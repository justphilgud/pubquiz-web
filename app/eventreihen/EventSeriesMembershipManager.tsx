"use client";

import { useMemo, useState } from "react";
import type { RoleMessages } from "@/app/i18n/roleMessages";
import {
  addEventSeriesMembership,
  changeEventSeriesMembershipRole,
  removeEventSeriesMembership,
  type EventSeriesMembershipOptions,
} from "./membershipActions";
import type { EventSeriesAssignmentRole } from "./eventSeriesAccessPolicy";
import { getAvailableEventSeries } from "./membershipPolicy";

type Props = {
  data: EventSeriesMembershipOptions;
  userId: number;
  messages: RoleMessages;
};

const fieldClass =
  "min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-emerald-600";

export function EventSeriesMembershipManager({
  data,
  userId,
  messages,
}: Props) {
  const memberships = useMemo(
    () => data.memberships.filter((membership) => membership.userId === userId),
    [data.memberships, userId],
  );
  const availableSeries = getAvailableEventSeries(
    data.eventSeries,
    memberships,
  );
  const [showAdd, setShowAdd] = useState(false);
  const [eventSeriesId, setEventSeriesId] = useState(
    availableSeries[0]?.id ?? 0,
  );
  const [newRole, setNewRole] =
    useState<EventSeriesAssignmentRole>("EVENT_EDITOR");
  const [roles, setRoles] = useState<Record<number, EventSeriesAssignmentRole>>(
    () => Object.fromEntries(memberships.map(({ id, role }) => [id, role])),
  );
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function add() {
    setPending(true);
    const result = await addEventSeriesMembership({
      userId,
      eventSeriesId,
      role: newRole,
    });
    setPending(false);
    setMessage(result.message);
    if (result.success) window.location.reload();
  }

  async function changeRole(
    membershipId: number,
    confirmedWithoutManager = false,
  ) {
    setPending(true);
    const result = await changeEventSeriesMembershipRole({
      membershipId,
      role: roles[membershipId],
      confirmedWithoutManager,
    });
    setPending(false);
    setMessage(result.message);
    if (result.requiresConfirmation && window.confirm(result.message)) {
      await changeRole(membershipId, true);
      return;
    }
    if (result.success) window.location.reload();
  }

  async function remove(membershipId: number, confirmedWithoutManager = false) {
    if (
      !confirmedWithoutManager &&
      !window.confirm(messages.messages.removeQuestion)
    ) {
      return;
    }
    setPending(true);
    const result = await removeEventSeriesMembership(
      membershipId,
      confirmedWithoutManager,
    );
    setPending(false);
    setMessage(result.message);
    if (result.requiresConfirmation && window.confirm(result.message)) {
      await remove(membershipId, true);
      return;
    }
    if (result.success) window.location.reload();
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3">
        {memberships.map((membership) => (
          <article
            key={membership.id}
            className="min-w-0 rounded-xl border border-slate-200 p-3"
          >
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0 flex-1">
                <p className="break-words font-semibold">
                  {membership.eventSeriesName}
                </p>
                {membership.eventSeriesArchived && (
                  <p className="mt-1 text-sm text-slate-500">
                    {messages.status.archived}
                  </p>
                )}
              </div>
              <label className="min-w-0 flex-1">
                <span className="mb-1 block text-sm font-semibold">
                  {messages.fields.eventSeriesRole}
                </span>
                <select
                  value={roles[membership.id]}
                  onChange={(event) =>
                    setRoles((current) => ({
                      ...current,
                      [membership.id]: event.target
                        .value as EventSeriesAssignmentRole,
                    }))
                  }
                  className={fieldClass}
                >
                  <option value="EVENT_MANAGER">
                    {messages.eventSeriesRoles.EVENT_MANAGER}
                  </option>
                  <option value="EVENT_EDITOR">
                    {messages.eventSeriesRoles.EVENT_EDITOR}
                  </option>
                </select>
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  disabled={pending || roles[membership.id] === membership.role}
                  onClick={() => changeRole(membership.id)}
                  className="min-h-11 rounded-xl border border-slate-300 px-4 py-2 font-semibold disabled:opacity-50"
                >
                  {messages.actions.changeRole}
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => remove(membership.id)}
                  className="min-h-11 rounded-xl border border-red-300 px-4 py-2 font-semibold text-red-800 disabled:opacity-50"
                >
                  {messages.actions.removeAssignment}
                </button>
              </div>
            </div>
          </article>
        ))}
        {memberships.length === 0 && (
          <p className="text-sm text-slate-500">
            {messages.summaries.noAssignment}
          </p>
        )}
      </div>

      {!showAdd ? (
        <button
          type="button"
          disabled={availableSeries.length === 0}
          onClick={() => setShowAdd(true)}
          className="min-h-11 rounded-xl border border-slate-300 px-4 py-2 font-semibold disabled:opacity-50"
        >
          {messages.actions.addEventSeries}
        </button>
      ) : (
        <div className="rounded-xl bg-slate-50 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              <span className="mb-1 block text-sm font-semibold">
                {messages.fields.eventSeries}
              </span>
              <select
                value={eventSeriesId}
                onChange={(event) => setEventSeriesId(Number(event.target.value))}
                className={fieldClass}
              >
                {availableSeries.map((series) => (
                  <option key={series.id} value={series.id}>
                    {series.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="mb-1 block text-sm font-semibold">
                {messages.fields.eventSeriesRole}
              </span>
              <select
                value={newRole}
                onChange={(event) =>
                  setNewRole(event.target.value as EventSeriesAssignmentRole)
                }
                className={fieldClass}
              >
                <option value="EVENT_MANAGER">
                  {messages.eventSeriesRoles.EVENT_MANAGER}
                </option>
                <option value="EVENT_EDITOR">
                  {messages.eventSeriesRoles.EVENT_EDITOR}
                </option>
              </select>
            </label>
          </div>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              disabled={pending || !eventSeriesId}
              onClick={add}
              className="min-h-11 rounded-xl bg-slate-900 px-4 py-2 font-semibold text-white disabled:opacity-50"
            >
              {messages.actions.addAssignment}
            </button>
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="min-h-11 rounded-xl border border-slate-300 px-4 py-2 font-semibold"
            >
              {messages.actions.cancel}
            </button>
          </div>
        </div>
      )}
      {availableSeries.length === 0 && (
        <p className="text-sm text-slate-500">
          {messages.messages.noAvailableSeries}
        </p>
      )}
      {message && (
        <p role="status" aria-live="polite" className="rounded-xl bg-slate-100 p-3 text-sm">
          {message}
        </p>
      )}
    </div>
  );
}
