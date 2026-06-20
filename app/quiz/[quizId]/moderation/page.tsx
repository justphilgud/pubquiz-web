import { notFound } from "next/navigation";
import { getQuizPraesentation } from "../../actions";
import {
  getOrCreatePraesentationStatus,
  getAntwortStatus,
} from "../praesentation/statusActions";
import ModerationClient from "./ModerationClient";

type Props = {
  params: Promise<{
    quizId: string;
  }>;
};

export default async function ModerationPage({ params }: Props) {
  const resolvedParams = await params;
  const quizId = Number(resolvedParams.quizId);

  if (Number.isNaN(quizId)) {
    notFound();
  }

  const quiz = await getQuizPraesentation(quizId);

  if (!quiz) {
    notFound();
  }

  const status = await getOrCreatePraesentationStatus(quizId);
  const antwortStatus = await getAntwortStatus(quizId, null);

  return (
    <ModerationClient
      quizId={quizId}
      quiz={quiz}
      initialStatus={{
        slide_index: status.slide_index,
        slide_started_at: status.slide_started_at
          ? status.slide_started_at.toISOString()
          : null,
        quiz_started_at: status.quiz_started_at
          ? status.quiz_started_at.toISOString()
          : null,
        endstand_reveal_count: status.endstand_reveal_count ?? 1,
      }}
      initialAntwortStatus={{
        teamsAngemeldet: antwortStatus.teamsAngemeldet,
        antwortenEingegangen: antwortStatus.antwortenEingegangen,
        prozent: antwortStatus.prozent,
        letzteAntwortAt: antwortStatus.letzteAntwortAt
          ? antwortStatus.letzteAntwortAt.toISOString()
          : null,
      }}
    />
  );
}
