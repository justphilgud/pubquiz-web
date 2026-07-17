"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  quizId: number;
  audioUrl?: string;
  text?: string;
};

export function IntroSlideStartsequenz({
  quizId,
  audioUrl = "/medien/audio/intro/mexico.mp3",
  text = "Ein guter Zeitpunkt, um seine Grundbedürfnisse zu befriedigen.",
}: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [started, setStarted] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [audioFehlt, setAudioFehlt] = useState(false);

  const router = useRouter();

  function goToNextSlide() {
    audioRef.current?.pause();

    router.push(`/quiz/${quizId}/show/begruessung`);
  }

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
    <section className="relative flex h-screen w-screen items-center justify-center overflow-hidden bg-[#050510] text-white">
      <audio
        ref={audioRef}
        src={audioUrl}
        preload="metadata"
        onTimeUpdate={updateCountdown}
        onEnded={() => {
          setRemainingSeconds(0);
          goToNextSlide();
        }}
        onError={() => setAudioFehlt(true)}
      />

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,0,140,0.2),transparent_42%),radial-gradient(circle_at_bottom_right,rgba(0,245,255,0.18),transparent_40%)]" />

      <div className="relative flex h-[86vh] w-[88vw] flex-col items-center justify-center rounded-[2rem] border-4 border-cyan-400/80 bg-black/50 p-12 text-center shadow-[0_0_45px_rgba(0,240,255,0.9)]">
        <p className="mb-10 max-w-5xl text-5xl font-black leading-tight text-white drop-shadow-[0_0_14px_rgba(255,255,255,0.8)]">
          {text}
        </p>

        <div className="rounded-3xl border-4 border-pink-500 px-20 py-10 text-[11rem] font-black leading-none text-pink-300 shadow-[0_0_45px_rgba(255,0,150,0.9)] drop-shadow-[0_0_20px_rgba(255,0,150,1)]">
          {formatTime(remainingSeconds)}
        </div>

        <div className="absolute bottom-6 right-20 flex items-center gap-2">
          {!started ? (
            <button
              type="button"
              onClick={startIntro}
              className="h-10 w-10 rounded-full border border-white/20 bg-white/5 text-white/30 transition hover:border-white/60 hover:bg-white/10 hover:text-white/80"
              title="Mexico starten"
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
                onClick={() => {
                  const audio = audioRef.current;
                  if (!audio) return;

                  audio.pause();
                  audio.currentTime = 0;
                  setStarted(false);
                  setRemainingSeconds(null);
                }}
                className="h-10 w-10 rounded-full border border-white/20 bg-white/5 text-white/30 transition hover:border-white/60 hover:bg-white/10 hover:text-white/80"
                title="Zurücksetzen"
              >
                ↺
              </button>

              <button
                type="button"
                onClick={goToNextSlide}
                className="h-10 rounded-full border border-cyan-300 bg-cyan-500/20 px-4 text-xs font-bold text-cyan-100 transition hover:bg-cyan-500/40"
                title="Countdown überspringen"
              >
                Skip
              </button>
            </>
          )}
        </div>

        {audioFehlt && (
          <div className="absolute bottom-8 left-8 rounded-2xl border border-red-400 bg-red-950/70 px-5 py-3 text-left text-sm font-bold text-red-100">
            Audiodatei nicht gefunden:
            <br />
            {audioUrl}
          </div>
        )}
      </div>
    </section>
  );
}
