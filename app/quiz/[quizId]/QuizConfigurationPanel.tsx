"use client";

import { useState, useTransition } from "react";
import { Select } from "@/components/ui/Select";
import { updateQuizDefaultSolutionStrategy } from "./quizStructureActions";
import type { QuizSolutionStrategy } from "@/app/quiz/flow/quizFlow";

export default function QuizConfigurationPanel({ quizId, initialStrategy }: {
  quizId: number;
  initialStrategy: QuizSolutionStrategy;
}) {
  const [strategy, setStrategy] = useState(initialStrategy);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] sm:items-end">
        <label className="space-y-2">
          <span className="block text-xs font-bold uppercase tracking-wide text-slate-500">Auflösungen</span>
          <Select
            value={strategy}
            disabled={pending}
            onChange={(event) => {
              const previous = strategy;
              const next = event.target.value as QuizSolutionStrategy;
              setStrategy(next);
              setMessage("");
              startTransition(async () => {
                const result = await updateQuizDefaultSolutionStrategy({ quizId, strategy: next });
                if (!result.success) {
                  setStrategy(previous);
                  setMessage(result.message);
                  return;
                }
                setMessage("Auflösungsstrategie wurde gespeichert.");
              });
            }}
            className="min-h-11 rounded-xl font-semibold"
          >
            <option value="AFTER_EACH_QUESTION">Direkt nach jeder Frage</option>
            <option value="END_OF_BLOCK">Gesammelt am Ende des Blocks</option>
            {strategy === "MANUAL" && <option value="MANUAL">Manueller Bestandsablauf</option>}
          </Select>
        </label>
        <div className="text-sm text-slate-600">
          Gilt für alle Fragenblöcke ohne historischen Block-Override.
        </div>
      </div>
      {message && <p role="status" className="mt-3 text-sm font-semibold text-slate-700">{message}</p>}
    </section>
  );
}
