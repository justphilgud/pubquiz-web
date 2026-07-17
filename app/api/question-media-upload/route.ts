import { issueSignedToken } from "@vercel/blob";
import { handleUploadPresigned } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  canCreateQuestions,
  canEditQuestion,
} from "@/app/lib/permissions";
import { prisma } from "@/app/lib/prisma";
import {
  getMediaUploadServerConfig,
  getMediaUploadFailureDetails,
  logMediaUploadFailure,
} from "@/app/fragen/editor/mediaUploadEnvironment";
import {
  isAllowedQuestionMediaPathname,
  questionMediaRules,
} from "@/app/fragen/editor/questionMedia";
import type { QuestionMediaType } from "@/app/fragen/editor/types";

type UploadContext =
  | {
      target: "QUESTION";
      questionId: number | null;
      mediaType: QuestionMediaType;
    }
  | {
      target: "ANSWER";
      questionId: number | null;
      mediaType: "IMAGE";
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

  const questionId = Reflect.get(value, "questionId");
  const mediaType = Reflect.get(value, "mediaType");
  const target = Reflect.get(value, "target");

  if (
    (target !== "QUESTION" && target !== "ANSWER") ||
    (mediaType !== "IMAGE" && mediaType !== "AUDIO")
  ) {
    throw new Error("Uploadkontext ist ungültig.");
  }

  const parsedQuestionId = parseOptionalId(questionId);

  if (target === "QUESTION") {
    return { target, questionId: parsedQuestionId, mediaType };
  }

  if (mediaType !== "IMAGE") {
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

        if (context.questionId === null) {
          if (!canCreateQuestions(session)) {
            throw new Error("Frage darf nicht erstellt werden.");
          }
        } else {
          const question = await prisma.fragen.findUnique({
            where: { fragen_id: context.questionId },
            select: {
              created_by_user_id: true,
              review_status: true,
              ist_archiviert: true,
            },
          });

          if (
            !question ||
            !canEditQuestion(session, {
              createdByUserId: question.created_by_user_id,
              reviewStatus: question.review_status,
              isArchived: question.ist_archiviert,
            })
          ) {
            throw new Error("Frage darf nicht bearbeitet werden.");
          }

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

        if (
          !isAllowedQuestionMediaPathname(
            pathname,
            context.mediaType,
            context.target,
            uploadConfig.environmentPrefix,
          )
        ) {
          throw new Error("Dateipfad oder Dateiendung ist ungültig.");
        }

        const rule = questionMediaRules[context.mediaType];
        const validUntil = Date.now() + 10 * 60 * 1000;
        phase = "signed-token";
        const token = await issueSignedToken({
          ...uploadConfig.blobAuthentication,
          pathname,
          operations: ["put"],
          allowedContentTypes: [...rule.mimeTypes],
          maximumSizeInBytes: rule.maximumSizeInBytes,
          validUntil,
        });

        return {
          token,
          urlOptions: {
            allowedContentTypes: [...rule.mimeTypes],
            maximumSizeInBytes: rule.maximumSizeInBytes,
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
