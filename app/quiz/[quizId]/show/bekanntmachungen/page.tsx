import { notFound } from "next/navigation";
import { getQuizDetails } from "@/app/quiz/actions";

type Props = {
  params: Promise<{ quizId: string }>;
};

export default async function ShowBekanntmachungenPage({
  params,
}: Props) {
  const resolvedParams = await params;

  const quiz = await getQuizDetails(Number(resolvedParams.quizId));

  if (!quiz) {
    notFound();
  }

  const punkte = (
    quiz.outro_bekanntmachungen ??
    "Danke fürs Mitspielen!"
  )
    .split("\n")
    .map((eintrag) => eintrag.trim())
    .filter(Boolean);

  return (
    <section className="flex min-h-screen items-center justify-center bg-slate-950 p-12 text-white">
      <div className="w-full max-w-5xl rounded-[2rem] border border-cyan-400/40 bg-slate-900/80 p-12 shadow-2xl">
        <div className="text-sm font-black uppercase tracking-[0.35em] text-cyan-300">
          Outro
        </div>

        <h1 className="mt-4 text-6xl font-black">
          Bekanntmachungen
        </h1>

        <ul className="mt-10 space-y-6 text-3xl font-semibold leading-tight">
          {punkte.map((punkt, index) => (
            <li key={index} className="flex gap-4">
              <span className="text-cyan-300">•</span>
              <span>{punkt}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}