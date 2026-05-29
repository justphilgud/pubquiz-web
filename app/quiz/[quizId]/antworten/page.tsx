import { notFound } from "next/navigation";
import { getQuizAntwortStatus } from "../../actions";
import QuizAntwortClient from "./QuizAntwortClient";

type Props = {
  params: Promise<{
    quizId: string;
  }>;
};

export default async function QuizAntwortPage({ params }: Props) {
  const resolvedParams = await params;
  const quizId = Number(resolvedParams.quizId);

  if (Number.isNaN(quizId)) {
    notFound();
  }

  const daten = await getQuizAntwortStatus(quizId);

  if (!daten) {
    notFound();
  }

  return <QuizAntwortClient daten={daten} />;
}