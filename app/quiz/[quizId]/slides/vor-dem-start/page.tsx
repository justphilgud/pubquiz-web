import { notFound } from "next/navigation";
import { getQuizDetails } from "@/app/quiz/actions";
import { saveVorDemStart } from "./actions";
import { ConfigSlideNavigation } from "../ConfigSlideNavigation";
import BlobUploadField from "../BlobUploadField";

export const runtime = "nodejs";

type Props = {
  params: Promise<{ quizId: string }>;
};

export default async function VorDemStartPage({ params }: Props) {
  const resolvedParams = await params;

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

          <form
            action={saveVorDemStart}
            encType="multipart/form-data">
            <input type="hidden" name="quizId" value={quiz.quiz_id} />
            <div className="grid gap-6">
              <BlobUploadField
                label="Intro-Video"
                hiddenFieldName="currentIntroVideoUrl"
                currentUrl={quiz.intro_video_url}
                zielordner="video/intro"
                accept="video/*"
              />
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
                href={`/quiz/${quiz.quiz_id}`}
                className="rounded-2xl border border-slate-300 bg-white px-6 py-3 font-semibold text-slate-900"
              >
                Abbrechen und zurück
              </a>

              <ConfigSlideNavigation
                previous={{
                  href: `/quiz/${quiz.quiz_id}/slides/preise`,
                  label: "Preise",
                }}
                next={{
                  href: `/quiz/${quiz.quiz_id}/slides/startsequenz`,
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
