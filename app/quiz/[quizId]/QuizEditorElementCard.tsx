"use client";

import type { CSSProperties, HTMLAttributes, ReactNode } from "react";

export type QuizEditorElementKind = "QUESTION" | "STORY" | "POLL";

export type QuizEditorElementCapabilities = {
  configure: boolean;
  preview: boolean;
  answerInteraction: boolean;
  evaluation: boolean;
  scoring: boolean;
};

export const QUIZ_EDITOR_ELEMENT_CAPABILITIES: Record<
  QuizEditorElementKind,
  QuizEditorElementCapabilities
> = {
  QUESTION: {
    configure: true,
    preview: true,
    answerInteraction: true,
    evaluation: true,
    scoring: true,
  },
  STORY: {
    configure: true,
    preview: true,
    answerInteraction: false,
    evaluation: false,
    scoring: false,
  },
  POLL: {
    configure: true,
    preview: true,
    answerInteraction: true,
    evaluation: false,
    scoring: false,
  },
};

type Props = {
  title: string;
  kind: QuizEditorElementKind;
  displayIndex: number;
  metadata: ReactNode;
  configureAction: ReactNode;
  previewAction: ReactNode;
  overflowAction?: ReactNode;
  details?: ReactNode;
  dragAttributes: HTMLAttributes<HTMLButtonElement>;
  dragListeners: HTMLAttributes<HTMLButtonElement> | undefined;
  dragLabel: string;
  cardRef?: (node: HTMLElement | null) => void;
  style?: CSSProperties;
  isDragging?: boolean;
};

export default function QuizEditorElementCard({
  title,
  kind,
  displayIndex,
  metadata,
  configureAction,
  previewAction,
  overflowAction,
  details,
  dragAttributes,
  dragListeners,
  dragLabel,
  cardRef,
  style,
  isDragging = false,
}: Props) {
  return (
    <article
      ref={cardRef}
      style={style}
      data-quiz-element-kind={kind}
      className={`rounded-xl border bg-white shadow-sm transition ${
        isDragging
          ? "border-cyan-300 opacity-80 shadow-lg"
          : "border-slate-200"
      }`}
    >
      <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-start">
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <button
            type="button"
            className="flex h-9 w-9 shrink-0 cursor-grab items-center justify-center rounded-lg text-lg font-semibold text-slate-400 transition hover:bg-slate-100 hover:text-slate-800 active:scale-95 active:cursor-grabbing"
            title="Zum Sortieren ziehen"
            aria-label={dragLabel}
            {...dragAttributes}
            {...dragListeners}
          >
            ⠿
          </button>
          <span className="flex h-9 min-w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 px-2 text-sm font-black text-slate-600">
            {displayIndex}
          </span>

          <div className="min-w-0 pt-1">
            <h3 className="break-words font-semibold leading-6 text-slate-900">
              {title}
            </h3>
            <div className="mt-2 flex flex-wrap gap-1.5 text-xs font-semibold text-slate-600">
              {metadata}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 pl-20 sm:pl-0">
          {configureAction}
          {previewAction}
          {overflowAction ? (
            <details className="relative">
              <summary
                className="flex h-9 w-10 cursor-pointer list-none items-center justify-center rounded-xl border border-slate-300 bg-white text-xl font-bold leading-none text-slate-600 shadow-sm transition hover:bg-slate-50 [&::-webkit-details-marker]:hidden"
                aria-label="Weitere Aktionen"
              >
                …
              </summary>
              <div className="absolute right-0 z-20 mt-2 min-w-max rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                {overflowAction}
              </div>
            </details>
          ) : null}
        </div>
      </div>
      {details}
    </article>
  );
}
