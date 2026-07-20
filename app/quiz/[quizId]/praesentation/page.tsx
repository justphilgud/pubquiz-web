import { notFound } from "next/navigation";
import { getQuizPraesentation } from "../../actions";
import { getOrCreatePraesentationStatus } from "./statusActions";
import QuizPraesentationPlayer from "./QuizPraesentationPlayer";
import { requireQuizLiveController } from "../../quizAccess.server";
import { resolveQuizTemplates } from "@/app/rendering/resolveQuizTemplates.server";

type Props = {
  params: Promise<{
    quizId: string;
  }>;
};

export default async function QuizPraesentationPage({ params }: Props) {
  const resolvedParams = await params;
  const quizId = Number(resolvedParams.quizId);

  if (Number.isNaN(quizId)) {
    notFound();
  }
  await requireQuizLiveController(quizId);

  const quiz = await getQuizPraesentation(quizId);
  console.log("Praesentation quizId", quizId, "quiz gefunden", Boolean(quiz));

  if (!quiz) {
    notFound();
  }
  const [status, templates] = await Promise.all([
    getOrCreatePraesentationStatus(quizId),
    resolveQuizTemplates(quizId),
  ]);
  if (!templates) notFound();

  return (
    <QuizPraesentationPlayer
      quiz={quiz}
      quizId={quizId}
      initialSlideIndex={status.slide_index}
      templateContext={templates.presentation}
    />
  );
}
