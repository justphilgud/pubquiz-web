import { notFound } from "next/navigation";
import {
  getQuizDetails,
  getQuizFixedSlideVisibility,
} from "@/app/quiz/actions";
import {
  getIntroSlideStatus,
  INTRO_SLIDES,
  isIntroSlideId,
  parsePrizeSlots,
} from "@/app/quiz/fixedSlidesPolicy";
import BlobUploadField from "../BlobUploadField";
import {
  FixedSlideEditor,
  FixedSlideEnabledField,
  FixedSlideField,
  FixedSlideForm,
} from "../FixedSlideEditor";
import { saveIntroSlide } from "../fixedSlideActions";

type Props = {
  params: Promise<{ quizId: string }>;
  searchParams: Promise<{ slide?: string }>;
};

const inputClassName =
  "min-h-11 rounded-xl border border-slate-300 px-4 py-3 text-base outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100";

const defaultRules = [
  "Bildet Teams und gebt euch einen Namen",
  "Scannt den QR-Code",
  "Bestimmt einen Schreiber",
  "Nutzt euren Kopf, nicht das Internet",
  "Der Quizmaster hat immer recht",
].join("\n");

function HiddenSlideFields({
  quizId,
  slideId,
}: {
  quizId: number;
  slideId: string;
}) {
  return (
    <>
      <input type="hidden" name="quizId" value={quizId} />
      <input type="hidden" name="slideId" value={slideId} />
    </>
  );
}

export default async function IntroEditorPage({ params, searchParams }: Props) {
  const [{ quizId }, query] = await Promise.all([params, searchParams]);
  const [quiz, slideVisibility] = await Promise.all([
    getQuizDetails(Number(quizId)),
    getQuizFixedSlideVisibility(Number(quizId)),
  ]);

  if (!quiz) {
    notFound();
  }

  const initialItemId = isIntroSlideId(query.slide)
    ? query.slide
    : INTRO_SLIDES[0].id;
  const [platz1, platz2, platz3] = parsePrizeSlots(quiz.intro_preise);
  const quizIdValue = quiz.quiz_id;
  const previewHref = (route: string) =>
    `/quiz/${quizIdValue}/show/${route}`;

  const panels = {
    waiting: (
      <FixedSlideForm
        action={saveIntroSlide}
        previewHref={previewHref("vor-dem-start")}
      >
        <HiddenSlideFields quizId={quizIdValue} slideId="waiting" />
        <FixedSlideEnabledField defaultEnabled={slideVisibility.waiting} />
        <BlobUploadField
          label="Intro-Video"
          quizId={quizIdValue}
          hiddenFieldName="introVideoUrl"
          currentUrl={quiz.intro_video_url}
          slot="INTRO_VIDEO"
          accept=".mp4,.webm,.mov,video/mp4,video/webm,video/quicktime"
        />
        <div className="grid gap-4 md:grid-cols-2">
          <FixedSlideField label="Beginn-Uhrzeit">
            <input
              name="startzeit"
              type="time"
              defaultValue={quiz.intro_startzeit ?? "19:30"}
              className={inputClassName}
            />
          </FixedSlideField>
          <FixedSlideField
            label="Wartetext"
            helpText="Optionaler Hinweis auf dem Wartebildschirm."
          >
            <input
              name="wartetext"
              defaultValue={quiz.intro_wartetext ?? ""}
              className={inputClassName}
            />
          </FixedSlideField>
        </div>
      </FixedSlideForm>
    ),
    countdown: (
      <FixedSlideForm
        action={saveIntroSlide}
        previewHref={previewHref("startsequenz")}
      >
        <HiddenSlideFields quizId={quizIdValue} slideId="countdown" />
        <FixedSlideEnabledField defaultEnabled={slideVisibility.countdown} />
        <BlobUploadField
          label="Intro-Musik"
          quizId={quizIdValue}
          hiddenFieldName="introMusikUrl"
          currentUrl={quiz.intro_musik_url}
          slot="INTRO_AUDIO"
          accept=".mp3,audio/mpeg,audio/mp3"
        />
        <FixedSlideField label="Countdowntext">
          <textarea
            name="countdownText"
            rows={5}
            defaultValue={
              quiz.intro_startsequenz_text ??
              "Ein guter Zeitpunkt, um seine Grundbedürfnisse zu befriedigen."
            }
            className={inputClassName}
          />
        </FixedSlideField>
      </FixedSlideForm>
    ),
    welcome: (
      <FixedSlideForm
        action={saveIntroSlide}
        previewHref={previewHref("begruessung")}
      >
        <HiddenSlideFields quizId={quizIdValue} slideId="welcome" />
        <FixedSlideEnabledField defaultEnabled={slideVisibility.welcome} />
        <FixedSlideField label="Titel">
          <input
            name="titel"
            defaultValue={
              quiz.intro_begruessungstitel ??
              quiz.titel ??
              "Willkommen im"
            }
            className={inputClassName}
          />
        </FixedSlideField>
        <FixedSlideField label="Begrüßungstext">
          <textarea
            name="begruessung"
            rows={6}
            defaultValue={
              quiz.intro_begruessungstext ??
              "Willkommen zum heutigen Quizabend!"
            }
            className={inputClassName}
          />
        </FixedSlideField>
      </FixedSlideForm>
    ),
    rules: (
      <FixedSlideForm
        action={saveIntroSlide}
        previewHref={previewHref("regeln")}
      >
        <HiddenSlideFields quizId={quizIdValue} slideId="rules" />
        <FixedSlideEnabledField defaultEnabled={slideVisibility.rules} />
        <FixedSlideField
          label="Regeln"
          helpText="Eine Regel pro Zeile."
        >
          <textarea
            name="regeln"
            rows={12}
            defaultValue={quiz.intro_regeln ?? defaultRules}
            className={inputClassName}
          />
        </FixedSlideField>
      </FixedSlideForm>
    ),
    prizes: (
      <FixedSlideForm
        action={saveIntroSlide}
        previewHref={previewHref("preise")}
      >
        <HiddenSlideFields quizId={quizIdValue} slideId="prizes" />
        <FixedSlideEnabledField defaultEnabled={slideVisibility.prizes} />
        {[
          ["platz1", "1. Platz", platz1, "z. B. Gutschein über 50 €"],
          ["platz2", "2. Platz", platz2, "z. B. Getränkerunde"],
          ["platz3", "3. Platz", platz3, "z. B. Ruhm und Ehre"],
        ].map(([name, label, value, placeholder]) => (
          <FixedSlideField key={name} label={label}>
            <input
              name={name}
              defaultValue={value}
              placeholder={placeholder}
              className={inputClassName}
            />
          </FixedSlideField>
        ))}
      </FixedSlideForm>
    ),
  };

  return (
    <FixedSlideEditor
      eyebrow="Intro · 5 feste Slides"
      title="Intro konfigurieren"
      description="Alle Intro-Inhalte an einem Ort. Beim Wechsel zwischen den Slides bleiben noch nicht gespeicherte Eingaben erhalten."
      initialItemId={initialItemId}
      backHref={`/quiz/${quizIdValue}`}
      items={INTRO_SLIDES.map((slide) => ({
        id: slide.id,
        title: slide.title,
        description: slide.description,
        status: getIntroSlideStatus(slide.id, quiz),
        panel: panels[slide.id],
      }))}
    />
  );
}
