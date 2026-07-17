import { notFound, redirect } from "next/navigation";
import {
  getQuizDetails,
  updateIntroBegruessung,
} from "@/app/quiz/actions";
import { SlideNavigation } from "../SlideNavigation";
import { ConfigSlideNavigation } from "../ConfigSlideNavigation";

type Props = {
  params: Promise<{
    quizId: string;
  }>;
};

export default async function BegruessungPage({
  params,
}: Props) {
  const resolvedParams = await params;

  const quiz = await getQuizDetails(Number(resolvedParams.quizId));
  
  if (!quiz) {
    notFound();
  }
  const quizIdValue = quiz.quiz_id;

  async function save(formData: FormData) {
    "use server";


    await updateIntroBegruessung({
      quizId: quizIdValue,
      titel: String(formData.get("titel") ?? ""),
      text: String(formData.get("text") ?? ""),
    });

    redirect(`/quiz/${quizIdValue}/slides/begruessung`);
  }

  const titel =
    (quiz as any).intro_begruessungstitel ?? quiz.titel ?? "Willkommen im";

  const text =
    (quiz as any).intro_begruessungstext ??
    "Willkommen zum heutigen Quizabend!";

  const naechsteSlideUrl = `/quiz/${quizIdValue}/slides/regeln`;

  return (
    <main className="min-h-screen bg-slate-100 p-8">
      <div className="mx-auto grid max-w-7xl gap-8 xl:grid-cols-[1fr_1.2fr]">
        <section className="rounded-3xl bg-white p-8 shadow-sm">
          <div className="mb-8">
            <div className="text-sm font-black uppercase tracking-[0.3em] text-cyan-600">
              Intro Slide
            </div>

            <h1 className="mt-2 text-4xl font-black text-slate-900">
              Begrüßung
            </h1>

            <p className="mt-2 text-slate-500">
              Konfiguriere die Begrüßung. Mit Enter oder Leertaste geht es
              später weiter zu den Regeln.
            </p>
          </div>

          <form action={save}>
            <div className="grid gap-6">
              <label className="grid gap-2">
                <div className="text-sm font-bold text-slate-700">Titel</div>

                <input
                  name="titel"
                  defaultValue={titel}
                  className="rounded-2xl border border-slate-300 px-5 py-4 text-lg"
                />
              </label>

              <label className="grid gap-2">
                <div className="text-sm font-bold text-slate-700">
                  Begrüßungstext
                </div>

                <textarea
                  name="text"
                  rows={5}
                  defaultValue={text}
                  className="rounded-2xl border border-slate-300 px-5 py-4 text-lg"
                />
              </label>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="submit"
                className="rounded-2xl bg-slate-900 px-6 py-3 font-semibold text-white"
              >
                Speichern & Vorschau aktualisieren
              </button>

              <a
                href={`/quiz/${quizIdValue}`}
                className="rounded-2xl border border-slate-300 bg-white px-6 py-3 font-semibold text-slate-900"
              >
                Abbrechen
              </a>

              <ConfigSlideNavigation
                previous={{
                  href: `/quiz/${quizIdValue}/slides/startsequenz`,
                  label: "Countdown",
                }}
                next={{
                  href: `/quiz/${quizIdValue}/slides/preise`,
                  label: "Preise",
                }}
              />
            </div>
          </form>
        </section>

        <section className="relative overflow-hidden rounded-3xl bg-black shadow-sm">
          <div className="relative h-[680px] overflow-hidden bg-[#050510] text-white">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,245,255,0.16),transparent_45%),radial-gradient(circle_at_bottom_left,rgba(255,0,140,0.22),transparent_40%)]" />

            <div className="absolute inset-8 flex flex-col items-center justify-center rounded-[2rem] border-4 border-pink-500/80 bg-black/45 p-12 text-center shadow-[0_0_35px_rgba(255,0,150,0.9)]">
              <div className="mb-8 text-sm font-black uppercase tracking-[0.35em] text-cyan-300 drop-shadow-[0_0_12px_rgba(0,240,255,1)]">
                Intro
              </div>

              <h2 className="max-w-5xl text-7xl font-black leading-tight text-pink-300 drop-shadow-[0_0_18px_rgba(255,0,150,1)]">
                {titel}
              </h2>

              <p className="mt-10 max-w-4xl whitespace-pre-line text-4xl font-extrabold leading-tight text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.7)]">
                {text}
              </p>

              <div className="mt-12 rounded-2xl border border-cyan-400/70 px-6 py-3 text-xl font-bold text-cyan-200 shadow-[0_0_22px_rgba(0,240,255,0.45)]">
                Handys weg. Gehirn an.
              </div>

              <SlideNavigation href={naechsteSlideUrl} />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
