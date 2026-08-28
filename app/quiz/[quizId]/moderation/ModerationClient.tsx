"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useModerationHotkeys } from "./hooks/useModerationHotkeys";

import {
  freigabeQuizBlock,
  schliesseQuizBlock,
  QuizPraesentationResult,
  getQuizPunktestand,
  getPresentationFunnyAnswers,
  getZufaelligeSchaetzfrage,
  setQuizLiveResultVisibility,
  closeQuizQuestionAnswerPhase,
  setLiveTextResponsePublication,
} from "../../actions";
import {
  buildPraesentationSlides,
  getPauseDurationSeconds,
  getPresentationSlideKey,
  getSlideModeratorNote,
  isPauseSlide,
  isIntermediateStandingsSlide,
  isPodiumRevealSlide,
  isStandingsSlide,
} from "../praesentation/buildPraesentationSlides";
import {
  setPraesentationSlideIndex,
  speicherePraesentationsdauer,
  setMediumOverlayAktiv,
  setAudioAktion,
  starteCountdown,
  resetCountdown,
  beendeCountdown,
  setEndstandRevealCount,
  setSchaetzfrageStatus,
  getAntwortStatus,
  getPraesentationAudienceZwischenstand,
  getPraesentationJahreswertung,
  starteQuiz,
} from "../praesentation/statusActions";

import ModerationToolbar from "./components/ModerationToolbar";
import ModerationSidebar from "./components/ModerationSidebar";
import SlideNotes from "./components/SlideNotes";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import AuswertungOverlay from "./components/AuswertungOverlay";
import CurrentSlidePanel from "./components/CurrentSlidePanel";
import type { ResolvedQuizTheme } from "@/app/rendering/theme/quizTheme";
import type { PresentationLiveState } from "@/app/rendering/presentation/presentationLiveState";
import { resolvePresentationSequenceIndex } from "@/app/rendering/presentation/presentationLiveState";
import {
  getQuizFlowTypeLabel,
  getQuizSolutionStrategyLabel,
} from "@/app/quiz/flow/quizFlow";
import type { PixelLiveState } from "@/app/quiz/interaction/pixelLiveInteraction";
import type { PollLiveState } from "@/app/quiz/interaction/pollInteraction";
import type { LiveChoiceResultState } from "@/app/quiz/liveResults/liveChoiceResults";
import type { LiveTextResultState } from "@/app/quiz/liveResults/liveTextResults";
import {
  canCloseLiveResultAnswerPhase,
  canToggleLiveResultVisibility,
} from "@/app/quiz/liveResults/liveResultControls";
import { parseQuizBlockPreviewSectionId } from "@/app/quiz/quizBlockLiveState";
import type { TeamAvatarCode } from "@/app/teams/teamProfile";
import { getFunnyAnswerPageCount, type FunnyAnswerEntry } from "@/app/quiz/funnyAnswerReveal";
import {
  resolvePodiumReveal,
  type IntermediateStandingsAudienceEntry,
} from "@/app/rendering/presentation/presentationRankingPolicy";
import type { YearlyRankingEntry } from "@/app/quiz/yearlyRanking";
import { TeamIdentityVisual } from "@/app/teams/TeamIdentityVisual";

type QuizLiveSnapshot = Awaited<
  ReturnType<typeof import("../../actions").getQuizLiveSnapshot>
>;

async function fetchQuizLiveSnapshot(
  quizId: number,
  includeTeamJoinState: boolean,
  presentationQuestionAssignmentId?: number,
) {
  const response = await fetch("/api/quiz/live-snapshot", {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      quizId,
      includeTeamJoinState,
      presentationQuestionAssignmentId,
      includeLiveModeration: true,
    }),
  });
  if (!response.ok) throw new Error("Live-Status konnte nicht geladen werden.");
  return await response.json() as QuizLiveSnapshot;
}

type EstimationQuestion = {
  fragen_id: number;
  frage: string;
  richtigeAntwort: string | null;
};

type AntwortStatus = {
  teamsAngemeldet: number;
  antwortenEingegangen: number;
  prozent: number;
  letzteAntwortAt: string | null;
};

type Props = {
  quizId: number;
  quiz: QuizPraesentationResult;
  initialLiveState: PresentationLiveState;
  initialEstimationQuestion: EstimationQuestion | null;
  initialAntwortStatus: AntwortStatus;
  backToQuizLabel: string;
  theme: ResolvedQuizTheme;
};

function secondsSince(startAt: string | null, now: number) {
  if (!startAt) return null;

  return Math.max(0, Math.floor((now - new Date(startAt).getTime()) / 1000));
}

export default function ModerationClient({
  quizId,
  quiz,
  initialLiveState,
  initialEstimationQuestion,
  initialAntwortStatus,
  backToQuizLabel,
  theme,
}: Props) {
  const [now, setNow] = useState(() => Date.now());
  const [pixelState, setPixelState] = useState<PixelLiveState | null>(null);
  const [pollState, setPollState] = useState<PollLiveState | null>(null);
  const [liveResultState, setLiveResultState] = useState<LiveChoiceResultState | LiveTextResultState | null>(null);
  const [liveResultPending, setLiveResultPending] = useState(false);
  const [liveResultControlError, setLiveResultControlError] = useState<string | null>(null);
  const [liveTextPublicationError, setLiveTextPublicationError] = useState<string | null>(null);
  const liveResultMutationRevisionRef = useRef(0);
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
  const [teamJoinState, setTeamJoinState] = useState<QuizLiveSnapshot["teamJoinState"]>(null);

  const [slideIndex, setSlideIndex] = useState(() => {
    return resolvePresentationSequenceIndex(
      initialLiveState,
      slides.map(getPresentationSlideKey),
    ).index;
  });

  const [slideStartedAt, setSlideStartedAt] = useState(
    initialLiveState.slideStartedAt,
  );
  const [quizStartedAt] = useState(initialLiveState.quizStartedAt);
  const [antwortStatus, setAntwortStatus] = useState(initialAntwortStatus);
  const [mediumOverlayAktiv, setMediumOverlayAktivLokal] = useState(
    initialLiveState.mediaOverlayActive,
  );

  const [confirmEndOpen, setConfirmEndOpen] = useState(false);
  const [quizBeendet, setQuizBeendet] = useState(false);

  const aktuellerSlide = slides[slideIndex];
  const showTeamJoinState =
    (aktuellerSlide?.typ === "ablauf" && aktuellerSlide.element.type === "QR_CODE") ||
    (aktuellerSlide?.typ === "fixer-slide" && aktuellerSlide.slideTyp === "qrcode");
  const presentationQuestionAssignmentId =
    aktuellerSlide?.typ === "frage" || aktuellerSlide?.typ === "funny" || aktuellerSlide?.typ === "aufloesung"
      ? aktuellerSlide.frage.quiz_fragen_id
      : undefined;
  const pauseVerstrichen =
    isPauseSlide(aktuellerSlide)
      ? (secondsSince(slideStartedAt, now) ?? 0)
      : 0;

  const istPauseAbgelaufen =
    isPauseSlide(aktuellerSlide) &&
    pauseVerstrichen >= getPauseDurationSeconds(aktuellerSlide);

  const naechsterSlide = slides[slideIndex + 1];
  const istCountdownSlide = isPauseSlide(aktuellerSlide);

  const aktuelleMedien =
    aktuellerSlide?.typ === "frage"
      ? aktuellerSlide.frage.medien
      : aktuellerSlide?.typ === "aufloesung"
        ? [
            ...aktuellerSlide.frage.medien,
            ...aktuellerSlide.frage.antworten.flatMap(
              (antwort) => antwort.medien,
            ),
          ]
        : aktuellerSlide?.typ === "ablauf" && aktuellerSlide.element.type === "AUDIO" && aktuellerSlide.element.config.audioUrl
          ? [{ medien_id: aktuellerSlide.element.persistentId ?? -1, datei: aktuellerSlide.element.config.audioUrl, medientyp: "Audio", sortierung: 1, bemerkung: aktuellerSlide.element.config.description ?? null }]
          : aktuellerSlide?.typ === "ablauf" && aktuellerSlide.element.type === "VIDEO" && aktuellerSlide.element.config.videoUrl
            ? [{ medien_id: aktuellerSlide.element.persistentId ?? -1, datei: aktuellerSlide.element.config.videoUrl, medientyp: "Video", sortierung: 1, bemerkung: aktuellerSlide.element.config.description ?? null }]
        : [];

  const [punktestand, setPunktestand] = useState<
    { teamId: number; teamname: string; punkte: number; avatarCode: TeamAvatarCode; photoUrl: string | null }[]
  >([]);
  const [audienceInterimStandings, setAudienceInterimStandings] = useState<
    IntermediateStandingsAudienceEntry[]
  >([]);
  const [yearlyStandings, setYearlyStandings] = useState<YearlyRankingEntry[]>([]);

  const hatMedien = aktuelleMedien.length > 0;

  const hatAudioAufFixemSlide =
    aktuellerSlide?.typ === "fixer-slide" &&
    (aktuellerSlide.slideTyp === "startsequenz" ||
      (aktuellerSlide.slideTyp === "qrcode" &&
        Boolean(quiz.intro_musik_url)) ||
      (aktuellerSlide.slideTyp === "bekanntmachungen" &&
        Boolean(quiz.outro_musik_url)));
  const hatAudioAufAblaufSlide =
    aktuellerSlide?.typ === "ablauf" &&
    ((aktuellerSlide.element.type === "START_SEQUENCE" && Boolean(quiz.intro_musik_url)) ||
      (aktuellerSlide.element.type === "CLOSING" && Boolean(quiz.outro_musik_url)) ||
      (aktuellerSlide.element.type === "AUDIO" && Boolean(aktuellerSlide.element.config.audioUrl)) ||
      (aktuellerSlide.element.type === "VIDEO" && Boolean(aktuellerSlide.element.config.videoUrl)));
  const hatAudio =
    hatAudioAufFixemSlide ||
    hatAudioAufAblaufSlide ||
    aktuelleMedien.some((medium) =>
      ["audio", "video"].some((type) =>
        medium.medientyp.toLowerCase().includes(type),
      ),
    );

  const [audioLaeuft, setAudioLaeuft] = useState(
    initialLiveState.playbackCommand === "play",
  );
  const [playbackCommand, setPlaybackCommand] = useState(
    initialLiveState.playbackCommand,
  );
  const [playbackCommandId, setPlaybackCommandId] = useState(
    initialLiveState.playbackCommandId,
  );

  const [showAuswertungDialog, setShowAuswertungDialog] = useState(false);

  const [blockFreigegeben, setBlockFreigegeben] = useState(false);

  const [countdownDauerMinuten, setCountdownDauerMinuten] = useState(
    Math.max(
      1,
      Math.round((initialLiveState.countdownDurationSeconds ?? 300) / 60),
    ),
  );

  const [countdownStartedAt, setCountdownStartedAt] = useState<string | null>(
    initialLiveState.countdownStartedAt,
  );

  const [countdownStatus, setCountdownStatus] = useState<string | null>(
    initialLiveState.countdownStatus,
  );

  const [showAuswertungIframe, setShowAuswertungIframe] = useState(false);

  const countdownVerstrichen = countdownStartedAt
    ? (secondsSince(countdownStartedAt, now) ?? 0)
    : 0;

  const countdownRestSekunden = Math.max(
    0,
    countdownDauerMinuten * 60 - countdownVerstrichen,
  );

  const [auswertungDialogBereitsGezeigt, setAuswertungDialogBereitsGezeigt] =
    useState(false);

  const [endstandRevealCount, setEndstandRevealCountLokal] = useState(
    initialLiveState.revealCount,
  );
  const [estimationPhase, setEstimationPhase] = useState(
    initialLiveState.estimation.phase,
  );
  const [estimationQuestion, setEstimationQuestion] =
    useState(initialEstimationQuestion);

  useEffect(() => {
    if (!istPauseAbgelaufen) return;
    if (auswertungDialogBereitsGezeigt) return;

    const timeoutId = window.setTimeout(() => {
      setShowAuswertungDialog(true);
      setAuswertungDialogBereitsGezeigt(true);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [istPauseAbgelaufen, auswertungDialogBereitsGezeigt]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    let active = true;
    let refreshing = false;
    async function refreshPixelState() {
      if (refreshing) return;
      refreshing = true;
      const liveResultMutationRevision = liveResultMutationRevisionRef.current;
      try {
      const snapshot = await fetchQuizLiveSnapshot(
        quizId,
        showTeamJoinState,
        presentationQuestionAssignmentId,
      );
      if (active) {
        setPixelState(snapshot.pixelState);
        setPollState(snapshot.pollState);
        if (liveResultMutationRevision === liveResultMutationRevisionRef.current) {
          setLiveResultState(snapshot.liveResultState);
        }
        setTeamJoinState(snapshot.teamJoinState);
        setBlockFreigegeben(Boolean(
          snapshot.blockState?.isReleased && !snapshot.blockState.isClosed,
        ));
      }
      } finally {
        refreshing = false;
      }
    }
    void refreshPixelState();
    const interval = window.setInterval(() => void refreshPixelState(), 750);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [quizId, showTeamJoinState, presentationQuestionAssignmentId]);

  async function speichereDauerVomAktuellenSlide() {
    if (aktuellerSlide?.typ !== "frage" || !slideStartedAt) {
      return;
    }

    const dauerSekunden = Math.max(
      0,
      Math.round((Date.now() - new Date(slideStartedAt).getTime()) / 1000),
    );

    await speicherePraesentationsdauer({
      quizId,
      quizFragenId: aktuellerSlide.frage.quiz_fragen_id,
      dauerSekunden,
    });
  }

  const handleBlockFreigeben = useCallback(async () => {
    const abschnitt =
      aktuellerSlide && "abschnitt" in aktuellerSlide
        ? aktuellerSlide.abschnitt
        : null;

    if (!abschnitt?.quiz_abschnitt_id) return;

    await freigabeQuizBlock({
      quizId,
      quizAbschnittId: abschnitt.quiz_abschnitt_id,
    });
  }, [aktuellerSlide, quizId]);

  const handleBlockSchliessen = useCallback(async () => {
    const abschnitt =
      aktuellerSlide && "abschnitt" in aktuellerSlide
        ? aktuellerSlide.abschnitt
        : null;

    if (!abschnitt?.quiz_abschnitt_id) return;

    await schliesseQuizBlock({
      quizId,
      quizAbschnittId: abschnitt.quiz_abschnitt_id,
    });
  }, [aktuellerSlide, quizId]);

  function vorherigerSlide() {
    void goToSlide(slideIndex - 1);
  }

  async function naechsterSlideAction() {
    if (aktuellerSlide?.typ === "funny") {
      const pageCount = getFunnyAnswerPageCount(funnyAnswers.length);
      if (endstandRevealCount < pageCount) {
        const nextPage = endstandRevealCount + 1;
        setEndstandRevealCountLokal(nextPage);
        await setEndstandRevealCount({ quizId, revealCount: nextPage });
        return;
      }
    }
    if (aktuellerSlide?.typ === "frage" && naechsterSlide?.typ === "funny" && funnyAnswers.length === 0) {
      void goToSlide(slideIndex + 2);
      return;
    }
    const templateData =
      aktuellerSlide?.typ === "frage"
        ? aktuellerSlide.frage.templateConfig?.templateData
        : null;
    if (
      templateData?.kind === "GOOGLE_REVIEWS" &&
      templateData.sequentialReveal &&
      endstandRevealCount < templateData.reviews.length
    ) {
      const nextRevealCount = Math.min(
        endstandRevealCount + 1,
        templateData.reviews.length,
      );
      setEndstandRevealCountLokal(nextRevealCount);
      await setEndstandRevealCount({
        quizId,
        revealCount: nextRevealCount,
      });
      return;
    }

    if (isPodiumRevealSlide(aktuellerSlide)) {
      const punktestand = await getQuizPunktestand(quizId);
      const reveal = resolvePodiumReveal(
        punktestand,
        endstandRevealCount,
      );
      const revealStageCount = aktuellerSlide?.typ === "endstand"
        ? reveal.revealStageCount + 1
        : reveal.revealStageCount;

      if (endstandRevealCount < revealStageCount) {
        const neuerRevealCount = Math.min(
          revealStageCount,
          endstandRevealCount + 1,
        );

        setEndstandRevealCountLokal(neuerRevealCount);

        await setEndstandRevealCount({
          quizId,
          revealCount: neuerRevealCount,
        });

        return;
      }
    }

    void goToSlide(slideIndex + 1);
  }

  function showFunnyAnswers() {
    void goToSlide(slideIndex + 1);
  }

  function skipFunnyAnswers() {
    void goToSlide(slideIndex + 2);
  }

  const handleMediumToggle = useCallback(async () => {
    const neuerWert = !mediumOverlayAktiv;

    setMediumOverlayAktivLokal(neuerWert);

    await setMediumOverlayAktiv({
      quizId,
      aktiv: neuerWert,
    });
  }, [mediumOverlayAktiv, quizId]);

  const handleAudioPlay = useCallback(async () => {
    const naechsteAktion = audioLaeuft ? "pause" : "play";

    setAudioLaeuft(!audioLaeuft);
    setPlaybackCommand(naechsteAktion);
    setPlaybackCommandId((current) => current + 1);
    if (
      naechsteAktion === "play" &&
      aktuellerSlide?.typ === "fixer-slide" &&
      aktuellerSlide.slideTyp === "startsequenz"
    ) {
      await starteQuiz(quizId);
    }

    await setAudioAktion({
      quizId,
      aktion: naechsteAktion,
    });
  }, [aktuellerSlide, audioLaeuft, quizId]);

  const handleAuswertungOeffnen = useCallback(() => {
    setShowAuswertungIframe(true);
    setShowAuswertungDialog(false);
  }, []);
  const aktualisiereAntwortStatus = useCallback(async () => {
    const aktuelleQuizFragenId =
      aktuellerSlide?.typ === "frage" || aktuellerSlide?.typ === "aufloesung"
        ? aktuellerSlide.frage.quiz_fragen_id
        : null;

    const neuerStatus = await getAntwortStatus(quizId, aktuelleQuizFragenId);

    setAntwortStatus({
      teamsAngemeldet: neuerStatus.teamsAngemeldet,
      antwortenEingegangen: neuerStatus.antwortenEingegangen,
      prozent: neuerStatus.prozent,
      letzteAntwortAt: neuerStatus.letzteAntwortAt
        ? neuerStatus.letzteAntwortAt.toISOString()
        : null,
    });
  }, [aktuellerSlide, quizId]);

  async function goToSlide(nextIndex: number) {
    const safeIndex = Math.min(
      Math.max(nextIndex, 0),
      Math.max(slides.length - 1, 0),
    );

    if (safeIndex === slideIndex) return;

    const newStartedAt = new Date().toISOString();

    setSlideIndex(safeIndex);
    setSlideStartedAt(newStartedAt);
    setShowAuswertungDialog(false);
    setAuswertungDialogBereitsGezeigt(false);
    setEndstandRevealCountLokal(1);
    setMediumOverlayAktivLokal(false);
    setAudioLaeuft(false);
    setPlaybackCommand("stop");
    setPlaybackCommandId((current) => current + 1);
    setCountdownStartedAt(null);
    setCountdownStatus("idle");

    const nextSlide = slides[safeIndex];
    if (!nextSlide) return;
    const nextSlideKey = getPresentationSlideKey(nextSlide);
    if (isPauseSlide(nextSlide)) {
      setCountdownDauerMinuten(
        Math.max(1, Math.round(getPauseDurationSeconds(nextSlide) / 60)),
      );
    }
    await setPraesentationSlideIndex(
      quizId,
      safeIndex,
      nextSlideKey,
    );
    void speichereDauerVomAktuellenSlide().catch(() => {
      // Presentation timing is diagnostic and must not delay live-state publication.
    });
    if (parseQuizBlockPreviewSectionId(nextSlideKey) !== null) {
      setBlockFreigegeben(true);
    }
    void aktualisiereAntwortStatus().catch(() => {
      // The regular status poll retries transient failures.
    });
  }

  async function handleBlockToggle() {
    if (blockFreigegeben) {
      await handleBlockSchliessen();
      setBlockFreigegeben(false);
      return;
    }

    await handleBlockFreigeben();
    setBlockFreigegeben(true);
  }

  function zurErstenSlide() {
    void goToSlide(0);
  }

  async function handleQuizBeenden() {
    setQuizBeendet(true);
    setConfirmEndOpen(false);

    await beendeCountdown({ quizId });
  }

  async function handleSchaetzfrageStarten() {
    const frage = await getZufaelligeSchaetzfrage(quizId);
    setEstimationQuestion(frage);
    setEstimationPhase("RUNNING");

    await setSchaetzfrageStatus({
      quizId,
      showSchaetzfrage: true,
      zeigeSchaetzantwort: false,
      schaetzfrageId: frage?.fragen_id ?? null,
    });
  }

  async function handleSchaetzfrageLoesungZeigen() {
    setEstimationPhase("SOLUTION");
    await setSchaetzfrageStatus({
      quizId,
      showSchaetzfrage: true,
      zeigeSchaetzantwort: true,
    });
  }

  async function handleSchaetzfrageZurueck() {
    setEstimationPhase("HIDDEN");
    setEstimationQuestion(null);
    await setSchaetzfrageStatus({
      quizId,
      showSchaetzfrage: false,
      zeigeSchaetzantwort: false,
      schaetzfrageId: null,
    });
  }

  async function handleCountdownStart() {
    await starteCountdown({
      quizId,
      dauerSekunden: countdownDauerMinuten * 60,
    });

    setCountdownStartedAt(new Date().toISOString());
    setCountdownStatus("running");
  }

  async function handleCountdownReset() {
    await resetCountdown({
      quizId,
    });

    setCountdownStartedAt(null);
    setCountdownStatus("idle");
  }

  const countdownIstAbgelaufen =
    countdownStatus === "running" &&
    countdownRestSekunden <= 0 &&
    !auswertungDialogBereitsGezeigt;

  useEffect(() => {
    if (!aktuellerSlide || (aktuellerSlide.typ !== "frage" && aktuellerSlide.typ !== "funny" && aktuellerSlide.typ !== "aufloesung")) {
      const timeout = window.setTimeout(() => setFunnyAnswers([]), 0);
      return () => window.clearTimeout(timeout);
    }
    let active = true;
    void getPresentationFunnyAnswers(quizId, aktuellerSlide.frage.quiz_fragen_id).then((answers) => {
      if (!active) return;
      setFunnyAnswers(answers);
      if (aktuellerSlide.typ === "frage") {
        setFunnyQuestionIds((current) => {
          const next = new Set(current);
          if (answers.length > 0) next.add(aktuellerSlide.frage.quiz_fragen_id);
          else next.delete(aktuellerSlide.frage.quiz_fragen_id);
          return next;
        });
      }
    });
    return () => { active = false; };
  }, [aktuellerSlide, quizId]);

  useEffect(() => {
    if (!countdownIstAbgelaufen) return;

    const timeoutId = window.setTimeout(() => {
      setCountdownStatus("finished");
      setAuswertungDialogBereitsGezeigt(true);
      setShowAuswertungDialog(true);

      void handleBlockSchliessen();
      void beendeCountdown({ quizId });
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [countdownIstAbgelaufen, quizId, handleBlockSchliessen]);

  useEffect(() => {
    if (!isStandingsSlide(aktuellerSlide)) return;
    let active = true;

    if (isIntermediateStandingsSlide(aktuellerSlide)) {
      void getPraesentationAudienceZwischenstand(quizId).then((standings) => {
        if (!active) return;
        setAudienceInterimStandings(standings);
      });
    } else {
      void Promise.all([
        getQuizPunktestand(quizId),
        getPraesentationJahreswertung(quizId),
      ]).then(([daten, jahreswertung]) => {
        if (!active) return;
        setPunktestand(daten);
        setYearlyStandings(jahreswertung);
      });
    }

    return () => {
      active = false;
    };
  }, [aktuellerSlide, quizId]);

  useEffect(() => {
    let active = true;
    let refreshing = false;
    async function refresh() {
      if (!active || refreshing) return;
      refreshing = true;
      try {
        await aktualisiereAntwortStatus();
      } finally {
        refreshing = false;
      }
    }
    void refresh();
    const interval = window.setInterval(() => void refresh(), 1_500);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [aktualisiereAntwortStatus]);

  async function toggleLiveResults() {
    if (aktuellerSlide?.typ !== "frage" || !liveResultState) return;
    if (!canToggleLiveResultVisibility(liveResultState.state)) return;
    liveResultMutationRevisionRef.current += 1;
    setLiveResultPending(true);
    setLiveResultControlError(null);
    try {
      const result = await setQuizLiveResultVisibility({
        quizId,
        quizFragenId: aktuellerSlide.frage.quiz_fragen_id,
        visible: !liveResultState.visible,
      });
      setLiveResultState({
        ...liveResultState,
        visible: result.visible,
        state: result.state,
      });
    } catch (error) {
      setLiveResultControlError(
        error instanceof Error
          ? error.message
          : "Die Publikumsansicht konnte nicht geändert werden.",
      );
    } finally {
      setLiveResultPending(false);
    }
  }

  async function closeLiveAnswerPhase() {
    if (aktuellerSlide?.typ !== "frage" || !liveResultState) return;
    if (!canCloseLiveResultAnswerPhase(liveResultState.state)) return;
    liveResultMutationRevisionRef.current += 1;
    setLiveResultPending(true);
    setLiveResultControlError(null);
    try {
      const result = await closeQuizQuestionAnswerPhase({
        quizId,
        quizFragenId: aktuellerSlide.frage.quiz_fragen_id,
      });
      setLiveResultState({
        ...liveResultState,
        state: result.state,
      });
    } catch (error) {
      setLiveResultControlError(
        error instanceof Error
          ? error.message
          : "Die Antwortphase konnte nicht geschlossen werden.",
      );
    } finally {
      setLiveResultPending(false);
    }
  }

  async function toggleLiveTextPublication(submissionId: number, visible: boolean) {
    if (aktuellerSlide?.typ !== "frage" || liveResultState?.kind !== "TEXT") return;
    liveResultMutationRevisionRef.current += 1;
    setLiveResultPending(true);
    setLiveTextPublicationError(null);
    try {
      await setLiveTextResponsePublication({
        quizId,
        quizFragenId: aktuellerSlide.frage.quiz_fragen_id,
        submissionId,
        visible,
      });
      setLiveResultState({
        ...liveResultState,
        moderationResponses: liveResultState.moderationResponses?.map((entry) =>
          entry.submissionId === submissionId ? { ...entry, isVisible: visible } : entry,
        ),
        publicResponses: visible
          ? [
              ...liveResultState.publicResponses.filter((entry) => entry.submissionId !== submissionId),
              ...liveResultState.moderationResponses
                ?.filter((entry) => entry.submissionId === submissionId)
                .map(({ submissionId: id, publicText }) => ({ submissionId: id, publicText })) ?? [],
            ]
          : liveResultState.publicResponses.filter((entry) => entry.submissionId !== submissionId),
      });
    } catch (error) {
      setLiveTextPublicationError(
        error instanceof Error
          ? error.message
          : "Die Freigabe konnte nicht gespeichert werden.",
      );
    } finally {
      setLiveResultPending(false);
    }
  }

  useModerationHotkeys({
    hatMedien,
    hatAudio,
    onWeiter: () => {
      void naechsterSlideAction();
    },
    onZurueck: vorherigerSlide,
    onBlockFreigeben: () => {
      void handleBlockFreigeben();
    },
    onBlockSchliessen: () => {
      void handleBlockSchliessen();
    },
    onAuswertungOeffnen: handleAuswertungOeffnen,
    onMediumToggle: () => {
      void handleMediumToggle();
    },
    onAudioToggle: () => {
      void handleAudioPlay();
    },
  });

  return (
    <>
      <ConfirmDialog
        open={confirmEndOpen}
        title="Quiz wirklich beenden?"
        danger
        confirmLabel="Quiz beenden"
        onClose={() => setConfirmEndOpen(false)}
        onConfirm={handleQuizBeenden}
      >
        <p className="text-sm text-gray-600">
          Der Timer wird gestoppt. Bereits abgegebene Antworten bleiben
          erhalten.
        </p>
      </ConfirmDialog>

      <AuswertungOverlay
        quizId={quizId}
        dialogOpen={showAuswertungDialog}
        iframeOpen={showAuswertungIframe}
        onAuswertungOeffnen={handleAuswertungOeffnen}
        onDialogSchliessen={() => setShowAuswertungDialog(false)}
        onIframeSchliessen={() => setShowAuswertungIframe(false)}
      />

      <main className="flex min-h-dvh flex-col bg-zinc-950 p-3 text-zinc-100 lg:h-dvh lg:overflow-hidden lg:p-4">
        <header className="mb-3 flex min-h-11 flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2">
          <div className="min-w-0">
            <div className="truncate font-bold">{quiz.titel ?? `Quiz ${quizId}`}</div>
          </div>
          <Link href={`/quiz/${quizId}`} className="inline-flex min-h-11 items-center rounded-lg border border-zinc-700 px-4 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
            {backToQuizLabel}
          </Link>
        </header>
        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,2.4fr)_360px] lg:overflow-hidden">
          <section className="flex min-h-0 flex-col gap-4 lg:overflow-y-auto lg:pr-1">
            <CurrentSlidePanel
              slideIndex={slideIndex}
              slides={slides}
              aktuellerSlide={aktuellerSlide}
              countdownRestSekunden={countdownRestSekunden}
              punktestand={punktestand}
              audienceInterimStandings={audienceInterimStandings}
              yearlyStandings={yearlyStandings}
              endstandRevealCount={endstandRevealCount}
              quiz={quiz}
              theme={theme}
              mediaOverlayActive={mediumOverlayAktiv}
              playbackCommand={playbackCommand}
              playbackCommandId={playbackCommandId}
              estimationPhase={estimationPhase}
              estimationQuestion={estimationQuestion}
              now={now}
              pixelState={pixelState}
              pollState={pollState}
              liveResultState={liveResultState}
              teamJoinState={teamJoinState}
              funnyAnswers={funnyAnswers}
            />

            {aktuellerSlide?.typ === "frage" && naechsterSlide?.typ === "funny" && funnyAnswers.length > 0 && (
              <section className="rounded-2xl border border-pink-500/50 bg-pink-950/30 p-4">
                <h2 className="font-bold">{funnyAnswers.length} skurrile {funnyAnswers.length === 1 ? "Antwort" : "Antworten"}</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={showFunnyAnswers} className="min-h-11 rounded-xl bg-pink-600 px-4 py-2 font-bold text-white">Falsch aber lustig anzeigen</button>
                  <button type="button" onClick={skipFunnyAnswers} className="min-h-11 rounded-xl border border-zinc-600 px-4 py-2 font-bold">Direkt zur Auflösung</button>
                </div>
              </section>
            )}

            {aktuellerSlide?.typ === "frage" && liveResultState && (
              <section className="rounded-2xl border border-cyan-500/50 bg-cyan-950/30 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-bold">Quiz-Live-Ergebnis</h2>
                    <p className="text-sm text-zinc-300">{liveResultState.finalAnswers} / {liveResultState.totalTeams} Teams haben geantwortet · {liveResultState.state === "OPEN" || liveResultState.state === "COUNTDOWN" ? "Antwortphase offen" : "Antwortphase geschlossen"}</p>
                    <p className="mt-1 text-xs text-cyan-100">
                      Publikumsansicht: {liveResultState.visible ? "Ergebnis" : "Frage"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {canCloseLiveResultAnswerPhase(liveResultState.state) && (
                      <button type="button" disabled={liveResultPending} onClick={() => void closeLiveAnswerPhase()} className="min-h-11 rounded-xl border border-zinc-600 px-4 py-2 font-bold disabled:opacity-50">Antwortphase schließen</button>
                    )}
                    {canToggleLiveResultVisibility(liveResultState.state) && (
                      <button type="button" aria-pressed={liveResultState.visible} disabled={liveResultPending} onClick={() => void toggleLiveResults()} className="min-h-11 rounded-xl bg-cyan-600 px-4 py-2 font-bold text-white disabled:opacity-50">
                        {liveResultState.visible ? "Ergebnis ausblenden" : "Ergebnis anzeigen"}
                      </button>
                    )}
                  </div>
                </div>
                {(liveResultState.state === "OPEN" || liveResultState.state === "COUNTDOWN") && (
                  <p className="mt-3 text-sm text-zinc-300">
                    Während der Antwortphase sieht das Publikum ausschließlich die Frage. Antworten können hier intern geprüft und Freitexte für die spätere Veröffentlichung vorbereitet werden.
                  </p>
                )}
                {liveResultState.state === "CLOSED" && !liveResultState.visible && (
                  <p className="mt-3 text-sm text-zinc-300">
                    Die Antwortphase ist geschlossen. „Ergebnis anzeigen“ veröffentlicht jetzt die anonyme Verteilung oder die freigegebenen Texte; die Lösung bleibt ein eigener Schritt.
                  </p>
                )}
                {liveResultState.finalAnswers === 0 && (
                  <p className="mt-2 text-sm text-amber-200">
                    Noch keine finale Antwort – die Ergebnisansicht ist derzeit leer.
                  </p>
                )}
                {liveResultControlError && (
                  <p role="alert" className="mt-3 rounded-xl border border-red-400/60 bg-red-950/50 p-3 text-sm text-red-100">
                    {liveResultControlError}
                  </p>
                )}
                <details className="mt-4 rounded-xl border border-zinc-700 bg-zinc-950/35 p-3">
                  <summary className="min-h-10 cursor-pointer select-none font-bold text-cyan-100">
                    Antworten ansehen (intern)
                  </summary>
                  <p className="mt-1 text-xs text-zinc-400">Nur in der Moderation sichtbar, nicht auf der Präsentationsfolie.</p>
                  {liveResultState.kind === "CHOICE" && (
                    <div className="mt-3 grid gap-2">
                      {liveResultState.options.map((entry) => (
                        <div key={entry.id} className="flex items-center justify-between gap-4 rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-sm">
                          <span className="truncate">{entry.label}</span>
                          <strong className="shrink-0">{entry.count} · {entry.share.toLocaleString("de-DE", { maximumFractionDigits: 1 })} %</strong>
                        </div>
                      ))}
                      {liveResultState.scale?.values.map((entry) => (
                        <div key={entry.value} className="flex items-center justify-between gap-4 rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-sm">
                          <span>Wert {entry.value.toLocaleString("de-DE")}</span>
                          <strong>{entry.count} · {entry.share.toLocaleString("de-DE", { maximumFractionDigits: 1 })} %</strong>
                        </div>
                      ))}
                    </div>
                  )}
                  {liveResultState.kind === "TEXT" && (
                    <div className="mt-4">
                    {liveTextPublicationError && (
                      <p role="alert" className="mb-3 rounded-xl border border-red-400/60 bg-red-950/50 p-3 text-sm text-red-100">
                        {liveTextPublicationError}
                      </p>
                    )}
                    <div className="grid gap-3 md:grid-cols-2">
                      {liveResultState.moderationResponses?.map((response) => (
                        <article key={response.submissionId} className="rounded-xl border border-zinc-700 bg-zinc-900/80 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-2">
                              <TeamIdentityVisual name={response.teamName} photoUrl={response.photoUrl} avatarCode={response.avatarCode} className="h-9 w-9" />
                              <strong className="truncate">{response.teamName}</strong>
                            </div>
                            <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-semibold ${response.isVisible ? "bg-emerald-950 text-emerald-200" : "bg-zinc-800 text-zinc-300"}`}>
                              {response.isVisible ? "öffentlich" : "nicht freigegeben"}
                            </span>
                          </div>
                          <dl className="mt-3 grid gap-2 text-sm">
                            <div>
                              <dt className="font-semibold text-zinc-400">Original</dt>
                              <dd className="break-words">„{response.originalText}“</dd>
                            </div>
                            <div>
                              <dt className="flex items-center gap-2 font-semibold text-zinc-400">
                                Öffentlich
                                {response.changed && (
                                  <span className="rounded-full bg-amber-950 px-2 py-0.5 text-[0.7rem] text-amber-200">
                                    Ersetzung angewendet
                                  </span>
                                )}
                              </dt>
                              <dd className={`break-words ${response.changed ? "text-amber-100" : "text-zinc-100"}`}>
                                „{response.publicText}“
                              </dd>
                            </div>
                          </dl>
                          <button type="button" disabled={liveResultPending} onClick={() => void toggleLiveTextPublication(response.submissionId, !response.isVisible)} className="mt-3 min-h-10 rounded-lg border border-zinc-600 px-3 py-1.5 text-sm font-bold disabled:opacity-50">
                            {response.isVisible ? "Freigabe zurücknehmen" : "Für Publikum freigeben"}
                          </button>
                        </article>
                      ))}
                      {(liveResultState.moderationResponses?.length ?? 0) === 0 && (
                        <p className="rounded-xl border border-dashed border-zinc-700 p-4 text-sm text-zinc-300 md:col-span-2">
                          Noch keine finalen Freitextantworten eingegangen.
                        </p>
                      )}
                    </div>
                    </div>
                  )}
                </details>
              </section>
            )}

            <SlideNotes>
              <div className="space-y-2">
                {pixelState && (aktuellerSlide?.typ === "frage" || aktuellerSlide?.typ === "aufloesung") && (
                  <div className="rounded-xl border border-fuchsia-500/50 bg-fuchsia-950/30 p-3">
                    <p><strong>Pixel-Stufe:</strong> {pixelState.effectivePixelStage} von 3</p>
                    <p><strong>Stop:</strong> {pixelState.stopped ? `${pixelState.stoppedByTeamName ?? "Team"} in Stufe ${pixelState.stoppedAtStage}` : pixelState.effectivePixelStage < 3 ? "möglich" : "in Stufe 3 deaktiviert"}</p>
                    <p><strong>Finale Antworten:</strong> {antwortStatus.antwortenEingegangen} / {antwortStatus.teamsAngemeldet}</p>
                    <p><strong>Zustand:</strong> {pixelState.submissionDeadlineAt && new Date(pixelState.submissionDeadlineAt).getTime() > now ? `${Math.max(0, Math.ceil((new Date(pixelState.submissionDeadlineAt).getTime() - now) / 1000))} Sekunden Restzeit` : pixelState.stopped ? "Countdown beendet" : "offen"}</p>
                  </div>
                )}
                {pollState && (aktuellerSlide?.typ === "frage" || aktuellerSlide?.typ === "aufloesung") && (
                  <div className="rounded-xl border border-cyan-500/50 bg-cyan-950/30 p-3">
                    <p><strong>Umfrage:</strong> {pollState.state === "OPEN" ? "offen" : "geschlossen"}</p>
                    <p><strong>Finale Antworten:</strong> {pollState.finalAnswers} / {pollState.totalTeams}</p>
                  </div>
                )}
                {aktuellerSlide?.typ === "ablauf" && (
                  <p><strong>Typ:</strong> {getQuizFlowTypeLabel(aktuellerSlide.element.type)}</p>
                )}
                {(aktuellerSlide?.typ === "frage" || aktuellerSlide?.typ === "aufloesung") && aktuellerSlide.solutionStrategy && (
                  <p><strong>Auflösungsstrategie:</strong> {getQuizSolutionStrategyLabel(aktuellerSlide.solutionStrategy)}</p>
                )}
                {aktuellerSlide?.typ === "ablauf" && aktuellerSlide.element.config.durationSeconds !== undefined && (
                  <p><strong>Geplante Verweildauer:</strong> {aktuellerSlide.element.config.durationSeconds} Sekunden</p>
                )}
                {getSlideModeratorNote(aktuellerSlide) && <p>{getSlideModeratorNote(aktuellerSlide)}</p>}
                {funnyAnswers.length > 0 && (aktuellerSlide?.typ === "frage" || aktuellerSlide?.typ === "funny" || aktuellerSlide?.typ === "aufloesung") && (
                  <div className="rounded-xl border border-pink-500/40 bg-pink-950/25 p-3">
                    <strong>Skurrile Antworten</strong>
                    <ul className="mt-2 space-y-1">{funnyAnswers.map((answer) => <li key={answer.teamAnswerId}><strong>{answer.teamName}:</strong> „{answer.answerText}“ · skurril</li>)}</ul>
                  </div>
                )}
              </div>
            </SlideNotes>

            <ModerationToolbar
              blockFreigegeben={blockFreigegeben}
              mediumOverlayAktiv={mediumOverlayAktiv}
              audioLaeuft={audioLaeuft}
              hatMedien={hatMedien}
              hatAudio={hatAudio}
              istCountdownSlide={istCountdownSlide}
              countdownDauerMinuten={countdownDauerMinuten}
              countdownRestSekunden={countdownRestSekunden}
              showSchaetzfrageControls={aktuellerSlide?.typ === "endstand"}
              onZurErstenSlide={zurErstenSlide}
              onZurueck={vorherigerSlide}
              onWeiter={naechsterSlideAction}
              onBlockToggle={handleBlockToggle}
              onMediumToggle={handleMediumToggle}
              onAudioToggle={handleAudioPlay}
              onAuswertungOeffnen={handleAuswertungOeffnen}
              onSchaetzfrageStarten={handleSchaetzfrageStarten}
              onSchaetzfrageLoesungZeigen={handleSchaetzfrageLoesungZeigen}
              onSchaetzfrageZurueck={handleSchaetzfrageZurueck}
              onCountdownDauerChange={setCountdownDauerMinuten}
              onCountdownStart={handleCountdownStart}
              onCountdownReset={handleCountdownReset}
              onQuizBeenden={() => setConfirmEndOpen(true)}
            />
          </section>

          <ModerationSidebar
            naechsterSlide={naechsterSlide}
            antwortStatus={antwortStatus}
            slideStartedAt={slideStartedAt}
            quizStartedAt={quizStartedAt}
            now={now}
            quizBeendet={quizBeendet}
            slideIndex={slideIndex}
            slidesLength={slides.length}
          />
        </div>
      </main>
    </>
  );
}
