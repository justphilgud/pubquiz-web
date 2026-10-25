"use client";
import { UserSeriesAssignments } from "./UserSeriesAssignments";
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
  return <div className="space-y-5">
    <fieldset className="space-y-3 border-t border-slate-200 pt-4">
      <legend className="font-semibold">Globale Rollen</legend>
      <label className="flex min-h-11 items-center gap-3"><input type="checkbox" name="roleAdministrator" defaultChecked={initialGlobalRoles.includes("ADMIN")} />{messages.assignmentRoles.ADMIN}</label>
      <label className="flex min-h-11 items-center gap-3"><input type="checkbox" name="roleEditor" defaultChecked={initialGlobalRoles.includes("EDITOR")} />Globaler Quiz-Editor</label>
      <p className="text-sm text-slate-600">Der globale Editor gilt ausschließlich für Quiz.</p>
    </fieldset>
    <UserSeriesAssignments eventSeries={eventSeries} initialAssignments={initialEventSeriesAssignments} initialManagementIds={initialManagementIds} />
  </div>;
}
