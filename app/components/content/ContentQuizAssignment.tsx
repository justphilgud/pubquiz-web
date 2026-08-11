"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { assignContentToQuiz } from "./actions";
import type { ContentQuizOption, ContentType } from "./contentLibrary";

export default function ContentQuizAssignment({ contentType, contentId, quizzes, assignedQuizIds, assignableQuizIds, disabled }: {
  contentType: ContentType;
  contentId: number;
  quizzes: ContentQuizOption[];
  assignedQuizIds: number[];
  assignableQuizIds: number[];
  disabled?: boolean;
}) {
  const router = useRouter();
  const [assigned, setAssigned] = useState(assignedQuizIds);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function assign(quizId: string) {
    if (!quizId || assigned.includes(Number(quizId))) return;
    startTransition(async () => {
      try {
        const result = await assignContentToQuiz({ contentType, contentId, quizId: Number(quizId) });
        setMessage(result.message);
        if (result.success) {
          setAssigned((current) => [...current, Number(quizId)]);
          router.refresh();
        }
      } catch {
        setMessage("Der Inhalt konnte diesem Quiz nicht zugeordnet werden.");
      }
    });
  }

  if (disabled || quizzes.length === 0) return null;
  return <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap">
    <select aria-label="Quiz auswählen und direkt zuordnen" value="" onChange={(event) => assign(event.target.value)} disabled={pending} className="min-h-11 min-w-0 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold">
      <option value="">Quiz auswählen</option>
      {quizzes.map((quiz) => {
        const isAssigned = assigned.includes(quiz.quizId);
        const isAssignable = assignableQuizIds.includes(quiz.quizId);
        return <option key={quiz.quizId} value={quiz.quizId} disabled={isAssigned || !isAssignable}>{isAssigned ? "✓ " : ""}{quiz.title}{!isAssigned && !isAssignable ? " · nicht verfügbar" : ""}</option>;
      })}
    </select>
    {!disabled && assignableQuizIds.every((quizId) => assigned.includes(quizId)) && <p className="basis-full text-xs text-slate-600">Für diesen Inhalt ist aktuell kein weiteres Quiz verfügbar.</p>}
    {message && <p role="status" className="basis-full text-xs font-semibold text-slate-700">{message}</p>}
  </div>;
}
