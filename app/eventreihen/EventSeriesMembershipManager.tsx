"use client";

import { useMemo, useState } from "react";
import type { RoleMessages } from "@/app/i18n/roleMessages";
import {
  addEventSeriesRoleAssignment,
  changeEventSeriesRoleAssignment,
  removeEventSeriesRoleAssignment,
  type RoleAssignmentOptions,
} from "./membershipActions";
import type { EventSeriesAssignmentRole } from "./eventSeriesAccessPolicy";
import { getAvailableEventSeries } from "./membershipPolicy";

type Props = {
  data: RoleAssignmentOptions;
  userId: number;
  messages: RoleMessages;
};

const fieldClass =
  "min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-emerald-600";

export function EventSeriesRoleAssignmentManager({ data, userId, messages }: Props) {
  const assignments = useMemo(
    () => data.assignments.filter((assignment) => assignment.userId === userId),
    [data.assignments, userId],
  );
  const availableSeries = getAvailableEventSeries(data.eventSeries, assignments);
  const [showAdd, setShowAdd] = useState(false);
  const [eventSeriesId, setEventSeriesId] = useState(availableSeries[0]?.id ?? 0);
  const [newRole, setNewRole] = useState<EventSeriesAssignmentRole>("EDITOR");
  const [roles, setRoles] = useState<Record<number, EventSeriesAssignmentRole>>(
    () => Object.fromEntries(assignments.map(({ id, role }) => [id, role])),
  );
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function add() {
    setPending(true);
    const result = await addEventSeriesRoleAssignment({ userId, eventSeriesId, role: newRole });
    setPending(false);
    setMessage(result.message);
    if (result.success) window.location.reload();
  }

  async function changeRole(assignmentId: number) {
    setPending(true);
    const result = await changeEventSeriesRoleAssignment({
      assignmentId,
      role: roles[assignmentId],
    });
    setPending(false);
    setMessage(result.message);
    if (result.success) window.location.reload();
  }

  async function remove(assignmentId: number) {
    if (!window.confirm(messages.messages.removeQuestion)) return;
    setPending(true);
    const result = await removeEventSeriesRoleAssignment(assignmentId);
    setPending(false);
    setMessage(result.message);
    if (result.success) window.location.reload();
  }

  return (
    <div className="min-w-0 space-y-4">
      <div className="grid gap-2">
        {assignments.map((assignment) => (
          <article key={assignment.id} className="min-w-0 rounded-xl border border-slate-200 p-3">
            <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(9rem,0.7fr)] lg:grid-cols-[minmax(0,1fr)_11rem_auto] lg:items-end">
              <div className="min-w-0">
                <p className="break-words font-semibold [overflow-wrap:anywhere]">
                  {assignment.eventSeriesName}
                </p>
                {assignment.eventSeriesArchived && (
                  <p className="mt-1 text-sm text-slate-500">{messages.status.archived}</p>
                )}
              </div>
              <label className="min-w-0">
                <span className="mb-1 block text-sm font-semibold">{messages.fields.role}</span>
                <select
                  value={roles[assignment.id]}
                  onChange={(event) => setRoles((current) => ({
                    ...current,
                    [assignment.id]: event.target.value as EventSeriesAssignmentRole,
                  }))}
                  className={fieldClass}
                >
                  <option value="EVENT_MANAGER">{messages.assignmentRoles.EVENT_MANAGER}</option>
                  <option value="EDITOR">{messages.assignmentRoles.EDITOR}</option>
                </select>
              </label>
              <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-1">
                <button
                  type="button"
                  disabled={pending || roles[assignment.id] === assignment.role}
                  onClick={() => changeRole(assignment.id)}
                  className="min-h-11 rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-emerald-600 disabled:opacity-50"
                >
                  {messages.actions.changeRole}
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => remove(assignment.id)}
                  className="min-h-11 rounded-xl border border-red-200 px-3 py-2 text-sm font-semibold text-red-800 focus-visible:ring-2 focus-visible:ring-red-600 disabled:opacity-50"
                >
                  {messages.actions.removeRole}
                </button>
              </div>
            </div>
          </article>
        ))}
        {assignments.length === 0 && (
          <p className="text-sm text-slate-500">{messages.summaries.noAssignment}</p>
        )}
      </div>

      {!showAdd ? (
        <button
          type="button"
          disabled={availableSeries.length === 0}
          onClick={() => setShowAdd(true)}
          className="min-h-11 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-emerald-600 disabled:opacity-50"
        >
          {messages.actions.addRole}
        </button>
      ) : (
        <div className="min-w-0 rounded-xl bg-slate-50 p-3 sm:p-4">
          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            <label className="min-w-0">
              <span className="mb-1 block text-sm font-semibold">{messages.fields.eventSeries}</span>
              <select value={eventSeriesId} onChange={(event) => setEventSeriesId(Number(event.target.value))} className={fieldClass}>
                {availableSeries.map((series) => <option key={series.id} value={series.id}>{series.name}</option>)}
              </select>
            </label>
            <label className="min-w-0">
              <span className="mb-1 block text-sm font-semibold">{messages.fields.role}</span>
              <select value={newRole} onChange={(event) => setNewRole(event.target.value as EventSeriesAssignmentRole)} className={fieldClass}>
                <option value="EVENT_MANAGER">{messages.assignmentRoles.EVENT_MANAGER}</option>
                <option value="EDITOR">{messages.assignmentRoles.EDITOR}</option>
              </select>
            </label>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" disabled={pending || !eventSeriesId} onClick={add} className="min-h-11 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {messages.actions.addRole}
            </button>
            <button type="button" onClick={() => setShowAdd(false)} className="min-h-11 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold">
              {messages.actions.cancel}
            </button>
          </div>
        </div>
      )}
      {availableSeries.length === 0 && <p className="text-sm text-slate-500">{messages.messages.noAvailableSeries}</p>}
      {message && <p role="status" aria-live="polite" className="rounded-xl bg-slate-100 p-3 text-sm">{message}</p>}
    </div>
  );
}
