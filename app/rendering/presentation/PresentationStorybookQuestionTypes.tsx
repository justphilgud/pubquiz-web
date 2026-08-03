import type { ReactNode } from "react";

/* eslint-disable @next/next/no-img-element -- Storybook renders dynamic quiz media with runtime URLs inside a fixed presentation canvas. */

import type { QuizPraesentationResult } from "@/app/quiz/actions";

type PresentationQuestion = QuizPraesentationResult["fragen"][number];

export type StorybookQuestionKind =
  | "OPEN"
  | "MULTIPLE_CHOICE"
  | "TRUE_FALSE"
  | "ESTIMATE"
  | "ORDERING"
  | "AUDIO"
  | "IMAGE"
  | "PIXEL_REVEAL"
  | "STRUCTURED_RESPONSE";

export type StorybookPresentationMedium = {
  id: number;
  kind: "IMAGE" | "AUDIO" | "VIDEO" | "FILE";
  src: string;
  alt: string;
  caption: string | null;
};

type StorybookQuestionSlideProps = {
  question: PresentationQuestion;
  questionNumber: number;
  layoutVariant: string;
  kind: StorybookQuestionKind;
  medium: StorybookPresentationMedium | null;
  audioElement: ReactNode;
  isPreview: boolean;
  pixelRevealStep: number | null;
  pixelRevealTotal: number;
};

type StorybookSolutionSlideProps = {
  question: PresentationQuestion;
  layoutVariant: string;
  kind: StorybookQuestionKind;
  medium: StorybookPresentationMedium | null;
  solutionLines: readonly string[];
};

function hasImage(question: PresentationQuestion) {
  return question.medien.some((medium) => /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(medium.datei));
}

export function resolveStorybookQuestionKind(
  question: PresentationQuestion,
): StorybookQuestionKind | null {
  const layoutVariant = question.presentationLayouts.question.variant;
  const templateData = question.templateConfig?.templateData;

  if (templateData?.kind === "TRUE_FALSE") return "TRUE_FALSE";
  if (templateData?.kind === "ESTIMATE") return "ESTIMATE";
  if (templateData?.kind === "ORDERING") return "ORDERING";
  if (layoutVariant === "AUDIO_FOCUS") return "AUDIO";
  if (layoutVariant === "REVEAL_SEQUENCE") return "PIXEL_REVEAL";
  if (layoutVariant === "STRUCTURED_RESPONSE") return "STRUCTURED_RESPONSE";

  // Other specialist template contracts keep their existing renderer until a
  // dedicated Storybook treatment is intentionally designed for them.
  if (templateData) return null;
  if (hasImage(question)) return "IMAGE";
  if (question.effektiver_antwortmodus === "CLOSED" && question.antworten.length > 1) {
    return "MULTIPLE_CHOICE";
  }
  return "OPEN";
}

function StorybookKicker({ children }: { children: ReactNode }) {
  return <div className="presentation-storybook-kicker">{children}</div>;
}

function StorybookQuestionLead({
  question,
  questionNumber,
  kind,
}: {
  question: PresentationQuestion;
  questionNumber: number;
  kind: StorybookQuestionKind;
}) {
  const labels: Record<StorybookQuestionKind, string> = {
    OPEN: "Persönliche Frage",
    MULTIPLE_CHOICE: "Vier Möglichkeiten",
    TRUE_FALSE: "Eine klare Entscheidung",
    ESTIMATE: "Eine Zahl aus der Geschichte",
    ORDERING: "Die richtige Reihenfolge",
    AUDIO: "Hörprobe",
    IMAGE: "Bildfrage",
    PIXEL_REVEAL: "Bild für Bild",
    STRUCTURED_RESPONSE: "Mehrteilige Antwort",
  };

  return (
    <div className="presentation-storybook-question-lead">
      <StorybookKicker>
        Frage {String(questionNumber).padStart(2, "0")} · {labels[kind]}
      </StorybookKicker>
      <h2>{question.frage}</h2>
    </div>
  );
}

function StorybookAudioPanel({
  audioElement,
  isPreview,
  caption,
}: {
  audioElement: ReactNode;
  isPreview: boolean;
  caption: string | null;
}) {
  return (
    <section
      className="presentation-storybook-audio"
      aria-label={isPreview ? "Stumme Audio-Vorschau" : "Audio-Wiedergabe"}
      data-preview-audio={isPreview ? "true" : undefined}
    >
      {audioElement}
      <div className="presentation-storybook-audio-heading">
        <span className="presentation-storybook-audio-play" aria-hidden="true">▶</span>
        <div>
          <StorybookKicker>Audio</StorybookKicker>
          <strong>{caption || "Hörprobe aus der gemeinsamen Geschichte"}</strong>
        </div>
      </div>
      <div className="presentation-storybook-audio-wave" aria-hidden="true" />
      <div className="presentation-storybook-audio-meta">
        <span>00:00</span>
        <span>{isPreview ? "Vorschau bleibt stumm" : "Wiedergabe durch die Moderation"}</span>
      </div>
    </section>
  );
}

function StorybookMediaFrame({
  medium,
  label,
}: {
  medium: StorybookPresentationMedium | null;
  label: string;
}) {
  if (!medium) {
    return (
      <div className="presentation-storybook-media presentation-storybook-media--empty">
        <StorybookKicker>{label}</StorybookKicker>
        <span>Kein Medium hinterlegt</span>
      </div>
    );
  }

  return (
    <figure className="presentation-storybook-media" data-storybook-media-kind={medium.kind}>
      {medium.kind === "IMAGE" ? (
        <img src={medium.src} alt={medium.alt} />
      ) : (
        <div className="presentation-storybook-file-name">{medium.alt}</div>
      )}
      <figcaption>
        <span>{label}</span>
        {medium.caption || medium.alt}
      </figcaption>
    </figure>
  );
}

function StorybookChoiceRows({
  question,
  trueFalse = false,
}: {
  question: PresentationQuestion;
  trueFalse?: boolean;
}) {
  const answers = [...question.antworten].sort((left, right) => {
    const leftIndex = question.antwort_reihenfolge.indexOf(left.antwort_id);
    const rightIndex = question.antwort_reihenfolge.indexOf(right.antwort_id);
    return (leftIndex < 0 ? Number.MAX_SAFE_INTEGER : leftIndex) - (rightIndex < 0 ? Number.MAX_SAFE_INTEGER : rightIndex);
  });

  return (
    <ol className={trueFalse ? "presentation-storybook-choices presentation-storybook-choices--binary" : "presentation-storybook-choices"}>
      {answers.map((answer, index) => (
        <li key={answer.antwort_id}>
          <span>{trueFalse ? String(index + 1).padStart(2, "0") : String.fromCharCode(65 + index)}</span>
          <strong>{answer.antwort}</strong>
        </li>
      ))}
    </ol>
  );
}

function StorybookEstimate({ question }: { question: PresentationQuestion }) {
  const templateData = question.templateConfig?.templateData;
  const unit = templateData?.kind === "ESTIMATE" ? templateData.unit : null;
  return (
    <div className="presentation-storybook-estimate">
      <span className="presentation-storybook-estimate-mark">?</span>
      <div className="presentation-storybook-estimate-scale" aria-hidden="true">
        {Array.from({ length: 9 }, (_, index) => <i key={index} />)}
      </div>
      <p>{unit ? `Gesucht: eine Antwort in ${unit}` : "Gesucht: die möglichst genaue Zahl"}</p>
    </div>
  );
}

function StorybookOrdering({ question }: { question: PresentationQuestion }) {
  const answers = [...question.antworten].sort((left, right) => {
    const leftIndex = question.antwort_reihenfolge.indexOf(left.antwort_id);
    const rightIndex = question.antwort_reihenfolge.indexOf(right.antwort_id);
    return (leftIndex < 0 ? Number.MAX_SAFE_INTEGER : leftIndex) - (rightIndex < 0 ? Number.MAX_SAFE_INTEGER : rightIndex);
  });
  return (
    <ol className="presentation-storybook-sequence">
      {answers.map((answer, index) => (
        <li key={answer.antwort_id}>
          <span>{String(index + 1).padStart(2, "0")}</span>
          <strong>{answer.antwort}</strong>
        </li>
      ))}
    </ol>
  );
}

function StorybookStructuredFields({ question }: { question: PresentationQuestion }) {
  return (
    <div className="presentation-storybook-fields">
      {question.antwortfelder.map((field, index) => (
        <section key={field.antwortfeld_id}>
          <span>Teil {String(index + 1).padStart(2, "0")}</span>
          <strong>{field.label}</strong>
          <small>{field.ist_pflicht ? "gehört zur vollständigen Antwort" : "optionale Ergänzung"}</small>
        </section>
      ))}
    </div>
  );
}

export function PresentationStorybookQuestionSlide({
  question,
  questionNumber,
  layoutVariant,
  kind,
  medium,
  audioElement,
  isPreview,
  pixelRevealStep,
  pixelRevealTotal,
}: StorybookQuestionSlideProps) {
  const lead = <StorybookQuestionLead question={question} questionNumber={questionNumber} kind={kind} />;

  if (kind === "OPEN") {
    return <section data-presentation-layout={layoutVariant} data-storybook-question-kind={kind} className="presentation-storybook-question presentation-storybook-question--open">{lead}</section>;
  }
  if (kind === "MULTIPLE_CHOICE" || kind === "TRUE_FALSE") {
    return (
      <section data-presentation-layout={layoutVariant} data-storybook-question-kind={kind} className="presentation-storybook-question presentation-storybook-question--split">
        {lead}
        <StorybookChoiceRows question={question} trueFalse={kind === "TRUE_FALSE"} />
      </section>
    );
  }
  if (kind === "ESTIMATE") {
    return (
      <section data-presentation-layout={layoutVariant} data-storybook-question-kind={kind} className="presentation-storybook-question presentation-storybook-question--estimate">
        {lead}
        <StorybookEstimate question={question} />
      </section>
    );
  }
  if (kind === "ORDERING") {
    return (
      <section data-presentation-layout={layoutVariant} data-storybook-question-kind={kind} className="presentation-storybook-question presentation-storybook-question--split">
        {lead}
        <StorybookOrdering question={question} />
      </section>
    );
  }
  if (kind === "STRUCTURED_RESPONSE") {
    return (
      <section data-presentation-layout={layoutVariant} data-storybook-question-kind={kind} className="presentation-storybook-question presentation-storybook-question--split">
        {lead}
        <StorybookStructuredFields question={question} />
      </section>
    );
  }
  if (kind === "AUDIO") {
    return (
      <section data-presentation-layout={layoutVariant} data-storybook-question-kind={kind} className="presentation-storybook-question presentation-storybook-question--audio">
        {lead}
        <StorybookAudioPanel audioElement={audioElement} isPreview={isPreview} caption={medium?.caption ?? null} />
      </section>
    );
  }

  const isPixel = kind === "PIXEL_REVEAL";
  return (
    <section
      data-presentation-layout={layoutVariant}
      data-storybook-question-kind={kind}
      data-pixel-reveal-step={pixelRevealStep ?? undefined}
      className="presentation-storybook-question presentation-storybook-question--media"
    >
      {lead}
      <div className="presentation-storybook-question-media">
        <StorybookMediaFrame medium={medium} label={isPixel ? "Bildenthüllung" : "Fotografie"} />
        {isPixel && pixelRevealStep !== null && (
          <div className="presentation-storybook-reveal-progress">
            <span>Enthüllung</span>
            <div aria-label={`Stufe ${pixelRevealStep} von ${pixelRevealTotal}`}>
              {Array.from({ length: pixelRevealTotal }, (_, index) => <i key={index} data-active={index < pixelRevealStep} />)}
            </div>
            <strong>{String(pixelRevealStep).padStart(2, "0")} / {String(pixelRevealTotal).padStart(2, "0")}</strong>
          </div>
        )}
      </div>
    </section>
  );
}

function acceptedStructuredSolutions(question: PresentationQuestion) {
  return question.antwortfelder.map((field) => ({
    label: field.label,
    values: field.loesungen.filter((solution) => solution.ist_akzeptiert).map((solution) => solution.loesung_text),
  })).filter((field) => field.values.length > 0);
}

function StorybookSolutionLead({ question }: { question: PresentationQuestion }) {
  return (
    <header className="presentation-storybook-solution-lead">
      <StorybookKicker>Auflösung</StorybookKicker>
      <p>{question.frage}</p>
    </header>
  );
}

function StorybookSolutionAnswers({
  question,
  kind,
  solutionLines,
}: {
  question: PresentationQuestion;
  kind: StorybookQuestionKind;
  solutionLines: readonly string[];
}) {
  const correctAnswers = question.antworten.filter((answer) => answer.ist_richtig);
  const structuredSolutions = acceptedStructuredSolutions(question);
  const templateData = question.templateConfig?.templateData;

  if (kind === "MULTIPLE_CHOICE" || kind === "TRUE_FALSE") {
    return (
      <div>
        <ol className="presentation-storybook-solution-choices">
          {question.antworten.map((answer, index) => (
            <li key={answer.antwort_id} data-correct={answer.ist_richtig}>
              <span>{kind === "TRUE_FALSE" ? String(index + 1).padStart(2, "0") : String.fromCharCode(65 + index)}</span>
              <strong>{answer.antwort}</strong>
              {answer.ist_richtig && <small>Richtige Antwort</small>}
            </li>
          ))}
        </ol>
        {kind === "TRUE_FALSE" && templateData?.kind === "TRUE_FALSE" && templateData.explanation && (
          <p className="presentation-storybook-solution-note">{templateData.explanation}</p>
        )}
      </div>
    );
  }
  if (kind === "ORDERING" && templateData?.kind === "ORDERING") {
    return (
      <ol className="presentation-storybook-sequence presentation-storybook-sequence--resolved">
        {templateData.items.map((item, index) => (
          <li key={item.id}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <div><strong>{item.text}</strong>{item.explanation && <small>{item.explanation}</small>}</div>
          </li>
        ))}
      </ol>
    );
  }
  if (kind === "STRUCTURED_RESPONSE") {
    return (
      <div className="presentation-storybook-structured-solution">
        {structuredSolutions.map((field) => (
          <section key={field.label}><span>{field.label}</span><strong>{field.values.join(" / ")}</strong></section>
        ))}
      </div>
    );
  }

  const primaryLine = solutionLines[0] || correctAnswers[0]?.antwort || "Keine Lösung hinterlegt";
  return (
    <div className={`presentation-storybook-primary-solution presentation-storybook-primary-solution--${kind.toLowerCase()}`}>
      <strong>{primaryLine}</strong>
      {kind === "ESTIMATE" && templateData?.kind === "ESTIMATE" && templateData.explanation && <p>{templateData.explanation}</p>}
    </div>
  );
}

export function PresentationStorybookSolutionSlide({
  question,
  layoutVariant,
  kind,
  medium,
  solutionLines,
}: StorybookSolutionSlideProps) {
  const hasMemoryImage = (kind === "IMAGE" || kind === "PIXEL_REVEAL") && medium;
  return (
    <section
      data-presentation-layout={layoutVariant}
      data-storybook-question-kind={kind}
      data-storybook-phase="SOLUTION"
      className={`presentation-storybook-solution${hasMemoryImage ? " presentation-storybook-solution--media" : ""}`}
    >
      <StorybookSolutionLead question={question} />
      <div className="presentation-storybook-solution-content">
        {hasMemoryImage && <StorybookMediaFrame medium={medium} label={kind === "PIXEL_REVEAL" ? "Vollständiges Bild" : "Erinnerung"} />}
        <StorybookSolutionAnswers question={question} kind={kind} solutionLines={solutionLines} />
      </div>
    </section>
  );
}
