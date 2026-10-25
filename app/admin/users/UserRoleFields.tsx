"use client";
import { useState } from "react";
import type { AppLocale } from "@/app/i18n/locale";
import type { RoleMessages } from "@/app/i18n/roleMessages";
import type { EventSeriesAssignmentRole } from "@/app/eventreihen/eventSeriesAccessPolicy";
import type { SelectableEventSeries } from "./eventSeriesSelectionPolicy";

type Props = {
  eventSeries: readonly SelectableEventSeries[];
  initialGlobalRoles?: readonly ("ADMIN" | "EDITOR")[];
  initialEventSeriesAssignments?: readonly { eventSeriesId: number; role: EventSeriesAssignmentRole }[];
  initialManagementIds?: readonly number[];
  locale: AppLocale; messages: RoleMessages;
};
export function UserRoleFields({ eventSeries, initialGlobalRoles = [], initialEventSeriesAssignments = [], initialManagementIds = [], messages }: Props) {
  const [assignments, setAssignments] = useState(() => [...initialEventSeriesAssignments]);
  return <div className="space-y-5">
    <fieldset className="space-y-3 border-t border-slate-200 pt-4">
      <legend className="font-semibold">Globale Rollen</legend>
      <label className="flex min-h-11 items-center gap-3"><input type="checkbox" name="roleAdministrator" defaultChecked={initialGlobalRoles.includes("ADMIN")} />{messages.assignmentRoles.ADMIN}</label>
      <label className="flex min-h-11 items-center gap-3"><input type="checkbox" name="roleEditor" defaultChecked={initialGlobalRoles.includes("EDITOR")} />Globaler Quiz-Editor</label>
      <p className="text-sm text-slate-600">Der globale Editor gilt ausschließlich für Quiz.</p>
    </fieldset>
    <fieldset className="space-y-3 border-t border-slate-200 pt-4">
      <legend className="font-semibold">Rollen je Eventreihe</legend>
      <p className="text-sm text-slate-600">Die Rolle gilt für die freigeschalteten Eventarten der jeweiligen Reihe, auch nach späterer Freischaltung. Editor bearbeitet Inhalte, Eventmanager führt Veranstaltungen durch. Für PowerPoint-Karaoke sind keine Editorfunktionen vorgesehen. Bingo und Karaoke sind noch nicht spielbar.</p>
      <input type="hidden" name="seriesRolesVersion" value="1" />
      <input type="hidden" name="eventSeriesRoles" value={JSON.stringify(assignments)} />
      {eventSeries.map(series => <div key={series.id} className="rounded-xl border border-slate-200 p-3">
        <label className="block font-medium">{series.name}{series.archived && " (Archiviert)"}
          <select aria-label={`${series.name}: Rolle`} className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 p-2" value={assignments.find(a => a.eventSeriesId === series.id)?.role ?? ""} onChange={e => {
            const role = e.target.value;
            setAssignments(current => {
              const remaining = current.filter(a => a.eventSeriesId !== series.id);
              if (role === "EDITOR" || role === "EVENT_MANAGER") remaining.push({ eventSeriesId: series.id, role });
              return remaining;
            });
          }}><option value="">Kein Zugriff</option><option value="EDITOR">Editor</option><option value="EVENT_MANAGER">Eventmanager</option></select>
        </label>
        <label className="mt-2 flex min-h-11 items-center gap-3"><input type="checkbox" name="manageEventSeriesIds" value={series.id} defaultChecked={initialManagementIds.includes(series.id)} aria-label={`${series.name}: Eventreihe verwalten`} />Eventreihe verwalten</label>
      </div>)}
      {eventSeries.length === 0 && <p className="text-sm text-slate-600">Noch keine Eventreihen vorhanden.</p>}
      <p className="text-sm text-slate-600">„Eventreihe verwalten“ erlaubt unabhängig von der Rolle gemeinsame Stammdaten und Branding. Benutzerverwaltung und Produktfreischaltungen bleiben Administratoren vorbehalten.</p>
    </fieldset>
  </div>;
}
