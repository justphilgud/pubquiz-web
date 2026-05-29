import { notFound } from "next/navigation";
import { getQuizPraesentation } from "../../actions";
import QuizPraesentationPlayer from "./QuizPraesentationPlayer";


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

  const quiz = await getQuizPraesentation(quizId);
  

  if (!quiz) {
    notFound();
  }

  return <QuizPraesentationPlayer quiz={quiz} />;
}