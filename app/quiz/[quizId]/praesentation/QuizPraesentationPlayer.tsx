"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  freigabeQuizBlock,
  schliesseQuizBlock,
  setAktuelleQuizFrage,
  getQuizPunktestand,
  getZufaelligeSchaetzfrage,
} from "../../actions";

import type { QuizPraesentationResult } from "../../actions";
import { IntroSlideAnkommen } from "../slides/vor-dem-start/IntroSlideAnkommen";
import QRCode from "react-qr-code";


type Props = {
  quiz: QuizPraesentationResult;
};

type PraesentationQuiz = QuizPraesentationResult & {
  intro_startzeit?: string | null;
  intro_video_url?: string | null;
  intro_logo_url?: string | null;
  intro_wartetext?: string | null;
  intro_musik_url?: string | null;
  intro_startsequenz_text?: string | null;
  outro_bekanntmachungen?: string | null;
};

type Abschnitt = QuizPraesentationResult["abschnitte"][number];

type FixerSlideTyp =
  | "vor-dem-start"
  | "startsequenz"
  | "begruessung"
  | "preise"
  | "regeln"
  | "qrcode"
  | "bekanntmachungen";

type Medium = {
  medien_id: number;
  datei: string;
  medientyp: string;
  sortierung: number;
  bemerkung: string | null;
};

type Slide =
  | {
    typ: "fixer-slide";
    slideTyp: FixerSlideTyp;
  }
  | {
    typ: "block";
    abschnitt: Abschnitt;
  }
  | {
    typ: "frage";
    abschnitt: Abschnitt | null;
    frage: QuizPraesentationResult["fragen"][number];
    frageIndexImBlock: number;
    fragenAnzahlImBlock: number;
  }
  | {
    typ: "aufloesung";
    abschnitt: Abschnitt | null;
    frage: QuizPraesentationResult["fragen"][number];
    frageIndexImBlock: number;
    fragenAnzahlImBlock: number;
  }
  | {
    typ: "pause";
    abschnitt: Abschnitt;
    dauerSekunden: number;
  }
  | {
    typ: "zwischenstand";
    abschnitt: Abschnitt;
  }
  | {
    typ: "endstand";
    abschnitt: Abschnitt;
  };

function StartsequenzSlideInPlayer({
  audioUrl = "/medien/audio/intro/mexico.mp3",
  text = "Ein guter Zeitpunkt, um seine Grundbedürfnisse zu befriedigen.",
  onFinished,
}: {
  audioUrl?: string;
  text?: string;
  onFinished: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [started, setStarted] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [audioFehlt, setAudioFehlt] = useState(false);

  async function startIntro() {
    const audio = audioRef.current;

    if (!audio) return;

    setAudioFehlt(false);
    audio.currentTime = 0;

    await audio.play();

    const duration = Number.isFinite(audio.duration)
      ? Math.ceil(audio.duration)
      : 0;

    setStarted(true);
    setRemainingSeconds(duration);
  }

  function updateCountdown() {
    const audio = audioRef.current;

    if (!audio || !Number.isFinite(audio.duration)) return;

    const remaining = Math.max(
      0,
      Math.ceil(audio.duration - audio.currentTime)
    );

    setRemainingSeconds(remaining);
  }

  function formatTime(seconds: number | null) {
    if (seconds === null) return "--:--";

    const minutes = Math.floor(seconds / 60);
    const rest = seconds % 60;

    return `${minutes}:${String(rest).padStart(2, "0")}`;
  }

  return (
    <section className="relative flex h-full min-h-0 w-full items-center justify-center overflow-hidden rounded-[1.5rem] bg-[#050510] text-white">
      <audio
        ref={audioRef}
        src={audioUrl}
        preload="metadata"
        onTimeUpdate={updateCountdown}
        onEnded={() => {
          setRemainingSeconds(0);
          onFinished();
        }}
        onError={() => setAudioFehlt(true)}
      />

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,0,140,0.2),transparent_42%),radial-gradient(circle_at_bottom_right,rgba(0,245,255,0.18),transparent_40%)]" />

      <div className="relative flex h-full w-full flex-col items-center justify-center rounded-[1.5rem] border-4 border-cyan-400/80 bg-black/50 p-12 text-center shadow-[0_0_45px_rgba(0,240,255,0.9)]">
        <p className="mb-10 max-w-5xl text-5xl font-black leading-tight text-white drop-shadow-[0_0_14px_rgba(255,255,255,0.8)]">
          {text}
        </p>

        <div className="rounded-3xl border-4 border-pink-500 px-20 py-10 text-[10rem] font-black leading-none text-pink-300 shadow-[0_0_45px_rgba(255,0,150,0.9)] drop-shadow-[0_0_20px_rgba(255,0,150,1)]">
          {formatTime(remainingSeconds)}
        </div>

        <div className="absolute bottom-6 right-20 flex items-center gap-2">
          {!started ? (
            <button
              type="button"
              onClick={startIntro}
              className="h-10 w-10 rounded-full border border-white/20 bg-white/5 text-white/30 transition hover:border-white/60 hover:bg-white/10 hover:text-white/80"
              title="Intro starten"
            >
              ▶
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => audioRef.current?.pause()}
                className="h-10 w-10 rounded-full border border-white/20 bg-white/5 text-white/30 transition hover:border-white/60 hover:bg-white/10 hover:text-white/80"
                title="Pausieren"
              >
                ❚❚
              </button>

              <button
                type="button"
                onClick={() => audioRef.current?.play()}
                className="h-10 w-10 rounded-full border border-white/20 bg-white/5 text-white/30 transition hover:border-white/60 hover:bg-white/10 hover:text-white/80"
                title="Fortsetzen"
              >
                ▶
              </button>

              <button
                type="button"
                onClick={onFinished}
                className="h-10 w-10 rounded-full border border-white/20 bg-white/5 text-white/30 transition hover:border-white/60 hover:bg-white/10 hover:text-white/80"
                title="Weiter"
              >
                →
              </button>
            </>
          )}
        </div>

        {audioFehlt && (
          <div className="absolute bottom-8 left-10 rounded-xl border border-red-400/60 bg-red-950/70 px-5 py-3 text-sm font-bold text-red-100">
            Audiodatei konnte nicht geladen werden: {audioUrl}
          </div>
        )}
      </div>
    </section>
  );
}

function istFragenblock(abschnittTyp: string) {
  return (
    abschnittTyp === "fragenblock" ||
    abschnittTyp === "fragenrunde"
  );
}


export default function QuizPraesentationPlayer({ quiz }: Props) {
  const praesentationQuiz = quiz as PraesentationQuiz;
  const [slideIndex, setSlideIndex] = useState(0);
  const [overlayMedien, setOverlayMedien] = useState<Medium[] | null>(null);
  const [timerSekunden, setTimerSekunden] = useState<number | null>(null);
  const [timerLaeuft, setTimerLaeuft] = useState(false);
  const [showSchaetzfrage, setShowSchaetzfrage] = useState(false);
  const [timerInputMinuten, setTimerInputMinuten] = useState("5");
  const [freigabeMeldung, setFreigabeMeldung] = useState("");
  const [isFreigabeLoading, setIsFreigabeLoading] = useState(false);
  const [endstandRevealCount, setEndstandRevealCount] = useState(2);
  const [schaetzfrage, setSchaetzfrage] = useState<{
    fragen_id: number;
    frage: string;
    richtigeAntwort: string | null;
  } | null>(null);

  const [isSchaetzfrageLoading, setIsSchaetzfrageLoading] = useState(false);
  const [zeigeSchaetzAntwort, setZeigeSchaetzAntwort] = useState(false);
  const [punktestand, setPunktestand] = useState<
    {
      teamname: string;
      punkte: number;
    }[]
  >([]);

  const slides = useMemo<Slide[]>(() => {
    const result: Slide[] = [];

    const fragenrunden = quiz.abschnitte.filter(
      (abschnitt) => abschnitt.abschnitt_typ === "fragenblock"
    );

    for (const abschnitt of quiz.abschnitte) {
      const fragenImBlock = quiz.fragen
        .filter(
          (frage) =>
            Number(frage.quiz_abschnitt_id) ===
            Number(abschnitt.quiz_abschnitt_id)
        )
        .sort((a, b) => (a.sortierung ?? 0) - (b.sortierung ?? 0));

      if (abschnitt.abschnitt_typ === "intro") {
        result.push({ typ: "fixer-slide", slideTyp: "vor-dem-start" });
        result.push({ typ: "fixer-slide", slideTyp: "startsequenz" });
        result.push({ typ: "fixer-slide", slideTyp: "begruessung" });
        result.push({ typ: "fixer-slide", slideTyp: "preise" });
        result.push({ typ: "fixer-slide", slideTyp: "regeln" });
        result.push({ typ: "fixer-slide", slideTyp: "qrcode" });
        continue;
      }

      if (abschnitt.abschnitt_typ === "outro") {
        result.push({ typ: "fixer-slide", slideTyp: "bekanntmachungen" });
        continue;
      }

      result.push({
        typ: "block",
        abschnitt,
      });

      if (abschnitt.abschnitt_typ === "fragenblock") {
        fragenImBlock.forEach((frage, index) => {
          result.push({
            typ: "frage",
            abschnitt,
            frage,
            frageIndexImBlock: index + 1,
            fragenAnzahlImBlock: fragenImBlock.length,
          });
        });

        if (fragenImBlock.length > 0) {
          result.push({
            typ: "pause",
            abschnitt,
            dauerSekunden: abschnitt.dauer_sekunden ?? 300,
          });
        }

        fragenImBlock.forEach((frage, index) => {
          result.push({
            typ: "aufloesung",
            abschnitt,
            frage,
            frageIndexImBlock: index + 1,
            fragenAnzahlImBlock: fragenImBlock.length,
          });
        });

        if (fragenImBlock.length > 0) {
          const istLetzteFragenrunde =
            fragenrunden[fragenrunden.length - 1]?.quiz_abschnitt_id ===
            abschnitt.quiz_abschnitt_id;

          result.push({
            typ: istLetzteFragenrunde ? "endstand" : "zwischenstand",
            abschnitt,
          });
        }

        continue;
      }

      fragenImBlock.forEach((frage, index) => {
        result.push({
          typ: "frage",
          abschnitt,
          frage,
          frageIndexImBlock: index + 1,
          fragenAnzahlImBlock: fragenImBlock.length,
        });
      });
    }

    const fragenOhneBlock = quiz.fragen
      .filter((frage) => frage.quiz_abschnitt_id == null)
      .sort((a, b) => (a.sortierung ?? 0) - (b.sortierung ?? 0));

    if (fragenOhneBlock.length > 0) {
      fragenOhneBlock.forEach((frage, index) => {
        result.push({
          typ: "frage",
          abschnitt: null,
          frage,
          frageIndexImBlock: index + 1,
          fragenAnzahlImBlock: fragenOhneBlock.length,
        });

        result.push({
          typ: "aufloesung",
          abschnitt: null,
          frage,
          frageIndexImBlock: index + 1,
          fragenAnzahlImBlock: fragenOhneBlock.length,
        });
      });
    }

    return result;
  }, [quiz.abschnitte, quiz.fragen]);
  const slide = slides[slideIndex];

  const hatGleichstandAufPlatz1 =
    punktestand.length > 1 &&
    punktestand[0].punkte === punktestand[1].punkte;
  useEffect(() => {
    if (slide?.typ === "pause") {
      setTimerSekunden(slide.dauerSekunden);
      setTimerInputMinuten(String(slide.dauerSekunden / 60));
      setTimerLaeuft(false);
    } else {
      setTimerSekunden(null);
      setTimerLaeuft(false);
    }
  }, [slideIndex, slide]);

  useEffect(() => {
    if (!timerLaeuft || timerSekunden === null || timerSekunden <= 0) {
      return;
    }


    const interval = window.setInterval(() => {
      setTimerSekunden((current) => {
        if (current === null || current <= 1) {
          window.clearInterval(interval);
          setTimerLaeuft(false);

          setTimeout(() => {
            handleBlockSchliessen();
          }, 0);

          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [timerLaeuft, timerSekunden]);

  useEffect(() => {
    if (slide?.typ === "endstand") {
      setEndstandRevealCount(2);
    }
  }, [slideIndex, slide?.typ]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const activeElement = document.activeElement as HTMLElement | null;
      const element = target ?? activeElement;

      const tagName = element?.tagName?.toLowerCase();

      const isInput =
        tagName === "input" ||
        tagName === "textarea" ||
        tagName === "select" ||
        element?.isContentEditable;

      if (isInput) {
        return;
      }

      if (
        event.key === "ArrowRight" ||
        event.key === " " ||
        event.key === "PageDown"
      ) {
        event.preventDefault();
        nextSlide();
        return;
      }

      if (
        event.key === "ArrowLeft" ||
        event.key === "Backspace" ||
        event.key === "PageUp"
      ) {
        event.preventDefault();
        previousSlide();
        return;
      }

      if (event.key.toLowerCase() === "f") {
        event.preventDefault();

        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen();
        } else {
          document.exitFullscreen();
        }
      }

      if (event.key === "Escape") {
        setOverlayMedien(null);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [slideIndex, slides.length]);

  useEffect(() => {
    if (
      slide?.typ !== "frage" ||
      !slide.abschnitt ||
      !istFragenblock(slide.abschnitt.abschnitt_typ)
    ) {
      return;
    }

    setAktuelleQuizFrage({
      quizId: quiz.quiz_id,
      quizAbschnittId: slide.abschnitt.quiz_abschnitt_id,
      quizFragenId: slide.frage.quiz_fragen_id,
    });
  }, [slideIndex]);

  useEffect(() => {
    if (slide?.typ !== "zwischenstand" && slide?.typ !== "endstand") {
      return;
    }

    async function ladePunktestand() {
      const result = await getQuizPunktestand(quiz.quiz_id);
      setPunktestand(result);
    }

    ladePunktestand();
  }, [slideIndex, quiz.quiz_id, slide?.typ]);

  function nextSlide() {
    if (overlayMedien) {
      setOverlayMedien(null);

      if (slideIndex >= slides.length - 1) return;
      setSlideIndex((current) => current + 1);
      return;
    }

    if (slide?.typ === "endstand" && endstandRevealCount < 5) {
      setEndstandRevealCount((current) => Math.min(5, current + 1));
      return;
    }

    if (
      slide?.typ === "frage" &&
      slide.frage.medien.length > 0
    ) {
      setOverlayMedien(slide.frage.medien);
      return;
    }

    if (slideIndex >= slides.length - 1) return;

    setSlideIndex((current) => current + 1);
    setOverlayMedien(null);
  }

  function previousSlide() {
    if (slideIndex <= 0) return;
    setSlideIndex((current) => current - 1);
    setOverlayMedien(null);
  }
  function getAktuellerFragenrundenAbschnitt() {
    if (!slide) return null;

    if (
      slide.typ === "block" &&
      istFragenblock(slide.abschnitt.abschnitt_typ)
    ) {
      return slide.abschnitt;
    }

    if (slide.typ === "pause") {
      return slide.abschnitt;
    }

    return null;
  }

  async function handleBlockFreigeben() {
    const abschnitt = getAktuellerFragenrundenAbschnitt();

    if (!abschnitt) {
      return;
    }

    setIsFreigabeLoading(true);
    setFreigabeMeldung("");

    const result = await freigabeQuizBlock({
      quizId: quiz.quiz_id,
      quizAbschnittId: abschnitt.quiz_abschnitt_id,
    });

    setIsFreigabeLoading(false);
    setFreigabeMeldung(result.message);
  }

  async function handleBlockSchliessen() {
    const abschnitt = getAktuellerFragenrundenAbschnitt();

    if (!abschnitt) {
      return;
    }

    setIsFreigabeLoading(true);
    setFreigabeMeldung("");

    const result = await schliesseQuizBlock({
      quizId: quiz.quiz_id,
      quizAbschnittId: abschnitt.quiz_abschnitt_id,
    });

    setIsFreigabeLoading(false);
    setFreigabeMeldung(result.message);
  }

  async function handleSchaetzfrageStarten() {
    setIsSchaetzfrageLoading(true);
    setZeigeSchaetzAntwort(false);

    const frage = await getZufaelligeSchaetzfrage();

    setSchaetzfrage(frage);
    setShowSchaetzfrage(true);
    setIsSchaetzfrageLoading(false);
  }

  function getMediumUrl(datei: string) {
    if (datei.startsWith("http://") || datei.startsWith("https://")) {
      return datei;
    }

    return `/medien/${datei}`;
  }

  function isBild(datei: string) {
    return /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(datei);
  }

  function isAudio(datei: string) {
    return /\.(mp3|wav|ogg|m4a)$/i.test(datei);
  }

  function isVideo(datei: string) {
    return /\.(mp4|webm|mov)$/i.test(datei);
  }

  function sortiereAntworten(frage: QuizPraesentationResult["fragen"][number]) {
    return [...frage.antworten].sort((a, b) => {
      const indexA = frage.antwort_reihenfolge.indexOf(a.antwort_id);
      const indexB = frage.antwort_reihenfolge.indexOf(b.antwort_id);

      if (indexA === -1 && indexB === -1) return a.antwort_id - b.antwort_id;
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;

      return indexA - indexB;
    });
  }

  function renderMedienKarte(medium: Medium, variant: "small" | "large") {
    const isLarge = variant === "large";
    const src = getMediumUrl(medium.datei);

    return (
      <div
        key={medium.medien_id}
        className={`flex min-h-0 flex-col justify-center overflow-hidden rounded-[1.5rem] border-4 border-cyan-300 bg-black/65 p-4 shadow-[8px_8px_0_#ff00aa] ${isLarge ? "h-full" : ""
          }`}
      >
        {isBild(medium.datei) ? (
          <img
            src={src}
            alt={medium.bemerkung ?? medium.datei}
            className="h-full max-h-full w-full rounded-2xl object-contain"
          />
        ) : isAudio(medium.datei) ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-6">
            <div className="text-7xl font-black text-yellow-200 drop-shadow-[5px_5px_0_#ff00aa]">
              ▶
            </div>
            <audio controls src={src} className="w-full" />
          </div>
        ) : isVideo(medium.datei) ? (
          <video
            controls
            src={src}
            className="h-full max-h-full w-full rounded-2xl object-contain"
          />
        ) : (
          <div className="break-all text-3xl font-black text-yellow-200">
            {medium.datei}
          </div>
        )}

        {medium.bemerkung && (
          <div className="mt-3 text-sm font-bold text-white/70">
            {medium.bemerkung}
          </div>
        )}
      </div>
    );
  }

  function renderAntwortOptionen(
    frage: QuizPraesentationResult["fragen"][number]
  ) {
    const antworten = sortiereAntworten(frage);
    const hatAntwortmoeglichkeiten = antworten.length > 1;

    if (!hatAntwortmoeglichkeiten) {
      return (
        <div className="flex h-full items-center justify-center rounded-[1.5rem] border-4 border-dashed border-yellow-300 bg-black/40 p-8 text-center text-2xl font-black uppercase text-white/40">
          Offene Frage
        </div>
      );
    }

    return (
      <div className="grid h-full min-h-0 content-center gap-4">
        {antworten.map((antwort, index) => (
          <div
            key={antwort.antwort_id}
            className="rounded-3xl border-4 border-yellow-300 bg-black/45 px-6 py-4 text-2xl font-black text-white shadow-[6px_6px_0_#ff00aa] xl:text-3xl"
          >
            <span className="mr-4 text-cyan-300">
              {String.fromCharCode(65 + index)}.
            </span>
            {antwort.antwort}
          </div>
        ))}
      </div>
    );
  }

  function renderPunkteBadge(punkteModus?: string | null) {
    if (!punkteModus || punkteModus === "standard") return null;

    const label =
      punkteModus === "expertenbonus"
        ? "Expertenbonus"
        : punkteModus === "risikofrage"
          ? "Risikofrage"
          : punkteModus;

    return (
      <span className="rounded-xl border-4 border-yellow-300 bg-yellow-300 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-slate-950 shadow-[4px_4px_0_#ff00aa]">
        {label}
      </span>
    );
  }

  function renderFrageSlide(slide: Extract<Slide, { typ: "frage" }>) {
    const frage = slide.frage;
    const antworten = sortiereAntworten(frage);
    const hatAntwortmoeglichkeiten = antworten.length > 1;
    const layout = frage.praesentationslayout ?? "standard";

    const effektivesLayout =
      layout !== "standard"
        ? layout
        : hatAntwortmoeglichkeiten
          ? "antworten_fokus"
          : frage.medien.length > 0
            ? "bild_fokus"
            : "text_fokus";

    if (effektivesLayout === "bild_fokus") {
      return (
        <div className="grid h-full min-h-0 gap-4 lg:grid-cols-[0.48fr_1.52fr]">
          <div className="flex min-h-0 flex-col rounded-[1.5rem] border-4 border-pink-500 bg-slate-950/70 p-5 shadow-[7px_7px_0_#00e5ff]">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <div className="inline-flex w-fit rotate-[-2deg] rounded-xl bg-pink-500 px-4 py-2 text-xs font-black uppercase tracking-[0.25em] text-yellow-200 shadow-[4px_4px_0_#facc15]">
                Frage {slide.frageIndexImBlock}
              </div>

              {renderPunkteBadge(frage.punkte_modus)}
            </div>

            <h2 className="text-3xl font-black leading-tight text-white drop-shadow-[3px_3px_0_#ff00aa] xl:text-4xl">
              {frage.frage}
            </h2>

            {frage.medien.length > 0 && (
              <button
                type="button"
                onClick={() => setOverlayMedien(frage.medien)}
                className="mt-auto rounded-2xl border-4 border-cyan-300 bg-black px-5 py-3 font-black uppercase text-cyan-200 shadow-[5px_5px_0_#ff00aa]"
              >
                Medium groß anzeigen
              </button>
            )}
          </div>

          <div className="min-h-0 rounded-[1.5rem] border-4 border-yellow-300 bg-black/45 p-5 shadow-[8px_8px_0_#ff00aa]">
            {frage.medien.length === 0 ? (
              <div className="flex h-full items-center justify-center rounded-3xl border-4 border-dashed border-cyan-300 text-3xl font-black uppercase text-white/40">
                Kein Medium
              </div>
            ) : (
              <div className="grid h-full min-h-0 gap-4">
                {frage.medien.slice(0, 1).map((medium) =>
                  renderMedienKarte(medium, "large")
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    if (effektivesLayout === "text_fokus") {
      return (
        <div className="flex h-full min-h-0 flex-col justify-center rounded-[1.5rem] border-4 border-pink-500 bg-slate-950/70 p-10 shadow-[8px_8px_0_#00e5ff]">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="inline-flex w-fit rotate-[-2deg] rounded-xl bg-pink-500 px-4 py-2 text-xs font-black uppercase tracking-[0.25em] text-yellow-200 shadow-[4px_4px_0_#facc15]">
              Frage {slide.frageIndexImBlock}
            </div>

            {renderPunkteBadge(frage.punkte_modus)}
          </div>

          <h2 className="text-5xl font-black leading-tight text-white drop-shadow-[5px_5px_0_#ff00aa] xl:text-7xl">
            {frage.frage}
          </h2>
        </div>
      );
    }

    if (effektivesLayout === "audio_fokus") {
      return (
        <div className="grid h-full min-h-0 gap-4 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="flex min-h-0 flex-col justify-center rounded-[1.5rem] border-4 border-pink-500 bg-slate-950/70 p-7 shadow-[7px_7px_0_#00e5ff]">
            <h2 className="text-4xl font-black leading-tight text-white drop-shadow-[4px_4px_0_#ff00aa] xl:text-5xl">
              {frage.frage}
            </h2>
          </div>

          <div className="flex min-h-0 flex-col justify-center rounded-[1.5rem] border-4 border-yellow-300 bg-black/55 p-8 text-center shadow-[8px_8px_0_#ff00aa]">
            <div className="mb-5 text-sm font-black uppercase tracking-[0.3em] text-cyan-300">
              Audio
            </div>

            {frage.medien.length === 0 ? (
              <div className="text-3xl font-black uppercase text-white/40">
                Keine Audiodatei
              </div>
            ) : (
              frage.medien.slice(0, 1).map((medium) =>
                renderMedienKarte(medium, "large")
              )
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="grid h-full min-h-0 gap-4 lg:grid-cols-[0.92fr_1.08fr]">
        <div className="flex min-h-0 flex-col rounded-[1.5rem] border-4 border-pink-500 bg-gradient-to-br from-slate-950 to-purple-950 p-6 shadow-[8px_8px_0_#00e5ff]">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="inline-flex w-fit rotate-[-2deg] rounded-xl bg-pink-500 px-4 py-2 text-xs font-black uppercase tracking-[0.25em] text-yellow-200 shadow-[4px_4px_0_#facc15]">
              Frage {slide.frageIndexImBlock}
            </div>

            {renderPunkteBadge(frage.punkte_modus)}
          </div>

          <h2 className="text-4xl font-black leading-tight text-white drop-shadow-[4px_4px_0_#ff00aa] xl:text-6xl">
            {frage.frage}
          </h2>

          {frage.medien.length > 0 && (
            <button
              type="button"
              onClick={() => setOverlayMedien(frage.medien)}
              className="mt-auto w-fit rounded-2xl border-4 border-cyan-300 bg-black px-5 py-3 font-black uppercase text-cyan-200 shadow-[5px_5px_0_#ff00aa]"
            >
              Medium groß anzeigen
            </button>
          )}
        </div>

        <div className="min-h-0 rounded-[1.5rem] border-4 border-yellow-300 bg-gradient-to-br from-blue-950 to-slate-950 p-5 shadow-[8px_8px_0_#ff00aa]">
          {hatAntwortmoeglichkeiten ? (
            renderAntwortOptionen(frage)
          ) : frage.medien.length > 0 ? (
            <div className="grid h-full min-h-0 gap-3">
              {frage.medien.slice(0, 1).map((medium) =>
                renderMedienKarte(medium, "large")
              )}
            </div>
          ) : (
            <div className="flex h-full items-center justify-center rounded-3xl border-4 border-dashed border-cyan-300 bg-black/40 text-center text-xl font-black uppercase text-white/40">
              Keine Antwortmöglichkeiten
            </div>
          )}
        </div>
      </div>
    );
  }

  function renderRennPferd({
    farbe,
    nummer,
  }: {
    farbe: string;
    nummer: number;
  }) {
    return (
      <div className="relative h-20 w-32 animate-[pferdGalopp_0.55s_ease-in-out_infinite]">
        <svg
          viewBox="0 0 220 120"
          className="h-full w-full drop-shadow-[4px_4px_0_#000]"
        >
          <g
            fill={farbe}
            stroke="#020617"
            strokeWidth="7"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <ellipse cx="94" cy="62" rx="54" ry="26" />
            <path d="M125 54 L154 24 L174 34 L145 63 Z" />
            <path d="M164 20 L199 29 L190 51 L158 44 Z" />
            <path d="M171 20 L178 5 L185 22 Z" />

            <path className="animate-[schweifWackel_0.45s_ease-in-out_infinite]" d="M42 55 Q8 34 18 78 Q32 66 50 69" />

            <path d="M61 82 L38 108" />
            <path d="M84 86 L74 114" />
            <path d="M116 84 L135 111" />
            <path d="M140 78 L176 101" />
          </g>

          <circle cx="181" cy="34" r="4" fill="#020617" />

          <g>
            <rect
              x="76"
              y="47"
              width="36"
              height="28"
              rx="6"
              fill="#f8fafc"
              stroke="#020617"
              strokeWidth="4"
            />
            <text
              x="94"
              y="68"
              textAnchor="middle"
              fontSize="20"
              fontWeight="900"
              fill="#020617"
            >
              {nummer}
            </text>
          </g>
        </svg>
      </div>
    );
  }
  function renderZwischenstandSlide() {
    const sortiertePunkte = [...punktestand]
      .sort((a, b) => b.punkte - a.punkte)
      .slice(0, 5);

    const maxPunkte = Math.max(
      ...sortiertePunkte.map((team) => team.punkte),
      1
    );

    const pferdeFarben = [
      "#22d3ee",
      "#fb7185",
      "#84cc16",
      "#60a5fa",
      "#f59e0b",
    ];

    const bahnFarben = [
      "from-cyan-900/80 to-cyan-700/60",
      "from-pink-900/80 to-pink-700/60",
      "from-emerald-900/80 to-emerald-700/60",
      "from-blue-900/80 to-blue-700/60",
      "from-orange-900/80 to-orange-700/60",
      "from-purple-900/80 to-purple-700/60",
    ];

    return (
      <div className="flex h-full min-h-0 flex-col rounded-[1.5rem] border-4 border-yellow-300 bg-[radial-gradient(circle_at_50%_0%,rgba(250,204,21,0.16),transparent_35%),linear-gradient(180deg,rgba(88,28,135,0.45),rgba(2,6,23,0.92))] p-8 shadow-[8px_8px_0_#ff00aa]">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div className="inline-flex w-fit rotate-[-2deg] rounded-xl bg-pink-500 px-5 py-3 text-sm font-black uppercase tracking-[0.3em] text-yellow-200 shadow-[4px_4px_0_#00e5ff]">
            Zwischenstand
          </div>

          <div className="rounded-2xl border-4 border-yellow-300 bg-black/55 px-5 py-2 text-sm font-black uppercase tracking-[0.25em] text-yellow-200 shadow-[4px_4px_0_#ff00aa]">
            Anonymer Zwischenstand
          </div>
        </div>

        <h2 className="mb-5 text-center text-5xl font-black uppercase tracking-tight text-yellow-200 drop-shadow-[5px_5px_0_#ff00aa] xl:text-6xl">
          So eng ist das Rennen
        </h2>

        <div className="min-h-0 flex-1 rounded-[1.5rem] border-4 border-cyan-300 bg-black/45 p-4 shadow-[6px_6px_0_#ff00aa]">
          <div className="grid h-full gap-3">
            {sortiertePunkte.map((team, index) => {
              const prozent = Math.max(7, (team.punkte / maxPunkte) * 100);
              const pferdLinks = `calc(${prozent}% - 5rem)`;

              return (
                <div
                  key={`${team.teamname}-${index}`}
                  className="grid grid-cols-[90px_1fr_130px] items-center gap-4"
                >
                  <div className="flex h-full items-center justify-center rounded-2xl border-4 border-yellow-300 bg-slate-950/80 text-4xl font-black text-yellow-200 shadow-[4px_4px_0_#ff00aa]">
                    {index + 1}
                  </div>

                  <div className="relative h-full min-h-[72px] overflow-visible rounded-2xl border-4 border-cyan-300 bg-slate-950/70 shadow-[4px_4px_0_#ff00aa]">
                    <div
                      className={`absolute inset-y-0 left-0 rounded-r-xl bg-gradient-to-r ${bahnFarben[index % bahnFarben.length]
                        }`}
                      style={{
                        width: `${prozent}%`,
                        animation: `bahnWachsen 1.2s ease-out ${index * 0.12}s both`,
                      }}
                    />

                    <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,rgba(255,255,255,0.08)_0,rgba(255,255,255,0.08)_2px,transparent_2px,transparent_42px)]" />

                    <div className="absolute left-5 top-1/2 -translate-y-1/2 text-2xl font-black text-white drop-shadow-[3px_3px_0_#000]">
                      #{index + 1}
                    </div>

                    <div
                      className="absolute top-1/2 z-30"
                      style={{
                        left: pferdLinks,
                        animation: `pferdEinreiten 1.4s ease-out ${index * 0.12}s both`,
                      }}
                    >

                      {renderRennPferd({
                        farbe: pferdeFarben[index % pferdeFarben.length],
                        nummer: index + 1,
                      })}
                    </div>

                    <div
                      className="absolute top-1/2 z-30 h-4 w-16 -translate-y-1/2 rounded-full bg-yellow-200/40 blur-xl"
                      style={{
                        left: `calc(${prozent}% - 9rem)`,
                      }}
                    />

                    <div
                      className="absolute right-3 top-1/2 z-10 h-[82%] w-6 -translate-y-1/2 rounded-sm border-2 border-white shadow-[0_0_18px_#facc15]"
                      style={{
                        backgroundImage:
                          "conic-gradient(#fff 25%, #000 0 50%, #fff 0 75%, #000 0)",
                        backgroundSize: "12px 12px",
                      }}
                    />
                  </div>

                  <div className="rounded-2xl border-4 border-yellow-300 bg-black/70 px-4 py-3 text-right text-4xl font-black text-yellow-200 shadow-[4px_4px_0_#ff00aa]">
                    {team.punkte.toFixed(1)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  function renderEndstandSlide() {
    const topTeams = punktestand.slice(0, 5);
    const maxPunkte = Math.max(...topTeams.map((team) => team.punkte), 1);
    const pferdeFarben = ["#22d3ee", "#fb7185", "#84cc16", "#60a5fa", "#f59e0b"];

    if (showSchaetzfrage) {
      return (
        <div className="flex h-full min-h-0 flex-col justify-center rounded-[1.5rem] border-4 border-yellow-300 bg-black/70 p-10 text-center shadow-[8px_8px_0_#ff00aa]">
          <div className="mx-auto mb-6 inline-flex rotate-[-2deg] rounded-xl bg-pink-500 px-5 py-3 text-sm font-black uppercase tracking-[0.3em] text-yellow-200 shadow-[4px_4px_0_#00e5ff]">
            Tie-Breaker
          </div>

          <h2 className="text-6xl font-black uppercase tracking-tight text-yellow-200 drop-shadow-[5px_5px_0_#ff00aa]">
            Schätzfrage
          </h2>

          <div className="mx-auto mt-10 max-w-5xl rounded-3xl border-4 border-cyan-300 bg-slate-950/80 px-8 py-8 text-4xl font-black leading-tight text-white shadow-[6px_6px_0_#ff00aa]">
            {isSchaetzfrageLoading
              ? "Schätzfrage wird geladen..."
              : schaetzfrage?.frage ?? "Keine Schätzfrage gefunden."}
          </div>

          {zeigeSchaetzAntwort && (
            <div className="mx-auto mt-6 max-w-4xl rounded-3xl border-4 border-yellow-300 bg-yellow-300 px-8 py-6 text-4xl font-black text-slate-950 shadow-[6px_6px_0_#ff00aa]">
              {schaetzfrage?.richtigeAntwort ?? "Keine Lösung hinterlegt."}
            </div>
          )}

          <div className="mt-10 flex justify-center gap-4">
            <button
              type="button"
              onClick={() => setZeigeSchaetzAntwort(true)}
              className="rounded-xl border-4 border-yellow-300 bg-yellow-300 px-6 py-4 text-xl font-black uppercase text-slate-950 shadow-[4px_4px_0_#ff00aa]"
            >
              Lösung zeigen
            </button>

            <button
              type="button"
              onClick={() => setShowSchaetzfrage(false)}
              className="rounded-xl border-4 border-cyan-300 bg-cyan-300 px-6 py-4 text-xl font-black uppercase text-slate-950 shadow-[4px_4px_0_#ff00aa]"
            >
              Zurück zum Endstand
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="flex h-full min-h-0 flex-col rounded-[1.5rem] border-4 border-yellow-300 bg-[radial-gradient(circle_at_50%_0%,rgba(250,204,21,0.16),transparent_35%),linear-gradient(180deg,rgba(88,28,135,0.45),rgba(2,6,23,0.92))] p-8 shadow-[8px_8px_0_#ff00aa]">
        <div className="mb-4 inline-flex w-fit rotate-[-2deg] rounded-xl bg-pink-500 px-5 py-3 text-sm font-black uppercase tracking-[0.3em] text-yellow-200 shadow-[4px_4px_0_#00e5ff]">
          Endstand
        </div>

        <h2 className="mb-5 text-center text-5xl font-black uppercase tracking-tight text-yellow-200 drop-shadow-[5px_5px_0_#ff00aa]">
          Finale Tabelle
        </h2>

        <div className="min-h-0 flex-1 rounded-[1.5rem] border-4 border-cyan-300 bg-black/45 p-4 shadow-[6px_6px_0_#ff00aa]">
          <div className="grid h-full gap-3">
            {topTeams.map((team, index) => {
              const prozent = Math.max(8, (team.punkte / maxPunkte) * 100);
              const pferdLinks = `calc(${prozent}% - 5rem)`;
              const istSichtbar = index >= 3 || index >= 5 - endstandRevealCount;
              const vorherigesTeam = topTeams[index - 1];

              const platz =
                vorherigesTeam && vorherigesTeam.punkte === team.punkte
                  ? topTeams.findIndex((t) => t.punkte === team.punkte) + 1
                  : index + 1;

              const istGewinner =
                team.punkte === topTeams[0].punkte;

              const istTot = !istGewinner;

              return (
                <div
                  key={team.teamname}
                  className={`grid grid-cols-[90px_1fr_150px] items-center gap-4 transition ${istSichtbar ? "opacity-100" : "opacity-30 blur-sm"
                    }`}
                >
                  <div className="flex h-full items-center justify-center rounded-2xl border-4 border-yellow-300 bg-slate-950/80 text-4xl font-black text-yellow-200 shadow-[4px_4px_0_#ff00aa]">
                    #{platz}
                  </div>

                  <div className="relative h-full min-h-[68px] overflow-visible rounded-2xl border-4 border-cyan-300 bg-slate-950/70 shadow-[4px_4px_0_#ff00aa]">
                    <div
                      className={`absolute inset-y-0 left-0 rounded-r-xl bg-gradient-to-r ${index === 0
                        ? "from-yellow-500/80 to-yellow-300/70"
                        : index === 1
                          ? "from-slate-400/80 to-slate-200/70"
                          : index === 2
                            ? "from-orange-700/80 to-orange-400/70"
                            : "from-cyan-900/80 to-cyan-700/60"
                        }`}
                      style={{
                        width: `${prozent}%`,
                        animation: istSichtbar
                          ? `bahnWachsen 1.2s ease-out ${index * 0.12}s both`
                          : undefined,
                      }}
                    />

                    <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,rgba(255,255,255,0.08)_0,rgba(255,255,255,0.08)_2px,transparent_2px,transparent_42px)]" />

                    <div className="absolute left-5 top-1/2 z-20 max-w-[45%] -translate-y-1/2 truncate text-2xl font-black text-white drop-shadow-[3px_3px_0_#000]">
                      {istSichtbar ? team.teamname : "???"}
                    </div>

                    {istSichtbar && (
                      <div
                        className={`absolute top-1/2 ${istTot
                          ? "z-30 animate-[pferdEinreitenUndSterben_1.7s_ease-out_both]"
                          : "z-30 animate-[pferdSieger_2.2s_ease-in-out_both]"
                          }`}
                        style={{
                          left: pferdLinks,
                          animationDelay: `${index * 0.12}s`,
                        }}
                      >

                        {renderRennPferd({
                          farbe: pferdeFarben[index % pferdeFarben.length],
                          nummer: index + 1,
                        })}
                      </div>
                    )}

                    <div
                      className="absolute right-3 top-1/2 z-10 h-[82%] w-6 -translate-y-1/2 rounded-sm border-2 border-white shadow-[0_0_18px_#facc15]"
                      style={{
                        backgroundImage:
                          "conic-gradient(#fff 25%, #000 0 50%, #fff 0 75%, #000 0)",
                        backgroundSize: "12px 12px",
                      }}
                    />
                  </div>

                  <div className="rounded-2xl border-4 border-yellow-300 bg-black/70 px-4 py-3 text-right text-4xl font-black text-yellow-200 shadow-[4px_4px_0_#ff00aa]">
                    {istSichtbar ? team.punkte.toFixed(1) : "?"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  function renderAufloesungSlide(slide: Extract<Slide, { typ: "aufloesung" }>) {
    const frage = slide.frage;
    const antworten = sortiereAntworten(frage);
    const richtigeAntworten = antworten.filter((antwort) => antwort.ist_richtig);
    const antwortMedien = richtigeAntworten.flatMap((antwort) => antwort.medien);
    const alleLoesungsMedien = [...frage.medien, ...antwortMedien];
    const hatAntwortmoeglichkeiten = antworten.length > 1;

    return (
      <div className="grid h-full min-h-0 gap-4 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="flex min-h-0 flex-col rounded-[1.5rem] border-4 border-pink-500 bg-slate-950/80 p-6 shadow-[8px_8px_0_#00e5ff]">
          <div className="mb-4 text-sm font-black uppercase tracking-[0.3em] text-pink-300">
            Frage
          </div>

          <h2 className="text-3xl font-black leading-tight text-white drop-shadow-[3px_3px_0_#ff00aa] xl:text-5xl">
            {frage.frage}
          </h2>

          {frage.quelle && (
            <div className="mt-auto pt-4 text-sm font-bold text-white/50">
              Quelle: {frage.quelle}
            </div>
          )}
        </div>

        <div className="flex min-h-0 flex-col rounded-[1.5rem] border-4 border-emerald-300 bg-gradient-to-br from-emerald-950 to-slate-950 p-6 shadow-[8px_8px_0_#facc15]">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div className="inline-flex w-fit rotate-[-2deg] rounded-xl bg-emerald-400 px-4 py-2 text-sm font-black uppercase tracking-[0.25em] text-slate-950 shadow-[4px_4px_0_#ff00aa]">
              Richtige Antwort
            </div>

            {alleLoesungsMedien.length > 0 && (
              <button
                type="button"
                onClick={() => setOverlayMedien(alleLoesungsMedien)}
                className="rounded-2xl border-4 border-cyan-300 bg-black px-5 py-3 font-black uppercase text-cyan-200 shadow-[5px_5px_0_#ff00aa]"
              >
                Medium anzeigen
              </button>
            )}
          </div>

          <div className="grid min-h-0 flex-1 gap-4 overflow-hidden">
            {hatAntwortmoeglichkeiten &&
              antworten.map((antwort, index) => (
                <div
                  key={antwort.antwort_id}
                  className={`rounded-3xl border-4 px-6 py-4 text-2xl font-black shadow-[6px_6px_0_#00e5ff] ${antwort.ist_richtig
                    ? "border-emerald-300 bg-emerald-500/25 text-yellow-200"
                    : "border-white/15 bg-black/35 text-white/45"
                    }`}
                >
                  <span className="mr-4 text-cyan-300">
                    {String.fromCharCode(65 + index)}.
                  </span>
                  {antwort.antwort}
                </div>
              ))}

            {!hatAntwortmoeglichkeiten &&
              richtigeAntworten.map((antwort) => (
                <div
                  key={antwort.antwort_id}
                  className="flex min-h-0 items-center rounded-3xl border-4 border-emerald-300 bg-black/45 p-7 shadow-[6px_6px_0_#00e5ff]"
                >
                  <div className="text-5xl font-black leading-tight text-yellow-200 drop-shadow-[4px_4px_0_#16a34a] xl:text-7xl">
                    {antwort.antwort}
                  </div>
                </div>
              ))}

            {richtigeAntworten.length === 0 && (
              <div className="flex flex-1 items-center justify-center text-2xl font-black text-white/50">
                Keine richtige Antwort markiert
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  function createVirtuellenAbschnitt(
    titel: string,
    abschnittTyp: string
  ): Abschnitt {
    return {
      quiz_abschnitt_id: -1,
      titel,
      abschnitt_typ: abschnittTyp,
      sortierung: 0,
      dauer_sekunden: null,
      qr_code_url: null,
      medien_datei: null,
      bemerkung: null,
    };
  }

  function renderBekanntmachungenSlide() {
    const bekanntmachungen = (
      praesentationQuiz.outro_bekanntmachungen ??
      "Danke fürs Mitspielen!\nNächster Quizabend: wird noch bekanntgegeben."
    )
      .split("\n")
      .map((zeile) => zeile.trim())
      .filter(Boolean);

    return (
      <div className="flex h-full min-h-0 flex-col rounded-[1.5rem] border-4 border-cyan-300 bg-slate-950/90 p-10 shadow-[8px_8px_0_#ff00aa]">
        <div className="mb-8">
          <div className="inline-flex rotate-[-2deg] rounded-xl bg-pink-500 px-5 py-3 text-sm font-black uppercase tracking-[0.3em] text-yellow-200 shadow-[4px_4px_0_#00e5ff]">
            Outro
          </div>

          <h2 className="mt-5 text-6xl font-black uppercase leading-none text-yellow-200 drop-shadow-[5px_5px_0_#ff00aa]">
            Bekanntmachungen
          </h2>
        </div>

        <div className="grid flex-1 gap-5">
          {bekanntmachungen.map((punkt, index) => (
            <div
              key={`${punkt}-${index}`}
              className="grid grid-cols-[80px_1fr] items-center gap-6 rounded-3xl border-4 border-cyan-300 bg-black/45 px-8 py-5 shadow-[5px_5px_0_#ff00aa]"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-pink-500 text-3xl font-black text-yellow-200">
                {index + 1}
              </div>

              <div className="text-3xl font-black leading-tight text-white">
                {punkt}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function renderAnkommenSlide() {
    const qrCodePfad = `/medien/bilder/qr_codes/${quiz.quiz_id}.png`;

    return (
      <div className="vor-dem-start-player relative h-full min-h-0 w-full overflow-hidden rounded-[1.5rem] bg-black">
        {praesentationQuiz.intro_video_url && (
          <video
            autoPlay
            muted
            loop
            playsInline
            className="absolute inset-0 h-full w-full object-contain"
          >
            <source
              src={praesentationQuiz.intro_video_url}
              type="video/mp4"
            />
          </video>
        )}

        <div className="absolute bottom-8 right-8 z-20 rounded-2xl border-4 border-yellow-300 bg-black/70 px-7 py-4 text-3xl font-black text-yellow-200 shadow-[5px_5px_0_#ff00aa]">
          Beginn: {praesentationQuiz.intro_startzeit ?? "19:30"} Uhr
        </div>
      </div>
    );
  }

  function renderStartsequenzSlide() {
    return (
      <StartsequenzSlideInPlayer
        audioUrl={praesentationQuiz.intro_musik_url ?? "/medien/audio/intro/mexico.mp3"}
        text={
          praesentationQuiz.intro_startsequenz_text ??
          "Ein guter Zeitpunkt, um seine Grundbedürfnisse zu befriedigen."
        }
        onFinished={nextSlide}
      />
    );
  }

  function renderFixenSlide(slide: Extract<Slide, { typ: "fixer-slide" }>) {
    if (slide.slideTyp === "vor-dem-start") {
      return renderAnkommenSlide();
    }

    if (slide.slideTyp === "startsequenz") {
      return renderStartsequenzSlide();
    }

    if (slide.slideTyp === "bekanntmachungen") {
      return renderBekanntmachungenSlide();
    }

    if (slide.slideTyp === "begruessung") {
      return renderBlockSlide({
        typ: "block",
        abschnitt: createVirtuellenAbschnitt("Begrüßung", "intro_begruessung"),
      });
    }

    if (slide.slideTyp === "preise") {
      return renderBlockSlide({
        typ: "block",
        abschnitt: createVirtuellenAbschnitt("Preise", "intro_preise"),
      });
    }

    if (slide.slideTyp === "regeln") {
      return renderBlockSlide({
        typ: "block",
        abschnitt: createVirtuellenAbschnitt("Regeln", "intro_regeln"),
      });
    }

    if (slide.slideTyp === "qrcode") {
      return renderBlockSlide({
        typ: "block",
        abschnitt: createVirtuellenAbschnitt("QR-Code", "intro_qrcode"),
      });
    }

    return null;
  }

  function renderBlockSlide(slide: Extract<Slide, { typ: "block" }>) {
    const abschnitt = slide.abschnitt;

    const zeilen =
      abschnitt.bemerkung
        ?.split("\n")
        .map((zeile) => zeile.trim())
        .filter(Boolean) ?? [];

    const regeln =
      quiz.intro_regeln
        ?.split("\n")
        .map((zeile) => zeile.trim())
        .filter(Boolean) ?? [
        "Bildet Teams und gebt euch einen Namen",
        "Scannt den QR-Code",
        "Bestimmt einen Schreiber",
        "Nutzt euren Kopf, nicht das Internet",
        "Der Quizmaster hat immer recht",
      ];

    const preise =
      quiz.intro_preise
        ?.split("\n")
        .map((zeile) => zeile.trim())
        .filter(Boolean) ?? [];

    if (abschnitt.abschnitt_typ === "intro_begruessung") {
      return (
        <div className="flex h-full min-h-0 flex-col items-center justify-center rounded-[1.5rem] border-4 border-yellow-300 bg-black/60 p-10 text-center shadow-[8px_8px_0_#ff00aa]">
          <div className="mb-6 inline-flex rotate-[-2deg] rounded-xl bg-pink-500 px-5 py-3 text-sm font-black uppercase tracking-[0.3em] text-yellow-200 shadow-[4px_4px_0_#00e5ff]">
            Willkommen im
          </div>

          <h2 className="text-7xl font-black uppercase tracking-tight text-yellow-200 drop-shadow-[6px_6px_0_#ff00aa]">
            {quiz.intro_begruessungstitel ?? quiz.titel}
          </h2>

          <div className="mt-10 max-w-5xl rounded-2xl border-4 border-cyan-300 bg-slate-950/70 px-8 py-5 text-3xl font-black text-white shadow-[5px_5px_0_#ff00aa]">
            {quiz.intro_begruessungstext ??
              "Willkommen zum heutigen Quizabend!"}
          </div>
        </div>
      );
    }

    if (abschnitt.abschnitt_typ === "intro_regeln") {
      return (
        <div className="flex h-full min-h-0 flex-col rounded-[1.5rem] border-4 border-cyan-300 bg-slate-950/90 p-10 shadow-[8px_8px_0_#ff00aa]">
          <div className="mb-8">
            <div className="inline-flex rotate-[-2deg] rounded-xl bg-pink-500 px-5 py-3 text-sm font-black uppercase tracking-[0.3em] text-yellow-200 shadow-[4px_4px_0_#00e5ff]">
              Rules are good!
            </div>

            <h2 className="mt-5 text-6xl font-black uppercase leading-none text-yellow-200 drop-shadow-[5px_5px_0_#ff00aa]">
              Rules help
              <br />
              control the fun!*
            </h2>
          </div>

          <div className="grid flex-1 gap-5">
            {regeln.map((regel, index) => (
              <div
                key={`${regel}-${index}`}
                className="grid grid-cols-[80px_1fr] items-center gap-6 rounded-3xl border-4 border-cyan-300 bg-black/45 px-8 py-5 shadow-[5px_5px_0_#ff00aa]"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-pink-500 text-3xl font-black text-yellow-200">
                  {index + 1}
                </div>

                <div className="text-3xl font-black leading-tight text-white">
                  {regel}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 text-center text-lg font-bold text-white/50">
            * Monica Geller (schlechte Verliererin)
          </div>
        </div>
      );
    }

    if (abschnitt.abschnitt_typ === "intro_qrcode") {
      return renderQrCodeSlide();
    }

    if (abschnitt.abschnitt_typ === "intro_preise") {
      return (
        <div className="flex h-full min-h-0 flex-col items-center justify-center rounded-[1.5rem] border-4 border-yellow-300 bg-black/60 p-10 text-center shadow-[8px_8px_0_#ff00aa]">
          <div className="mb-6 inline-flex rotate-[-2deg] rounded-xl bg-pink-500 px-5 py-3 text-sm font-black uppercase tracking-[0.3em] text-yellow-200 shadow-[4px_4px_0_#00e5ff]">
            Preise
          </div>

          <h2 className="text-7xl font-black uppercase tracking-tight text-yellow-200 drop-shadow-[6px_6px_0_#ff00aa]">
            Heute gibt es was zu gewinnen
          </h2>

          <div className="mt-10 grid gap-4">
            {preise.length > 0 ? (
              preise.map((preis, index) => (
                <div
                  key={`${preis}-${index}`}
                  className="rounded-2xl border-4 border-cyan-300 bg-slate-950/70 px-8 py-4 text-3xl font-black text-white shadow-[5px_5px_0_#ff00aa]"
                >
                  Platz {index + 1}: {preis}
                </div>
              ))
            ) : (
              <div className="rounded-2xl border-4 border-cyan-300 bg-slate-950/70 px-8 py-4 text-3xl font-black text-white shadow-[5px_5px_0_#ff00aa]">
                Die Preise werden gleich live vorgestellt.
              </div>
            )}
          </div>
        </div>
      );
    }

    if (abschnitt.abschnitt_typ === "intro_vor_dem_start") {
      return (
        <div className="flex h-full min-h-0 flex-col items-center justify-center rounded-[1.5rem] border-4 border-yellow-300 bg-black/60 p-10 text-center shadow-[8px_8px_0_#ff00aa]">
          {quiz.intro_logo_url ? (
            <img
              src={quiz.intro_logo_url}
              alt="Quiz Logo"
              className="mb-10 max-h-52 max-w-xl object-contain"
            />
          ) : (
            <div className="mb-10 rounded-3xl border-4 border-cyan-300 bg-slate-950/70 px-12 py-8 text-5xl font-black uppercase text-yellow-200 shadow-[5px_5px_0_#ff00aa]">
              Logo
            </div>
          )}

          <h2 className="text-7xl font-black uppercase tracking-tight text-yellow-200 drop-shadow-[6px_6px_0_#ff00aa]">
            Das Quiz startet in Kürze
          </h2>

          {quiz.intro_wartetext && (
            <div className="mt-10 max-w-5xl rounded-2xl border-4 border-cyan-300 bg-slate-950/70 px-8 py-5 text-3xl font-black text-white shadow-[5px_5px_0_#ff00aa]">
              {quiz.intro_wartetext}
            </div>
          )}

          {quiz.intro_musik_url && (
            <audio
              src={quiz.intro_musik_url}
              autoPlay
              loop
              controls
              className="mt-8"
            />
          )}
        </div>
      );
    }

    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center rounded-[1.5rem] border-4 border-yellow-300 bg-black/60 p-10 text-center shadow-[8px_8px_0_#ff00aa]">

        <h2 className="text-7xl font-black uppercase tracking-tight text-yellow-200 drop-shadow-[6px_6px_0_#ff00aa]">
          {abschnitt.titel}
        </h2>

        {zeilen.length > 0 && (
          <div className="mt-10 grid gap-4">
            {zeilen.map((zeile, index) => (
              <div
                key={`${zeile}-${index}`}
                className="rounded-2xl border-4 border-cyan-300 bg-slate-950/70 px-8 py-4 text-3xl font-black text-white shadow-[5px_5px_0_#ff00aa]"
              >
                {zeile}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  function renderQrCodeSlide() {
    const antwortUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}/quiz/${quiz.quiz_id}/antworten?passwort=${encodeURIComponent(
          new URLSearchParams(window.location.search).get("passwort") ?? ""
        )}`
        : "";

    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center rounded-[1.5rem] border-4 border-yellow-300 bg-black/70 p-10 text-center shadow-[8px_8px_0_#ff00aa]">
        <div className="mb-10 inline-flex rotate-[-2deg] rounded-xl bg-pink-500 px-8 py-4 text-2xl font-black uppercase tracking-[0.3em] text-yellow-200 shadow-[5px_5px_0_#00e5ff]">
          Jetzt scannen
        </div>

        <div className="rounded-[2rem] border-4 border-cyan-300 bg-white p-8 shadow-[8px_8px_0_#ff00aa]">
          <div className="rounded-[2rem] border-4 border-cyan-300 bg-white p-8 shadow-[8px_8px_0_#ff00aa]">
            <QRCode
              value={antwortUrl}
              size={500}
            />
          </div>
        </div>
      </div>
    );
  }

  function renderPauseSlide(slide: Extract<Slide, { typ: "pause" }>) {
    const aktuelleSekunden = timerSekunden ?? slide.dauerSekunden;
    const minuten = Math.floor(aktuelleSekunden / 60);
    const sekunden = aktuelleSekunden % 60;

    function setTimerMinuten(minutenWert: number) {
      const sichereMinuten = Math.max(0, minutenWert);
      setTimerSekunden(Math.round(sichereMinuten * 60));
      setTimerLaeuft(false);
    }

    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center rounded-[1.5rem] border-4 border-yellow-300 bg-black/60 p-10 text-center shadow-[8px_8px_0_#ff00aa]">
        <div className="mb-6 inline-flex rotate-[-2deg] rounded-xl bg-pink-500 px-5 py-3 text-sm font-black uppercase tracking-[0.3em] text-yellow-200 shadow-[4px_4px_0_#00e5ff]">
          Abgabezeit
        </div>

        <h2 className="text-7xl font-black uppercase tracking-tight text-yellow-200 drop-shadow-[6px_6px_0_#ff00aa]">
          Verbleibende Zeit zum Grübeln:
        </h2>

        <div className="mt-10 rounded-3xl border-4 border-cyan-300 bg-slate-950/70 px-10 py-6 shadow-[5px_5px_0_#ff00aa]">
          <div className="text-7xl font-black text-white">
            {String(minuten).padStart(2, "0")}:
            {String(sekunden).padStart(2, "0")}
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => setTimerLaeuft((current) => !current)}
            className="rounded-2xl border-4 border-emerald-300 bg-black px-6 py-3 font-black uppercase text-emerald-200 shadow-[5px_5px_0_#ff00aa]"
          >
            {timerLaeuft ? "Pause" : "Start"}
          </button>

          <button
            type="button"
            onClick={() => {
              setTimerSekunden(slide.dauerSekunden);
              setTimerLaeuft(false);
              setTimerInputMinuten(String(slide.dauerSekunden / 60));
            }}
            className="rounded-2xl border-4 border-cyan-300 bg-black px-6 py-3 font-black uppercase text-cyan-200 shadow-[5px_5px_0_#ff00aa]"
          >
            Reset
          </button>

          <div className="flex items-center gap-2 rounded-2xl border-4 border-yellow-300 bg-black px-4 py-2 shadow-[5px_5px_0_#ff00aa]">
            <span className="text-sm font-black uppercase text-yellow-200">
              Minuten
            </span>

            <input
              type="number"
              min={0}
              step={0.5}
              value={timerInputMinuten}
              onChange={(e) => {
                const value = e.target.value;

                setTimerInputMinuten(value);

                const minuten = Number(value);

                if (!Number.isNaN(minuten)) {
                  setTimerMinuten(minuten);
                }
              }}
              className="w-28 rounded-xl border-2 border-white/20 bg-slate-950 px-3 py-2 text-center text-xl font-black text-white outline-none"
            />
          </div>
        </div>

        <div className="mt-8 text-2xl font-black uppercase tracking-wide text-white/70">
          Bitte schickt das Formular ab, bevor der Timer abgelaufen ist.
        </div>
      </div>
    );
  }

  function renderAktuellenSlide() {
    if (!slide) {
      return (
        <div className="flex h-full items-center justify-center text-4xl font-black text-white/50">
          Keine Slides vorhanden
        </div>
      );
    }

    if (slide.typ === "fixer-slide") {
      return renderFixenSlide(slide);
    }

    if (slide.typ === "block") {
      return renderBlockSlide(slide);
    }
    if (slide.typ === "pause") {
      return renderPauseSlide(slide);
    }

    if (slide.typ === "frage") {
      return renderFrageSlide(slide);
    }

    if (slide.typ === "zwischenstand") {
      return renderZwischenstandSlide();
    }

    if (slide.typ === "endstand") {
      return renderEndstandSlide();
    }

    return renderAufloesungSlide(slide);
  }

  const slideLabel =
    !slide
      ? "-"
      : slide.typ === "fixer-slide"
        ? slide.slideTyp === "vor-dem-start"
          ? "Vor dem Start"
          : slide.slideTyp === "begruessung"
            ? "Begrüßung"
            : slide.slideTyp === "regeln"
              ? "Regeln"
              : slide.slideTyp === "preise"
                ? "Preise"
                : "Bekanntmachungen"
        : slide.typ === "block"
          ? slide.abschnitt.titel
          : slide.abschnitt?.titel ?? "Kein Block";

  const modusLabel =
    !slide
      ? "-"
      : slide.typ === "fixer-slide"
        ? "Slide"
        : slide.typ === "block"
          ? "Block"
          : slide.typ === "frage"
            ? "Frage"
            : slide.typ === "pause"
              ? "Pause"
              : slide.typ === "zwischenstand"
                ? "Zwischenstand"
                : slide.typ === "endstand"
                  ? "Endstand"
                  : "Auflösung";

  return (

    <main className="h-screen overflow-hidden bg-[radial-gradient(circle_at_20%_20%,#ff00aa_0,#ff00aa22_24%,transparent_42%),radial-gradient(circle_at_80%_10%,#00e5ff66_0,#00e5ff22_22%,transparent_38%),linear-gradient(135deg,#1a0033,#080014_45%,#001a3a)] text-white">

      <style jsx global>{`
  @keyframes pferdGalopp {
  0% {
    transform: translateY(0) rotate(-2deg) scale(1);
  }
  25% {
    transform: translateY(-8px) rotate(1deg) scale(1.03);
  }
  50% {
    transform: translateY(0) rotate(2deg) scale(1);
  }
  75% {
    transform: translateY(-5px) rotate(-1deg) scale(1.02);
  }
  100% {
    transform: translateY(0) rotate(-2deg) scale(1);
  }
}

@keyframes schweifWackel {
  0%,
  100% {
    transform: rotate(-5deg);
    transform-origin: 45px 60px;
  }
  50% {
    transform: rotate(10deg);
    transform-origin: 45px 60px;
  }
}

@keyframes zielBlinken {
  0%,
  100% {
    opacity: 0.65;
    box-shadow: 0 0 14px #facc15;
  }
  50% {
    opacity: 1;
    box-shadow: 0 0 28px #facc15;
  }
}

@keyframes bahnWachsen {
  from {
    width: 0%;
  }
}

@keyframes pferdEinreiten {
  0% {
    left: 0%;
    transform: translateY(-50%) rotate(-2deg) scale(1);
  }

  35% {
    transform: translateY(calc(-50% - 8px)) rotate(2deg) scale(1.03);
  }

  70% {
    transform: translateY(-50%) rotate(-1deg) scale(1);
  }

  100% {
    transform: translateY(-50%) rotate(-2deg) scale(1);
  }
}

@keyframes pferdEinreitenUndSterben {
  0% {
    left: 0%;
    transform: translateY(-50%) rotate(-2deg) scale(1);
  }

  55% {
    transform: translateY(-50%) rotate(2deg) scale(1);
  }

  75% {
    transform: translateY(-50%) rotate(-8deg) scale(1);
  }

  100% {
    transform: translateY(-50%) rotate(180deg) scale(1);
  }
}

@keyframes pferdSieger {
  0% {
    left: 0%;
    transform: translateY(-50%) rotate(-2deg) scale(1);
  }

  45% {
    transform: translateY(calc(-50% - 8px)) rotate(2deg) scale(1.03);
  }

  65% {
    transform: translateY(-50%) rotate(-2deg) scale(1);
  }

  78% {
    transform: translateY(calc(-50% - 18px)) rotate(-12deg) scale(1.08);
  }

  88% {
    transform: translateY(-50%) rotate(6deg) scale(1.04);
  }

  100% {
    transform: translateY(calc(-50% - 10px)) rotate(-6deg) scale(1.07);
  }
}
`}</style>
      <div className="flex h-screen flex-col p-4">
        <header className="mb-3 flex h-20 shrink-0 items-center justify-between rounded-3xl border-4 border-yellow-300 bg-black/60 px-5 shadow-[0_0_30px_rgba(255,0,170,0.55)]">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 rotate-[-6deg] items-center justify-center rounded-2xl border-4 border-cyan-300 bg-pink-500 text-xs font-black uppercase tracking-wide text-yellow-200 shadow-[6px_6px_0_#00e5ff]">
              Logo
            </div>

            <div>
              <div className="text-xs font-black uppercase tracking-[0.35em] text-cyan-300">
                {slideLabel}
              </div>

              <h1 className="text-2xl font-black uppercase tracking-tight text-yellow-200 drop-shadow-[3px_3px_0_#ff00aa]">
                {quiz.titel ?? `Quiz ${quiz.quiz_id}`}
              </h1>
            </div>
          </div>

          <div className="rounded-2xl border-4 border-pink-400 bg-yellow-300 px-5 py-2 text-xl font-black text-slate-950 shadow-[5px_5px_0_#ff00aa]">
            {slideIndex + 1} / {slides.length}
          </div>
        </header>

        <section className="min-h-0 flex-1 rounded-[2rem] border-4 border-cyan-300 bg-black/55 p-4 shadow-[0_0_35px_rgba(0,229,255,0.35)]">
          {renderAktuellenSlide()}
        </section>


        {hatGleichstandAufPlatz1 && slide?.typ === "endstand" && (
          <footer className="mt-3 flex h-20 shrink-0 items-center justify-start gap-4">
            <button
              type="button"
              onClick={handleSchaetzfrageStarten}
              className="rounded-2xl border-4 border-pink-400 bg-pink-500 px-6 py-4 text-xl font-black uppercase tracking-[0.2em] text-yellow-200 shadow-[4px_4px_0_#00e5ff] transition hover:scale-105"
            >
              Schätzfrage
            </button>
          </footer>
        )}

        {overlayMedien && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-8"
            onClick={() => setOverlayMedien(null)}
          >
            <div className="max-h-full w-full max-w-6xl rounded-[2rem] border-4 border-yellow-300 bg-slate-950 p-8 shadow-[0_0_60px_rgba(255,0,170,0.65)]">
              <div className="mb-6 flex items-center justify-between gap-4">
                <div className="text-xl font-black uppercase tracking-[0.25em] text-cyan-300">
                  Medium
                </div>

                <button
                  type="button"
                  onClick={() => setOverlayMedien(null)}
                  className="rounded-2xl bg-pink-500 px-5 py-3 font-black uppercase text-yellow-100 shadow-[4px_4px_0_#facc15]"
                >
                  Schließen
                </button>
              </div>

              <div className="grid max-h-[70vh] gap-5 overflow-hidden">
                {overlayMedien.slice(0, 2).map((medium) => (
                  <div
                    key={medium.medien_id}
                    className="rounded-3xl border-4 border-cyan-300 bg-black p-8"
                  >
                    <div className="mb-3 text-sm font-black uppercase tracking-wide text-pink-300">
                      {medium.medientyp}
                    </div>

                    {isBild(medium.datei) ? (
                      <img
                        src={getMediumUrl(medium.datei)}
                        alt={medium.bemerkung ?? medium.datei}
                        className="max-h-[68vh] w-full rounded-2xl object-contain"
                      />
                    ) : isAudio(medium.datei) ? (
                      <audio
                        controls
                        src={getMediumUrl(medium.datei)}
                        className="w-full"
                      />
                    ) : isVideo(medium.datei) ? (
                      <video
                        controls
                        src={getMediumUrl(medium.datei)}
                        className="max-h-[68vh] w-full rounded-2xl object-contain"
                      />
                    ) : (
                      <div className="break-all text-5xl font-black text-yellow-200">
                        {medium.datei}
                      </div>
                    )}

                    {medium.bemerkung && (
                      <div className="mt-4 text-2xl font-bold text-white/70">
                        {medium.bemerkung}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}