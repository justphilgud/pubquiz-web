import Link from "next/link";
import { isAdministrator } from "@/app/roles/roleAssignmentPolicy";
import { loadTeamDetail, requireTeamManagementActor } from "@/app/teams/teamManagement.server";
import { TeamLifecyclePanel } from "../TeamLifecyclePanel";
import { TeamPasswordPanel } from "../TeamPasswordPanel";
import { TeamProfileManagementPanel } from "../TeamProfileManagementPanel";
import { getMediaUploadEnvironmentPrefix } from "@/app/fragen/editor/mediaUploadEnvironment";

const dateFormatter = new Intl.DateTimeFormat("de-DE", { dateStyle: "long", timeZone: "Europe/Berlin" });

export default async function TeamDetailPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { actor } = await requireTeamManagementActor();
  const teamId = Number((await params).teamId);
  const team = await loadTeamDetail(actor, teamId);
  const admin = isAdministrator(actor);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6">
      <div className="mx-auto max-w-4xl space-y-5">
        <Link href="/admin/teams" className="inline-flex min-h-11 items-center text-sm font-semibold text-slate-600 hover:text-slate-950">← Zur Teamübersicht</Link>
        <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold">{team.name}</h1>
            <span className={team.isArchived ? "rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold" : "rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800"}>
              {team.isArchived ? "Archiviert" : "Aktiv"}
            </span>
          </div>
          <dl className="mt-5 grid gap-4 sm:grid-cols-3">
            <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Teilnahmen</dt><dd className="mt-1 text-xl font-bold">{team.participationCount}</dd></div>
            <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Letzte Teilnahme</dt><dd className="mt-1 font-semibold">{team.lastParticipationAt ? dateFormatter.format(new Date(team.lastParticipationAt)) : "Noch keine"}</dd></div>
            <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Erstellt</dt><dd className="mt-1 font-semibold">{dateFormatter.format(new Date(team.createdAt))}</dd></div>
          </dl>
          <div className="mt-5">
            <h2 className="text-sm font-bold">Eventreihen im erlaubten Scope</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {team.eventSeries.map((series) => <span key={series.id} className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium">{series.name}</span>)}
              {team.eventSeries.length === 0 && <span className="text-sm text-slate-500">Keine bisherigen Teilnahmen.</span>}
            </div>
          </div>
        </header>

        <TeamProfileManagementPanel teamName={team.name} initialProfile={team.profile} isAdmin={admin} uploadEnvironmentPrefix={getMediaUploadEnvironmentPrefix()} />
        <TeamPasswordPanel teamId={team.id} initialPassword={team.password} />
        {admin && <TeamLifecyclePanel teamId={team.id} teamName={team.name} isArchived={team.isArchived} participationCount={team.participationCount} hasHistory={team.hasHistory} />}
      </div>
    </main>
  );
}
