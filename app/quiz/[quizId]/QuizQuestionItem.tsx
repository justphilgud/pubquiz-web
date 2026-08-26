"use client";

import type React from "react";
import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import QuizFrageEntfernenButton from "./QuizFrageEntfernenButton";
import QuizFrageVorschauButton from "./QuizFrageVorschauButton";
import QuizQuestionSettings, {
  type QuizQuestionSettingsActions,
} from "./QuizQuestionSettings";
import { getQuizQuestionPointsDisplay } from "@/app/quiz/evaluation/quizQuestionPointsDisplay";
import { isPollQuestionTemplateId } from "@/app/fragen/editor/templates/questionTemplateRegistry";
import type { ResolvedPresentationLayout } from "@/app/rendering/presentation/presentationLayoutResolver";
import type { StoryElementType } from "@/app/story-elemente/storyElement";
import type { StoryPlacementOverride } from "@/app/story-elemente/storyPlacement";
import type { QuizResultDisplayMode } from "@/app/quiz/liveResults/liveResultMode";

export type QuizQuestion = {
  quiz_fragen_id: number;
  sortierung: number | null;
  quiz_abschnitt_id: number | null;
  fragen_id: number;
  frage: string;
  schwierigkeitslevel: string | null;
  resolvedPresentationLayout: ResolvedPresentationLayout;
  punkte_basis: number;
  punkte_modus: string | null;
  freie_antwort_erlaubt: boolean;
  ergebnisdarstellung: QuizResultDisplayMode;
  live_ergebnis_unterstuetzt: boolean;
  kann_freie_antwort_aktivieren: boolean;
  effektiver_antwortmodus: "OPEN" | "CLOSED" | "UNCLASSIFIED";
  vorlagenname: string;
  templateId: string | null;
  teilpunkte_faehig: boolean;
  kategorien: string[];
  storyElements: Array<{
    id: number;
    title: string;
    type: StoryElementType;
    defaultPlacement: "BEFORE_QUESTION" | "AFTER_SOLUTION";
    placementOverride: StoryPlacementOverride;
  }>;
};

type Props = {
  frage: QuizQuestion;
  index: number;
  quizId: number;
  containerId: string;
  settingsActions: QuizQuestionSettingsActions;
  onRemove: (quizFragenId: number) => void;
};

function getAnswerModeLabel(frage: QuizQuestion) {
  if (isPollQuestionTemplateId(frage.templateId)) {
    return "Abstimmung";
  }

  if (frage.freie_antwort_erlaubt) {
    return "Als offene Frage gestellt";
  }

  if (frage.effektiver_antwortmodus === "OPEN") {
    return "Offene Antwort";
  }

  if (frage.effektiver_antwortmodus === "CLOSED") {
    return "Auswahlantwort";
  }

  return "Antwortmodus unklar";
}

function DragHandle({
  attributes,
  listeners,
}: {
  attributes: React.HTMLAttributes<HTMLButtonElement>;
  listeners: React.HTMLAttributes<HTMLButtonElement> | undefined;
}) {
  return (
    <button
      type="button"
      className="flex h-9 w-9 shrink-0 cursor-grab items-center justify-center rounded-lg text-lg font-semibold text-slate-400 transition hover:bg-slate-100 hover:text-slate-800 active:cursor-grabbing active:scale-95"
      title="Zum Sortieren ziehen"
      aria-label="Frage zum Sortieren ziehen"
      {...attributes}
      {...listeners}
    >
      ⠿
    </button>
  );
}

export default function QuizQuestionItem({
  frage,
  index,
  quizId,
  containerId,
  settingsActions,
  onRemove,
}: Props) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: frage.quiz_fragen_id,
    data: {
      type: "frage",
      containerId,
    },
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const pointsDisplay = getQuizQuestionPointsDisplay({
    templateId: frage.templateId,
    pointsMode: frage.punkte_modus,
    basePoints: frage.punkte_basis,
  });

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={`rounded-xl border bg-white shadow-sm transition ${
        isDragging
          ? "border-cyan-300 opacity-80 shadow-lg"
          : "border-slate-200"
      }`}
    >
      <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-start">
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <DragHandle attributes={attributes} listeners={listeners} />
          <span className="flex h-9 min-w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 px-2 text-sm font-black text-slate-600">
            {index + 1}
          </span>

          <div className="min-w-0 pt-1">
            <h3 className="font-semibold leading-6 text-slate-900">
              {frage.frage}
            </h3>
            <div className="mt-2 flex flex-wrap gap-1.5 text-xs font-semibold text-slate-600">
              <span className="rounded-full bg-violet-50 px-2.5 py-1 text-violet-700">
                {frage.vorlagenname}
              </span>
              {pointsDisplay.pointsLabel && (
                <span className="rounded-full bg-slate-100 px-2.5 py-1">
                  {pointsDisplay.pointsLabel}
                </span>
              )}
              {pointsDisplay.modeLabel && (
                <span
                  className={`rounded-full px-2.5 py-1 ${
                    pointsDisplay.isDynamic
                      ? "bg-rose-50 text-rose-700"
                      : "bg-amber-50 text-amber-800"
                  }`}
                >
                  {pointsDisplay.modeLabel}
                </span>
              )}
              <span
                className={`rounded-full px-2.5 py-1 ${
                  frage.freie_antwort_erlaubt
                    ? "bg-cyan-100 text-cyan-800"
                    : "bg-slate-100"
                }`}
              >
                {getAnswerModeLabel(frage)}
              </span>
              {frage.storyElements.length > 0 && (
                <span
                  className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-800"
                  title={frage.storyElements.map((story) => story.title).join(" · ")}
                >
                  {frage.storyElements.length} {frage.storyElements.length === 1
                    ? "Story-Element"
                    : "Story-Elemente"}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 pl-20 sm:pl-0">
          <button
            type="button"
            onClick={() => setIsSettingsOpen((current) => !current)}
            aria-expanded={isSettingsOpen}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50"
          >
            Konfigurieren
          </button>
          <QuizFrageVorschauButton
            fragenId={frage.fragen_id}
            storyElements={frage.storyElements}
          />

          <details className="relative">
            <summary
              className="flex h-9 w-10 cursor-pointer list-none items-center justify-center rounded-xl border border-slate-300 bg-white text-xl font-bold leading-none text-slate-600 shadow-sm transition hover:bg-slate-50 [&::-webkit-details-marker]:hidden"
              aria-label="Weitere Aktionen"
            >
              …
            </summary>
            <div className="absolute right-0 z-20 mt-2 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
              <QuizFrageEntfernenButton
                quizId={quizId}
                quizFragenId={frage.quiz_fragen_id}
                onRemoved={onRemove}
              />
            </div>
          </details>
        </div>
      </div>

      {isSettingsOpen && (
        <QuizQuestionSettings
          quizFragenId={frage.quiz_fragen_id}
          resolvedPresentationLayout={frage.resolvedPresentationLayout}
          punkteModus={frage.punkte_modus}
          freieAntwortErlaubt={frage.freie_antwort_erlaubt}
          ergebnisdarstellung={frage.ergebnisdarstellung}
          liveErgebnisUnterstuetzt={frage.live_ergebnis_unterstuetzt}
          kannFreieAntwortAktivieren={frage.kann_freie_antwort_aktivieren}
          istPixelbild={frage.templateId === "pixelbild" || frage.templateId === "image_pixel"}
          istUmfrage={isPollQuestionTemplateId(frage.templateId)}
          teilpunkteFaehig={frage.teilpunkte_faehig}
          storyElements={frage.storyElements}
          actions={settingsActions}
        />
      )}
    </article>
  );
}
