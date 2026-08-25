"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  archiveTeamAction,
  deleteTeamAction,
  INITIAL_TEAM_ACTION_RESULT,
  reactivateTeamAction,
} from "@/app/teams/actions";

export function TeamLifecyclePanel({
  teamId,
  teamName,
  isArchived,
  participationCount,
}: {
  teamId: number;
  teamName: string;
  isArchived: boolean;
  participationCount: number;
}) {
  const router = useRouter();
  const [archiveState, archiveAction, archivePending] = useActionState(
    isArchived ? reactivateTeamAction : archiveTeamAction,
    INITIAL_TEAM_ACTION_RESULT,
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteTeamAction,
    INITIAL_TEAM_ACTION_RESULT,
  );

  useEffect(() => {
    if (deleteState.deleted) router.replace("/admin/teams");
  }, [deleteState.deleted, router]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-bold">Globale Teamidentität verwalten</h2>
      <p className="mt-1 text-sm text-slate-600">
        Archivieren erhält sämtliche Teilnahmen und Ergebnisse. Eventmanager können diese globalen Aktionen nicht ausführen.
      </p>
      <form action={archiveAction} className="mt-4">
        <input type="hidden" name="teamId" value={teamId} />
        <button
          type="submit"
          disabled={archivePending}
          className="min-h-11 rounded-xl border border-slate-300 px-4 py-2 font-semibold hover:bg-slate-50 disabled:opacity-50"
        >
          {isArchived ? "Team reaktivieren" : "Team archivieren"}
        </button>
      </form>
      {archiveState.message && <p className="mt-2 text-sm font-medium" aria-live="polite">{archiveState.message}</p>}

      <div className="mt-6 border-t border-red-200 pt-5">
        <h3 className="font-bold text-red-800">Gefahrenbereich</h3>
        {participationCount === 0 ? (
          <>
            <p className="mt-2 text-sm text-slate-700">
              Dieses Team hat an keinem Quiz teilgenommen und kann ohne historische Datenverluste gelöscht werden.
            </p>
            <form action={deleteAction} className="mt-3">
              <input type="hidden" name="teamId" value={teamId} />
              <input type="hidden" name="force" value="false" />
              <button type="submit" disabled={deletePending} className="min-h-11 rounded-xl bg-red-700 px-4 py-2 font-semibold text-white hover:bg-red-800 disabled:opacity-50">
                Team löschen
              </button>
            </form>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm font-semibold text-red-800">
              Team „{teamName}“ hat an {participationCount} {participationCount === 1 ? "Quiz" : "Quizzen"} teilgenommen.
              Beim endgültigen Löschen werden Sessions, Antworten, Bewertungen, Punkte und Quizzuordnungen entfernt.
            </p>
            <form action={deleteAction} className="mt-4 space-y-3 rounded-xl border border-red-200 bg-red-50 p-4">
              <input type="hidden" name="teamId" value={teamId} />
              <input type="hidden" name="force" value="true" />
              <label className="block">
                <span className="mb-1 block text-sm font-semibold">Zur Bestätigung „{teamName}“ eingeben</span>
                <input name="confirmation" required autoComplete="off" className="min-h-11 w-full rounded-xl border border-red-300 bg-white px-4 py-2" />
              </label>
              <button type="submit" disabled={deletePending} className="min-h-11 rounded-xl bg-red-800 px-4 py-2 font-semibold text-white hover:bg-red-900 disabled:opacity-50">
                Team endgültig löschen
              </button>
            </form>
          </>
        )}
        {deleteState.message && <p className="mt-3 text-sm font-medium text-red-800" aria-live="polite">{deleteState.message}</p>}
      </div>
    </section>
  );
}
