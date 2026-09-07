"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { QuizPraesentationResult } from "../../actions";
import { getPresentationFunnyAnswers, getQuizLiveSnapshot, getSchaetzfrageById } from "../../actions";
import type { PixelLiveState } from "@/app/quiz/interaction/pixelLiveInteraction";
import type { PollLiveState } from "@/app/quiz/interaction/pollInteraction";
import type { LiveChoiceResultState } from "@/app/quiz/liveResults/liveChoiceResults";
import type { LiveTextResultState } from "@/app/quiz/liveResults/liveTextResults";
import type { LivePollAudienceState } from "@/app/umfragen/livePollRuntime";
import { getLivePollPollingDelay } from "@/app/umfragen/livePollRuntime";
import {
  getPraesentationAudienceZwischenstand,
  getPraesentationPunktestand,
  getPraesentationJahreswertung,
  getPraesentationStatus,
} from "./statusActions";
import {
  buildPraesentationSlides,
  getPresentationSlideKey,
  isIntermediateStandingsSlide,
  isStandingsSlide,
} from "./buildPraesentationSlides";
import PresentationSlideRenderer from "@/app/rendering/presentation/PresentationSlideRenderer";
import {
  resolvePresentationLiveState,
  resolvePresentationOpeningState,
  resolvePresentationSequenceIndex,
  type PresentationLiveState,
} from "@/app/rendering/presentation/presentationLiveState";
import { getPresentationSlideTitle } from "@/app/rendering/presentation/presentationSlideMetadata";
import type { ResolvedQuizTheme } from "@/app/rendering/theme/quizTheme";
import { QuizThemeScope } from "@/app/rendering/theme/QuizThemeScope";
import type { TeamAvatarCode } from "@/app/teams/teamProfile";
import type { FunnyAnswerEntry } from "@/app/quiz/funnyAnswerReveal";
import type { YearlyRankingEntry } from "@/app/quiz/yearlyRanking";
import type { IntermediateStandingsAudienceEntry } from "@/app/rendering/presentation/presentationRankingPolicy";

type Props = {
  quiz: QuizPraesentationResult;
  quizId: number;
  initialLiveState: PresentationLiveState;
  theme: ResolvedQuizTheme;
};

type EstimationQuestion = {
  fragen_id: number;
  frage: string;
  richtigeAntwort: string | null;
};

export default function QuizPraesentationPlayer({
  quiz,
  quizId,
  initialLiveState,
  theme,
}: Props) {
  const [liveState, setLiveState] = useState(() => resolvePresentationOpeningState(initialLiveState));
  const [activatedContext, setActivatedContext] = useState<string | null>(null);
  const activationContext = `${liveState.lifecycleRevision}:${liveState.quizStartedAt ?? "preparation"}`;
  const activated = activatedContext === activationContext && liveState.lifecycle !== "STOPPED";
  const presentationRoot = useRef<HTMLDivElement>(null);
  const [scores, setScores] = useState<
    { teamId: number; teamname: string; punkte: number; avatarCode: TeamAvatarCode; photoUrl: string | null }[]
  >([]);
  const [audienceInterimStandings, setAudienceInterimStandings] = useState<
    IntermediateStandingsAudienceEntry[]
  >([]);
  const [yearlyStandings, setYearlyStandings] = useState<YearlyRankingEntry[]>([]);
  const [estimationQuestion, setEstimationQuestion] =
    useState<EstimationQuestion | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const serverClockOffsetRef = useRef(0);
  const [syncError, setSyncError] = useState(false);
  const [pixelState, setPixelState] = useState<PixelLiveState | null>(null);
  const [pollState, setPollState] = useState<PollLiveState | null>(null);
  const [liveResultState, setLiveResultState] = useState<LiveChoiceResultState | LiveTextResultState | null>(null);
  const [livePollState, setLivePollState] = useState<LivePollAudienceState | null>(null);
  const [funnyAnswers, setFunnyAnswers] = useState<FunnyAnswerEntry[]>([]);
  const [funnyQuestionIds, setFunnyQuestionIds] = useState(
    () => new Set(
      quiz.fragen
        .filter((question) => question.funnyRevealAvailable)
        .map((question) => question.quiz_fragen_id),
    ),
  );
  const slides = useMemo(
    () => buildPraesentationSlides(quiz, { funnyQuestionAssignmentIds: funnyQuestionIds }),
    [funnyQuestionIds, quiz],
  );
  const [teamJoinState, setTeamJoinState] = useState<{
    teams: {
      teamId: number;
      teamName: string;
      avatarCode: TeamAvatarCode;
      photoUrl: string | null;
    }[];
    totalTeams: number;
    remainingTeams: number;
  } | null>(null);

  const slideIndex = resolvePresentationSequenceIndex(
    liveState,
    slides.map(getPresentationSlideKey),
  ).index;
  const slide = slides[slideIndex];
  const showTeamJoinState =
    (slide?.typ === "ablauf" && slide.element.type === "QR_CODE") ||
    (slide?.typ === "fixer-slide" && slide.slideTyp === "qrcode");
  const presentationQuestionAssignmentId =
    slide?.typ === "frage" || slide?.typ === "funny" || slide?.typ === "aufloesung"
      ? slide.frage.quiz_fragen_id
      : undefined;
  const showIntermediateStandings = isIntermediateStandingsSlide(slide);

  useEffect(() => {
    if (
      !slide ||
      (slide.typ !== "frage" && slide.typ !== "funny" && slide.typ !== "aufloesung")
    ) {
      const timeout = window.setTimeout(() => setFunnyAnswers([]), 0);
      return () => window.clearTimeout(timeout);
    }
    let active = true;
    void getPresentationFunnyAnswers(quizId, slide.frage.quiz_fragen_id).then((answers) => {
      if (!active) return;
      setFunnyAnswers(answers);
      if (answers.length > 0) {
        setFunnyQuestionIds((current) => {
          if (current.has(slide.frage.quiz_fragen_id)) return current;
          return new Set(current).add(slide.frage.quiz_fragen_id);
        });
      }
    });
    return () => { active = false; };
  }, [quizId, slide]);

  useEffect(() => {
    let active = true;
    let refreshing = false;
    let timeout: number | null = null;
    let pollActive = false;
    let consecutiveFailures = 0;

    function schedule() {
      if (!active) return;
      const delay = pollActive
        ? getLivePollPollingDelay({ hidden: document.hidden, consecutiveFailures })
        : 750;
      timeout = window.setTimeout(() => void refresh(), delay);
    }

    async function refresh() {
      if (refreshing) return schedule();
      refreshing = true;
      try {
        const [storedStatus, interactionSnapshot] = await Promise.all([
          getPraesentationStatus(quizId),
          getQuizLiveSnapshot(
            quizId,
            undefined,
            true,
            showTeamJoinState,
            presentationQuestionAssignmentId,
          ),
        ]);
        if (!active) return;

        const storedState = resolvePresentationLiveState(storedStatus);
        const nextState = storedState.lifecycle === "PREPARATION" &&
          storedState.lifecycleRevision === initialLiveState.lifecycleRevision &&
          storedState.slideStartedAt === initialLiveState.slideStartedAt
          ? resolvePresentationOpeningState(storedState) : storedState;
        setLiveState((current) => {
          if (
            current.updatedAt &&
            nextState.updatedAt &&
            nextState.updatedAt < current.updatedAt
          ) {
            return current;
          }
          return nextState;
        });
        setSyncError(false);
        setPixelState(interactionSnapshot.pixelState);
        setPollState(interactionSnapshot.pollState);
        setLiveResultState(interactionSnapshot.liveResultState);
        setLivePollState(interactionSnapshot.livePollState);
        pollActive = interactionSnapshot.livePollState !== null;
        consecutiveFailures = 0;
        setTeamJoinState(interactionSnapshot.teamJoinState);
        serverClockOffsetRef.current =
          new Date(interactionSnapshot.serverNow).getTime() - Date.now();
        setNow(Date.now() + serverClockOffsetRef.current);
      } catch {
        consecutiveFailures += 1;
        if (active) setSyncError(true);
      } finally {
        refreshing = false;
        schedule();
      }
    }

    void refresh();
    return () => {
      active = false;
      if (timeout !== null) window.clearTimeout(timeout);
    };
  }, [quizId, showTeamJoinState, presentationQuestionAssignmentId, initialLiveState]);

  useEffect(() => {
    if (!isStandingsSlide(slide)) return;
    let active = true;

    if (isIntermediateStandingsSlide(slide)) {
      void getPraesentationAudienceZwischenstand(quizId).then((standings) => {
        if (!active) return;
        setAudienceInterimStandings(standings);
      });
    } else {
      void Promise.all([
        getPraesentationPunktestand(quizId),
        getPraesentationJahreswertung(quizId),
      ]).then(([currentScores, yearlyScores]) => {
        if (!active) return;
        setScores(currentScores);
        setYearlyStandings(yearlyScores);
      });
    }

    return () => {
      active = false;
    };
  }, [quizId, slide, liveState.updatedAt]);

  useEffect(() => {
    const questionId = liveState.estimation.questionId;
    if (questionId === null) {
      const timeout = window.setTimeout(() => setEstimationQuestion(null), 0);
      return () => window.clearTimeout(timeout);
    }

    let active = true;
    void getSchaetzfrageById(quizId, questionId).then((question) => {
      if (active) setEstimationQuestion(question);
    });
    return () => {
      active = false;
    };
  }, [liveState.estimation.questionId, quizId]);

  useEffect(() => {
    const interval = window.setInterval(
      () => setNow(Date.now() + serverClockOffsetRef.current),
      1000,
    );
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleFullscreen(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (
        target?.isContentEditable ||
        ["input", "textarea", "select", "audio", "video"].includes(
          target?.tagName.toLowerCase() ?? "",
        )
      ) {
        return;
      }
      if (event.key.toLowerCase() !== "f") return;

      event.preventDefault();
      if (document.fullscreenElement) {
        void document.exitFullscreen();
      } else {
        void document.documentElement.requestFullscreen();
      }
    }

    window.addEventListener("keydown", handleFullscreen);
    return () => window.removeEventListener("keydown", handleFullscreen);
  }, []);

  return (
    <QuizThemeScope
      as="main"
      theme={theme}
      className="presentation-template h-dvh overflow-hidden text-white"
    >
      <div ref={presentationRoot} className="h-full p-4">
        <PresentationSlideRenderer
          quiz={quiz}
          slide={slide}
          slides={slides}
          slideIndex={slideIndex}
          slideLabel={getPresentationSlideTitle(slide, slides)}
          theme={theme}
          displayState={{
            renderMode: "PRESENTATION",
            templateRevealCount: liveState.revealCount,
            punktestand: showIntermediateStandings ? [] : scores,
            intermediateStandings: showIntermediateStandings
              ? audienceInterimStandings
              : [],
            yearlyStandings,
            endstandRevealCount: liveState.revealCount,
            now,
            estimationPhase: liveState.estimation.phase,
            schaetzfrage: estimationQuestion,
            isSchaetzfrageLoading:
              liveState.estimation.phase !== "HIDDEN" &&
              liveState.estimation.questionId !== null &&
              estimationQuestion === null,
            remoteCountdownDauerSekunden:
              liveState.countdownDurationSeconds,
            remoteCountdownStartedAt: liveState.countdownStartedAt,
            remoteCountdownStatus: liveState.countdownStatus,
            mediaOverlayActive: liveState.mediaOverlayActive,
            playbackCommand: activated ? liveState.playbackCommand : null,
            playbackCommandId: liveState.playbackCommandId,
            pixelState,
            pollState,
            liveResultState,
            livePollState,
            teamJoinState,
            funnyAnswers,
          }}
        />
        {!activated && <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/85 p-6">
          <div className="max-w-lg text-center">
            <h1 className="text-3xl font-bold">{liveState.lifecycle === "STOPPED" ? "Quiz beendet" : "Präsentation bereit"}</h1>
            <p className="my-4">{liveState.lifecycle === "PREPARATION" ? "Das Quiz ist in Vorbereitung. Der reguläre Durchlauf wird in der Moderation gestartet." : liveState.lifecycle === "RUNNING" ? "Das Quiz läuft. Aktiviere dieses Fenster, um die Präsentation und Medienwiedergabe fortzusetzen." : "Die Antworten bleiben gespeichert. Ein neuer Durchlauf beginnt nach dem Zurücksetzen."}</p>
            {liveState.lifecycle !== "STOPPED" && <button className="min-h-11 rounded-lg bg-white px-5 py-3 font-bold text-black" onClick={() => {
              // Invoke play synchronously in this window's user gesture. Individual
              // media retain their existing blocked-playback fallback for later slides.
              if (liveState.playbackCommand === "play") {
                presentationRoot.current?.querySelectorAll<HTMLMediaElement>("audio, video").forEach((media) => { void media.play().catch(() => {}); });
              }
              setActivatedContext(activationContext);
            }}>{liveState.lifecycle === "RUNNING" ? "Präsentation starten / fortsetzen" : "Vorschau aktivieren"}</button>}
          </div>
        </div>}
        {syncError && (
          <div
            role="status"
            className="absolute bottom-4 left-1/2 z-[60] -translate-x-1/2 rounded-xl border border-amber-400/60 bg-black/85 px-4 py-2 text-sm font-bold text-amber-100"
          >
            Verbindung unterbrochen – erneuter Abgleich läuft.
          </div>
        )}
      </div>
    </QuizThemeScope>
  );
}
