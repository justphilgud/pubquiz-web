import Link from "next/link";
import { loadTeamManagementPage, requireTeamManagementActor, type TeamListStatus } from "@/app/teams/teamManagement.server";

const dateFormatter = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeZone: "Europe/Berlin" });

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function TeamManagementPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { actor } = await requireTeamManagementActor();
  const params = await searchParams;
  const deleted = first(params.deleted);
  const query = first(params.q)?.trim() ?? "";
  const rawStatus = first(params.status);
  const status: TeamListStatus = rawStatus === "ARCHIVED" || rawStatus === "ALL" ? rawStatus : "ACTIVE";
  const rawSeriesId = Number(first(params.eventSeriesId));
  const eventSeriesId = Number.isInteger(rawSeriesId) && rawSeriesId > 0 ? rawSeriesId : null;
  const data = await loadTeamManagementPage({ actor, query, status, eventSeriesId });

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div>
          <h1 className="text-3xl font-bold">Teamverwaltung</h1>
          <p className="mt-2 max-w-3xl text-slate-600">
            Globale Teams schnell finden, Zugangswörter unterstützen und Teilnahmen im erlaubten Eventreihen-Scope einsehen.
          </p>
        </div>

        {(deleted === "unused" || deleted === "force") && (
          <p
            className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900"
            role="status"
          >
            {deleted === "force"
              ? "Team und seine Quiz-Historie wurden endgültig gelöscht."
              : "Unbenutztes Team wurde gelöscht."}
          </p>
        )}

        <form className="mt-6 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_220px_220px_auto]">
          <label>
            <span className="mb-1 block text-xs font-semibold">Teamname</span>
            <input name="q" defaultValue={query} placeholder="Kolibri" className="min-h-11 w-full rounded-xl border border-slate-300 px-4 py-2" />
          </label>
          <label>
            <span className="mb-1 block text-xs font-semibold">Status</span>
            <select name="status" defaultValue={status} className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2">
              <option value="ACTIVE">Aktiv</option>
              <option value="ARCHIVED">Archiviert</option>
              <option value="ALL">Alle</option>
            </select>
          </label>
          <label>
            <span className="mb-1 block text-xs font-semibold">Eventreihe</span>
            <select name="eventSeriesId" defaultValue={eventSeriesId ?? ""} className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2">
              <option value="">Alle erlaubten Reihen</option>
              {data.eventSeries.map((series) => (
                <option key={series.id} value={series.id}>{series.name}{series.isArchived ? " (archiviert)" : ""}</option>
              ))}
            </select>
          </label>
          <button type="submit" className="min-h-11 self-end rounded-xl bg-slate-900 px-5 py-2 font-semibold text-white hover:bg-slate-800">Filtern</button>
        </form>

        <p className="mt-4 text-sm font-medium text-slate-700" aria-live="polite">{data.teams.length} Teams</p>
        <section className="mt-3 grid gap-3" aria-label="Teamliste">
          {data.teams.map((team) => (
            <article key={team.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-lg font-bold">{team.name}</h2>
                    <span className={team.isArchived ? "rounded-full bg-slate-200 px-2.5 py-1 text-xs font-semibold" : "rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800"}>
                      {team.isArchived ? "Archiviert" : "Aktiv"}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">
                    {team.participationCount} {team.participationCount === 1 ? "Quizteilnahme" : "Quizteilnahmen"}
                    {team.lastParticipationAt ? ` · zuletzt ${dateFormatter.format(new Date(team.lastParticipationAt))}` : " · noch keine Teilnahme"}
                  </p>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-500">
                    {team.eventSeries.length > 0 ? team.eventSeries.map((series) => series.name).join(" · ") : "Noch keiner Eventreihe zugeordnet"}
                  </p>
                </div>
                <Link href={`/admin/teams/${team.id}`} className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-slate-300 px-4 py-2 font-semibold hover:bg-slate-50">
                  Team öffnen
                </Link>
              </div>
            </article>
          ))}
          {data.teams.length === 0 && (
            <p className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-600">Keine Teams entsprechen den Filtern.</p>
          )}
        </section>
      </div>
    </main>
  );
}
