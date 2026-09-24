import { requireQuestionEditor } from "@/app/lib/permissions";
import { getAktiveQuizListe } from "@/app/quiz/actions";
import { prisma } from "@/app/lib/prisma";
import { getAssignableQuestionEventSeries } from "@/app/fragen/editor/questionAccess.server";
import ContentWorkspace from "./ContentWorkspace";
import type { ContentInitialType } from "./contentLibrary";
import { localizeQuestionTemplates } from "@/app/fragen/editor/templates/questionTemplates";
import { loadQuestionEditorMessages } from "@/app/i18n/questionEditorMessages";
import { getDefaultLocale } from "@/app/i18n/locale";
import { loadDynamicQuestionTemplates } from "@/app/fragen/editor/templates/dynamicQuestionTemplates.server";

export default async function ContentLibraryPage({ initialType }: { initialType?: ContentInitialType }) {
  const session = await requireQuestionEditor();
  const baseTemplates = localizeQuestionTemplates(
    loadQuestionEditorMessages(getDefaultLocale()),
  ).filter((template) => template.enabled);
  const [quizzes, categories, eventSeries, dynamicTemplates] = await Promise.all([
    getAktiveQuizListe(),
    prisma.fragenkategorie.findMany({ where: { status: "ACTIVE" }, select: { fragenkategorie_id: true, kategorie: true }, orderBy: { kategorie: "asc" } }),
    getAssignableQuestionEventSeries(session),
    loadDynamicQuestionTemplates(baseTemplates),
  ]);
  const templates = [...baseTemplates, ...dynamicTemplates];
  return <ContentWorkspace
    initialType={initialType}
    templates={templates.map(({ id, name, availableForFiltering }) => ({
      id,
      name,
      availableForFiltering,
    }))}
    quizzes={quizzes.map((quiz) => ({ quizId: quiz.quiz_id, title: quiz.titel ?? `Quiz ${quiz.quiz_id}`, date: quiz.quiz_datum, eventSeriesId: quiz.eventreihe_id }))}
    categories={categories.map((category) => ({ id: category.fragenkategorie_id, name: category.kategorie }))}
    eventSeries={eventSeries.map((series) => ({ id: series.eventreihe_id, name: series.name }))}
  />;
}
