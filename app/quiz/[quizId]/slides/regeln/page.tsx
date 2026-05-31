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
  searchParams: Promise<{
    passwort?: string;
  }>;
};

export default async function RegelnPage({ params, searchParams }: Props) {
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
  const quizIdValue = quiz.quiz_id;

  async function save(formData: FormData) {
    "use server";

    await updateIntroRegeln({
      quizId: quizIdValue,
      regeln: String(formData.get("regeln") ?? ""),
    });

    redirect(
      `/quiz/${quizIdValue}/slides/regeln?passwort=${encodeURIComponent(
        passwort
      )}`
    );
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

  const naechsteSlideUrl = `/quiz/${quizIdValue
    }/slides/preise?passwort=${encodeURIComponent(passwort)}`;

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
                onKeyDown={(event) => {
                  event.stopPropagation();
                }}
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
                href={`/quiz/${quizIdValue}?passwort=${encodeURIComponent(
                  passwort
                )}`}
                className="rounded-2xl border border-slate-300 bg-white px-6 py-3 font-semibold text-slate-900"
              >
                Abbrechen und zurück
              </a>
              <ConfigSlideNavigation
                previous={{
                  href: `/quiz/${quizIdValue}/slides/preise?passwort=${encodeURIComponent(passwort)}`,
                  label: "Preise",
                }}
                next={{
                  href: `/quiz/${quizIdValue}/slides/vor-dem-start?passwort=${encodeURIComponent(passwort)}`,
                  label: "Warteslide",
                }}
              />

            </div>
          </form>
        </section>

        <section className="relative overflow-hidden rounded-3xl bg-black shadow-sm">
  <div className="relative h-[680px] overflow-hidden bg-[#050510] text-white">
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(0,245,255,0.16),transparent_38%),radial-gradient(circle_at_8%_100%,rgba(255,0,170,0.20),transparent_42%)]" />

    <div className="absolute inset-4 rounded-[2rem] border-2 border-yellow-300/90 shadow-[0_0_24px_rgba(250,204,21,0.35)]" />

    <div className="relative z-10 flex h-full flex-col px-10 py-8">
      <div className="mb-6 flex items-center justify-between rounded-2xl border-2 border-yellow-300/80 bg-black/40 px-5 py-3">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 rotate-[-5deg] items-center justify-center rounded-xl bg-pink-500 text-xs font-black uppercase text-yellow-200 shadow-[4px_4px_0_#00e5ff]">
            Logo
          </div>

          <div>
            <div className="text-xs font-black uppercase tracking-[0.35em] text-cyan-300">
              Regeln
            </div>
            <div className="text-2xl font-black uppercase text-yellow-200 drop-shadow-[3px_3px_0_#ff00aa]">
              {quiz.titel ?? "PubQuiz"}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border-4 border-pink-500 bg-yellow-300 px-5 py-2 text-2xl font-black text-black shadow-[4px_4px_0_#ff00aa]">
          5 / 12
        </div>
      </div>

      <div className="mb-5 text-center">
        <div className="mx-auto mb-3 flex max-w-2xl items-center justify-center gap-4">
          <div className="h-1 flex-1 rounded-full bg-cyan-300 shadow-[0_0_12px_#00e5ff]" />
          <div className="rounded-xl border-2 border-cyan-300 bg-pink-500 px-6 py-2 text-sm font-black uppercase tracking-[0.35em] text-white shadow-[4px_4px_0_#00e5ff]">
            Rules are good!
          </div>
          <div className="h-1 flex-1 rounded-full bg-cyan-300 shadow-[0_0_12px_#00e5ff]" />
        </div>

        <h2 className="text-5xl font-black italic uppercase leading-none text-yellow-200 drop-shadow-[5px_5px_0_#ff00aa]">
          Rules help control the fun!*
        </h2>

        <div className="mt-2 text-right text-sm font-black text-cyan-300">
          * Monica Geller (Schlechte Verliererin)
        </div>
      </div>

      <div className="grid min-h-0 flex-1 content-start gap-4">
        {regeln.map((regel: string, index: number) => {
          const regelTextClass =
            regeln.length <= 4
              ? "text-3xl"
              : regeln.length <= 6
                ? "text-2xl"
                : "text-xl";

          return (
            <div
              key={`${regel}-${index}`}
              className="flex items-center gap-6 rounded-2xl border-4 border-cyan-300 bg-slate-950/80 px-6 py-4 shadow-[4px_4px_0_#ff00aa]"
            >
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-pink-500 text-3xl font-black text-yellow-200 shadow-[3px_3px_0_#ff00aa]">
                {index + 1}
              </div>

              <div
                className={`${regelTextClass} font-black leading-tight text-white drop-shadow-[3px_3px_0_#000]`}
              >
                {regel}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex items-center gap-4 rounded-2xl border-2 border-pink-500/80 bg-black/45 px-5 py-4">
        <a
          href={`/quiz/${quizIdValue}/slides/preise?passwort=${encodeURIComponent(
            passwort
          )}`}
          className="rounded-xl border-4 border-cyan-300 bg-slate-950 px-6 py-3 font-black uppercase text-cyan-300 shadow-[4px_4px_0_#ff00aa]"
        >
          ← Zurück
        </a>

        <a
          href={naechsteSlideUrl}
          className="rounded-xl border-4 border-cyan-300 bg-slate-950 px-6 py-3 font-black uppercase text-cyan-300 shadow-[4px_4px_0_#ff00aa]"
        >
          Weiter →
        </a>
      </div>
    </div>
  </div>
</section>
      </div>
    </main>
  );
}