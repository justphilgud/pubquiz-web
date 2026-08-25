"use server";

import { randomUUID } from "node:crypto";
import { copy, del, head } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin, requireQuestionEditor } from "@/app/lib/permissions";
import { isAdministrator } from "@/app/roles/roleAssignmentPolicy";
import { canEditScopedQuestion } from "../questionScopePolicy";
import { loadQuestionForEditor } from "../questionEditorData";
import {
  buildMediaUploadPathname,
  getMediaVerificationServerConfig,
} from "../mediaUploadEnvironment";
import { getQuestionMediaFileName } from "../questionMedia";
import {
  getDynamicTemplateAnswerSourceKey,
  getDynamicQuestionTemplateInitialStatus,
  type DynamicQuestionTemplateRole,
  type DynamicQuestionTemplateSnapshot,
  type PersistedDynamicQuestionTemplateRuleSelection,
} from "./dynamicQuestionTemplate";
import { getQuestionTemplateDefinition } from "./questionTemplates";

export type DynamicQuestionTemplateActionResult =
  | { ok: true; status: "ACTIVE" | "PENDING"; name: string }
  | { ok: false; message: string };

function normalizeMetadata(name: string, description: string) {
  const normalizedName = name.trim().replace(/\s+/g, " ");
  const normalizedDescription = description.trim();
  if (normalizedName.length < 3 || normalizedName.length > 120) {
    throw new Error("Der Name muss zwischen 3 und 120 Zeichen lang sein.");
  }
  if (normalizedDescription.length > 500) {
    throw new Error("Die Beschreibung darf höchstens 500 Zeichen lang sein.");
  }
  return { name: normalizedName, description: normalizedDescription };
}

function hasValidRoles(rules: PersistedDynamicQuestionTemplateRuleSelection) {
  const roles: readonly DynamicQuestionTemplateRole[] = [
    "FIXED",
    "REQUIRED_NEW",
    "EXCLUDED",
  ];
  return roles.includes(rules.questionText) &&
    rules.media.every((rule) => roles.includes(rule.role)) &&
    rules.answers.every((rule) => roles.includes(rule.role));
}

const CREATION_REQUEST_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function resultFromExistingTemplate(existing: {
  source_fragen_id: number | null;
  created_by_user_id: number | null;
  status: "ACTIVE" | "PENDING" | "REJECTED" | "ARCHIVED";
  name: string;
}, questionId: number, userId: number): DynamicQuestionTemplateActionResult | null {
  if (existing.source_fragen_id !== questionId || existing.created_by_user_id !== userId) {
    return null;
  }
  if (existing.status !== "ACTIVE" && existing.status !== "PENDING") {
    return null;
  }
  return {
    ok: true,
    status: existing.status,
    name: existing.name,
  };
}

async function copyFixedMedium(url: string) {
  const config = getMediaVerificationServerConfig();
  const metadata = await head(url, config.blobAuthentication);
  const requiredPrefix = `${config.environmentPrefix}/question-media/`;
  if (!metadata.pathname.startsWith(requiredPrefix)) {
    throw new Error(
      "Nur ein verifiziertes Fragenmedium dieser Umgebung kann fest übernommen werden.",
    );
  }
  const sourceName = getQuestionMediaFileName(metadata.pathname);
  const extension = sourceName.includes(".")
    ? `.${sourceName.split(".").pop()!.toLowerCase()}`
    : "";
  return copy(
    url,
    buildMediaUploadPathname("template-media", [
      `${randomUUID()}${extension}`,
    ]),
    {
      access: "public",
      addRandomSuffix: false,
      token: config.blobAuthentication.token,
    },
  );
}

export async function createDynamicQuestionTemplate(input: {
  questionId: number;
  requestId: string;
  name: string;
  description: string;
  rules: PersistedDynamicQuestionTemplateRuleSelection;
}): Promise<DynamicQuestionTemplateActionResult> {
  const session = await requireQuestionEditor();
  const copiedUrls: string[] = [];
  let creationCode: string | null = null;
  let templateCreated = false;

  try {
    if (!Number.isInteger(input.questionId) || input.questionId <= 0 ||
      !CREATION_REQUEST_ID_PATTERN.test(input.requestId) ||
      !input.rules || !hasValidRoles(input.rules)) {
      return { ok: false, message: "Die Vorlagenkonfiguration ist ungültig." };
    }
    const metadata = normalizeMetadata(input.name, input.description);
    const loaded = await loadQuestionForEditor(input.questionId);
    if (!loaded || !canEditScopedQuestion(session.actor, loaded.access)) {
      return { ok: false, message: "Diese Frage darf nicht als Vorlage verwendet werden." };
    }
    creationCode = `dynamic_${input.requestId}`;
    const existing = await prisma.frage_vorlagen.findUnique({
      where: { code: creationCode },
      select: {
        source_fragen_id: true,
        created_by_user_id: true,
        status: true,
        name: true,
      },
    });
    if (existing) {
      return resultFromExistingTemplate(
        existing,
        input.questionId,
        session.actor.userId,
      ) ?? { ok: false, message: "Der Speicherauftrag ist bereits vergeben." };
    }

    const mediaById = new Map(
      loaded.draft.questionMedia.flatMap((medium) =>
        medium.existingMediaId === null ? [] : [[medium.existingMediaId, medium] as const]),
    );
    const answerByKey = new Map(
      loaded.draft.answers.map((answer) => [
        getDynamicTemplateAnswerSourceKey(answer),
        answer,
      ]),
    );
    if (input.rules.media.length !== mediaById.size ||
      input.rules.answers.length !== answerByKey.size ||
      new Set(input.rules.media.map((rule) => rule.sourceMediaId)).size !== mediaById.size ||
      new Set(input.rules.answers.map((rule) => rule.sourceKey)).size !== answerByKey.size ||
      input.rules.media.some((rule) => !mediaById.has(rule.sourceMediaId)) ||
      input.rules.answers.some((rule) => !answerByKey.has(rule.sourceKey))) {
      return { ok: false, message: "Die Frage wurde zwischenzeitlich geändert. Öffne den Dialog erneut." };
    }

    const baseCode = loaded.draft.templateId ?? "standard";
    if (!getQuestionTemplateDefinition(baseCode)) {
      return { ok: false, message: "Die strukturelle Ausgangsvorlage ist unbekannt." };
    }
    if ([...mediaById.values()].some((medium) =>
      !medium.mediaType || !medium.url
    )) {
      return { ok: false, message: "Ein Fragenmedium ist nicht vollständig gespeichert." };
    }

    const media: DynamicQuestionTemplateSnapshot["media"] = [];
    for (const rule of input.rules.media) {
      const source = mediaById.get(rule.sourceMediaId)!;
      let fixedUrl: string | undefined;
      if (rule.role === "FIXED") {
        const copied = await copyFixedMedium(source.url!);
        fixedUrl = copied.url;
        copiedUrls.push(copied.url);
      }
      media.push({
        slotKey: source.slotKey,
        mediaType: source.mediaType!,
        role: rule.role,
        ...(fixedUrl ? { fixedUrl } : {}),
      });
    }

    const snapshot: DynamicQuestionTemplateSnapshot = {
      version: 1,
      questionText: {
        role: input.rules.questionText,
        value: loaded.draft.questionText,
      },
      media,
      answers: input.rules.answers.map((rule) => {
        const source = answerByKey.get(rule.sourceKey)!;
        return {
          sourceKey: rule.sourceKey,
          fieldLabel: source.fieldLabel,
          isRequired: source.isRequired,
          isCorrect: source.isCorrect,
          role: rule.role,
          text: source.text,
          additionalInfo: source.additionalInfo,
        };
      }),
      templateConfig: structuredClone(loaded.draft.templateConfig),
    };
    const status = getDynamicQuestionTemplateInitialStatus(
      isAdministrator(session.actor),
    );
    await prisma.frage_vorlagen.create({
      data: {
        code: creationCode,
        name: metadata.name,
        beschreibung: metadata.description || null,
        slide_typ: "DYNAMIC",
        ist_aktiv: status === "ACTIVE",
        art: "DYNAMIC",
        status,
        basis_code: baseCode,
        konfiguration_json: snapshot,
        source_fragen_id: input.questionId,
        created_by_user_id: session.actor.userId,
        ...(status === "ACTIVE"
          ? {
              reviewed_by_user_id: session.actor.userId,
              reviewed_at: new Date(),
            }
          : {}),
      },
    });
    templateCreated = true;
    revalidatePath("/fragen/editor");
    revalidatePath(`/fragen/editor/${input.questionId}`);
    revalidatePath("/admin/fragenvorlagen");
    return { ok: true, status, name: metadata.name };
  } catch (error) {
    if (!templateCreated && copiedUrls.length > 0) {
      try {
        await del(copiedUrls, getMediaVerificationServerConfig().blobAuthentication);
      } catch (cleanupError) {
        console.error("Verwaiste Vorlagenmedien konnten nicht bereinigt werden", cleanupError);
      }
    }
    if (creationCode) {
      try {
        const existing = await prisma.frage_vorlagen.findUnique({
          where: { code: creationCode },
          select: {
            source_fragen_id: true,
            created_by_user_id: true,
            status: true,
            name: true,
          },
        });
        const existingResult = existing
          ? resultFromExistingTemplate(
              existing,
              input.questionId,
              session.actor.userId,
            )
          : null;
        if (existingResult) return existingResult;
      } catch (lookupError) {
        console.error("Vorhandener Vorlagenauftrag konnte nicht geprüft werden", lookupError);
      }
    }
    console.error("Spezialfragenvorlage konnte nicht erstellt werden", error);
    return {
      ok: false,
      message: error instanceof Error
        ? error.message
        : "Die Spezialfragenvorlage konnte nicht gespeichert werden.",
    };
  }
}

export async function reviewDynamicQuestionTemplate(input: {
  templateId: number;
  decision: "APPROVE" | "REJECT";
  feedback?: string;
}): Promise<{ ok: boolean; message: string }> {
  const session = await requireAdmin();
  if (!Number.isInteger(input.templateId) || input.templateId <= 0 ||
    (input.decision !== "APPROVE" && input.decision !== "REJECT")) {
    return { ok: false, message: "Die Freigabeanfrage ist ungültig." };
  }
  const feedback = input.feedback?.trim() || null;
  if ((feedback?.length ?? 0) > 500) {
    return { ok: false, message: "Die Rückmeldung darf höchstens 500 Zeichen lang sein." };
  }
  const result = await prisma.frage_vorlagen.updateMany({
    where: {
      vorlage_id: input.templateId,
      art: "DYNAMIC",
      status: "PENDING",
    },
    data: {
      status: input.decision === "APPROVE" ? "ACTIVE" : "REJECTED",
      ist_aktiv: input.decision === "APPROVE",
      reviewed_by_user_id: session.actor.userId,
      reviewed_at: new Date(),
      review_feedback: feedback,
    },
  });
  if (result.count !== 1) {
    return { ok: false, message: "Die Vorlage wurde bereits bearbeitet oder nicht gefunden." };
  }
  revalidatePath("/fragen/editor");
  revalidatePath("/admin/fragenvorlagen");
  return {
    ok: true,
    message: input.decision === "APPROVE"
      ? "Die Spezialfragenvorlage ist jetzt aktiv."
      : "Der Vorlagenvorschlag wurde abgelehnt.",
  };
}
