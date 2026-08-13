"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  addFrageToQuiz,
  searchFragenForQuiz,
} from "../actions";
import type { QuizFrageSuchResult } from "../actions";
import ContentSearchControls from "@/app/components/content/ContentSearchControls";

type Props = {
  quizId: number;
};

const buttonPrimaryClass =
  "rounded-2xl bg-slate-900 px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-slate-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-slate-300";

const buttonSecondaryClass =
  "rounded-xl border border-slate-300 bg-white px-4 py-2 font-medium text-slate-900 shadow-sm transition hover:bg-slate-50 active:scale-[0.99]";

export default function QuizFragenHinzufuegen({ quizId }: Props) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [suchtext, setSuchtext] = useState("");
  const [ergebnisse, setErgebnisse] = useState<QuizFrageSuchResult[]>([]);
  const [meldung, setMeldung] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [includeLinkedStoryElements, setIncludeLinkedStoryElements] = useState(true);

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
    try {
      const assignment = await addFrageToQuiz({
        quizId,
        fragenId,
        includeLinkedStoryElements,
      });
      setMeldung(
        assignment.coupledQuestionAlreadyInQuiz
          ? "Frage wurde hinzugefügt. Hinweis: Die gekoppelte FaceMorph-/Pixelfrage ist ebenfalls in diesem Quiz."
          : "Frage wurde zum Quiz hinzugefügt.",
      );
      const result = await searchFragenForQuiz({ quizId, suchtext });
      setErgebnisse(result);
      router.refresh();
    } catch (error) {
      setMeldung(error instanceof Error ? error.message : "Frage konnte nicht hinzugefügt werden.");
    }
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={buttonPrimaryClass}
      >
        Quiz-Element hinzufügen
      </button>
    );
  }

  return (
    <div className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold">Quiz-Element hinzufügen</h3>
          <p className="mt-1 text-sm text-slate-500">
            Wähle eine Frage aus oder wechsle zu den Story-Elementen im Quizablauf.
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

      <div className="mb-4 flex flex-wrap gap-2">
        <span className="inline-flex min-h-11 items-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
          Frage auswählen
        </span>
        <Link
          href={`/quiz/${quizId}/ablauf`}
          className={`${buttonSecondaryClass} inline-flex min-h-11 items-center`}
        >
          Story-Element auswählen
        </Link>
      </div>

      <ContentSearchControls
        query={suchtext}
        loading={isLoading}
        placeholder="Fragen durchsuchen …"
        onQueryChange={setSuchtext}
        onSubmit={() => void handleSearch()}
      />

      <label className="mt-3 flex min-h-11 items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800">
        <input type="checkbox" checked={includeLinkedStoryElements} onChange={(event) => setIncludeLinkedStoryElements(event.target.checked)} className="h-5 w-5 rounded border-slate-300" />
        Verknüpfte Story-Elemente ebenfalls hinzufügen
      </label>

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
                  <span
                    className={`rounded-full px-2 py-1 font-semibold ${
                      frage.ist_verwendbar
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-amber-50 text-amber-800"
                    }`}
                  >
                    {frage.status_hinweis}
                  </span>
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
                disabled={frage.ist_bereits_im_quiz || !frage.ist_verwendbar}
                className={buttonPrimaryClass}
              >
                {frage.ist_bereits_im_quiz
                  ? "Bereits im Quiz"
                  : frage.ist_verwendbar
                    ? "Hinzufügen"
                    : "Noch nicht verwendbar"}
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
