import Link from "next/link";
import { requireActor } from "@/app/lib/permissions";
import { getLivePollTypeLabel } from "@/app/umfragen/livePoll";
import { listLivePolls } from "@/app/umfragen/livePollRepository.server";

export default async function LivePollLibraryPage() {
  const { actor } = await requireActor();
  const polls = await listLivePolls(actor);
  return <main className="min-h-screen bg-slate-50 px-4 py-8 md:px-8"><div className="mx-auto max-w-6xl space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm font-semibold uppercase tracking-wider text-cyan-700">Content</p><h1 className="text-3xl font-bold text-slate-950">Umfragen</h1><p className="mt-1 text-slate-600">Eigenständige Auswahl- und Freitext-Umfragen.</p></div><Link className="rounded-xl bg-slate-950 px-4 py-3 font-semibold text-white" href="/content/polls/new">Neue Umfrage</Link></div>
    <div className="grid gap-4 md:grid-cols-2">{polls.map((poll) => <Link key={poll.id} href={`/content/polls/${poll.id}`} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-cyan-400"><div className="flex justify-between gap-3"><strong className="text-lg text-slate-950">{poll.prompt}</strong><span className="text-xs font-semibold uppercase text-slate-500">{poll.status}</span></div><p className="mt-2 text-sm text-slate-600">{getLivePollTypeLabel(poll.type)} · {poll.eventSeriesName ?? "Global"} · Revision {poll.revisionNumber}</p><p className="mt-1 text-xs text-slate-500">{poll.usageCount} Platzierung(en)</p></Link>)}</div>
    {!polls.length ? <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-600">Noch keine sichtbaren Umfragen.</p> : null}
  </div></main>;
}
