"use client";

import { Modal } from "@/components/ui/Modal";
import { formatQuizPoints } from "../formatQuizPoints";
import type {
  EvaluationMatrixCell,
  EvaluationMatrixQuestion,
  EvaluationMatrixTeam,
} from "./evaluationMatrix";
import { evaluationMatrixStatusPresentation } from "./evaluationMatrixDisplay";

export type EvaluationMatrixSelection =
  | {
      kind: "cell";
      cell: EvaluationMatrixCell;
      question: EvaluationMatrixQuestion;
      team: EvaluationMatrixTeam;
    }
  | {
      kind: "question";
      question: EvaluationMatrixQuestion;
    };

export function EvaluationMatrixDetailContent({
  selection,
}: {
  selection: EvaluationMatrixSelection;
}) {
  const question = selection.question;

  if (selection.kind === "question") {
    return (
      <div className="space-y-4 text-sm text-slate-700">
        <p className="text-base font-bold text-slate-950">{question.text}</p>
        <dl className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-3">
          <div>
            <dt className="text-xs font-bold text-slate-500">Runde</dt>
            <dd className="mt-1 font-semibold">{question.sectionTitle}</dd>
          </div>
          <div>
            <dt className="text-xs font-bold text-slate-500">Punkte</dt>
            <dd className="mt-1 font-semibold">{question.maximumPointsLabel}</dd>
          </div>
          <div>
            <dt className="text-xs font-bold text-slate-500">Erfolgsquote</dt>
            <dd className="mt-1 font-semibold">
              {question.successRate === null
                ? "–"
                : `${question.successRate.toLocaleString("de-DE")} %`}
            </dd>
          </div>
        </dl>
      </div>
    );
  }

  const presentation = evaluationMatrixStatusPresentation[selection.cell.status];

  return (
    <div className="space-y-4 text-sm text-slate-700">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold ${presentation.className}`}
        >
          <span aria-hidden="true">{presentation.symbol}</span>
          {presentation.label}
        </span>
        <span className="text-xs font-semibold text-slate-500">
          {selection.team.rank ? `Platz ${selection.team.rank} · ` : ""}
          {formatQuizPoints(selection.team.totalPoints)} Pkt.
        </span>
      </div>

      <dl className="space-y-3">
        <div>
          <dt className="text-xs font-bold text-slate-500">Team</dt>
          <dd className="mt-1 font-bold text-slate-950">{selection.team.name}</dd>
        </div>
        <div>
          <dt className="text-xs font-bold text-slate-500">
            Frage {question.number} · {question.sectionTitle}
          </dt>
          <dd className="mt-1 font-semibold text-slate-950">{question.text}</dd>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-slate-50 p-3">
            <dt className="text-xs font-bold text-slate-500">Teamantwort</dt>
            <dd className="mt-1 break-words">{selection.cell.answerText || "–"}</dd>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <dt className="text-xs font-bold text-slate-500">Lösung</dt>
            <dd className="mt-1 break-words">{selection.cell.correctAnswer}</dd>
          </div>
        </div>
        <div>
          <dt className="text-xs font-bold text-slate-500">Punkte</dt>
          <dd className="mt-1 font-bold text-slate-950">
            Vergeben: {formatQuizPoints(selection.cell.awardedPoints)} · {selection.cell.maximumPointsLabel}
          </dd>
        </div>
      </dl>
    </div>
  );
}

export default function EvaluationMatrixDetailModal({
  selection,
  onClose,
}: {
  selection: EvaluationMatrixSelection | null;
  onClose: () => void;
}) {
  return (
    <Modal
      open={selection !== null}
      title={selection?.kind === "cell"
        ? "Antwortdetails"
        : `Frage ${selection?.question.number ?? ""}`}
      onClose={onClose}
    >
      {selection && <EvaluationMatrixDetailContent selection={selection} />}
    </Modal>
  );
}
