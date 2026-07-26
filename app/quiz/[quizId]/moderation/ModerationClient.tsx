"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useModerationHotkeys } from "./hooks/useModerationHotkeys";

import {
  freigabeQuizBlock,
  schliesseQuizBlock,
  QuizPraesentationResult,
  getQuizPunktestand,
  getZufaelligeSchaetzfrage,
  setAktuelleQuizFrage,
} from "../../actions";
import {
  buildPraesentationSlides,
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
import { isQuestionSection } from "@/app/quiz/quizSectionPolicy";

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
  const slides = useMemo(() => buildPraesentationSlides(quiz), [quiz]);
  const [now, setNow] = useState(() => Date.now());

  const [slideIndex, setSlideIndex] = useState(() =>
    Math.min(
      Math.max(initialLiveState.slideIndex, 0),
      Math.max(slides.length - 1, 0),
    ),
  );

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
  const pauseVerstrichen =
    aktuellerSlide?.typ === "pause"
      ? (secondsSince(slideStartedAt, now) ?? 0)
      : 0;

  const istPauseAbgelaufen =
    aktuellerSlide?.typ === "pause" &&
    pauseVerstrichen >= aktuellerSlide.dauerSekunden;

  const naechsterSlide = slides[slideIndex + 1];
  const istCountdownSlide = aktuellerSlide?.typ === "pause";

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
        : [];

  const [punktestand, setPunktestand] = useState<
    { teamname: string; punkte: number }[]
  >([]);

  const hatMedien = aktuelleMedien.length > 0;

  const hatAudioAufFixemSlide =
    aktuellerSlide?.typ === "fixer-slide" &&
    (aktuellerSlide.slideTyp === "startsequenz" ||
      (aktuellerSlide.slideTyp === "qrcode" &&
        Boolean(quiz.intro_musik_url)) ||
      (aktuellerSlide.slideTyp === "bekanntmachungen" &&
        Boolean(quiz.outro_musik_url)));
  const hatAudio =
    hatAudioAufFixemSlide ||
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

    if (aktuellerSlide?.typ === "endstand") {
      const punktestand = await getQuizPunktestand(quizId);
      const topTeams = punktestand.slice(0, 5);

      const platzGruppen = Array.from(
        new Set(
          topTeams.map(
            (team) =>
              topTeams.findIndex(
                (vergleichsTeam) => vergleichsTeam.punkte === team.punkte,
              ) + 1,
          ),
        ),
      ).sort((a, b) => b - a);

      if (endstandRevealCount < platzGruppen.length) {
        const neuerRevealCount = Math.min(
          platzGruppen.length,
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

    await speichereDauerVomAktuellenSlide();

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

    await setPraesentationSlideIndex(quizId, safeIndex);
    const nextSlide = slides[safeIndex];
    if (
      nextSlide?.typ === "frage" &&
      nextSlide.abschnitt &&
      isQuestionSection(nextSlide.abschnitt)
    ) {
      await setAktuelleQuizFrage({
        quizId,
        quizAbschnittId: nextSlide.abschnitt.quiz_abschnitt_id,
        quizFragenId: nextSlide.frage.quiz_fragen_id,
      });
    }
    await aktualisiereAntwortStatus();
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
    if (
      aktuellerSlide?.typ !== "zwischenstand" &&
      aktuellerSlide?.typ !== "endstand"
    ) {
      return;
    }

    async function ladePunktestand() {
      const daten = await getQuizPunktestand(quizId);
      setPunktestand(daten);
    }

    void ladePunktestand();
  }, [aktuellerSlide?.typ, quizId]);

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
              endstandRevealCount={endstandRevealCount}
              quiz={quiz}
              theme={theme}
              mediaOverlayActive={mediumOverlayAktiv}
              playbackCommand={playbackCommand}
              playbackCommandId={playbackCommandId}
              estimationPhase={estimationPhase}
              estimationQuestion={estimationQuestion}
            />

            <SlideNotes />

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
