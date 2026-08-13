"use client";

import type { ReactNode } from "react";

export const quizElementActionClass =
  "min-h-11 shrink-0 rounded-2xl bg-slate-900 px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-slate-300";

export default function QuizElementSearchResult({
  title,
  metadata,
  description,
  actionLabel,
  disabled,
  onAction,
}: {
  title: string;
  metadata: ReactNode;
  description?: string | null;
  actionLabel: string;
  disabled: boolean;
  onAction: () => void;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 focus-within:border-slate-400">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="break-words font-medium text-slate-900">{title}</div>
          {description && <p className="mt-1 line-clamp-2 text-sm text-slate-600">{description}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">{metadata}</div>
        </div>
        <button type="button" onClick={onAction} disabled={disabled} className={quizElementActionClass}>
          {actionLabel}
        </button>
      </div>
    </article>
  );
}
