import { questionScoringRules } from "@/app/fragen/editor/templates/questionScoringGuide";

export function QuestionScoringOverview() {
  return <div className="mt-6 space-y-4">
    {Object.entries(questionScoringRules).map(([id, entry]) => <section key={id} id={`punkte-${id}`} className="rounded-xl border border-slate-200 p-4">
      <h2 className="text-lg font-semibold text-slate-950">{entry.name}</h2>
      <p className="mt-1 font-medium text-slate-900">Maximum: {entry.maximum}</p>
      <p className="mt-2 leading-7 text-slate-700">{entry.rule}</p>
    </section>)}
  </div>;
}
