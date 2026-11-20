import { resolveCanonicalQuestionTemplateId, questionTemplateIds as T } from "@/app/fragen/editor/templates/questionTemplateRegistry";
import { normalizeEvaluationText } from "./evaluationDetails";

function normalizeReviewText(value: string) { return normalizeEvaluationText(value).replace(/ß/g, "ss"); }

export type ReviewField = { id: number; label: string; answer: string | null; solutions: readonly string[] };
export type ReviewHintEntry = {
  quiz_fragen_id: number; team_antwort_id: number | null;
  templateId: string | null; antwortText: string | null; ausgewaehlteAntwort: string | null;
  istOffeneFrage: boolean; istUnbeantwortet: boolean; istNichtGespielt: boolean;
  bewertungAusstehend: boolean; bewertungsstatus: string; bewertungsquelle: string;
  reviewFields?: readonly ReviewField[]; reviewSolutions?: readonly string[];
  pixelStage?: number | null;
};
export type ReviewHint = { kind: "SAME" | "SIMILAR" | "SOLUTION" | "FACE_SWAP"; text: string; count?: number };

export function isOrdinaryReviewTemplate(entry: Pick<ReviewHintEntry, "templateId">) {
  const id = resolveCanonicalQuestionTemplateId(entry.templateId);
  return id !== T.memeCaption && id !== T.ordering;
}

export function filterManualReview<TEntry extends ReviewHintEntry>(entries: readonly TEntry[], options: {
  pendingOnly: boolean; hideClearClosedWrong: boolean;
}) {
  return entries.filter(entry => isOrdinaryReviewTemplate(entry)
    && (!options.pendingOnly || (!entry.istUnbeantwortet && !entry.istNichtGespielt && !entry.bewertungAusstehend
      && entry.bewertungsstatus === "REVIEW_REQUIRED" && entry.bewertungsquelle !== "MANUAL"))
    && (!options.hideClearClosedWrong || entry.istOffeneFrage || entry.bewertungsstatus !== "WRONG"
      || entry.bewertungsquelle !== "AUTO" || entry.bewertungAusstehend || entry.istUnbeantwortet));
}

/** One Unicode letter insertion/deletion/substitution; a hint, never an evaluator. */
export function isNearReviewText(left: string, right: string) {
  const a = [...normalizeReviewText(left)], b = [...normalizeReviewText(right)];
  if (a.length < 3 || b.length < 3 || a.length > 512 || b.length > 512
    || !/\p{L}/u.test(a.join("")) || !/\p{L}/u.test(b.join("")) || Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, differences = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++differences > 1) return false;
    if (a.length >= b.length) i++;
    if (b.length >= a.length) j++;
  }
  return differences + (i < a.length || j < b.length ? 1 : 0) === 1;
}

function short(text: string) { return text.length > 80 ? `${text.slice(0, 80)}…` : text; }

/** Only authorized, effective read-model contents enter here. No action/score writes. */
export function buildManualReviewHints(entries: readonly ReviewHintEntry[]) {
  const result = new Map<number, ReviewHint[]>();
  const buckets = new Map<string, Map<string, { text: string; ids: Set<number> }>>();
  const add = (id: number, hint: ReviewHint) => {
    const hints = result.get(id) ?? [];
    if (hints.length < 4 && !hints.some(h => h.kind === hint.kind && h.text === hint.text)) hints.push(hint);
    result.set(id, hints);
  };
  for (const entry of entries) {
    const id = entry.team_antwort_id;
    const template = resolveCanonicalQuestionTemplateId(entry.templateId);
    if (id === null || !isOrdinaryReviewTemplate(entry) || entry.istUnbeantwortet || entry.istNichtGespielt
      || entry.bewertungAusstehend || !entry.istOffeneFrage
      || [T.pixelImage, T.estimate, T.factsCountry, T.factsYear, T.pairs, T.pollSingle, T.pollMulti, T.pollScale].some(t => t === template)) continue;
    const fields = entry.reviewFields?.length ? entry.reviewFields : [{ id: 0, label: "Antwort",
      answer: entry.antwortText, solutions: entry.reviewSolutions ?? [] }];
    for (const field of fields) {
      if (!field.answer?.trim()) continue;
      const key = `${entry.quiz_fragen_id}:${field.id}:${entry.pixelStage ?? ""}`;
      const bucket = buckets.get(key) ?? new Map();
      const normalized = normalizeReviewText(field.answer);
      const group = bucket.get(normalized) ?? { text: field.answer, ids: new Set<number>() };
      group.ids.add(id); bucket.set(normalized, group); buckets.set(key, bucket);
      const near = field.solutions.find(solution => isNearReviewText(field.answer!, solution));
      if (near && !field.solutions.some(s => normalizeReviewText(s) === normalized)) add(id, {
        kind: "SOLUTION", text: `${field.label}: ähnlich zur hinterlegten Lösung „${short(near)}“ (ein Zeichen Unterschied).`,
      });
    }
    if (template === T.faceMorph && fields.length === 2) {
      const matches = (answer: string | null, field: ReviewField) => !!answer?.trim() && field.solutions.some(s =>
        normalizeReviewText(answer) === normalizeReviewText(s) || isNearReviewText(answer, s));
      const [a,b] = fields;
      const aOther = !matches(a.answer, a) && matches(a.answer, b);
      const bOther = !matches(b.answer, b) && matches(b.answer, a);
      if (aOther || bOther) add(id, { kind: "FACE_SWAP", text: aOther && bOther
        ? "FaceMorph: Antworten zu Person A und B möglicherweise vertauscht. Bitte beide Felder prüfen."
        : `FaceMorph: ${aOther ? a.label : b.label} passt möglicherweise zur anderen Person. Bitte Zuordnung prüfen.` });
    }
  }
  for (const bucket of buckets.values()) {
    const groups = [...bucket.values()];
    for (const group of groups) {
      if (group.ids.size > 1) for (const id of group.ids) add(id, { kind: "SAME", count: group.ids.size,
        text: `Gleicher Feldtext bei ${group.ids.size} sichtbaren Teamantworten (Groß-/Kleinschreibung unerheblich): „${short(group.text)}“.` });
    }
    let comparisons = 0;
    for (let i=0; i<groups.length; i++) for (let j=i+1; j<groups.length; j++) {
      if (comparisons++ >= 5000) break;
      if (!isNearReviewText(groups[i].text, groups[j].text)) continue;
      for (const [a,b] of [[groups[i],groups[j]],[groups[j],groups[i]]]) for (const id of a.ids) add(id, {
        kind: "SIMILAR", text: `Ähnlicher Feldtext in einer anderen sichtbaren Teamantwort: „${short(b.text)}“ (ein Zeichen Unterschied).`,
      });
    }
  }
  return result;
}
