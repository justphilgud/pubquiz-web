import QuizBalanceSummary from "../planning/QuizBalanceSummary";
import type { QuizBalance } from "../quizBalance";
import { formatQuizDuration, formatQuizQuestionCount, getQuizComposition } from "../quizPlanning";

type Composition = ReturnType<typeof getQuizComposition>;

function Distribution({ title, rows }: { title: string; rows: Composition["categories"] }) {
  return (
    <div className="min-w-0">
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      <ul className="space-y-2">
        {rows.map(({ id, label, count, share }) => (
          <li key={id === null ? "missing" : `value:${id}`} className="text-sm">
            <div className="flex items-baseline justify-between gap-2">
              <span className="min-w-0 break-words">{label}</span>
              <span className="shrink-0 tabular-nums text-slate-600">{count} · {share} %</span>
            </div>
            <div aria-hidden="true" className="mt-1 h-1.5 rounded-full bg-slate-200">
              <div className="h-full rounded-full bg-slate-700" style={{ width: `${share}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function QuizPlanningSummary({ questions, durationSeconds, balance }: {
  questions: Parameters<typeof getQuizComposition>[0];
  durationSeconds: number | undefined;
  balance?: QuizBalance;
}) {
  const { categories, templates } = getQuizComposition(questions);
  return (
    <section aria-labelledby="quiz-composition" className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="quiz-composition" className="text-lg font-semibold">Zusammensetzung</h2>
        <p className="text-sm font-semibold">
          {formatQuizQuestionCount(questions.length)}
          {durationSeconds === undefined ? "" : ` · Dauerprognose: ${formatQuizDuration(durationSeconds)}`}
        </p>
      </div>
      <p className="mt-1 text-sm text-slate-600">
        Die Schätzung enthält Begrüßung, Spielpausen und weitere aktive Folien. Einlass und Startcountdown liegen davor.
      </p>
      <details className="mt-2 text-sm text-slate-600">
        <summary className="inline-flex min-h-11 cursor-pointer items-center underline">Wie wird geschätzt?</summary>
        <p>Ohne Zeitvorgabe rechnen wir mit 2 Minuten je Frage, 30 Sekunden je Auflösung, 20 Sekunden je weiterer Folie und 5 Minuten je Pause. Geplante Zeiten im Ablauf und feste Antwortzeiten fließen ein. Fragen ohne Block zählen zur Zusammensetzung, aber noch nicht zur Spielzeit. In der Moderation können gemessene Zeiten die Prognose verändern.</p>
      </details>
      {balance ? <QuizBalanceSummary balance={balance} /> : questions.length ? (
        <>
          <p className="mb-3 mt-2 text-sm text-slate-600">
            Eine Frage zählt in jeder ihrer Kategorien. Die Anteile beziehen sich auf alle zugeordneten Fragen und können bei Kategorien zusammen über 100 % ergeben.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 sm:gap-8">
            <Distribution title="Kategorien" rows={categories} />
            <Distribution title="Fragetemplates" rows={templates} />
          </div>
        </>
      ) : <p className="mt-2 text-sm text-slate-600">Für die Verteilung sind noch keine Fragen zugeordnet.</p>}
    </section>
  );
}
