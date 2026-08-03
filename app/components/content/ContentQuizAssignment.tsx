"use client";

import { useState, useTransition } from "react";
import { assignContentToQuiz } from "./actions";
import type { ContentQuizOption, ContentType } from "./contentLibrary";

export default function ContentQuizAssignment({ contentType, contentId, quizzes, assignedQuizIds, disabled }: {
  contentType: ContentType;
  contentId: number;
  quizzes: ContentQuizOption[];
  assignedQuizIds: number[];
  disabled?: boolean;
}) {
  const [quizId, setQuizId] = useState("");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function assign() {
    if (!quizId) return;
    startTransition(async () => {
      const result = await assignContentToQuiz({ contentType, contentId, quizId: Number(quizId) });
      setMessage(result.message);
      if (result.success) window.location.reload();
    });
  }

  if (disabled || quizzes.length === 0) return null;
  return <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap">
    <select aria-label="Quiz auswählen" value={quizId} onChange={(event) => setQuizId(event.target.value)} disabled={pending} className="min-h-11 min-w-0 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold">
      <option value="">Quiz auswählen</option>
      {quizzes.map((quiz) => <option key={quiz.quizId} value={quiz.quizId} disabled={assignedQuizIds.includes(quiz.quizId)}>{quiz.title}{assignedQuizIds.includes(quiz.quizId) ? " · bereits enthalten" : ""}</option>)}
    </select>
    <button type="button" disabled={pending || !quizId || assignedQuizIds.includes(Number(quizId))} onClick={assign} className="min-h-11 rounded-xl bg-emerald-800 px-4 text-sm font-bold text-white disabled:opacity-50">Hinzufügen</button>
    {message && <p role="status" className="basis-full text-xs font-semibold text-slate-700">{message}</p>}
  </div>;
}
