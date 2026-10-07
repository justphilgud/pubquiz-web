import type { QuizAnalysisSnapshot } from "./quizAnalysisReader";

function counts(values: readonly string[]) {
  const result: Record<string, number> = {};
  for (const value of [...values].sort()) result[value] = (result[value] ?? 0) + 1;
  return result;
}

/** Inventory counts never interpret unpublished content as eligible for play. */
export function summarizeQuestionInventory(snapshot: QuizAnalysisSnapshot) {
  const questions = snapshot.questions;
  return {
    capturedAt: snapshot.capturedAt,
    total: questions.length,
    statusMatrix: counts(questions.map(q => `${q.reviewStatus}|${q.archived ? "ARCHIVED" : "NOT_ARCHIVED"}|${q.approved ? "APPROVED_FLAG" : "NOT_APPROVED_FLAG"}`)),
    reviewStatuses: counts(questions.map(q => q.reviewStatus)),
    archived: questions.filter(q => q.archived).length,
    incomplete: questions.filter(q => q.incomplete).length,
    byCanonicalTemplate: counts(questions.map(q => q.canonicalTemplate)),
    byPersistedTemplate: counts(questions.map(q => q.template?.code ?? "<null>")),
    categories: snapshot.categories.map(category => ({ ...category,
      questions: questions.filter(q => q.categories.some(c => c.id === category.id)).length })),
    uncategorized: questions.filter(q => !q.categories.length).length,
    withMedia: questions.filter(q => q.media.length).length,
    withoutMedia: questions.filter(q => !q.media.length).length,
    mediaOwners: counts(questions.flatMap(q => q.media.map(m => m.owner))),
    mediaSlots: counts(questions.flatMap(q => q.media.map(m => m.slot ?? "<legacy-unassigned>"))),
    used: questions.filter(q => q.quizUsages.length).length,
    unused: questions.filter(q => !q.quizUsages.length).length,
    scope: counts(questions.map(q => q.scope)),
    eventSeries: snapshot.eventSeries.map(series => ({ ...series,
      boundQuestions: questions.filter(q => q.eventSeriesIds.includes(series.id)).length,
      quizzes: snapshot.quizzes.filter(q => q.eventSeriesId === series.id).map(q => ({ id: q.id, title: q.title })) })),
    dynamicTemplates: snapshot.templates.filter(t => t.kind === "DYNAMIC").map(t => ({ ...t,
      appliedQuestions: questions.filter(q => q.sourceTemplate?.id === t.id || q.template?.id === t.id).length })),
    metadataCoverage: {
      difficulty: questions.filter(q => q.difficulty !== null).length,
      validity: questions.filter(q => q.validUntil !== null).length,
      reviewFrom: questions.filter(q => q.reviewFrom !== null).length,
      templateConfig: questions.filter(q => q.templateConfig !== null).length,
      source: questions.filter(q => q.source?.trim()).length,
    },
  };
}
