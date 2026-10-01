import ContentQuizAssignment from "./ContentQuizAssignment";
import type { ContentQuizOption, ContentQuizUsage } from "./contentLibrary";

export default function QuestionQuizAssignmentPanel({
  questionId,
  quizzes,
  usages,
  assignableQuizIds,
  disabled,
}: {
  questionId: number;
  quizzes: ContentQuizOption[];
  usages: ContentQuizUsage[];
  assignableQuizIds: number[];
  disabled: boolean;
}) {
  return <section className="mx-auto mt-5 max-w-5xl rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
    <h2 className="text-lg font-black text-slate-950">Quiz-Zuordnung</h2>
    <p className="mt-1 text-sm text-slate-600">Die Frage direkt einem erlaubten Quiz zuordnen. Neue Zuordnungen erscheinen zunächst unter „Kein Block“.</p>
    {usages.length > 0 ? <ul className="mt-3 flex flex-wrap gap-2" aria-label="Aktuelle Quiz-Zuordnungen">
      {usages.map((usage) => <li key={usage.quizId} className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-700">
        {usage.title}{usage.archived ? " · archiviert" : ""}
      </li>)}
    </ul> : <p className="mt-3 text-sm text-slate-500">Noch keinem für dich verwaltbaren Quiz zugeordnet.</p>}
    <div className="mt-4">
      <ContentQuizAssignment
        contentType="QUESTION"
        contentId={questionId}
        quizzes={quizzes}
        assignedQuizIds={usages.map((usage) => usage.quizId)}
        assignableQuizIds={assignableQuizIds}
        disabled={disabled}
      />
    </div>
  </section>;
}
