import { notFound, redirect } from "next/navigation";
import {
  getQuizDetails,
  updateIntroRegeln,
} from "@/app/quiz/actions";
import { SlideNavigation } from "../SlideNavigation";
import { ConfigSlideNavigation } from "../ConfigSlideNavigation";


type Props = {
  params: Promise<{
    quizId: string;
  }>;
};

export default async function RegelnPage({ params }: Props) {
  const resolvedParams = await params;

  const quiz = await getQuizDetails(Number(resolvedParams.quizId));

  if (!quiz) {
    notFound();
  }
  const quizIdValue = quiz.quiz_id;

  async function save(formData: FormData) {
    "use server";

    await updateIntroRegeln({
      quizId: quizIdValue,
      regeln: String(formData.get("regeln") ?? ""),
    });

    redirect(`/quiz/${quizIdValue}/slides/regeln`);
  }

  const defaultRegeln = [
    "Bildet Teams und gebt euch einen Namen",
    "Scannt den QR-Code",
    "Bestimmt einen Schreiber",
    "Nutzt euren Kopf, nicht das Internet",
    "Der Quizmaster hat immer recht",
  ].join("\n");

  const regelnText = (quiz as any).intro_regeln ?? defaultRegeln;

  const regeln = regelnText
    .split("\n")
    .map((regel: string) => regel.trim())
    .filter(Boolean);

  const naechsteSlideUrl = `/quiz/${quizIdValue}/slides/preise`;

  return (
    <main className="min-h-screen bg-slate-100 p-8">
      <div className="mx-auto grid max-w-7xl gap-8 xl:grid-cols-[1fr_1.2fr]">
        <section className="rounded-3xl bg-white p-8 shadow-sm">
          <div className="mb-8">
            <div className="text-sm font-black uppercase tracking-[0.3em] text-cyan-600">
              Intro Slide
            </div>

            <h1 className="mt-2 text-4xl font-black text-slate-900">
              Regeln
            </h1>

            <p className="mt-2 text-slate-500">
              Eine Regel pro Zeile. Mit Enter oder Leertaste geht es später
              weiter zur Preise-Slide.
            </p>
          </div>

          <form action={save}>
            <div className="grid gap-2">
              <div className="text-sm font-bold text-slate-700">
                Regeln
              </div>

              <textarea
                name="regeln"
                rows={12}
                defaultValue={regelnText}
                className="rounded-2xl border border-slate-300 px-5 py-4 font-medium"
              />
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
                Abbrechen und zurück
              </a>
              <ConfigSlideNavigation
                previous={{
                  href: `/quiz/${quizIdValue}/slides/begruessung`,
                  label: "Begrüßung",
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

            <div className="absolute inset-8 flex flex-col justify-center rounded-[2rem] border-4 border-cyan-400/80 bg-black/45 p-12 shadow-[0_0_35px_rgba(0,240,255,0.85)]">
              <div className="mb-6 text-sm font-black uppercase tracking-[0.35em] text-pink-300 drop-shadow-[0_0_12px_rgba(255,0,150,1)]">
                Kurz und schmerzlos
              </div>

              <h2 className="text-7xl font-black leading-tight text-cyan-300 drop-shadow-[0_0_18px_rgba(0,240,255,1)]">
                Regeln
              </h2>

              <div className="mt-10 grid gap-5">
                {regeln.map((regel: string, index: number) => (
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

              <SlideNavigation href={naechsteSlideUrl} />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
