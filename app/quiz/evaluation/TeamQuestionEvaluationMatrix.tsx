"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { formatQuizPoints } from "../formatQuizPoints";
import EvaluationMatrixDetailModal, {
  type EvaluationMatrixSelection,
} from "./EvaluationMatrixDetailModal";
import type {
  EvaluationMatrix as EvaluationMatrixData,
  EvaluationMatrixCell,
  EvaluationMatrixQuestion,
  EvaluationMatrixTeam,
} from "./evaluationMatrix";
import {
  evaluationMatrixStatusPresentation,
  type EvaluationMatrixFilter,
  questionMatchesEvaluationMatrixFilter,
} from "./evaluationMatrixDisplay";

const filterOptions: ReadonlyArray<{
  id: EvaluationMatrixFilter;
  label: string;
}> = [
  { id: "ALL", label: "Alle" },
  { id: "REVIEW", label: "Nur prüfen" },
  { id: "PROBLEMATIC", label: "Problematisch" },
];

function MatrixCell({
  cell,
  question,
  team,
  selected,
  onSelect,
}: {
  cell: EvaluationMatrixCell;
  question: EvaluationMatrixQuestion;
  team: EvaluationMatrixTeam;
  selected: boolean;
  onSelect: () => void;
}) {
  const presentation = evaluationMatrixStatusPresentation[cell.status];
  const accessibleLabel = `${team.name}, Frage ${question.number}: ${presentation.label}. Details anzeigen`;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`mx-auto flex h-9 w-9 items-center justify-center rounded-lg border text-sm font-black transition hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-slate-900 sm:h-8 sm:w-8 ${presentation.className} ${selected ? "ring-2 ring-indigo-600 ring-offset-1" : ""}`}
      aria-label={accessibleLabel}
      title={`${presentation.label} · ${team.name} · Frage ${question.number}`}
    >
      <span aria-hidden="true">{presentation.symbol}</span>
    </button>
  );
}

export default function TeamQuestionEvaluationMatrix({ matrix }: { matrix: EvaluationMatrixData }) {
  const [filter, setFilter] = useState<EvaluationMatrixFilter>("ALL");
  const [selection, setSelection] = useState<EvaluationMatrixSelection | null>(null);
  const visibleQuestions = useMemo(
    () => matrix.questions.filter((question) =>
      questionMatchesEvaluationMatrixFilter(question, filter)),
    [filter, matrix.questions],
  );
  const selectedQuestionId = selection?.question.id ?? null;
  const selectedTeamName = selection?.kind === "cell" ? selection.team.name : null;

  if (matrix.questions.length === 0 || matrix.teams.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-6 text-sm text-slate-600 shadow-sm">
        Für die Matrix sind noch keine bewerteten Quizfragen und Teams vorhanden.
      </div>
    );
  }

  function selectFilter(nextFilter: EvaluationMatrixFilter) {
    setFilter(nextFilter);
    setSelection(null);
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-slate-900">Team × Frage</h2>
            <p className="mt-1 max-w-3xl text-sm text-slate-600">
              Zelle oder Fragenummer auswählen, um Details zu sehen. Umfragen sind nicht Teil der Bewertung.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5 text-xs font-bold" aria-label="Statuslegende">
            {Object.entries(evaluationMatrixStatusPresentation).map(([status, value]) => (
              <span key={status} className={`rounded-full border px-2 py-1 ${value.className}`}>
                <span aria-hidden="true">{value.symbol}</span> {value.label}
              </span>
            ))}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2" aria-label="Matrixfilter">
          <span className="text-xs font-bold text-slate-500">Ansicht:</span>
          {filterOptions.map((option) => (
            <Button
              key={option.id}
              type="button"
              variant={filter === option.id ? "primary" : "secondary"}
              aria-pressed={filter === option.id}
              onClick={() => selectFilter(option.id)}
              className={`px-3 py-1.5 text-xs ${filter === option.id ? "bg-slate-900 hover:bg-slate-800" : ""}`}
            >
              {option.label}
            </Button>
          ))}
          <span className="ml-auto text-xs font-semibold text-slate-500">
            {visibleQuestions.length} von {matrix.questions.length} Fragen
          </span>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl bg-white shadow-sm" aria-label="Bewertungsmatrix">
        <div className="max-h-[min(68vh,48rem)] max-w-full overflow-auto overscroll-contain">
          <table className="w-max min-w-full border-separate border-spacing-0 text-xs">
            <thead className="text-left">
              <tr>
                <th className="sticky left-0 top-0 z-40 w-36 min-w-36 max-w-36 border-b border-r border-slate-200 bg-slate-100 px-3 py-2 align-middle text-[0.6875rem] font-bold uppercase tracking-wide text-slate-500 shadow-[4px_0_8px_-8px_rgba(15,23,42,0.5)] sm:w-44 sm:min-w-44 sm:max-w-44">
                  Team · Punkte
                </th>
                {visibleQuestions.map((question) => (
                  <th
                    key={question.id}
                    className={`sticky top-0 z-30 w-10 min-w-10 max-w-10 border-b border-r border-slate-200 p-1 text-center ${selectedQuestionId === question.id ? "bg-indigo-100" : "bg-slate-100"}`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelection({ kind: "question", question })}
                      className="mx-auto flex h-8 w-8 items-center justify-center rounded-md font-black text-slate-800 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-slate-900"
                      aria-label={`Frage ${question.number}: ${question.text}. Details anzeigen`}
                      title={`${question.text} · ${question.sectionTitle} · ${question.maximumPointsLabel}`}
                    >
                      {question.number}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.teams.map((team) => {
                const rowSelected = selectedTeamName === team.name;
                return (
                  <tr key={team.name} className={rowSelected ? "bg-indigo-50/60" : ""}>
                    <th
                      className={`sticky left-0 z-20 w-36 min-w-36 max-w-36 border-b border-r border-slate-200 px-3 py-2 text-left shadow-[4px_0_8px_-8px_rgba(15,23,42,0.5)] sm:w-44 sm:min-w-44 sm:max-w-44 ${rowSelected ? "bg-indigo-50" : "bg-white"}`}
                      title={team.name}
                    >
                      <div className="truncate font-black text-slate-900">{team.name}</div>
                      <div className="mt-0.5 truncate text-[0.6875rem] font-semibold text-slate-500">
                        {team.rank ? `#${team.rank} · ` : ""}{formatQuizPoints(team.totalPoints)} Pkt.
                      </div>
                    </th>
                    {visibleQuestions.map((question) => {
                      const cell = team.cells[question.id];
                      const cellSelected = selection?.kind === "cell" &&
                        selection.team.name === team.name &&
                        selection.question.id === question.id;
                      const columnSelected = selectedQuestionId === question.id;
                      return (
                        <td
                          key={question.id}
                          className={`h-10 w-10 min-w-10 max-w-10 border-b border-r border-slate-200 p-0.5 text-center ${columnSelected ? "bg-indigo-50/50" : ""}`}
                        >
                          <MatrixCell
                            cell={cell}
                            question={question}
                            team={team}
                            selected={cellSelected}
                            onSelect={() => setSelection({ kind: "cell", cell, question, team })}
                          />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              {visibleQuestions.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-sm text-slate-500">
                    Für diesen Filter gibt es keine Fragen.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-lg font-black text-slate-900">Fragenkennzahlen</h2>
          <p className="mt-0.5 text-xs text-slate-600">
            Erfolgsquote = vollständig richtige Antworten geteilt durch alle abgeschlossenen Bewertungen.
          </p>
        </div>
        <div className="max-w-full overflow-x-auto">
          <table className="w-full min-w-[50rem] border-collapse text-xs">
            <thead className="bg-slate-100 text-left text-[0.6875rem] font-bold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Frage</th>
                <th className="px-3 py-2">Runde</th>
                <th className="px-3 py-2">Punkte</th>
                <th className="px-3 py-2">Beantw.</th>
                <th className="px-3 py-2">Richtig</th>
                <th className="px-3 py-2">Falsch</th>
                <th className="px-3 py-2">Teilw.</th>
                <th className="px-3 py-2">Prüfen</th>
                <th className="px-3 py-2">Berechn.</th>
                <th className="px-3 py-2">Offen</th>
                <th className="px-3 py-2">Erfolg</th>
                <th className="px-3 py-2">Ø Punkte</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {matrix.questions.map((question) => (
                <tr key={question.id}>
                  <td className="max-w-52 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-slate-900">{question.number}</span>
                      <span className="truncate text-slate-600" title={question.text}>{question.text}</span>
                    </div>
                  </td>
                  <td className="max-w-32 truncate px-3 py-2 text-slate-700" title={question.sectionTitle}>{question.sectionTitle}</td>
                  <td className="whitespace-nowrap px-3 py-2 font-semibold">{question.maximumPointsLabel}</td>
                  <td className="px-3 py-2">{question.answered}</td>
                  <td className="px-3 py-2 font-bold text-emerald-700">{question.correct}</td>
                  <td className="px-3 py-2 font-bold text-red-700">{question.wrong}</td>
                  <td className="px-3 py-2 font-bold text-amber-800">{question.partial}</td>
                  <td className="px-3 py-2 font-bold text-blue-800">{question.reviewRequired}</td>
                  <td className="px-3 py-2 font-bold text-amber-800">{question.pending}</td>
                  <td className="px-3 py-2 text-slate-600">{question.unanswered}</td>
                  <td className="px-3 py-2 font-black text-slate-900">
                    {question.successRate === null ? "–" : `${question.successRate.toLocaleString("de-DE")} %`}
                  </td>
                  <td className="px-3 py-2 font-semibold">
                    {question.averagePoints === null ? "–" : formatQuizPoints(question.averagePoints)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <EvaluationMatrixDetailModal
        selection={selection}
        onClose={() => setSelection(null)}
      />
    </div>
  );
}
