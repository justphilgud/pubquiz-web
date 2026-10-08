import { createHash } from "node:crypto";
import { isExactAnagram, normalizeAnagramLetters, parseQuestionTemplateData } from "../../editor/templates/questionTemplateData";
import { calculateQuestionSimilarity, normalizeQuestionForSimilarity } from "../../editor/questionSimilarity";

export type EditorialCandidate = {
  externalId: string; templateId: string; question: string; solution: string; variants: string[];
  difficulty: "LEICHT" | "MITTEL" | "SCHWER"; categories: string[]; sources: string[];
  templateConfig: { templateData: unknown }; metadata: Record<string, unknown>;
};
export type EditorialSource = { provider: string; files: { name: string; sha256: string }[]; candidates: EditorialCandidate[] };
export type EditorialExistingQuestion = { id: number; question: string; templateId: string | null;
  solutions: string[]; templateData: unknown; metadata?: Record<string, unknown> };
export type EditorialDecision = { candidate: EditorialCandidate; action: "IMPORTIEREN" | "ÜBERSPRINGEN" | "MANUELL PRÜFEN";
  validation: string[]; duplicates: { questionId: number; reason: string }[]; existingQuestionId: number | null };
export const sha256 = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
export const candidateDigest = (candidate: EditorialCandidate) => sha256(JSON.stringify(candidate));
const textKey = (value: string) => normalizeQuestionForSimilarity(value);
const nameKey = (value: string) => value.normalize("NFKD").toLocaleLowerCase("de-DE").replace(/\p{M}/gu, "").replace(/[^\p{L}\p{N}]/gu, "");
const QUESTION_STOP_WORDS = new Set(["wie","viele","viel","welche","welcher","welches","betragt","betragen","lang","hoch","gross","laut","insgesamt","typisch","typische","typischen","erwachsene","erwachsenen","normalerweise","sind","eine","einer","einen","einem","eines","der","die","das","den","dem","des","und","oder","von","fur","mit","hat","haben","ist","werden","wird","zahl","anzahl","meter","kilometer","jahr","jahre"]);
function subjectTokens(question: string) {
  return new Set(textKey(question).split(" ").filter(t => t.length > 3 && !QUESTION_STOP_WORDS.has(t) && !/^\d+$/.test(t)).map(t => t.replace(/(ern|en|er|es|e|s)$/,"")));
}
function overlapsSubject(a: string, b: string) {
  const left=subjectTokens(a), right=subjectTokens(b);
  const shared=[...left].filter(t=>right.has(t)).length;
  return shared >= 2 && shared / Math.min(left.size,right.size) >= 0.5;
}

/** Adapter preserves approved wording and stores the complete original row for auditing. */
export function parseEditorialPool(fileName: string, raw: string): EditorialCandidate[] {
  const rows: unknown = JSON.parse(raw);
  if (!Array.isArray(rows) || rows.length > 1000) throw new Error("EDITORIAL_SOURCE_INVALID");
  return rows.map((row) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) throw new Error("EDITORIAL_ROW_INVALID");
    const r = row as Record<string, unknown>;
    const anagram = r.templateId === "anagramm";
    return {
      externalId: typeof r.id === "string" ? r.id : "",
      templateId: typeof r.templateId === "string" ? r.templateId : "",
      question: typeof r.question === "string" ? r.question : "",
      solution: anagram ? String(r.solution ?? "") : typeof r.referenceValue === "number" ? String(r.referenceValue) : "",
      variants: Array.isArray(r.variants) ? r.variants.filter((v): v is string => typeof v === "string") : [],
      difficulty: r.difficulty as EditorialCandidate["difficulty"],
      categories: Array.isArray(r.categories) ? r.categories.filter((v): v is string => typeof v === "string") : typeof r.category === "string" ? [r.category] : [],
      sources: [anagram ? r.identitySource : r.source].filter((v): v is string => typeof v === "string"),
      templateConfig: r.templateConfig as EditorialCandidate["templateConfig"],
      metadata: { sourceFile: fileName, original: r,
        ...(typeof r.measurementKey === "string" ? { measurementKey: r.measurementKey } : {}),
        ...(typeof r.referenceDate === "string" ? { referenceDate: r.referenceDate } : {}) },
    };
  });
}

export function validateEditorialCandidate(c: EditorialCandidate): string[] {
  const issues: string[] = [];
  if (!c.externalId || c.externalId.length > 128) issues.push("IMPORT_ID_INVALID");
  if (!c.question.trim() || !c.solution.trim()) issues.push("CONTENT_REQUIRED");
  if (!["LEICHT", "MITTEL", "SCHWER"].includes(c.difficulty)) issues.push("DIFFICULTY_INVALID");
  if (!c.categories.length || new Set(c.categories).size !== c.categories.length) issues.push("CATEGORIES_INVALID");
  if (!c.sources.length || c.sources.some(url => { try { return new URL(url).protocol !== "https:"; } catch { return true; } })) issues.push("SOURCE_INVALID");
  const data = parseQuestionTemplateData(c.templateConfig?.templateData, c.templateId, true);
  if (!data || !["anagramm", "schaetzfrage"].includes(c.templateId)) issues.push("TEMPLATE_INVALID");
  if (data?.kind === "ANAGRAM" && (data.name !== c.solution || !isExactAnagram(data.name, data.selectedSolution))) issues.push("ANAGRAM_INVALID");
  if (data?.kind === "ESTIMATE" && (data.correctValue === null || !Number.isFinite(data.correctValue) || String(data.correctValue) !== c.solution || !data.unit.trim())) issues.push("ESTIMATE_INVALID");
  if (c.variants.some(v => !v.trim())) issues.push("VARIANT_INVALID");
  return issues;
}

export function previewEditorialImport(source: EditorialSource, existing: EditorialExistingQuestion[],
  imported: Map<string, { questionId: number | null; digest: string }>, knownCategories: Set<string>): EditorialDecision[] {
  if (!source.provider || source.provider.length > 80 || !source.files.length || source.files.some(f => !/^[a-f0-9]{64}$/.test(f.sha256))) throw new Error("EDITORIAL_SOURCE_INVALID");
  if (new Set(source.candidates.map(c => c.externalId)).size !== source.candidates.length) throw new Error("EDITORIAL_SOURCE_DUPLICATE_ID");
  const accepted: EditorialExistingQuestion[] = [];
  return source.candidates.map((candidate, sourceIndex) => {
    const validation = validateEditorialCandidate(candidate);
    if (candidate.categories.some(c => !knownCategories.has(c))) validation.push("CATEGORY_NOT_ACTIVE");
    const prior = imported.get(candidate.externalId);
    if (prior) return { candidate, action: prior.digest === candidateDigest(candidate) && prior.questionId !== null ? "ÜBERSPRINGEN" : "MANUELL PRÜFEN",
      validation: prior.digest === candidateDigest(candidate) ? validation : [...validation, "IMPORT_ID_CONTENT_CONFLICT"], duplicates: [], existingQuestionId: prior.questionId };
    const data = parseQuestionTemplateData(candidate.templateConfig?.templateData, candidate.templateId, true);
    const duplicates: EditorialDecision["duplicates"] = [];
    for (const q of [...existing, ...accepted]) {
      let reason: string | null = null;
      if (textKey(candidate.question) === textKey(q.question)) reason = q.solutions.some(s => nameKey(s) === nameKey(candidate.solution)) ? "IDENTICAL_QUESTION" : "IDENTICAL_QUESTION_SOLUTION_REVIEW";
      const other = parseQuestionTemplateData(q.templateData, q.templateId, true);
      if (data?.kind === "ANAGRAM") {
        if (q.solutions.some(s => nameKey(s) === nameKey(data.name))) reason ??= "SAME_PERSON_OR_SOLUTION";
        if (other?.kind === "ANAGRAM" && normalizeAnagramLetters(other.selectedSolution) === normalizeAnagramLetters(data.selectedSolution) && reason !== "IDENTICAL_QUESTION") reason = nameKey(other.name) === nameKey(data.name) ? "SAME_ANAGRAM" : "SAME_ANAGRAM_PERSON_REVIEW";
      }
      if (data?.kind === "ESTIMATE" && other?.kind === "ESTIMATE" && data.unit.trim().toLocaleLowerCase("de-DE") === other.unit.trim().toLocaleLowerCase("de-DE") && data.correctValue === other.correctValue) reason ??= "SAME_ESTIMATE_VALUE_AND_UNIT";
      if (data?.kind === "ESTIMATE" && overlapsSubject(candidate.question,q.question)) reason ??= "ESTIMATE_SUBJECT_REVIEW";
      if (data?.kind === "ESTIMATE" && candidate.metadata.measurementKey && q.metadata?.measurementKey === candidate.metadata.measurementKey) {
        reason ??= candidate.metadata.referenceDate === q.metadata?.referenceDate ? "SAME_MEASUREMENT_PERIOD" : "MEASUREMENT_PERIOD_REVIEW";
      }
      // Anagram prompts share boilerplate; the person's name/stimulus is the content.
      if (data?.kind !== "ANAGRAM" && calculateQuestionSimilarity(candidate.question, q.question) >= 0.58) reason ??= "SEMANTIC_SIMILARITY";
      if (reason) duplicates.push({ questionId: q.id, reason });
    }
    const exact = duplicates.some(d => d.reason === "IDENTICAL_QUESTION" || d.reason === "SAME_ANAGRAM");
    const action = validation.length ? "MANUELL PRÜFEN" : exact ? "ÜBERSPRINGEN" : duplicates.length ? "MANUELL PRÜFEN" : "IMPORTIEREN";
    // Include every earlier source row to prevent hidden duplicates within one pool.
    accepted.push({ id: -(sourceIndex + 1), question: candidate.question, templateId: candidate.templateId, solutions: [candidate.solution, ...candidate.variants], templateData: candidate.templateConfig?.templateData, metadata: candidate.metadata });
    const exactExisting = duplicates.find(d => d.questionId > 0 && ["IDENTICAL_QUESTION", "SAME_ANAGRAM"].includes(d.reason));
    return { candidate, validation, duplicates, action, existingQuestionId: exactExisting?.questionId ?? null };
  });
}
