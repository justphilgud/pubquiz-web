import { notFound } from "next/navigation";
import { getQuizDetails } from "@/app/quiz/actions";
import { saveStartsequenz } from "./actions";
import { IntroSlideStartsequenz } from "./IntroSlideStartsequenz";
import { ConfigSlideNavigation } from "../ConfigSlideNavigation";

type Props = {
  params: Promise<{
    quizId: string;
  }>;
  searchParams: Promise<{
    passwort?: string;
  }>;
};

export default async function StartsequenzPage({
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

  const audioUrl =
    (quiz as any).intro_startsequenz_audio_url ??
    "/medien/audio/intro/mexico.mp3";

  const text =
    (quiz as any).intro_startsequenz_text ??
    "Ein guter Zeitpunkt, um seine Grundbedürfnisse zu befriedigen.";

  return (
    <main className="min-h-screen bg-slate-100 p-8">
      <div className="mx-auto grid max-w-7xl gap-8 xl:grid-cols-[1fr_1.2fr]">
        <section className="rounded-3xl bg-white p-8 shadow-sm">
          <div className="mb-8">
            <div className="text-sm font-black uppercase tracking-[0.3em] text-cyan-600">
              Intro Slide
            </div>

            <h1 className="mt-2 text-4xl font-black text-slate-900">
              Startsequenz
            </h1>

            <p className="mt-2 text-slate-500">
              Konfiguriere Musik und Countdowntext für den Start des Quiz.
            </p>
          </div>

          <form action={saveStartsequenz}>
            <input type="hidden" name="quizId" value={quiz.quiz_id} />

            <input
              type="hidden"
              name="passwort"
              value={passwort}
            />

            <input
              type="hidden"
              name="currentAudioUrl"
              value={audioUrl}
            />

            <div className="grid gap-6">
              <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-5">
                <div className="text-sm font-bold text-slate-700">
                  Intro-Musik
                </div>

                <p>
                  Lade hier eine MP3-Datei hoch. Sie wird im Cloud-Speicher
                  abgelegt und für dieses Quiz verwendet.
                </p>

                <div className="mt-3 rounded-xl bg-white px-4 py-3 font-mono text-sm text-slate-800">
                  Aktuelle Datei: {audioUrl}
                </div>

                <input
                  type="file"
                  name="audioFile"
                  accept=".mp3,audio/mpeg"
                  className="mt-4 block w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm"
                />

                <div className="mt-3 space-y-1 text-xs text-slate-500">
                  <div>• Erlaubt sind nur MP3-Dateien</div>
                  <div>• Maximale Dateigröße: 10 MB</div>
                  <div>• Die Datei wird automatisch umbenannt</div>
                </div>

                <p className="mt-3 text-xs text-slate-500">
                  Aktueller Webpfad: {audioUrl}
                </p>
              </div>

              <label className="grid gap-2">
                <div className="text-sm font-bold text-slate-700">
                  Countdowntext
                </div>

                <textarea
                  name="text"
                  rows={4}
                  defaultValue={text}
                  className="rounded-2xl border border-slate-300 px-5 py-4 text-lg"
                />
              </label>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="submit"
                name="submitAction"
                value="stay"
                className="rounded-2xl bg-cyan-600 px-6 py-3 font-semibold text-white"
              >
                Speichern & Vorschau aktualisieren
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
                  href: `/quiz/${quiz.quiz_id}/slides/vor-dem-start?passwort=${encodeURIComponent(passwort)}`,
                  label: "Warteslide",
                }}
                next={{
                  href: `/quiz/${quiz.quiz_id}/slides/begruessung?passwort=${encodeURIComponent(passwort)}`,
                  label: "Begrüßung",
                }}
              />
            </div>
          </form>
        </section>

        <section className="overflow-hidden rounded-3xl bg-black shadow-sm">
          <div className="origin-top-left scale-[0.38]">
            <IntroSlideStartsequenz
              quizId={quiz.quiz_id}
              passwort={passwort}
              audioUrl={`${audioUrl}?v=${Date.now()}`}
            />
          </div>
        </section>
      </div>
    </main>
  );
}