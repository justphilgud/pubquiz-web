import { questionTemplateIds as T, resolveCanonicalQuestionTemplateId } from "@/app/fragen/editor/templates/questionTemplateRegistry";
import { normalizeQuizMode, type QuizMode } from "./quizMode";

export type BalanceStatus = "RED" | "YELLOW" | "GREEN" | "NONE";
export const CATEGORY_BALANCE_LIMITS = { greenMax: 20, yellowMax: 30 } as const;
export const CATEGORY_BALANCE_RULE = {
  red: `>${CATEGORY_BALANCE_LIMITS.yellowMax} %`,
  yellow: `>${CATEGORY_BALANCE_LIMITS.greenMax}–${CATEGORY_BALANCE_LIMITS.yellowMax} %`,
  green: `≤${CATEGORY_BALANCE_LIMITS.greenMax} %`,
};
export type BalanceGroup = "open" | "closed" | "audio" | "facts" | "image" | "creative" | "ordering" | "pairs" | "trueFalse" | "estimate" | "poll";
type RegistryId = (typeof T)[keyof typeof T];
/** Exhaustive: a new registry template must receive a deliberate planning policy. */
export const BALANCE_TEMPLATE_GROUPS = {
  [T.standard]: "open", [T.multipleChoice]: "closed",
  [T.music]: "audio", [T.musicReverse]: "audio", [T.musicEightBit]: "audio", [T.translationReadAloud]: "audio",
  [T.factsPerson]: "facts", [T.factsYear]: "facts", [T.factsCountry]: "facts", [T.factsText]: "facts",
  [T.faceMorph]: "image", [T.pixelImage]: "image", [T.artwork]: "image",
  [T.anagram]: "creative", [T.memeCaption]: "creative", [T.googleReviews]: "creative",
  [T.ordering]: "ordering", [T.pairs]: "pairs", [T.trueFalse]: "trueFalse",
  [T.estimate]: "estimate", [T.pollSingle]: "poll", [T.pollMulti]: "poll", [T.pollScale]: "poll",
} satisfies Record<RegistryId, BalanceGroup>;

export const BALANCE_RULES: { id: BalanceGroup; label: string; red: string; yellow: string; green: string }[] = [
  { id: "open", label: "Offene Fragen", red: "<5 % oder >25 %", yellow: "5–<10 % oder >20–25 %", green: "10–20 %" },
  { id: "closed", label: "Geschlossene Fragen", red: "<10 % oder >60 %", yellow: ">50–60 %", green: "10–50 %" },
  { id: "audio", label: "Audio-Fragen", red: "0 Fragen", yellow: "—", green: "≥1 Frage" },
  ...([ ["facts", "Fakten"], ["image", "Bild"], ["creative", "Kreativität"], ["ordering", "Reihenfolge"], ["pairs", "Paare"], ["trueFalse", "Wahr oder Falsch"] ] as const)
    .map(([id, label]) => ({ id, label, red: "0 Fragen", yellow: "—", green: "≥1 Frage" })),
  { id: "estimate", label: "Schätzfrage", red: "—", yellow: "—", green: "—" },
  { id: "poll", label: "Umfragen", red: "—", yellow: "—", green: "—" },
];

export type BalanceQuestion = {
  sectionId: number | null; templateId: string | null;
  answerMode: "OPEN" | "CLOSED" | "UNCLASSIFIED";
  categoryIds: readonly number[];
};
export type BalanceSection = { id: number; title: string };
export type BalanceCategory = { id: number; name: string; availableForSearch?: boolean };

export function questionBalanceGroup(question: BalanceQuestion): BalanceGroup | "unknown" {
  const id = resolveCanonicalQuestionTemplateId(question.templateId) ?? T.standard;
  if (id === T.standard) return question.answerMode === "CLOSED" ? "closed" : "open";
  return Object.hasOwn(BALANCE_TEMPLATE_GROUPS, id) ? BALANCE_TEMPLATE_GROUPS[id as RegistryId] : "unknown";
}

/** Compare exact counts, never rounded display percentages. */
export function balanceStatus(group: BalanceGroup | "category", count: number, total: number): BalanceStatus {
  if (!total || group === "estimate" || group === "poll" || (group === "category" && !count)) return "NONE";
  const p = count * 100;
  if (group === "category") return p > CATEGORY_BALANCE_LIMITS.yellowMax * total ? "RED" : p > CATEGORY_BALANCE_LIMITS.greenMax * total ? "YELLOW" : "GREEN";
  if (group === "open") return p < 5 * total || p > 25 * total ? "RED" : p < 10 * total || p > 20 * total ? "YELLOW" : "GREEN";
  if (group === "closed") return p < 10 * total || p > 60 * total ? "RED" : p > 50 * total ? "YELLOW" : "GREEN";
  return count ? "GREEN" : "RED";
}

export function worstBalanceStatus(statuses: readonly BalanceStatus[]): BalanceStatus {
  return statuses.includes("RED") ? "RED" : statuses.includes("YELLOW") ? "YELLOW" : statuses.includes("GREEN") ? "GREEN" : "NONE";
}

export function balanceSearchHref(input: { templateIds?: readonly string[]; categoryId?: number; answerMode?: "open" | "closed"; eventSeriesId?: number }) {
  const params = new URLSearchParams({ contentType: "QUESTION", status: "ACTIVE" });
  for (const id of new Set(input.templateIds)) params.append("template", id);
  if (input.categoryId) params.set("categoryId", String(input.categoryId));
  if (input.answerMode) params.set("answerMode", input.answerMode);
  if (input.eventSeriesId) params.set("eventSeriesId", String(input.eventSeriesId));
  return `/fragen?${params}`;
}

function templatesForGroup(group: BalanceGroup) {
  if (group === "open") return [T.standard];
  if (group === "closed") return [T.standard, T.multipleChoice];
  return Object.entries(BALANCE_TEMPLATE_GROUPS).filter(([, value]) => value === group).map(([id]) => id);
}

export function getQuizBalance(input: { questions: readonly BalanceQuestion[]; sections: readonly BalanceSection[]; categories: readonly BalanceCategory[]; mode?: QuizMode }) {
  const mode = normalizeQuizMode(input.mode);
  const blocks = input.sections.map(section => {
    const questions = input.questions.filter(q => q.sectionId === section.id);
    const categorizedTotal = questions.filter(q => q.categoryIds.some(id => input.categories.some(c => c.id === id))).length;
    const groups = BALANCE_RULES.map(rule => {
      const count = questions.filter(q => questionBalanceGroup(q) === rule.id).length;
      const upperGreen = rule.id === "open" ? 20 : rule.id === "closed" ? 50 : null;
      return { ...rule, count, status: balanceStatus(rule.id, count, questions.length), overrepresented: upperGreen !== null && count * 100 > upperGreen * questions.length };
    });
    const categories = input.categories.map(category => {
      const count = questions.filter(q => q.categoryIds.includes(category.id)).length;
      return { ...category, count, status: mode === "THEMED" ? "NONE" as const : balanceStatus("category", count, categorizedTotal) };
    });
    const displayedCategories = categories.filter(category => category.count > 0);
    const overCategory = displayedCategories.some(c => c.status === "RED" || c.status === "YELLOW");
    const alternative = overCategory ? categories.filter(c => c.availableForSearch !== false && (c.count === 0 || c.status === "GREEN")).sort((a, b) => a.count - b.count || a.name.localeCompare(b.name, "de"))[0] : undefined;
    const recommendations: { label: string; href: string }[] = [];
    for (const group of groups) {
      if (!questions.length || group.status === "NONE" || group.status === "GREEN") continue;
      const lower = group.id === "open" ? group.count * 100 < 10 * questions.length : group.id === "closed" ? group.count * 100 < 10 * questions.length : group.count === 0;
      if (lower) recommendations.push({
        label: `${group.label} ergänzen${alternative ? ` · ${alternative.name}` : ""}`,
        href: balanceSearchHref({ templateIds: templatesForGroup(group.id), categoryId: alternative?.id, answerMode: group.id === "open" ? "open" : group.id === "closed" ? "closed" : undefined }),
      });
    }
    if (alternative && !recommendations.some(r => new URL(r.href, "https://quiz.invalid").searchParams.has("categoryId"))) recommendations.push({ label: `${alternative.name} statt stark vertretener Sachkategorien suchen`, href: balanceSearchHref({ categoryId: alternative.id }) });
    return { ...section, total: questions.length, categorizedTotal, uncategorizedTotal: questions.length - categorizedTotal, groups, categories: displayedCategories, recommendations,
      unknown: questions.filter(q => questionBalanceGroup(q) === "unknown").length,
      status: worstBalanceStatus([...groups.map(g => g.status), ...displayedCategories.map(c => c.status)]),
    };
  });
  return { mode, blocks, unassigned: input.questions.filter(q => !input.sections.some(s => s.id === q.sectionId)).length,
    status: worstBalanceStatus(blocks.map(b => b.status)),
  };
}

export type QuizBalance = ReturnType<typeof getQuizBalance>;
