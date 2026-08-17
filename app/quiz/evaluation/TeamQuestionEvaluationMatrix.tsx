import { formatQuizPoints } from "../formatQuizPoints";
import type {
  EvaluationMatrix as EvaluationMatrixData,
  EvaluationMatrixCell,
  EvaluationMatrixStatus,
} from "./evaluationMatrix";

const statusPresentation: Record<EvaluationMatrixStatus, {
  label: string;
  symbol: string;
  className: string;
}> = {
  CORRECT: {
    label: "Richtig",
    symbol: "✓",
    className: "border-emerald-300 bg-emerald-50 text-emerald-800",
  },
  WRONG: {
    label: "Falsch",
    symbol: "×",
    className: "border-red-300 bg-red-50 text-red-800",
  },
  PARTIAL: {
    label: "Teilweise",
    symbol: "½",
    className: "border-amber-300 bg-amber-50 text-amber-900",
  },
  REVIEW_REQUIRED: {
    label: "Prüfen",
    symbol: "?",
    className: "border-blue-300 bg-blue-50 text-blue-900",
  },
  UNANSWERED: {
    label: "Nicht beantwortet",
    symbol: "–",
    className: "border-slate-200 bg-slate-50 text-slate-500",
  },
};

function MatrixCell({ cell }: { cell: EvaluationMatrixCell }) {
  const presentation = statusPresentation[cell.status];
  return (
    <details className="group min-w-32">
      <summary
        className={`flex min-h-11 cursor-pointer list-none items-center justify-center gap-2 rounded-xl border px-2 py-2 text-xs font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 ${presentation.className}`}
        aria-label={`${presentation.label}; Details anzeigen`}
      >
        <span aria-hidden="true" className="text-base">{presentation.symbol}</span>
        <span>{presentation.label}</span>
      </summary>
      <dl className="mt-2 space-y-2 rounded-xl border border-slate-200 bg-white p-3 text-left text-xs text-slate-700 shadow-sm">
        <div>
          <dt className="font-bold text-slate-500">Teamantwort</dt>
          <dd className="mt-0.5 break-words">{cell.answerText || "–"}</dd>
        </div>
        <div>
          <dt className="font-bold text-slate-500">Lösung</dt>
          <dd className="mt-0.5 break-words">{cell.correctAnswer}</dd>
        </div>
        <div>
          <dt className="font-bold text-slate-500">Punkte</dt>
          <dd className="mt-0.5 font-bold text-slate-900">
            Vergeben: {formatQuizPoints(cell.awardedPoints)} · {cell.maximumPointsLabel}
          </dd>
        </div>
      </dl>
    </details>
  );
}

export default function TeamQuestionEvaluationMatrix({ matrix }: { matrix: EvaluationMatrixData }) {
  if (matrix.questions.length === 0 || matrix.teams.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-6 text-sm text-slate-600 shadow-sm">
        Für die Matrix sind noch keine bewerteten Quizfragen und Teams vorhanden.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-slate-900">Team × Frage</h2>
            <p className="mt-1 max-w-3xl text-sm text-slate-600">
              Status auswählen, um Antwort, Lösung und Punkte zu sehen. Umfragen sind nicht Teil der bewerteten Matrix.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-bold">
            {Object.entries(statusPresentation).map(([status, value]) => (
              <span key={status} className={`rounded-full border px-3 py-1 ${value.className}`}>
                {value.symbol} {value.label}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl bg-white shadow-sm" aria-label="Bewertungsmatrix">
        <div className="max-w-full overflow-x-auto overscroll-x-contain">
          <table className="w-max min-w-full border-separate border-spacing-0 text-sm">
            <thead className="text-left">
              <tr>
                <th className="sticky left-0 z-20 min-w-48 border-b border-r border-slate-200 bg-slate-100 px-4 py-3 align-bottom text-xs font-bold uppercase tracking-wide text-slate-500">
                  Team
                </th>
                {matrix.questions.map((question) => (
                  <th key={question.id} className="min-w-40 max-w-48 border-b border-r border-slate-200 bg-slate-100 px-3 py-3 align-top">
                    <div className="text-xs font-black uppercase tracking-wide text-slate-500">
                      Frage {question.number}
                    </div>
                    <div className="mt-1 line-clamp-3 text-sm font-bold text-slate-900" title={question.text}>
                      {question.text}
                    </div>
                    <div className="mt-2 text-xs font-medium text-slate-500">
                      {question.sectionTitle} · {question.maximumPointsLabel}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.teams.map((team) => (
                <tr key={team.name}>
                  <th className="sticky left-0 z-10 border-b border-r border-slate-200 bg-white px-4 py-3 text-left align-top shadow-[4px_0_8px_-8px_rgba(15,23,42,0.5)]">
                    <div className="font-black text-slate-900">{team.name}</div>
                    <div className="mt-1 text-xs font-semibold text-slate-500">
                      {team.rank ? `Platz ${team.rank} · ` : ""}{formatQuizPoints(team.totalPoints)} Pkt.
                    </div>
                  </th>
                  {matrix.questions.map((question) => (
                    <td key={question.id} className="border-b border-r border-slate-200 p-2 align-top">
                      <MatrixCell cell={team.cells[question.id]} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-4">
          <h2 className="text-xl font-black text-slate-900">Fragenkennzahlen</h2>
          <p className="mt-1 text-sm text-slate-600">
            Erfolgsquote = vollständig richtige Antworten geteilt durch alle beantworteten Antworten.
          </p>
        </div>
        <div className="max-w-full overflow-x-auto">
          <table className="min-w-[64rem] w-full border-collapse text-sm">
            <thead className="bg-slate-100 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Frage</th>
                <th className="px-4 py-3">Runde</th>
                <th className="px-4 py-3">Punkte</th>
                <th className="px-4 py-3">Beantwortet</th>
                <th className="px-4 py-3">Richtig</th>
                <th className="px-4 py-3">Falsch</th>
                <th className="px-4 py-3">Teilweise</th>
                <th className="px-4 py-3">Zu prüfen</th>
                <th className="px-4 py-3">Nicht beantwortet</th>
                <th className="px-4 py-3">Erfolg</th>
                <th className="px-4 py-3">Ø Punkte</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {matrix.questions.map((question) => (
                <tr key={question.id}>
                  <td className="max-w-sm px-4 py-3">
                    <div className="font-black text-slate-900">Frage {question.number}</div>
                    <div className="mt-0.5 line-clamp-2 text-xs text-slate-600" title={question.text}>{question.text}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{question.sectionTitle}</td>
                  <td className="whitespace-nowrap px-4 py-3 font-semibold">{question.maximumPointsLabel}</td>
                  <td className="px-4 py-3">{question.answered}</td>
                  <td className="px-4 py-3 font-bold text-emerald-700">{question.correct}</td>
                  <td className="px-4 py-3 font-bold text-red-700">{question.wrong}</td>
                  <td className="px-4 py-3 font-bold text-amber-800">{question.partial}</td>
                  <td className="px-4 py-3 font-bold text-blue-800">{question.reviewRequired}</td>
                  <td className="px-4 py-3 text-slate-600">{question.unanswered}</td>
                  <td className="px-4 py-3 font-black text-slate-900">
                    {question.successRate === null ? "–" : `${question.successRate.toLocaleString("de-DE")} %`}
                  </td>
                  <td className="px-4 py-3 font-semibold">
                    {question.averagePoints === null ? "–" : formatQuizPoints(question.averagePoints)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
