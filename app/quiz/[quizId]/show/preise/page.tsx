import { notFound } from "next/navigation";
import { getQuizDetails } from "@/app/quiz/actions";
import { parsePrizeSlots } from "@/app/quiz/fixedSlidesPolicy";

type Props = {
  params: Promise<{ quizId: string }>;
};

export default async function ShowPreisePage({
  params,
}: Props) {
  const resolvedParams = await params;

  const quiz = await getQuizDetails(Number(resolvedParams.quizId));

  if (!quiz) {
    notFound();
  }

  const gespeichertePreise = parsePrizeSlots(quiz.intro_preise);

  const preise = [
    {
      platz: "1",
      titel: "Platz 1",
      preis: gespeichertePreise[0] || "50 € Gutschein",
    },
    {
      platz: "2",
      titel: "Platz 2",
      preis: gespeichertePreise[1] || "Getränkerunde",
    },
    {
      platz: "3",
      titel: "Platz 3",
      preis: gespeichertePreise[2] || "Ruhm und Ehre",
    },
  ];

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#050510] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,0,140,0.2),transparent_42%),radial-gradient(circle_at_bottom_right,rgba(0,245,255,0.18),transparent_40%)]" />

      <div className="absolute inset-[4vh_4vw] flex flex-col justify-center rounded-[2rem] border-4 border-pink-500/80 bg-black/45 p-12 shadow-[0_0_35px_rgba(255,0,150,0.9)]">
        <div className="mb-6 text-sm font-black uppercase tracking-[0.35em] text-cyan-300 drop-shadow-[0_0_12px_rgba(0,240,255,1)]">
          Es geht um alles
        </div>

        <h1 className="text-8xl font-black leading-tight text-pink-300 drop-shadow-[0_0_18px_rgba(255,0,150,1)]">
          Preise
        </h1>

        <div className="mt-10 grid gap-5">
          {preise.map((preis) => (
            <div
              key={preis.platz}
              className="grid grid-cols-[5rem_1fr] items-center gap-6 rounded-2xl border border-white/10 bg-white/5 px-6 py-5"
            >
              <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-cyan-400 text-4xl font-black text-cyan-300 shadow-[0_0_22px_rgba(0,240,255,0.85)]">
                {preis.platz}
              </div>

              <div>
                <div className="text-xl font-black uppercase tracking-[0.2em] text-cyan-200">
                  {preis.titel}
                </div>

                <div className="mt-1 text-4xl font-black leading-tight text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.55)]">
                  {preis.preis}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 w-fit rounded-2xl border border-cyan-400/70 px-6 py-3 text-xl font-bold text-cyan-200 shadow-[0_0_22px_rgba(0,240,255,0.45)]">
          Verlieren ist keine Option. Außer für fast alle.
        </div>
      </div>
    </main>
  );
}
