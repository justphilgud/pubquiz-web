import { notFound } from "next/navigation";
import {
  getQuizDetails,
  getQuizFixedSlideVisibility,
} from "@/app/quiz/actions";
import {
  FixedSlideEditor,
  FixedSlideEnabledField,
  FixedSlideField,
  FixedSlideForm,
} from "../FixedSlideEditor";
import { getFixedSlideConfig, saveOutroSlide } from "../fixedSlideActions";
import BlobUploadField from "../BlobUploadField";
import {
  isOutroSlideId,
  OUTRO_SLIDES,
} from "@/app/quiz/fixedSlidesPolicy";
import { PUBLIC_CALENDAR_LANDING_PATH } from "@/app/calendar/publicCalendar";

type Props = {
  params: Promise<{ quizId: string }>;
  searchParams: Promise<{ slide?: string }>;
};

export default async function OutroEditorPage({ params, searchParams }: Props) {
  const [{ quizId }, query] = await Promise.all([params, searchParams]);
  const [quiz, slideVisibility, questionSubmissionSlide, calendarSlide] = await Promise.all([
    getQuizDetails(Number(quizId)),
    getQuizFixedSlideVisibility(Number(quizId)),
    getFixedSlideConfig(Number(quizId), "questionSubmission"),
    getFixedSlideConfig(Number(quizId), "calendar"),
  ]);

  if (!quiz) {
    notFound();
  }

  const quizIdValue = quiz.quiz_id;
  const initialItemId = isOutroSlideId(query.slide)
    ? query.slide
    : OUTRO_SLIDES[0].id;

  return (
    <FixedSlideEditor
      eyebrow="Outro · 3 feste Slides"
      title="Outro konfigurieren"
      description="Bekanntmachungen, optionale Frageneinreichung und der allgemeine PubQuiz-Kalender bilden gemeinsam den Abschluss."
      initialItemId={initialItemId}
      backHref={`/quiz/${quizIdValue}`}
      items={[
        {
          id: OUTRO_SLIDES[0].id,
          title: OUTRO_SLIDES[0].title,
          description: OUTRO_SLIDES[0].description,
          status:
            quiz.outro_bekanntmachungen?.trim() ||
            quiz.outro_musik_url?.trim()
            ? "configured"
            : "notice",
          panel: (
            <FixedSlideForm
              action={saveOutroSlide}
              previewHref={`/quiz/${quizIdValue}/show/bekanntmachungen`}
            >
              <input type="hidden" name="quizId" value={quizIdValue} />
              <input type="hidden" name="slideId" value="announcements" />
              <FixedSlideEnabledField defaultEnabled={slideVisibility.announcements} />
              <BlobUploadField
                label="Outro-Musik"
                quizId={quizIdValue}
                hiddenFieldName="outroMusikUrl"
                currentUrl={quiz.outro_musik_url}
                slot="OUTRO_AUDIO"
                accept=".mp3,audio/mpeg,audio/mp3"
              />
              <FixedSlideField
                label="Bekanntmachungstext"
                helpText="Ein Punkt pro Zeile. Leerzeilen werden in der Präsentation ausgelassen."
              >
                <textarea
                  name="bekanntmachungen"
                  rows={14}
                  defaultValue={
                    quiz.outro_bekanntmachungen ??
                    "Danke fürs Mitspielen!\n\nNächster Quizabend:\n..."
                  }
                  className="rounded-xl border border-slate-300 px-4 py-3 text-base outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                />
              </FixedSlideField>
            </FixedSlideForm>
          ),
        },
        {
          id: OUTRO_SLIDES[1].id,
          title: OUTRO_SLIDES[1].title,
          description: OUTRO_SLIDES[1].description,
          status: slideVisibility.questionSubmission ? "configured" : "notice",
          panel: (
            <FixedSlideForm
              action={saveOutroSlide}
              previewHref="/frage-einreichen"
            >
              <input type="hidden" name="quizId" value={quizIdValue} />
              <input type="hidden" name="slideId" value="questionSubmission" />
              <FixedSlideEnabledField defaultEnabled={slideVisibility.questionSubmission} />
              <FixedSlideField label="Überschrift">
                <input
                  name="title"
                  defaultValue={questionSubmissionSlide.title ?? "Eure Frage fürs nächste Quiz"}
                  className="rounded-xl border border-slate-300 px-4 py-3 text-base outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                />
              </FixedSlideField>
              <FixedSlideField label="Beschreibung / Subline">
                <textarea
                  name="body"
                  rows={4}
                  defaultValue={questionSubmissionSlide.body ?? "Scanne den QR-Code und reiche deine eigene Quizfrage ein."}
                  className="rounded-xl border border-slate-300 px-4 py-3 text-base outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                />
              </FixedSlideField>
              <FixedSlideField label="CTA- / Hinweistext">
                <input
                  name="ctaText"
                  defaultValue={questionSubmissionSlide.teamHint ?? "Anonym möglich · jede Frage wird redaktionell geprüft."}
                  className="rounded-xl border border-slate-300 px-4 py-3 text-base outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                />
              </FixedSlideField>
            </FixedSlideForm>
          ),
        },
        {
          id: OUTRO_SLIDES[2].id,
          title: OUTRO_SLIDES[2].title,
          description: OUTRO_SLIDES[2].description,
          status: "configured",
          panel: (
            <FixedSlideForm
              action={saveOutroSlide}
              previewHref={PUBLIC_CALENDAR_LANDING_PATH}
            >
              <input type="hidden" name="quizId" value={quizIdValue} />
              <input type="hidden" name="slideId" value="calendar" />
              <FixedSlideEnabledField defaultEnabled={slideVisibility.calendar} />
              <FixedSlideField label="Überschrift">
                <input
                  name="title"
                  defaultValue={calendarSlide.title ?? "Kein PubQuiz mehr verpassen"}
                  className="rounded-xl border border-slate-300 px-4 py-3 text-base outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                />
              </FixedSlideField>
              <FixedSlideField label="Beschreibung / Subline">
                <textarea
                  name="body"
                  rows={5}
                  defaultValue={calendarSlide.body ?? "Scanne den QR-Code und abonniere unsere nächsten öffentlichen PubQuiz-Termine direkt in deinem Kalender."}
                  className="rounded-xl border border-slate-300 px-4 py-3 text-base outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                />
              </FixedSlideField>
              <FixedSlideField label="CTA- / Hinweistext">
                <input
                  name="ctaText"
                  defaultValue={calendarSlide.teamHint ?? "Ein Kalender für alle öffentlichen ungegoogelt Quizabende."}
                  className="rounded-xl border border-slate-300 px-4 py-3 text-base outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                />
              </FixedSlideField>
              <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-5 text-sm text-cyan-950">
                <p className="font-black">Kein PubQuiz mehr verpassen</p>
                <p className="mt-2 leading-6">
                  Der Slide zeigt einen großen QR-Code zum allgemeinen öffentlichen
                  PubQuiz-Kalender. Das Ziel ist bei jedem Quiz identisch und enthält
                  niemals private Termine.
                </p>
              </div>
            </FixedSlideForm>
          ),
        },
      ]}
    />
  );
}
