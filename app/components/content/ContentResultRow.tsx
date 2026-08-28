import { MediaBadge, ScopeBadge, StatusBadge, UsageSummary } from "./ContentBadges";
import ContentActions from "./ContentActions";
import type { ContentQuizOption, ContentSearchItem } from "./contentLibrary";

export default function ContentResultRow({ item, quizzes }: { item: ContentSearchItem; quizzes: ContentQuizOption[] }) {
  const detailsId = `content-details-${item.contentType.toLowerCase()}-${item.id}`;
  return <article className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
    <div className="flex flex-wrap items-center gap-2"><ContentTypeBadge type={item.contentType} /><StatusBadge status={item.status} archived={item.archived} />{item.lifecycleStatus && <StatusBadge status={item.lifecycleStatus} archived={false} />}<ScopeBadge scope={item.scope} />{item.contentType !== "POLL" && <MediaBadge count={item.mediaCount} />}</div>
    <h2 className="mt-3 break-words text-xl font-black text-slate-950">{item.title}</h2>
    <p className="mt-1 font-mono text-xs text-slate-500">Content-ID #{item.id} · {item.subtype}</p>
    <dl className="mt-4 grid gap-x-5 gap-y-3 border-t border-slate-100 pt-4 text-sm sm:grid-cols-3 lg:grid-cols-4">
      {item.questionMetrics ? <>
        <Metric label="Kategorie" value={item.questionMetrics.categories.join(", ") || "Nicht gesetzt"} />
        <Metric label="Quelle" value={item.questionMetrics.source || "Nicht gesetzt"} />
        <Metric label="Antwortart" value={item.questionMetrics.answerMode} />
        <Metric label="Template" value={item.questionMetrics.template} />
        <Metric label="Antworten" value={String(item.questionMetrics.answerCount)} />
        <Metric label="Medien Frage / Antworten" value={`${item.questionMetrics.questionMediaCount} / ${item.questionMetrics.answerMediaCount}`} />
        <Metric label="Quiz-Verwendungen" value={String(item.quizUsages.length)} />
        <Metric label="Schwierigkeit" value={item.questionMetrics.difficulty ?? "Nicht gesetzt"} />
        <Metric label="Story-Elemente" value={String(item.questionMetrics.storyElementCount)} />
      </> : item.pollMetrics ? <>
        <Metric label="Umfragetyp" value={item.subtype} />
        <Metric label="Veröffentlichung" value={item.pollMetrics.publicationMode} />
        <Metric label="Antwortoptionen" value={item.pollMetrics.optionCount > 0 ? String(item.pollMetrics.optionCount) : "Freitext"} />
        <Metric label="Quiz-Verwendungen" value={String(item.quizUsages.length)} />
        <Metric label="Revision" value={String(item.pollMetrics.revision)} />
      </> : <>
        <Metric label="Story-Typ" value={item.subtype} />
        <Metric label="Medien" value={String(item.mediaCount)} />
        <Metric label="Quiz-Verwendungen" value={String(item.quizUsages.length)} />
        <Metric label="Verknüpfte Frage" value={item.storyMetrics?.linkedQuestionTitle ?? "Nicht verknüpft"} />
        <Metric label="Revision" value={String(item.storyMetrics?.revision ?? 1)} />
      </>}
    </dl>
    <div className="mt-3"><UsageSummary quizCount={item.quizUsages.length} linkedQuestionCount={item.storyMetrics?.linkedQuestionCount} /></div>
    <div id={detailsId} hidden className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-700"><strong>Technische Zuordnung:</strong> {item.contentType} #{item.id}. Neue Quiz-Zuordnungen landen zunächst unter „Kein Block“.</div>
    <ContentActions item={item} quizzes={quizzes} detailsId={detailsId} />
  </article>;
}

function ContentTypeBadge({ type }: { type: ContentSearchItem["contentType"] }) {
  const style = type === "QUESTION"
    ? "bg-cyan-100 text-cyan-950"
    : type === "POLL"
      ? "bg-violet-100 text-violet-950"
      : "bg-emerald-100 text-emerald-950";
  const label = type === "QUESTION" ? "Frage" : type === "POLL" ? "Umfrage" : "Story-Element";
  return <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${style}`}>{label}</span>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><dt className="text-xs text-slate-500">{label}</dt><dd className="break-words font-semibold">{value}</dd></div>;
}
