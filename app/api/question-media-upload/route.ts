import { issueSignedToken } from "@vercel/blob";
import { handleUploadPresigned } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/app/lib/prisma";
import {
  getMediaUploadServerConfig,
  getMediaUploadFailureDetails,
  logMediaUploadFailure,
} from "@/app/fragen/editor/mediaUploadEnvironment";
import {
  isAllowedQuestionMediaPathname,
} from "@/app/fragen/editor/questionMedia";
import type { QuestionMediaType } from "@/app/fragen/editor/types";
import type { MediaSlotKey } from "@/app/fragen/editor/types";
import { getMediaSlotDefinition, isMediaSlotKey } from "@/app/fragen/editor/mediaSlots";
import { questionTemplateDefinitions } from "@/app/fragen/editor/templates/questionTemplates";
import { findQuestionTemplate, resolveCanonicalQuestionTemplateId } from "@/app/fragen/editor/templates/questionTemplateRegistry";
import { getQuestionActor, requireQuestionAccess } from "@/app/fragen/editor/questionAccess.server";
import {
  hasAnyEditorialAssignment,
  isAdministrator,
} from "@/app/roles/roleAssignmentPolicy";
import {
  isAllowedPresentationTemplateAssetPathname,
  isPresentationTemplateAssetRole,
  presentationTemplateAssetUploadRule,
  type PresentationTemplateAssetRole,
} from "@/app/rendering/presentationTemplates/presentationTemplateAssets";
import { requirePresentationTemplateUploadContext } from "@/app/rendering/presentationTemplates/presentationTemplateUpload.server";

type UploadContext =
  | {
      target: "TEMPLATE";
      templateId: string;
      assetRole: PresentationTemplateAssetRole;
    }
  | {
      target: "QUESTION";
      questionId: number | null;
      mediaType: QuestionMediaType;
      slotKey: MediaSlotKey;
      templateId: string | null;
    }
  | {
      target: "ANSWER";
      questionId: number | null;
      mediaType: "IMAGE";
      slotKey: "answer_image";
      answerTarget:
        | { type: "CLASSIC"; answerId: number | null }
        | { type: "LABELED_FIELD"; answerFieldId: number | null };
    };

type UploadErrorResponse = {
  ok: false;
  code: string;
  phase: string;
  message: string;
};

function uploadErrorResponse(
  code: string,
  phase: string,
  message: string,
  status: number,
) {
  return NextResponse.json<UploadErrorResponse>(
    { ok: false, code, phase, message },
    { status },
  );
}

function parseOptionalId(value: unknown) {
  if (value === null) {
    return null;
  }

  if (!Number.isInteger(value) || Number(value) <= 0) {
    throw new Error("Uploadkontext ist ungültig.");
  }

  return Number(value);
}

function parseUploadContext(clientPayload: string | null): UploadContext {
  if (!clientPayload) {
    throw new Error("Uploadkontext fehlt.");
  }

  const value: unknown = JSON.parse(clientPayload);

  if (!value || typeof value !== "object") {
    throw new Error("Uploadkontext ist ungültig.");
  }

  const target = Reflect.get(value, "target");
  if (target === "TEMPLATE") {
    const templateId = Reflect.get(value, "templateId");
    const assetRole = Reflect.get(value, "assetRole");
    if (
      typeof templateId !== "string" ||
      !/^[a-z][a-z0-9-]{2,63}$/.test(templateId) ||
      !isPresentationTemplateAssetRole(assetRole)
    ) {
      throw new Error("Template-Uploadkontext ist ungültig.");
    }
    return { target, templateId, assetRole };
  }

  const questionId = Reflect.get(value, "questionId");
  const mediaType = Reflect.get(value, "mediaType");
  const slotKey = Reflect.get(value, "slotKey");
  const rawTemplateId = Reflect.get(value, "templateId");

  if (
    (target !== "QUESTION" && target !== "ANSWER") ||
    (mediaType !== "IMAGE" && mediaType !== "AUDIO" && mediaType !== "VIDEO") ||
    !isMediaSlotKey(slotKey)
  ) {
    throw new Error("Uploadkontext ist ungültig.");
  }

  const parsedQuestionId = parseOptionalId(questionId);

  if (target === "QUESTION") {
    if (rawTemplateId !== null && typeof rawTemplateId !== "string") throw new Error("Vorlagenkontext ist ungültig.");
    const definition = getMediaSlotDefinition(slotKey);
    if (definition.scope !== "QUESTION" || definition.mediaType !== mediaType) throw new Error("Medienslot ist ungültig.");
    if (!definition.manualUploadAllowed) throw new Error("Dieser Medienslot darf nicht manuell hochgeladen werden.");
    return { target, questionId: parsedQuestionId, mediaType, slotKey, templateId: resolveCanonicalQuestionTemplateId(rawTemplateId) };
  }

  if (mediaType !== "IMAGE" || slotKey !== "answer_image") {
    throw new Error("Für Antworten sind nur Bilder erlaubt.");
  }

  const answerTarget = Reflect.get(value, "answerTarget");

  if (!answerTarget || typeof answerTarget !== "object") {
    throw new Error("Antwortzuordnung fehlt.");
  }

  const answerTargetType = Reflect.get(answerTarget, "type");

  if (answerTargetType === "CLASSIC") {
    return {
      target,
      questionId: parsedQuestionId,
      mediaType,
      slotKey,
      answerTarget: {
        type: answerTargetType,
        answerId: parseOptionalId(Reflect.get(answerTarget, "answerId")),
      },
    };
  }

  if (answerTargetType === "LABELED_FIELD") {
    return {
      target,
      questionId: parsedQuestionId,
      mediaType,
      slotKey,
      answerTarget: {
        type: answerTargetType,
        answerFieldId: parseOptionalId(
          Reflect.get(answerTarget, "answerFieldId"),
        ),
      },
    };
  }

  throw new Error("Antwortzuordnung ist ungültig.");
}

export async function POST(request: Request) {
  let phase = "authentication";

  try {
    const session = await auth();

    if (!session?.user?.id) {
      const code = "NOT_AUTHENTICATED";
      const message = "Nicht angemeldet.";
      logMediaUploadFailure(phase, new Error(message), code);
      return uploadErrorResponse(code, phase, message, 401);
    }

    phase = "user-authorization";
    const user = await prisma.users.findUnique({
      where: { id: Number(session.user.id) },
      select: { is_active: true, must_change_password: true },
    });

    if (!user?.is_active || user.must_change_password) {
      const code = "USER_NOT_AUTHORIZED";
      const message = "Upload nicht erlaubt.";
      logMediaUploadFailure(phase, new Error(message), code);
      return uploadErrorResponse(code, phase, message, 403);
    }

    phase = "configuration";
    const uploadConfig = getMediaUploadServerConfig();
    phase = "request-processing";
    const body = await request.json();
    const jsonResponse = await handleUploadPresigned({
      body,
      request,
      webhookPublicKey: uploadConfig.webhookPublicKey,
      getSignedToken: async (pathname, clientPayload) => {
        phase = "context-authorization";
        const context = parseUploadContext(clientPayload);
        if (context.target === "TEMPLATE") {
          requirePresentationTemplateUploadContext();
          const actor = await getQuestionActor(session);
          if (!isAdministrator(actor)) {
            throw new Error("Template-Assets dürfen nur von Administratoren hochgeladen werden.");
          }
          const template = await prisma.presentation_templates.findUnique({
            where: { presentation_template_id: context.templateId },
            select: { status: true, ist_systemtemplate: true },
          });
          if (!template || template.ist_systemtemplate || template.status !== "DRAFT") {
            throw new Error("Template-Assets dürfen nur zu bearbeitbaren Entwürfen hochgeladen werden.");
          }
          if (
            !isAllowedPresentationTemplateAssetPathname(
              pathname,
              uploadConfig.environmentPrefix,
              context.templateId,
              context.assetRole,
            )
          ) {
            throw new Error("Template-Assetpfad oder Dateiendung ist ungültig.");
          }
          const validUntil = Date.now() + 10 * 60 * 1000;
          phase = "signed-token";
          const token = await issueSignedToken({
            ...uploadConfig.blobAuthentication,
            pathname,
            operations: ["put"],
            allowedContentTypes: [...presentationTemplateAssetUploadRule.mimeTypes],
            maximumSizeInBytes: presentationTemplateAssetUploadRule.maximumSizeInBytes,
            validUntil,
          });
          return {
            token,
            urlOptions: {
              allowedContentTypes: [...presentationTemplateAssetUploadRule.mimeTypes],
              maximumSizeInBytes: presentationTemplateAssetUploadRule.maximumSizeInBytes,
              addRandomSuffix: true,
              validUntil,
            },
          };
        }
        let effectiveTemplateId = context.target === "QUESTION" ? context.templateId : null;

        if (context.questionId === null) {
          const actor = await getQuestionActor(session);
          if (!hasAnyEditorialAssignment(actor)) {
            throw new Error("Frage darf nicht erstellt werden.");
          }
        } else {
          await requireQuestionAccess(context.questionId, "EDIT");
          const question = await prisma.fragen.findUnique({
            where: { fragen_id: context.questionId },
            select: {
              created_by_user_id: true,
              review_status: true,
              ist_archiviert: true,
              vorlage: { select: { code: true } },
            },
          });

          if (!question) {
            throw new Error("Frage darf nicht bearbeitet werden.");
          }

          effectiveTemplateId = resolveCanonicalQuestionTemplateId(question.vorlage?.code ?? null);

          if (context.target === "ANSWER") {
            const belongsToQuestion =
              context.answerTarget.type === "CLASSIC"
                ? context.answerTarget.answerId === null ||
                  (await prisma.antworten.count({
                    where: {
                      antwort_id: context.answerTarget.answerId,
                      fragen_id: context.questionId,
                    },
                  })) === 1
                : context.answerTarget.answerFieldId === null ||
                  (await prisma.frage_antwortfelder.count({
                    where: {
                      antwortfeld_id: context.answerTarget.answerFieldId,
                      fragen_id: context.questionId,
                    },
                  })) === 1;

            if (!belongsToQuestion) {
              throw new Error("Antwort gehört nicht zu dieser Frage.");
            }
          }
        }

        if (
          context.target === "ANSWER" &&
          context.questionId === null &&
          ((context.answerTarget.type === "CLASSIC" &&
            context.answerTarget.answerId !== null) ||
            (context.answerTarget.type === "LABELED_FIELD" &&
              context.answerTarget.answerFieldId !== null))
        ) {
          throw new Error("Antwortzuordnung ist ungültig.");
        }

        if (context.target === "QUESTION") {
          const template = findQuestionTemplate(questionTemplateDefinitions, effectiveTemplateId ?? "standard");
          if (!template?.mediaSlots.some((slot) => slot.slotKey === context.slotKey)) {
            throw new Error("Medienslot ist für diese Vorlage nicht erlaubt.");
          }
        }

        if (
          !isAllowedQuestionMediaPathname(
            pathname,
            context.mediaType,
            context.target,
            uploadConfig.environmentPrefix,
            context.slotKey,
          )
        ) {
          throw new Error("Dateipfad oder Dateiendung ist ungültig.");
        }

        const slotDefinition = getMediaSlotDefinition(context.slotKey);
        const validUntil = Date.now() + 10 * 60 * 1000;
        phase = "signed-token";
        const token = await issueSignedToken({
          ...uploadConfig.blobAuthentication,
          pathname,
          operations: ["put"],
          allowedContentTypes: [...slotDefinition.allowedMimeTypes],
          maximumSizeInBytes: slotDefinition.maxFileSizeBytes,
          validUntil,
        });

        return {
          token,
          urlOptions: {
            allowedContentTypes: [...slotDefinition.allowedMimeTypes],
            maximumSizeInBytes: slotDefinition.maxFileSizeBytes,
            addRandomSuffix: true,
            validUntil,
          },
        };
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    const details = getMediaUploadFailureDetails(phase, error);
    logMediaUploadFailure(phase, error, details.code);
    const status =
      phase === "request-processing" || phase === "context-authorization"
        ? 400
        : 500;

    return uploadErrorResponse(
      details.code,
      phase,
      details.publicMessage,
      status,
    );
  }
}
