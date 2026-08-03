import { notFound } from "next/navigation";

import { requireAdmin } from "@/app/lib/permissions";
import { resolveQuizTemplates } from "@/app/rendering/resolveQuizTemplates.server";
import {
  resolvePresentationLiveState,
} from "@/app/rendering/presentation/presentationLiveState";
import { getPresentationSlideTitle } from "@/app/rendering/presentation/presentationSlideMetadata";
import { getQuizPraesentation } from "../../actions";
import {
  buildPraesentationSlides,
  getPresentationSlideKey,
  type Slide,
} from "../praesentation/buildPraesentationSlides";
import { getPraesentationStatus } from "../praesentation/statusActions";
import QuizTestClient, { type QuizTestSlide } from "./QuizTestClient";
import { getEffectiveQuizSolutionStrategy } from "@/app/quiz/flow/quizFlow";

type Props = {
  params: Promise<{ quizId: string }>;
};

function getDiagnosticSlideType(slide: Slide) {
  if (slide.typ === "ablauf") return slide.element.type;
  if (slide.typ === "frage") return "QUESTION";
  if (slide.typ === "aufloesung") return "QUESTION_SOLUTION";
  if (slide.typ === "fixer-slide") return slide.slideTyp;
  if (slide.typ === "block") return "ROUND_INTRO";
  if (slide.typ === "pause") return "BREAK";
  if (slide.typ === "zwischenstand") return "INTERMEDIATE_STANDINGS";
  return "FINAL_STANDINGS";
}

function toDiagnosticSlide(
  slide: Slide,
  slides: Slide[],
  visibleIndexByKey: ReadonlyMap<string, number>,
  quizStrategy: unknown,
): QuizTestSlide {
  const key = getPresentationSlideKey(slide);
  const visibleIndex = visibleIndexByKey.get(key) ?? null;
  const phase = slide.typ === "frage"
    ? "QUESTION"
    : slide.typ === "aufloesung"
      ? "SOLUTION"
      : "NON_QUESTION";
  return {
    key,
    label: `${visibleIndex === null ? "—" : visibleIndex + 1}. ${getPresentationSlideTitle(slide, slides)}`,
    slideType: getDiagnosticSlideType(slide),
    phase,
    sectionId: "abschnitt" in slide
      ? (slide.abschnitt?.quiz_abschnitt_id ?? null)
      : null,
    questionAssignmentId:
      slide.typ === "frage" || slide.typ === "aufloesung"
        ? slide.frage.quiz_fragen_id
        : null,
    questionId:
      slide.typ === "frage" || slide.typ === "aufloesung"
        ? slide.frage.fragen_id
        : null,
    solutionStrategy:
      slide.typ === "frage" || slide.typ === "aufloesung"
        ? (slide.solutionStrategy ?? null)
        : slide.typ === "ablauf" && slide.abschnitt
          ? getEffectiveQuizSolutionStrategy(
              quizStrategy,
              slide.abschnitt.aufloesungsstrategie,
            )
          : null,
    sectionTitle:
      "abschnitt" in slide ? (slide.abschnitt?.titel ?? null) : null,
    visibleIndex,
    enabled: slide.typ !== "ablauf" || slide.element.enabled,
  };
}

export default async function QuizTestPage({ params }: Props) {
  await requireAdmin();
  const { quizId: quizIdParam } = await params;
  const quizId = Number(quizIdParam);
  if (!Number.isSafeInteger(quizId) || quizId <= 0) notFound();

  const [quiz, storedStatus, templates] = await Promise.all([
    getQuizPraesentation(quizId),
    getPraesentationStatus(quizId),
    resolveQuizTemplates(quizId),
  ]);
  if (!quiz || !templates) notFound();

  const visibleSlides = buildPraesentationSlides(quiz);
  const allSlides = buildPraesentationSlides(quiz, {
    includeDisabledFlowItems: true,
  });
  const visibleIndexByKey = new Map(
    visibleSlides.map((slide, index) => [getPresentationSlideKey(slide), index]),
  );
  const templateSource = templates.presentationInfo.source === "QUIZ"
    ? "Quizzuordnung"
    : templates.presentationInfo.source === "EVENT_SERIES"
      ? `Eventreihe „${templates.presentationInfo.eventSeriesName}“`
      : "Systemstandard";

  return (
    <QuizTestClient
      quizId={quizId}
      quizTitle={quiz.titel ?? `Quiz ${quizId}`}
      templateName={templates.presentationInfo.name}
      templateSource={templateSource}
      initialLiveState={resolvePresentationLiveState(storedStatus)}
      slides={allSlides.map((slide) =>
        toDiagnosticSlide(
          slide,
          allSlides,
          visibleIndexByKey,
          quiz.aufloesungsstrategie,
        ),
      )}
      questionIdentities={quiz.fragen.map((question) => ({
        questionAssignmentId: question.quiz_fragen_id,
        questionId: question.fragen_id,
        sectionId: question.quiz_abschnitt_id,
      }))}
    />
  );
}
