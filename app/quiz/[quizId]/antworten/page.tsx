import { notFound } from "next/navigation";
import { getQuizAntwortStatus } from "../../actions";
import QuizAntwortClient from "./QuizAntwortClient";
import { resolveQuizTemplates } from "@/app/rendering/resolveQuizTemplates.server";

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

  const [daten, templates] = await Promise.all([
    getQuizAntwortStatus(quizId),
    resolveQuizTemplates(quizId),
  ]);

  if (!daten || !templates) {
    notFound();
  }

  return <QuizAntwortClient daten={daten} theme={templates.theme} />;
}
