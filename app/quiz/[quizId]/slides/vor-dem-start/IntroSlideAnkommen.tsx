"use client";

type IntroSlideAnkommenProps = {
  quizId: number;
  startzeit?: string | null;
  videoUrl?: string | null;
};

export function IntroSlideAnkommen({
  startzeit,
  videoUrl,
}: IntroSlideAnkommenProps) {
  const finalStartzeit = startzeit?.trim() || "19:30";

  return (
    <section className="relative h-screen w-screen overflow-hidden bg-black text-white">
      {videoUrl ? (
        <video
          src={videoUrl}
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950">
          <div className="rounded-3xl border-4 border-cyan-300 px-10 py-8 text-center shadow-[0_0_35px_rgba(0,240,255,0.8)]">
            <div className="text-6xl font-black uppercase text-pink-400">
              PubQuiz
            </div>
            <div className="mt-4 text-2xl font-bold text-cyan-200">
              Kein Intro-Video hinterlegt
            </div>
          </div>
        </div>
      )}

      <div className="absolute inset-0 bg-black/10" />

      <div className="absolute bottom-8 right-8 rounded-2xl border-4 border-yellow-300 bg-black/70 px-7 py-4 text-3xl font-black text-yellow-200 shadow-[5px_5px_0_#ff00aa]">
        Beginn: {finalStartzeit} Uhr
      </div>
    </section>
  );
}