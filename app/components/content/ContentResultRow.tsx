import { MediaBadge, ScopeBadge, StatusBadge, UsageSummary } from "./ContentBadges";
import ContentActions from "./ContentActions";
import type { ContentQuizOption, ContentSearchItem } from "./contentLibrary";

export default function ContentResultRow({ item, quizzes }: { item: ContentSearchItem; quizzes: ContentQuizOption[] }) {
  const detailsId = `content-details-${item.contentType.toLowerCase()}-${item.id}`;
  return <article className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
    <div className="flex flex-wrap items-center gap-2"><span className={item.contentType === "QUESTION" ? "rounded-full bg-cyan-100 px-2.5 py-1 text-xs font-bold text-cyan-950" : "rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-950"}>{item.contentType === "QUESTION" ? "Frage" : "Story"}</span><StatusBadge status={item.status} archived={item.archived} /><ScopeBadge scope={item.scope} /><MediaBadge count={item.mediaCount} /></div>
    <h2 className="mt-3 break-words text-xl font-black text-slate-950">{item.title}</h2>
    <p className="mt-1 font-mono text-xs text-slate-500">Content-ID #{item.id} · {item.subtype}</p>
    <dl className="mt-4 grid gap-3 border-t border-slate-100 pt-4 text-sm sm:grid-cols-3">
      {item.questionMetrics ? <><div><dt className="text-xs text-slate-500">Antworten</dt><dd className="font-semibold">{item.questionMetrics.answerCount}</dd></div><div><dt className="text-xs text-slate-500">Schwierigkeit</dt><dd className="font-semibold">{item.questionMetrics.difficulty ?? "Nicht gesetzt"}</dd></div><div><dt className="text-xs text-slate-500">Antwortart</dt><dd className="font-semibold">{item.questionMetrics.answerMode}</dd></div></> : <><div><dt className="text-xs text-slate-500">Story-Typ</dt><dd className="font-semibold">{item.subtype}</dd></div><div><dt className="text-xs text-slate-500">Verknüpfte Fragen</dt><dd className="font-semibold">{item.storyMetrics?.linkedQuestionCount ?? 0}</dd></div><div><dt className="text-xs text-slate-500">Revision</dt><dd className="font-semibold">{item.storyMetrics?.revision ?? 1}</dd></div></>}
    </dl>
    <div className="mt-3"><UsageSummary quizCount={item.quizUsages.length} linkedQuestionCount={item.storyMetrics?.linkedQuestionCount} /></div>
    <div id={detailsId} hidden className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-700"><strong>Technische Zuordnung:</strong> {item.contentType} #{item.id}. Neue Quiz-Zuordnungen landen zunächst unter „Kein Block“.</div>
    <ContentActions item={item} quizzes={quizzes} detailsId={detailsId} />
  </article>;
}
