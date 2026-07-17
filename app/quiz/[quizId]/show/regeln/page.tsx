import { notFound } from "next/navigation";
import { getQuizDetails } from "@/app/quiz/actions";
import { ShowNavigation } from "../ShowNavigation";

type Props = {
  params: Promise<{ quizId: string }>;
};

export default async function ShowRegelnPage({ params }: Props) {
  const resolvedParams = await params;

  const quiz = await getQuizDetails(Number(resolvedParams.quizId));

  if (!quiz) {
    notFound();
  }

  const defaultRegeln = [
    "Bildet Teams und gebt euch einen Namen",
    "Scannt den QR-Code",
    "Bestimmt einen Schreiber",
    "Nutzt euren Kopf, nicht das Internet",
    "Der Quizmaster hat immer recht",
  ].join("\n");

  const regeln = (quiz.intro_regeln ?? defaultRegeln)
    .split("\n")
    .map((regel) => regel.trim())
    .filter(Boolean);

  const nextUrl = `/quiz/${quiz.quiz_id}/show/preise`;

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#050510] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,245,255,0.16),transparent_45%),radial-gradient(circle_at_bottom_left,rgba(255,0,140,0.22),transparent_40%)]" />

      <div className="absolute inset-[4vh_4vw] flex flex-col justify-center rounded-[2rem] border-4 border-cyan-400/80 bg-black/45 p-12 shadow-[0_0_35px_rgba(0,240,255,0.85)]">
        <div className="mb-6 text-sm font-black uppercase tracking-[0.35em] text-pink-300 drop-shadow-[0_0_12px_rgba(255,0,150,1)]">
          Kurz und schmerzlos
        </div>

        <h1 className="text-8xl font-black leading-tight text-cyan-300 drop-shadow-[0_0_18px_rgba(0,240,255,1)]">
          Regeln
        </h1>

        <div className="mt-10 grid gap-5">
          {regeln.map((regel, index) => (
            <div
              key={`${regel}-${index}`}
              className="flex items-start gap-5 rounded-2xl border border-white/10 bg-white/5 px-6 py-4"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-pink-400 text-2xl font-black text-pink-300 shadow-[0_0_18px_rgba(255,0,150,0.75)]">
                {index + 1}
              </div>

              <div className="pt-1 text-3xl font-extrabold leading-tight text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.55)]">
                {regel}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 w-fit rounded-2xl border border-pink-400/70 px-6 py-3 text-xl font-bold text-pink-200 shadow-[0_0_22px_rgba(255,0,150,0.45)]">
          Spaß zählt. Google nicht.
        </div>
      </div>

      <ShowNavigation href={nextUrl} />
    </main>
  );
}
