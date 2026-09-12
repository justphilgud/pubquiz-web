import { notFound } from "next/navigation";
import { getQuizPraesentation, getSchaetzfrageById } from "../../actions";
import {
  getOrCreatePraesentationStatus,
  getAntwortStatus,
} from "../praesentation/statusActions";
import ModerationClient from "./ModerationClient";
import { requireQuizLiveController } from "../../quizAccess.server";
import { loadRenderingMessages } from "@/app/i18n/renderingMessages";
import { getDefaultLocale } from "@/app/i18n/locale";
import { resolveQuizTemplates } from "@/app/rendering/resolveQuizTemplates.server";
import { buildPraesentationSlides, getPresentationSlideKey } from "../praesentation/buildPraesentationSlides";
import { resolvePresentationSequenceIndex, resolvePresentationLiveState } from "@/app/rendering/presentation/presentationLiveState";

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
  await requireQuizLiveController(quizId);

  const quiz = await getQuizPraesentation(quizId);

  if (!quiz) {
    notFound();
  }

  const [status, templates] = await Promise.all([
    getOrCreatePraesentationStatus(quizId),
    resolveQuizTemplates(quizId),
  ]);
  if (!templates) notFound();
  const initialLiveState = { ...resolvePresentationLiveState(status), serverNow: status.serverNow };
  const slides = buildPraesentationSlides(quiz, { funnyQuestionAssignmentIds: new Set(quiz.fragen.filter((question) => question.funnyRevealAvailable).map((question) => question.quiz_fragen_id)) });
  const slide = slides[resolvePresentationSequenceIndex(initialLiveState, slides.map(getPresentationSlideKey)).index];
  const questionId = slide?.typ === "frage" || slide?.typ === "aufloesung" || slide?.typ === "funny" ? slide.frage.quiz_fragen_id : null;
  const antwortStatus = await getAntwortStatus(quizId, questionId);
  const initialEstimationQuestion =
    initialLiveState.estimation.questionId === null
      ? null
      : await getSchaetzfrageById(
          quizId,
          initialLiveState.estimation.questionId,
        );

  return (
    <ModerationClient
      quizId={quizId}
      quiz={quiz}
      initialLiveState={initialLiveState}
      initialEstimationQuestion={initialEstimationQuestion}
      initialAntwortStatus={{
        teamsAngemeldet: antwortStatus.teamsAngemeldet,
        antwortenEingegangen: antwortStatus.antwortenEingegangen,
        finaleAntworten: antwortStatus.finaleAntworten,
        prozent: antwortStatus.prozent,
        letzteAntwortAt: antwortStatus.letzteAntwortAt
          ? antwortStatus.letzteAntwortAt.toISOString()
          : null,
      }}
      backToQuizLabel={loadRenderingMessages(getDefaultLocale()).fields.backToQuiz}
      theme={templates.theme}
    />
  );
}
