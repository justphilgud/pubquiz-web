"use client";

import { useState } from "react";
import {
  addFrageToQuiz,
  searchFragenForQuiz,
} from "../actions";
import type { QuizFrageSuchResult } from "../actions";

type Props = {
  quizId: number;
};

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-200";

const buttonPrimaryClass =
  "rounded-2xl bg-slate-900 px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-slate-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-slate-300";

const buttonSecondaryClass =
  "rounded-xl border border-slate-300 bg-white px-4 py-2 font-medium text-slate-900 shadow-sm transition hover:bg-slate-50 active:scale-[0.99]";

export default function QuizFragenHinzufuegen({ quizId }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [suchtext, setSuchtext] = useState("");
  const [ergebnisse, setErgebnisse] = useState<QuizFrageSuchResult[]>([]);
  const [meldung, setMeldung] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSearch() {
    setMeldung("");
    setIsLoading(true);

    const result = await searchFragenForQuiz({
      quizId,
      suchtext,
    });

    setErgebnisse(result);
    setIsLoading(false);
  }

  async function handleAdd(fragenId: number) {
    setMeldung("");

    await addFrageToQuiz({
      quizId,
      fragenId,
    });

    setMeldung("Frage wurde zum Quiz hinzugefügt.");

    const result = await searchFragenForQuiz({
      quizId,
      suchtext,
    });

    setErgebnisse(result);
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={buttonPrimaryClass}
      >
        Frage hinzufügen
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold">Frage zum Quiz hinzufügen</h3>
          <p className="mt-1 text-sm text-slate-500">
            Suche im Fragenpool und füge passende Fragen direkt diesem Quiz hinzu.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className={buttonSecondaryClass}
        >
          Schließen
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
        <input
          value={suchtext}
          onChange={(e) => setSuchtext(e.target.value)}
          className={inputClass}
          placeholder="Fragetext suchen..."
        />

        <button
          type="button"
          onClick={handleSearch}
          className={buttonPrimaryClass}
        >
          {isLoading ? "Suche..." : "Suchen"}
        </button>
      </div>

      {meldung && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3 text-sm font-medium text-slate-800">
          {meldung}
        </div>
      )}

      <div className="mt-4 space-y-3">
        {ergebnisse.map((frage) => (
          <div
            key={frage.fragen_id}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="font-medium text-slate-900">
                  {frage.frage}
                </div>

                <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                  <span>Quelle: {frage.quelle ?? "-"}</span>
                  <span>Schwierigkeit: {frage.schwierigkeitslevel ?? "-"}</span>
                  <span>
                    Kategorien:{" "}
                    {frage.kategorien.length > 0
                      ? frage.kategorien.join(", ")
                      : "-"}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleAdd(frage.fragen_id)}
                disabled={frage.ist_bereits_im_quiz}
                className={buttonPrimaryClass}
              >
                {frage.ist_bereits_im_quiz
                  ? "Bereits im Quiz"
                  : "Hinzufügen"}
              </button>
            </div>
          </div>
        ))}

        {ergebnisse.length === 0 && !isLoading && (
          <p className="text-sm text-slate-500">
            Noch keine Suchergebnisse. Starte eine Suche, um Fragen auszuwählen.
          </p>
        )}
      </div>
    </div>
  );
}