"use client";

import { useState } from "react";
import {
  addFrageToQuiz,
  removeFrageFromQuizByFrageId,
} from "@/app/quiz/actions";
import type { QuizOption } from "./FragenWorkspace";

type Props = {
  fragenId: number;
  quizze: QuizOption[];
  disabled?: boolean;
  verwendeteQuizIds?: number[];
};

export default function ZuQuizHinzufuegenButton({
  fragenId,
  quizze,
  disabled = false,
  verwendeteQuizIds = [],
}: Props) {
  console.log("Quizze im Button", quizze);

  const [meldung, setMeldung] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function handleQuizChange(value: string) {
    if (!value) return;

    const selectedQuizId = Number(value);
    const bereitsVerwendet = verwendeteQuizIds.includes(selectedQuizId);

    setIsSaving(true);
    setMeldung("");

    try {
      if (bereitsVerwendet) {
        await removeFrageFromQuizByFrageId({
          quizId: selectedQuizId,
          fragenId,
        });

        setMeldung("Aus Quiz entfernt.");
      } else {
        await addFrageToQuiz({
          quizId: selectedQuizId,
          fragenId,
        });

        setMeldung("Zu Quiz hinzugefügt.");
      }
    } catch {
      setMeldung("Aktion fehlgeschlagen.");
    }

    setIsSaving(false);
  }

  if (disabled) {
    return (
      <select
        disabled
        title="Archivierte Fragen können nicht zu einem Quiz hinzugefügt werden."
        className="cursor-not-allowed rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-400 shadow-sm"
      >
        <option>Archivierte Frage</option>
      </select>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value=""
        onChange={(e) => handleQuizChange(e.target.value)}
        disabled={isSaving}
        className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
      >
        <option value="">
          {isSaving ? "Aktualisiere..." : "Quiz auswählen"}
        </option>

        {quizze.map((quiz) => {
          const bereitsVerwendet = verwendeteQuizIds.includes(quiz.quiz_id);
          const quizDatum =
            quiz.quiz_datum instanceof Date
              ? quiz.quiz_datum.toISOString().split("T")[0]
              : quiz.quiz_datum ?? "-";

          return (
            <option key={quiz.quiz_id} value={quiz.quiz_id}>
              {bereitsVerwendet ? "✓ " : ""}
              {quizDatum} · {quiz.titel ?? `Quiz ${quiz.quiz_id}`}
            </option>
          );
        })}
      </select>

      {meldung && (
        <span className="text-sm font-medium text-slate-500">{meldung}</span>
      )}
    </div>
  );
}