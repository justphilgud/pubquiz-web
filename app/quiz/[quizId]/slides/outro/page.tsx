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
import { saveOutroSlide } from "../fixedSlideActions";
import BlobUploadField from "../BlobUploadField";
import { OUTRO_SLIDES } from "@/app/quiz/fixedSlidesPolicy";

type Props = {
  params: Promise<{ quizId: string }>;
};

export default async function OutroEditorPage({ params }: Props) {
  const { quizId } = await params;
  const [quiz, slideVisibility] = await Promise.all([
    getQuizDetails(Number(quizId)),
    getQuizFixedSlideVisibility(Number(quizId)),
  ]);

  if (!quiz) {
    notFound();
  }

  const quizIdValue = quiz.quiz_id;

  return (
    <FixedSlideEditor
      eyebrow="Outro · 1 feste Slide"
      title="Outro konfigurieren"
      description="Das Outro besteht ausschließlich aus den Bekanntmachungen."
      initialItemId="announcements"
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
                hiddenFieldName="outroMusikUrl"
                currentUrl={quiz.outro_musik_url}
                zielordner="audio/outro"
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
      ]}
    />
  );
}
