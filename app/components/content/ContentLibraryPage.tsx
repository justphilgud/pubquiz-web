import { requireQuestionEditor } from "@/app/lib/permissions";
import { getAktiveQuizListe } from "@/app/quiz/actions";
import { prisma } from "@/app/lib/prisma";
import { getAssignableQuestionEventSeries } from "@/app/fragen/editor/questionAccess.server";
import ContentWorkspace from "./ContentWorkspace";
import type { ContentInitialType } from "./contentLibrary";

export default async function ContentLibraryPage({ initialType }: { initialType?: ContentInitialType }) {
  const session = await requireQuestionEditor();
  const [quizzes, categories, eventSeries] = await Promise.all([
    getAktiveQuizListe(),
    prisma.fragenkategorie.findMany({ where: { status: "ACTIVE" }, select: { fragenkategorie_id: true, kategorie: true }, orderBy: { kategorie: "asc" } }),
    getAssignableQuestionEventSeries(session),
  ]);
  return <ContentWorkspace
    initialType={initialType}
    quizzes={quizzes.map((quiz) => ({ quizId: quiz.quiz_id, title: quiz.titel ?? `Quiz ${quiz.quiz_id}`, date: quiz.quiz_datum, eventSeriesId: quiz.eventreihe_id }))}
    categories={categories.map((category) => ({ id: category.fragenkategorie_id, name: category.kategorie }))}
    eventSeries={eventSeries.map((series) => ({ id: series.eventreihe_id, name: series.name }))}
  />;
}
