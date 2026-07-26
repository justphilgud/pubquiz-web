import { notFound } from "next/navigation";
import { getQuizPraesentation } from "../../actions";
import { getPraesentationStatus } from "./statusActions";
import QuizPraesentationPlayer from "./QuizPraesentationPlayer";
import { requireQuizLiveController } from "../../quizAccess.server";
import { resolveQuizTemplates } from "@/app/rendering/resolveQuizTemplates.server";
import { resolvePresentationLiveState } from "@/app/rendering/presentation/presentationLiveState";

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
    getPraesentationStatus(quizId),
    resolveQuizTemplates(quizId),
  ]);
  if (!templates) notFound();

  return (
    <QuizPraesentationPlayer
      quiz={quiz}
      quizId={quizId}
      initialLiveState={resolvePresentationLiveState(status)}
      theme={templates.theme}
    />
  );
}
