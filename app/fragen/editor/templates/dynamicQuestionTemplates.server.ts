import "server-only";

import type { QuestionTemplate } from "../types";
import { prisma } from "@/app/lib/prisma";
import {
  buildDynamicQuestionTemplate,
  parseDynamicQuestionTemplateSnapshot,
} from "./dynamicQuestionTemplate";
import { resolveCanonicalQuestionTemplateId } from "./questionTemplateRegistry";

export async function loadDynamicQuestionTemplates(
  baseTemplates: QuestionTemplate[],
  currentSourceTemplateId?: number | null,
) {
  const rows = await prisma.frage_vorlagen.findMany({
    where: {
      art: "DYNAMIC",
      OR: [
        { status: "ACTIVE", ist_aktiv: true },
        ...(currentSourceTemplateId
          ? [{ vorlage_id: currentSourceTemplateId }]
          : []),
      ],
    },
    orderBy: [{ name: "asc" }, { vorlage_id: "asc" }],
    select: {
      vorlage_id: true,
      name: true,
      beschreibung: true,
      basis_code: true,
      konfiguration_json: true,
    },
  });

  return rows.flatMap((row) => {
    const snapshot = parseDynamicQuestionTemplateSnapshot(
      row.konfiguration_json,
    );
    const baseId = resolveCanonicalQuestionTemplateId(row.basis_code) ??
      "standard";
    const baseTemplate = baseTemplates.find(
      (template) => template.id === baseId,
    );
    if (!snapshot || !baseTemplate) return [];

    return [buildDynamicQuestionTemplate({
      id: row.vorlage_id,
      name: row.name,
      description: row.beschreibung,
      baseTemplate,
      snapshot,
    })];
  });
}
