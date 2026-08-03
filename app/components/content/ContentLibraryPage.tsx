import { requireQuestionEditor } from "@/app/lib/permissions";
import { getAktiveQuizListe } from "@/app/quiz/actions";
import ContentWorkspace from "./ContentWorkspace";
import type { ContentInitialType } from "./contentLibrary";

export default async function ContentLibraryPage({ initialType }: { initialType?: ContentInitialType }) {
  await requireQuestionEditor();
  const quizzes = await getAktiveQuizListe();
  return <ContentWorkspace initialType={initialType} quizzes={quizzes.map((quiz) => ({ quizId: quiz.quiz_id, title: quiz.titel ?? `Quiz ${quiz.quiz_id}`, date: quiz.quiz_datum }))} />;
}
