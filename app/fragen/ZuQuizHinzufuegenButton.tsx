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

  const [meldung, setMeldung] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [selectedQuizId, setSelectedQuizId] = useState("");
  const [assignmentOverrides, setAssignmentOverrides] = useState<
    Record<number, boolean>
  >({});

  const isAssigned = (quizId: number) =>
    assignmentOverrides[quizId] ?? verwendeteQuizIds.includes(quizId);

  async function handleQuizChange(value: string) {
    if (!value) return;

    const selectedQuizId = Number(value);
    const bereitsVerwendet = isAssigned(selectedQuizId);

    setIsSaving(true);
    setMeldung("");

    try {
      if (bereitsVerwendet) {
        await removeFrageFromQuizByFrageId({
          quizId: selectedQuizId,
          fragenId,
        });

        setMeldung("Aus Quiz entfernt.");
        setAssignmentOverrides((current) => ({
          ...current,
          [selectedQuizId]: false,
        }));
      } else {
        const result = await addFrageToQuiz({
          quizId: selectedQuizId,
          fragenId,
        });

        setMeldung(
          result.coupledQuestionAlreadyInQuiz
            ? "Zu Quiz hinzugefügt. Hinweis: Die gekoppelte FaceMorph-/Pixelfrage ist ebenfalls in diesem Quiz."
            : "Zu Quiz hinzugefügt.",
        );
        setAssignmentOverrides((current) => ({
          ...current,
          [selectedQuizId]: true,
        }));
      }
    } catch {
      setMeldung("Aktion fehlgeschlagen.");
    }

    setSelectedQuizId("");
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
        aria-label="Quiz auswählen"
        value={selectedQuizId}
        onChange={(event) => {
          setSelectedQuizId(event.target.value);
          void handleQuizChange(event.target.value);
        }}
        disabled={isSaving}
        className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
      >
        <option value="">
          {isSaving ? "Aktualisiere..." : "Quiz auswählen"}
        </option>

        {quizze.map((quiz) => {
          const bereitsVerwendet = isAssigned(quiz.quiz_id);
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
