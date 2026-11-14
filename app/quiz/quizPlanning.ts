import { resolveCanonicalQuestionTemplateId } from "@/app/fragen/editor/templates/questionTemplateRegistry";

type AssignedQuestion = {
  templateId: string | null;
  compositionTemplateId?: string;
  vorlagenname: string;
  kategorien: readonly string[];
};

export function getQuizComposition(questions: readonly AssignedQuestion[]) {
  const categories = new Map<string | null, number>();
  const templates = new Map<string | null, { label: string; count: number }>();
  for (const question of questions) {
    const names = new Set<string | null>(question.kategorien.filter(Boolean));
    if (!names.size) names.add(null);
    for (const name of names) categories.set(name, (categories.get(name) ?? 0) + 1);

    const id = question.compositionTemplateId ?? resolveCanonicalQuestionTemplateId(question.templateId);
    const entry = templates.get(id);
    templates.set(id, { label: id ? question.vorlagenname : "Standardfrage", count: (entry?.count ?? 0) + 1 });
  }
  function distribution(entries: { id: string | null; label: string; count: number }[]) {
    return entries.map(entry => ({
      ...entry,
      share: Math.round(entry.count / questions.length * 100),
    })).sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, "de"));
  }
  return {
    categories: distribution(Array.from(categories, ([id, count]) => ({ id, label: id ?? "Ohne Kategorie", count }))),
    templates: distribution(Array.from(templates, ([id, entry]) => ({ id, ...entry }))),
  };
}

export function formatQuizQuestionCount(count: number) {
  return count === 1 ? "1 Frage" : `${count} Fragen`;
}

export function formatQuizDuration(seconds: number) {
  if (seconds === 0) return "0 Min.";
  if (seconds < 60) return "unter 1 Min.";
  const minutes = seconds < 600 ? Math.round(seconds / 60) : Math.round(seconds / 300) * 5;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return hours
    ? `ca. ${hours} Std.${remainder ? ` ${remainder} Min.` : ""}`
    : `ca. ${minutes} Min.`;
}
