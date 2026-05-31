import { notFound } from "next/navigation";
import { getQuizDetails } from "@/app/quiz/actions";
import { ShowNavigation } from "../ShowNavigation";

type Props = {
  params: Promise<{ quizId: string }>;
  searchParams: Promise<{ passwort?: string }>;
};

export default async function ShowBegruessungPage({
  params,
  searchParams,
}: Props) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;

  const passwort = resolvedSearchParams.passwort ?? "";

  if (passwort !== process.env.AUSWERTUNG_PASSWORT) {
    notFound();
  }

  const quiz = await getQuizDetails(Number(resolvedParams.quizId));

  if (!quiz) {
    notFound();
  }

  const titel = quiz.intro_begruessungstitel ?? quiz.titel ?? "Willkommen im";
  const text =
    quiz.intro_begruessungstext ?? "Willkommen zum heutigen Quizabend!";

  const nextUrl = `/quiz/${quiz.quiz_id}/show/regeln?passwort=${encodeURIComponent(
    passwort
  )}`;

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#050510] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,245,255,0.16),transparent_45%),radial-gradient(circle_at_bottom_left,rgba(255,0,140,0.22),transparent_40%)]" />

      <div className="absolute inset-[4vh_4vw] flex flex-col items-center justify-center rounded-[2rem] border-4 border-pink-500/80 bg-black/45 p-12 text-center shadow-[0_0_35px_rgba(255,0,150,0.9)]">
        <div className="mb-8 text-sm font-black uppercase tracking-[0.35em] text-cyan-300 drop-shadow-[0_0_12px_rgba(0,240,255,1)]">
          Intro
        </div>

        <h1 className="max-w-5xl text-8xl font-black leading-tight text-pink-300 drop-shadow-[0_0_18px_rgba(255,0,150,1)]">
          {titel}
        </h1>

        <p className="mt-10 max-w-4xl whitespace-pre-line text-5xl font-extrabold leading-tight text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.7)]">
          {text}
        </p>

        <div className="mt-12 rounded-2xl border border-cyan-400/70 px-6 py-3 text-2xl font-bold text-cyan-200 shadow-[0_0_22px_rgba(0,240,255,0.45)]">
          Handys weg. Gehirn an.
        </div>
      </div>

      <ShowNavigation href={nextUrl} />
    </main>
  );
}