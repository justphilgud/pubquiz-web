"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import ContentSearchControls from "@/app/components/content/ContentSearchControls";
import type { StoryQuestionRelationshipValue } from "./storyElement";
import { linkQuestionStoryElement, unlinkQuestionStoryElement } from "./questionActions";

type QuestionOption = {
  questionId: number;
  title: string;
  status: string;
  eventSeriesNames: string[];
  quizzes: Array<{ id: number; title: string; eventSeriesName: string }>;
};

export default function StoryQuestionLinksPanel({
  storyElementId,
  links,
  options,
  canEditStory,
}: {
  storyElementId: number;
  links: Array<QuestionOption & { relationship: StoryQuestionRelationshipValue; canEdit: boolean }>;
  options: QuestionOption[];
  canEditStory: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const filtered = options.filter((question) =>
    `${question.questionId} ${question.title} ${question.eventSeriesNames.join(" ")} ${question.quizzes.map((quiz) => quiz.title).join(" ")}`
      .toLocaleLowerCase("de-DE")
      .includes(query.trim().toLocaleLowerCase("de-DE")),
  );

  function run(action: () => Promise<{ success: boolean; message?: string }>) {
    setMessage("");
    startTransition(async () => {
      const result = await action();
      if (!result.success) setMessage(result.message ?? "Verknüpfung konnte nicht gespeichert werden.");
      else router.refresh();
    });
  }

  return (
    <section className="rounded-3xl border border-cyan-200 bg-cyan-50 p-4 shadow-sm sm:p-6">
      <h2 className="text-xl font-black">Verknüpfte Fragen</h2>
      <p className="mt-1 text-sm text-slate-600">Beziehungen verbinden Inhalte, ohne Frage oder Story-Element zu löschen.</p>
      <div className="mt-4 space-y-2">
        {links.map((link) => <article key={link.questionId} className="rounded-xl border border-cyan-200 bg-white p-3"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><strong>{link.title}</strong><p className="mt-1 text-xs text-slate-500">Content-ID #{link.questionId} · {link.status}{link.eventSeriesNames.length ? ` · ${link.eventSeriesNames.join(", ")}` : " · Global"}</p>{link.quizzes.length > 0 && <p className="mt-1 text-xs text-slate-500">Quiz: {link.quizzes.map((quiz) => `${quiz.title} (${quiz.eventSeriesName})`).join(", ")}</p>}</div><div className="flex flex-wrap gap-2"><Link href={`/fragen/editor/${link.questionId}`} target="_blank" className="inline-flex min-h-10 items-center rounded-xl border border-slate-300 px-3 text-sm font-semibold">Frage öffnen</Link>{canEditStory && link.canEdit && <button type="button" disabled={pending} onClick={() => run(() => unlinkQuestionStoryElement({ questionId: link.questionId, storyElementId }))} className="min-h-10 rounded-xl border border-red-200 px-3 text-sm font-semibold text-red-700 disabled:opacity-50">Verknüpfung entfernen</button>}</div></div></article>)}
        {links.length === 0 && <p className="rounded-xl border border-dashed border-cyan-300 bg-white/70 p-4 text-sm text-slate-600">Dieses Story-Element ist noch mit keiner Frage verknüpft.</p>}
      </div>
      {canEditStory && <div className="mt-4 rounded-xl border border-cyan-200 bg-white p-3"><ContentSearchControls query={query} placeholder="Fragen durchsuchen …" onQueryChange={setQuery} onSubmit={() => undefined} /><div className="mt-3 space-y-2" aria-live="polite">{filtered.map((question) => <article key={question.questionId} className="flex flex-col gap-3 rounded-xl border border-slate-200 p-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><strong className="break-words">{question.title}</strong><p className="mt-1 text-xs text-slate-500">Content-ID #{question.questionId} · {question.status}{question.eventSeriesNames.length ? ` · ${question.eventSeriesNames.join(", ")}` : " · Global"}</p></div><button type="button" disabled={pending} onClick={() => run(() => linkQuestionStoryElement({ questionId: question.questionId, storyElementId }))} className="min-h-11 shrink-0 rounded-xl bg-cyan-900 px-4 font-bold text-white disabled:opacity-50">Verknüpfen</button></article>)}</div>{filtered.length === 0 && <p className="mt-3 rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-600">Keine berechtigte Frage gefunden. Suche zurücksetzen oder zuerst eine Frage anlegen.</p>}</div>}
      {message && <p role="alert" className="mt-3 text-sm font-semibold text-red-700">{message}</p>}
    </section>
  );
}
