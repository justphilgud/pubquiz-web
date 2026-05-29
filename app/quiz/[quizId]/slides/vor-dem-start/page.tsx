import { notFound } from "next/navigation";
import { getQuizDetails } from "@/app/quiz/actions";
import { saveVorDemStart } from "./actions";
import { ConfigSlideNavigation } from "../ConfigSlideNavigation";

export const runtime = "nodejs";

type Props = {
  params: Promise<{ quizId: string }>;
  searchParams: Promise<{ passwort?: string }>;
};

export default async function VorDemStartPage({ params, searchParams }: Props) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;

  const passwort = resolvedSearchParams.passwort ?? "";

  if (
    process.env.NODE_ENV === "production" &&
    passwort !== process.env.AUSWERTUNG_PASSWORT
  ) {
    notFound();
  }

  const quiz = await getQuizDetails(Number(resolvedParams.quizId));

  if (!quiz) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-slate-100 p-8">
      <div className="mx-auto max-w-4xl">
        <section className="rounded-3xl bg-white p-8 shadow-sm">
          <div className="mb-8">
            <div className="text-sm font-black uppercase tracking-[0.3em] text-cyan-600">
              Vor dem Start
            </div>

            <h1 className="mt-2 text-4xl font-black text-slate-900">
              Vor dem Start konfigurieren
            </h1>

            <p className="mt-2 text-slate-500">
              Hier konfigurierst du nur noch das Intro-Video und die angezeigte
              Beginn-Uhrzeit.
            </p>
          </div>

          <form action={saveVorDemStart}>
            <input type="hidden" name="quizId" value={quiz.quiz_id} />
            <input type="hidden" name="passwort" value={passwort} />

            <div className="grid gap-6">
              <label className="grid gap-2">
                <span className="text-sm font-bold text-slate-700">
                  Intro-Video URL
                </span>

                <input
                  type="text"
                  name="introVideoUrl"
                  defaultValue={quiz.intro_video_url ?? ""}
                  placeholder="/medien/video/intro/intro.mp4"
                  className="rounded-2xl border border-slate-300 px-5 py-4 text-lg"
                />

                <span className="text-sm text-slate-500">
                  Lege das Video z. B. unter public/videos/intro.mp4 ab und
                  trage hier /videos/intro.mp4 ein.
                </span>
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-bold text-slate-700">
                  Beginn-Uhrzeit
                </span>

                <input
                  type="time"
                  name="startzeit"
                  defaultValue={quiz.intro_startzeit ?? "19:30"}
                  className="rounded-2xl border border-slate-300 px-5 py-4 text-lg"
                />

                <span className="text-sm text-slate-500">
                  Diese Uhrzeit wird unten rechts als „Beginn: 19:30 Uhr“
                  angezeigt.
                </span>
              </label>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="submit"
                name="submitAction"
                value="stay"
                className="rounded-2xl bg-cyan-600 px-6 py-3 font-semibold text-white"
              >
                Speichern
              </button>

              <button
                type="submit"
                name="submitAction"
                value="close"
                className="rounded-2xl bg-slate-900 px-6 py-3 font-semibold text-white"
              >
                Speichern & schließen
              </button>

              <a
                href={`/quiz/${quiz.quiz_id}?passwort=${encodeURIComponent(
                  passwort
                )}`}
                className="rounded-2xl border border-slate-300 bg-white px-6 py-3 font-semibold text-slate-900"
              >
                Abbrechen und zurück
              </a>

              <ConfigSlideNavigation
                previous={{
                  href: `/quiz/${quiz.quiz_id}/slides/preise?passwort=${encodeURIComponent(
                    passwort
                  )}`,
                  label: "Preise",
                }}
                next={{
                  href: `/quiz/${quiz.quiz_id}/slides/startsequenz?passwort=${encodeURIComponent(
                    passwort
                  )}`,
                  label: "Startsequenz",
                }}
              />
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}