import type { Prisma } from "@/app/generated/prisma/client";
import type { AuthorizationActor } from "@/app/roles/roleAssignmentPolicy";
import { normalizeExactOpenAnswer } from "@/app/quiz/evaluation/evaluateBaseAnswer";
import { questionVisibilityWhere } from "../../editor/questionVisibility";
import { calculateQuestionSimilarity, normalizeQuestionForSimilarity } from "../../editor/questionSimilarity";
import { parsePairs } from "../../editor/templates/pairsTemplate";
import { questionTemplateIds, resolveCanonicalQuestionTemplateId } from "../../editor/templates/questionTemplateRegistry";
import type { ImportQuestion, ImportTarget, Issue } from "./format";
import { contentFingerprint } from "./parseImport";

export async function findImportDuplicates(
  db: Prisma.TransactionClient, actor: AuthorizationActor, target: ImportTarget,
  questions: ImportQuestion[], includeWarnings: boolean,
) {
  const errors: Issue[] = [];
  const warnings: Issue[] = [];
  const visible = questionVisibilityWhere(actor);
  const exact = new Map(questions.map(question => [contentFingerprint(question), question]));
  const targetNames = new Set(questions.map(question => normalizeExactOpenAnswer(question.text)));
  const exactMatches = new Map<number, number>();
  const scopeFilter: Prisma.fragenWhereInput = {
    geltungsbereich: target.scope,
    eventreihen: target.scope === "GLOBAL" ? { none: {} } : {
      every: { eventreihe_id: { in: target.eventSeriesIds } },
    },
  };
  if (target.scope === "EVENT_SERIES") {
    scopeFilter.AND = target.eventSeriesIds.map(eventreihe_id => ({ eventreihen: { some: { eventreihe_id } } }));
  }
  const where = { AND: [visible, scopeFilter], ist_archiviert: false };
  let after = 0;
  for (;;) {
    const page = await db.fragen.findMany({
      where: { ...where, fragen_id: { gt: after } },
      orderBy: { fragen_id: "asc" }, take: 500, select: { fragen_id: true, frage: true },
    });
    const ids = page.filter(row => targetNames.has(normalizeExactOpenAnswer(row.frage))).map(row => row.fragen_id);
    if (ids.length) {
      const candidates = await db.fragen.findMany({
        where: { ...where, fragen_id: { in: ids } },
        select: {
          fragen_id: true, frage: true, template_config_json: true, vorlage: { select: { code: true } },
          source_vorlage_id: true, _count: { select: { antwortfelder: true } },
          antworten: { select: { antwort: true, ist_richtig: true } },
        },
      });
      for (const candidate of candidates) {
        if (candidate.source_vorlage_id !== null || candidate._count.antwortfelder) continue;
        const templateId = resolveCanonicalQuestionTemplateId(candidate.vorlage?.code ?? null);
        if (templateId !== null && templateId !== questionTemplateIds.pairs) continue;
        const config = candidate.template_config_json;
        const pairs = templateId === questionTemplateIds.pairs && config && typeof config === "object" && !Array.isArray(config)
          ? parsePairs(config.templateData, true)?.pairs : undefined;
        if (templateId === questionTemplateIds.pairs && !pairs) continue;
        const question = exact.get(contentFingerprint({
          text: candidate.frage,
          type: pairs ? "Paare bilden" : candidate.antworten.some(answer => !answer.ist_richtig) ? "Geschlossen" : "Offen",
          pairs: (pairs ?? []).map(pair => ({ row: 0, ...pair })),
          answers: candidate.antworten.map(answer => ({ row: 0, text: answer.antwort, correct: answer.ist_richtig, info: "" })),
        }));
        if (question) exactMatches.set(question.row, candidate.fragen_id);
      }
    }
    if (page.length < 500) break;
    after = page[page.length - 1].fragen_id;
  }

  const recent = includeWarnings ? (await db.fragen.findMany({
    where: { AND: [visible], ist_archiviert: false }, orderBy: { updated_at: "desc" }, take: 200,
    select: { fragen_id: true, frage: true },
  })).map(candidate => ({ id: candidate.fragen_id, text: normalizeQuestionForSimilarity(candidate.frage) })) : [];
  for (const question of questions) {
    const location = { sheet: "Fragen", row: question.row, field: "Fragetext" } as const;
    const match = exactMatches.get(question.row);
    if (match) {
      errors.push({ ...location, message: `Inhalt identisch mit Frage #${match} im gewählten Zielbereich.` });
    } else if (includeWarnings && question.type !== "Paare bilden") {
      const query = normalizeQuestionForSimilarity(question.text);
      if (query.length < 12) continue;
      const earlier = questions.find(candidate => candidate.row < question.row &&
        candidate.type === question.type &&
        calculateQuestionSimilarity(query, normalizeQuestionForSimilarity(candidate.text)) >= 0.58);
      if (earlier) {
        warnings.push({ ...location, message: `Ähnlicher Fragetext in Zeile ${earlier.row} (${earlier.key}). Bitte prüfen.` });
      }
      let best: { id: number; score: number } | undefined;
      for (const candidate of recent) {
        const score = calculateQuestionSimilarity(query, candidate.text);
        if (score >= 0.58 && (!best || score > best.score)) best = { id: candidate.id, score };
      }
      if (best) warnings.push({ ...location, message: `Ähnlicher Fragetext bei Frage #${best.id}. Bitte prüfen.` });
    }
  }
  return { errors, warnings };
}
