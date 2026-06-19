"use client";

import { useEffect, useMemo, useState } from "react";
import {
  freigabeQuizBlock,
  schliesseQuizBlock,
  QuizPraesentationResult,
  getQuizPunktestand,
} from "../../actions";
import {
  buildPraesentationSlides,
  type Slide,
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
} from "../praesentation/statusActions";

import {
  ChevronLeftIcon,
  ChevronRightIcon,
  LockOpenIcon,
  LockClosedIcon,
  PhotoIcon,
  SpeakerWaveIcon,
  ChartBarIcon,
  PlayIcon,
  ArrowPathIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";

type ModerationStatus = {
  slide_index: number;
  slide_started_at: string | null;
  quiz_started_at: string | null;
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
  initialStatus: ModerationStatus;
  initialAntwortStatus: AntwortStatus;
};

function istFragenblockTyp(abschnittTyp: string | null | undefined) {
  return abschnittTyp === "fragenrunde" || abschnittTyp === "fragenblock";
}

function formatSeconds(seconds: number | null | undefined) {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) {
    return "--:--";
  }

  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const rest = safeSeconds % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
      2,
      "0"
    )}:${String(rest).padStart(2, "0")}`;
  }

  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

function getAbschnittAnzeigeTitel(
  abschnitt: QuizPraesentationResult["abschnitte"][number] | null | undefined,
  slides?: Slide[]
) {
  if (!abschnitt) return "Kein Block";

  if (!istFragenblockTyp(abschnitt.abschnitt_typ)) {
    return abschnitt.titel;
  }

  if (!slides) return abschnitt.titel;

  const blockIndex = slides
    .filter(
      (slide) =>
        slide.typ === "block" && istFragenblockTyp(slide.abschnitt.abschnitt_typ)
    )
    .findIndex(
      (slide) =>
        slide.typ === "block" &&
        slide.abschnitt.quiz_abschnitt_id === abschnitt.quiz_abschnitt_id
    );

  return blockIndex >= 0 ? `Block ${blockIndex + 1}` : abschnitt.titel;
}

function getSlideTitel(slide: Slide | undefined, slides?: Slide[]) {
  if (!slide) return "Kein Slide";

  if (slide.typ === "fixer-slide") {
    if (slide.slideTyp === "vor-dem-start") return "Vor dem Start";
    if (slide.slideTyp === "startsequenz") return "Startsequenz";
    if (slide.slideTyp === "begruessung") return "Begrüßung";
    if (slide.slideTyp === "preise") return "Preise";
    if (slide.slideTyp === "regeln") return "Regeln";
    if (slide.slideTyp === "qrcode") return "QR-Code";
    if (slide.slideTyp === "bekanntmachungen") return "Bekanntmachungen";
    return slide.slideTyp;
  }

  if (slide.typ === "block") {
    return getAbschnittAnzeigeTitel(slide.abschnitt, slides);
  }

  if (slide.typ === "frage") return slide.frage.frage ?? "Frage";
  if (slide.typ === "aufloesung") return `Auflösung: ${slide.frage.frage ?? "Frage"}`;
  if (slide.typ === "pause") return `Countdown: ${getAbschnittAnzeigeTitel(slide.abschnitt, slides)}`;
  if (slide.typ === "zwischenstand") return "Zwischenstand";
  if (slide.typ === "endstand") return "Endstand";

  return "Slide";
}

function secondsSince(startAt: string | null, now: number) {
  if (!startAt) return null;

  return Math.max(
    0,
    Math.floor((now - new Date(startAt).getTime()) / 1000)
  );
}

function LiveTimer({
  label,
  startAt,
  now,
  emptyText = "Noch nicht gestartet",
}: {
  label: string;
  startAt: string | null;
  now: number;
  emptyText?: string;
}) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const seconds = isMounted ? secondsSince(startAt, now) : null;

  return (
    <div className="rounded-xl bg-zinc-950 p-4">
      <div className="text-sm text-zinc-400">{label}</div>
      <div className="mt-1 text-2xl font-black">
        {!isMounted ? "--:--" : seconds === null ? emptyText : formatSeconds(seconds)}
      </div>
    </div>
  );
}

function SlidePreview({
  slide,
  slides,
  countdownRestSekunden,
}: {
  slide: Slide | undefined;
  slides: Slide[];
  countdownRestSekunden: number;
}) {
  if (!slide) {
    return <div className="text-zinc-500">Kein Slide vorhanden</div>;
  }

  if (slide.typ === "fixer-slide") {
    return (
      <div className="flex h-full min-h-[300px] items-center justify-center text-center">
        <div>
          <div className="mb-4 text-sm uppercase tracking-[0.3em] text-cyan-300">
            Fixer Slide
          </div>
          <div className="text-5xl font-black">{getSlideTitel(slide, slides)}</div>
        </div>
      </div>
    );
  }

  if (slide.typ === "block") {
    return (
      <div className="flex h-full min-h-[300px] items-center justify-center text-center">
        <div>
          <div className="mb-4 text-sm uppercase tracking-[0.3em] text-pink-300">
            Block
          </div>
          <div className="text-5xl font-black">
            {getAbschnittAnzeigeTitel(slide.abschnitt, slides)}
          </div>
        </div>
      </div>
    );
  }

  if (slide.typ === "frage") {
    const bildMedien = slide.frage.medien.filter((medium) =>
      medium.medientyp.toLowerCase().includes("bild")
    );

    return (
      <div className="flex h-full min-h-[360px] flex-col justify-center">
        <div className="mb-4 text-sm uppercase tracking-[0.3em] text-cyan-300">
          Frage {slide.frageIndexImBlock} / {slide.fragenAnzahlImBlock}
        </div>

        <div className="grid items-center gap-8 md:grid-cols-[1.2fr_0.8fr]">
          <div className="text-4xl font-black leading-tight">
            {slide.frage.frage}
          </div>

          {bildMedien.length > 0 && (
            <div className="overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-950">
              <img
                src={bildMedien[0].datei}
                alt=""
                className="max-h-[320px] w-full object-contain"
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  if (slide.typ === "aufloesung") {
    const richtigeAntworten = slide.frage.antworten
      .filter((antwort) => antwort.ist_richtig)
      .map((antwort) => antwort.antwort);

    return (
      <div>
        <div className="mb-4 text-sm uppercase tracking-[0.3em] text-emerald-300">
          Auflösung
        </div>
        <div className="mb-8 text-3xl font-black leading-tight">
          {slide.frage.frage}
        </div>
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/40 p-5 text-2xl font-bold text-emerald-100">
          {richtigeAntworten.length > 0
            ? richtigeAntworten.join(" / ")
            : "Keine Antwort hinterlegt"}
        </div>
      </div>
    );
  }

  if (slide.typ === "pause") {
    return (
      <div className="flex h-full min-h-[300px] items-center justify-center text-center">
        <div>
          <div className="mb-4 text-sm uppercase tracking-[0.3em] text-yellow-300">
            Antwortzeit
          </div>
          <div className="text-6xl font-black">
            {formatSeconds(countdownRestSekunden)}
          </div>
        </div>
      </div>
    );
  }

  if (slide.typ === "zwischenstand") {
    return (
      <div className="flex h-full min-h-[300px] items-center justify-center text-center">
        <div className="text-5xl font-black">Zwischenstand</div>
      </div>
    );
  }

  if (slide.typ === "endstand") {
    return (
      <div className="flex h-full min-h-[300px] items-center justify-center text-center">
        <div className="text-5xl font-black">Endstand</div>
      </div>
    );
  }

  return <div className="text-zinc-500">Unbekannter Slide</div>;
}

function ProgressBlock({
  slideIndex,
  slidesLength,
  quizStartedAt,
  now,
}: {
  slideIndex: number;
  slidesLength: number;
  quizStartedAt: string | null;
  now: number;
}) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const currentSlideNumber = slidesLength === 0 ? 0 : slideIndex + 1; const completedSlides = Math.max(0, slideIndex);
  const remainingSlides = Math.max(0, slidesLength - currentSlideNumber);
  const progressPercent =
    slidesLength > 0 ? Math.round((currentSlideNumber / slidesLength) * 100) : 0;

  const elapsedSeconds = secondsSince(quizStartedAt, now);
  const averageSecondsPerCompletedSlide =
    elapsedSeconds !== null && completedSlides > 0
      ? elapsedSeconds / completedSlides
      : null;

  const estimatedRemainingSeconds =
    averageSecondsPerCompletedSlide !== null
      ? Math.round(averageSecondsPerCompletedSlide * remainingSlides)
      : null;

  const estimatedEndAt =
    estimatedRemainingSeconds !== null
      ? new Date(now + estimatedRemainingSeconds * 1000)
      : null;

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Fortschritt</h2>
        <div className="text-xl font-black text-cyan-300">
          {progressPercent}%
        </div>
      </div>

      <div className="mb-3 h-3 overflow-hidden rounded-full bg-zinc-800">
        <div
          className="h-full rounded-full bg-cyan-400 transition-all"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="rounded-xl bg-zinc-950 p-2">
          <div className="text-xl font-black">
            {currentSlideNumber} / {slidesLength}
          </div>
          <div className="mt-1 text-xs text-zinc-400">Slides</div>
        </div>

        <div className="rounded-xl bg-zinc-950 p-2">
          <div className="text-xl font-black">{remainingSlides}</div>
          <div className="mt-1 text-xs text-zinc-400">verbleibend</div>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 text-center">
        <div className="rounded-xl bg-zinc-950 p-2">
          <div className="text-xl font-black">
            {isMounted ? formatSeconds(estimatedRemainingSeconds) : "--:--"}
          </div>
          <div className="mt-1 text-xs text-zinc-400">Prognose Rest</div>
        </div>

        <div className="rounded-xl bg-zinc-950 p-2">
          <div className="text-xl font-black">
            {isMounted && estimatedEndAt
              ? estimatedEndAt.toLocaleTimeString("de-DE", {
                hour: "2-digit",
                minute: "2-digit",
              })
              : "--:--"}
          </div>
          <div className="mt-1 text-xs text-zinc-400">Prognose Ende</div>
        </div>
      </div>

      {!quizStartedAt && (
        <div className="mt-4 text-sm text-zinc-500">
          Prognose startet, sobald das Quiz gestartet wurde.
        </div>
      )}
    </div>
  );
}

export default function ModerationClient({
  quizId,
  quiz,
  initialStatus,
  initialAntwortStatus,
}: Props) {
  const slides = useMemo(() => buildPraesentationSlides(quiz), [quiz]);
  const [now, setNow] = useState(() => Date.now());

  const [slideIndex, setSlideIndex] = useState(() =>
    Math.min(
      Math.max(initialStatus.slide_index, 0),
      Math.max(slides.length - 1, 0)
    )
  );

  const [slideStartedAt, setSlideStartedAt] = useState(
    initialStatus.slide_started_at
  );
  const [quizStartedAt] = useState(initialStatus.quiz_started_at);
  const [antwortStatus] = useState(initialAntwortStatus);
  const [mediumOverlayAktiv, setMediumOverlayAktivLokal] =
    useState(false);

  const aktuellerSlide = slides[slideIndex];
  const pauseVerstrichen =
    aktuellerSlide?.typ === "pause"
      ? secondsSince(slideStartedAt, now) ?? 0
      : 0;

  const istPauseAbgelaufen =
    aktuellerSlide?.typ === "pause" &&
    pauseVerstrichen >= aktuellerSlide.dauerSekunden;


  const naechsterSlide = slides[slideIndex + 1];
  const istCountdownSlide =
    aktuellerSlide?.typ === "pause";

  const aktuelleMedien =
    aktuellerSlide?.typ === "frage"
      ? aktuellerSlide.frage.medien
      : aktuellerSlide?.typ === "aufloesung"
        ? [
          ...aktuellerSlide.frage.medien,
          ...aktuellerSlide.frage.antworten.flatMap((antwort) => antwort.medien),
        ]
        : [];

  const hatMedien = aktuelleMedien.length > 0;

  const hatAudio =
    aktuellerSlide?.typ === "fixer-slide" &&
      aktuellerSlide.slideTyp === "startsequenz"
      ? true
      : aktuelleMedien.some((medium) =>
        medium.medientyp.toLowerCase().includes("audio")
      );

  const [audioLaeuft, setAudioLaeuft] = useState(false);

  const [showAuswertungDialog, setShowAuswertungDialog] =
    useState(false);

  const [blockFreigegeben, setBlockFreigegeben] = useState(false);

  const [countdownDauerMinuten, setCountdownDauerMinuten] =
    useState(5);

  const [countdownStartedAt, setCountdownStartedAt] =
    useState<string | null>(null);

  const [countdownStatus, setCountdownStatus] =
    useState<string | null>("idle");

  const [showAuswertungIframe, setShowAuswertungIframe] =
    useState(false);

  const countdownVerstrichen =
    countdownStartedAt
      ? secondsSince(countdownStartedAt, now) ?? 0
      : 0;

  const countdownRestSekunden =
    Math.max(
      0,
      countdownDauerMinuten * 60 - countdownVerstrichen
    );

  const [auswertungDialogBereitsGezeigt,
    setAuswertungDialogBereitsGezeigt] = useState(false);

  const [endstandRevealCount, setEndstandRevealCountLokal] = useState(1);

  useEffect(() => {
    if (!istPauseAbgelaufen) return;
    if (auswertungDialogBereitsGezeigt) return;

    setShowAuswertungDialog(true);
    setAuswertungDialogBereitsGezeigt(true);
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
      Math.round((Date.now() - new Date(slideStartedAt).getTime()) / 1000)
    );

    await speicherePraesentationsdauer({
      quizFragenId: aktuellerSlide.frage.quiz_fragen_id,
      dauerSekunden,
    });
  }

  async function goToSlide(nextIndex: number) {
    const safeIndex = Math.min(
      Math.max(nextIndex, 0),
      Math.max(slides.length - 1, 0)
    );

    if (safeIndex === slideIndex) return;

    await speichereDauerVomAktuellenSlide();

    const newStartedAt = new Date().toISOString();

    setMediumOverlayAktivLokal(false);

    await setMediumOverlayAktiv({
      quizId,
      aktiv: false,
    });

    setSlideIndex(safeIndex);
    setSlideStartedAt(newStartedAt);
    setShowAuswertungDialog(false);
    setAuswertungDialogBereitsGezeigt(false);
    setEndstandRevealCountLokal(1);

    await setPraesentationSlideIndex(quizId, safeIndex);
  }

  async function handleBlockFreigeben() {
    const abschnitt =
      aktuellerSlide && "abschnitt" in aktuellerSlide
        ? aktuellerSlide.abschnitt
        : null;

    if (!abschnitt?.quiz_abschnitt_id) return;

    await freigabeQuizBlock({
      quizId,
      quizAbschnittId: abschnitt.quiz_abschnitt_id,
    });
  }

  async function handleBlockSchliessen() {
    const abschnitt =
      aktuellerSlide && "abschnitt" in aktuellerSlide
        ? aktuellerSlide.abschnitt
        : null;

    if (!abschnitt?.quiz_abschnitt_id) return;

    await schliesseQuizBlock({
      quizId,
      quizAbschnittId: abschnitt.quiz_abschnitt_id,
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

  function vorherigerSlide() {
    void goToSlide(slideIndex - 1);
  }

  async function naechsterSlideAction() {
    if (aktuellerSlide?.typ === "endstand") {
      const punktestand = await getQuizPunktestand(quizId);
      const topTeams = punktestand.slice(0, 5);

      const platzGruppen = Array.from(
        new Set(
          topTeams.map((team) =>
            topTeams.findIndex(
              (vergleichsTeam) => vergleichsTeam.punkte === team.punkte
            ) + 1
          )
        )
      ).sort((a, b) => b - a);

      if (endstandRevealCount < platzGruppen.length) {
        const neuerRevealCount = Math.min(
          platzGruppen.length,
          endstandRevealCount + 1
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
  async function handleMediumToggle() {
    const neuerWert = !mediumOverlayAktiv;

    setMediumOverlayAktivLokal(neuerWert);

    await setMediumOverlayAktiv({
      quizId,
      aktiv: neuerWert,
    });
  }

  async function handleAudioPlay() {
    const naechsteAktion = audioLaeuft ? "pause" : "play";

    setAudioLaeuft(!audioLaeuft);

    await setAudioAktion({
      quizId,
      aktion: naechsteAktion,
    });
  }

  function handleAuswertungOeffnen() {
    setShowAuswertungIframe(true);
    setShowAuswertungDialog(false);
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

  useEffect(() => {
    if (countdownStatus !== "running") return;
    if (countdownRestSekunden > 0) return;
    if (auswertungDialogBereitsGezeigt) return;

    setCountdownStatus("finished");
    setAuswertungDialogBereitsGezeigt(true);

    void handleBlockSchliessen();

    setShowAuswertungDialog(true);

    void beendeCountdown({
      quizId,
    });
  }, [
    countdownStatus,
    countdownRestSekunden,
    auswertungDialogBereitsGezeigt,
    quizId,
  ]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();

      if (
        tagName === "input" ||
        tagName === "textarea" ||
        tagName === "select" ||
        target?.isContentEditable
      ) {
        return;
      }

      if (
        event.key === "ArrowRight" ||
        event.key === "PageDown" ||
        event.key === " "
      ) {
        event.preventDefault();
        naechsterSlideAction();
        return;
      }

      if (
        event.key === "ArrowLeft" ||
        event.key === "PageUp" ||
        event.key === "Backspace"
      ) {
        event.preventDefault();
        vorherigerSlide();
        return;
      }

      if (event.key.toLowerCase() === "f") {
        event.preventDefault();

        if (!document.fullscreenElement) {
          void document.documentElement.requestFullscreen();
        } else {
          void document.exitFullscreen();
        }
      }
      if (event.key.toLowerCase() === "b") {
        event.preventDefault();
        void handleBlockFreigeben();
        return;
      }

      if (event.key.toLowerCase() === "s") {
        event.preventDefault();
        void handleBlockSchliessen();
        return;
      }

      if (event.key.toLowerCase() === "a") {
        event.preventDefault();
        handleAuswertungOeffnen();
        return;
      }

      if (event.key.toLowerCase() === "i") {
        event.preventDefault();

        if (hatMedien) {
          void handleMediumToggle();
        }

        return;
      }

      if (event.key.toLowerCase() === "m") {
        event.preventDefault();

        if (hatAudio) {
          void handleAudioPlay();
        }

        return;
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    slideIndex,
    slides.length,
    aktuellerSlide,
    slideStartedAt,
    hatMedien,
    hatAudio,
    mediumOverlayAktiv,
    audioLaeuft,
  ]);

  return (
    <>
      {showAuswertungDialog && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 p-6">
          <div className="w-full max-w-xl rounded-3xl border border-zinc-700 bg-zinc-900 p-8 text-white shadow-2xl">
            <div className="mb-4 text-sm font-black uppercase tracking-[0.3em] text-cyan-300">
              Antwortzeit beendet
            </div>

            <h2 className="mb-4 text-3xl font-black">
              Die Antworten sind eingefroren.
            </h2>

            <p className="mb-8 text-lg text-zinc-300">
              Der zuletzt automatisch gespeicherte Stand zählt. Änderungen sind ab
              jetzt nicht mehr möglich.
            </p>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  handleAuswertungOeffnen();
                  setShowAuswertungDialog(false);
                }}
                className="rounded-xl bg-cyan-500 px-5 py-3 font-bold text-black hover:bg-cyan-400"
              >
                Auswertung öffnen
              </button>

              <button
                type="button"
                onClick={() => setShowAuswertungDialog(false)}
                className="rounded-xl bg-zinc-700 px-5 py-3 font-bold hover:bg-zinc-600"
              >
                Später
              </button>
            </div>
          </div>
        </div>
      )}

      {showAuswertungIframe && (
        <div className="fixed inset-0 z-[10000] flex flex-col bg-zinc-950 p-4 text-white">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-sm font-black uppercase tracking-[0.3em] text-cyan-300">
                Auswertung
              </div>
              <div className="text-xl font-black">
                Quiz {quizId}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowAuswertungIframe(false)}
              className="rounded-xl bg-zinc-800 px-4 py-2 font-bold hover:bg-zinc-700"
            >
              Schließen
            </button>
          </div>

          <iframe
            src={`/quiz/${quizId}/auswertung`}
            className="min-h-0 flex-1 rounded-2xl border border-zinc-700 bg-white"
          />
        </div>
      )}

      <main className="h-screen overflow-hidden bg-zinc-950 p-4 text-zinc-100">
        <div className="grid h-[calc(100vh-2rem)] grid-cols-[minmax(0,2.4fr)_360px] gap-4">
          <section className="flex flex-col gap-4">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
              <div className="mb-3 text-sm text-zinc-400">
                Aktueller Slide {slideIndex + 1} / {slides.length}
              </div>

              <h1 className="text-3xl font-bold">
                {aktuellerSlide?.typ === "frage"
                  ? "Frage"
                  : aktuellerSlide?.typ === "aufloesung"
                    ? "Auflösung"
                    : getSlideTitel(aktuellerSlide, slides)}
              </h1>

              <div className="mt-6 min-h-[420px] rounded-xl border border-zinc-800 bg-black p-8 text-zinc-100">
                <SlidePreview
                  slide={aktuellerSlide}
                  slides={slides}
                  countdownRestSekunden={countdownRestSekunden}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
              <h2 className="mb-3 text-xl font-semibold">Moderationsnotizen</h2>
              <p className="text-zinc-400">Noch keine Notizen angebunden.</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={vorherigerSlide}
                className="rounded-xl bg-zinc-800 p-3 hover:bg-zinc-700"
                title="Zurück (←)"
              >
                <ChevronLeftIcon className="h-6 w-6" />
              </button>

              <button
                type="button"
                onClick={naechsterSlideAction}
                className="rounded-xl bg-cyan-500 p-3 text-black hover:bg-cyan-400"
                title="Weiter (→)"
              >
                <ChevronRightIcon className="h-6 w-6" />
              </button>

              <button
                type="button"
                onClick={handleBlockToggle}
                className={`rounded-xl p-3 ${blockFreigegeben
                  ? "bg-amber-600 hover:bg-amber-500"
                  : "bg-emerald-600 hover:bg-emerald-500"
                  }`}
                title={blockFreigegeben ? "Block schließen (S)" : "Block freigeben (B)"}
              >
                {blockFreigegeben ? (
                  <LockClosedIcon className="h-6 w-6" />
                ) : (
                  <LockOpenIcon className="h-6 w-6" />
                )}
              </button>

              <button
                type="button"
                onClick={handleMediumToggle}
                disabled={!hatMedien}
                className={`rounded-xl p-3 ${!hatMedien
                  ? "cursor-not-allowed bg-zinc-800 text-zinc-600"
                  : mediumOverlayAktiv
                    ? "bg-violet-400 text-black"
                    : "bg-violet-600 hover:bg-violet-500"
                  }`}
                title={
                  hatMedien
                    ? "Bild anzeigen / schließen (I)"
                    : "Kein Medium auf diesem Slide"
                }
              >
                <PhotoIcon className="h-6 w-6" />
              </button>

              <button
                type="button"
                onClick={handleAudioPlay}
                disabled={!hatAudio}
                className={`rounded-xl p-3 ${!hatAudio
                  ? "cursor-not-allowed bg-zinc-800 text-zinc-600"
                  : audioLaeuft
                    ? "bg-pink-400 text-black"
                    : "bg-pink-600 hover:bg-pink-500"
                  }`}
                title={hatAudio ? "Audio abspielen (M)" : "Kein Audio auf diesem Slide"}
              >
                <SpeakerWaveIcon className="h-6 w-6" />
              </button>

              <button
                type="button"
                onClick={handleAuswertungOeffnen}
                className="rounded-xl bg-zinc-700 p-3 hover:bg-zinc-600"
                title="Auswertung (A)"
              >
                <ChartBarIcon className="h-6 w-6" />
              </button>

              <div
                className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${istCountdownSlide
                  ? "border-zinc-700 bg-zinc-900"
                  : "border-zinc-800 bg-zinc-900/50"
                  }`}
              >
                <ClockIcon
                  className={`h-5 w-5 ${istCountdownSlide ? "text-cyan-300" : "text-zinc-600"
                    }`}
                />

                <input
                  type="number"
                  min={1}
                  value={countdownDauerMinuten}
                  disabled={!istCountdownSlide}
                  onChange={(event) =>
                    setCountdownDauerMinuten(Number(event.target.value))
                  }
                  className={`w-20 rounded-lg border px-2 py-1 text-right pr-2 text-sm font-bold [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${istCountdownSlide
                    ? "border-zinc-700 bg-zinc-950 text-white"
                    : "cursor-not-allowed border-zinc-800 bg-zinc-950 text-zinc-600"
                    }`}
                />

                <span
                  className={`text-xs ${istCountdownSlide ? "text-zinc-400" : "text-zinc-600"
                    }`}
                >
                  min
                </span>

                <div
                  className={`w-16 text-center text-sm font-black ${istCountdownSlide ? "text-cyan-300" : "text-zinc-600"
                    }`}
                >
                  {formatSeconds(countdownRestSekunden)}
                </div>

                <button
                  type="button"
                  onClick={handleCountdownStart}
                  disabled={!istCountdownSlide}
                  className={`rounded-lg p-2 ${istCountdownSlide
                    ? "bg-emerald-600 hover:bg-emerald-500"
                    : "cursor-not-allowed bg-zinc-800 text-zinc-600"
                    }`}
                  title="Countdown starten"
                >
                  <PlayIcon className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  onClick={handleCountdownReset}
                  disabled={!istCountdownSlide}
                  className={`rounded-lg p-2 ${istCountdownSlide
                    ? "bg-zinc-700 hover:bg-zinc-600"
                    : "cursor-not-allowed bg-zinc-800 text-zinc-600"
                    }`}
                  title="Countdown zurücksetzen"
                >
                  <ArrowPathIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          </section>

          <aside className="flex min-h-0 flex-col gap-3 overflow-hidden">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
              <h2 className="mb-2 text-lg font-semibold">Nächster Slide</h2>
              <div className="line-clamp-3 rounded-xl border border-zinc-800 bg-black p-3 text-sm font-semibold text-zinc-300">
                {getSlideTitel(naechsterSlide, slides)}
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
              <h2 className="mb-3 text-lg font-semibold">Antworten</h2>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-zinc-950 p-2">
                  <div className="text-xl font-black">
                    {antwortStatus.teamsAngemeldet}
                  </div>
                  <div className="mt-1 text-[11px] text-zinc-400">Teams</div>
                </div>

                <div className="rounded-xl bg-zinc-950 p-2">
                  <div className="text-xl font-black">
                    {antwortStatus.antwortenEingegangen}
                  </div>
                  <div className="mt-1 text-[11px] text-zinc-400">Antworten</div>
                </div>

                <div className="rounded-xl bg-zinc-950 p-2">
                  <div className="text-xl font-black">
                    {antwortStatus.prozent}%
                  </div>
                  <div className="mt-1 text-[11px] text-zinc-400">Quote</div>
                </div>
              </div>

              <div className="mt-3 h-3 overflow-hidden rounded-full bg-zinc-800">
                <div
                  className="h-full rounded-full bg-cyan-400"
                  style={{ width: `${antwortStatus.prozent}%` }}
                />
              </div>

              <div className="mt-2 text-xs text-zinc-400">
                {antwortStatus.letzteAntwortAt
                  ? `Letzte Antwort: ${new Date(
                    antwortStatus.letzteAntwortAt
                  ).toLocaleTimeString("de-DE", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}`
                  : "Noch keine Antwort eingegangen"}
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
              <h2 className="mb-3 text-lg font-semibold">Zeit</h2>

              <div className="grid grid-cols-2 gap-2">
                <LiveTimer
                  label="Aktuelle Folie"
                  startAt={slideStartedAt}
                  now={now}
                />

                <LiveTimer
                  label="Quiz gesamt"
                  startAt={quizStartedAt}
                  now={now}
                  emptyText="Nicht gestartet"
                />
              </div>


            </div>

            <ProgressBlock
              slideIndex={slideIndex}
              slidesLength={slides.length}
              quizStartedAt={quizStartedAt}
              now={now}
            />

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 text-xs leading-relaxed text-zinc-400">
              <div className="mb-1 text-sm font-semibold text-zinc-200">
                Hotkeys
              </div>
              ←/→ Slide · Leertaste weiter · PageUp/PageDown · F Vollbild
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}
