"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  removeEventSeriesMembership,
  saveEventSeriesMembership,
  type EventSeriesMembershipOptions,
} from "./membershipActions";
import type { EventSeriesAssignmentRole } from "./eventSeriesAccessPolicy";

type Props = {
  data: EventSeriesMembershipOptions;
  fixedUserId?: number;
  fixedEventSeriesId?: number;
  compact?: boolean;
};

const roleLabels: Record<EventSeriesAssignmentRole, string> = {
  EVENT_MANAGER: "Eventmanager",
  EDITOR: "Editor",
};

const fieldClass = "min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2";

export function EventSeriesMembershipManager({
  data,
  fixedUserId,
  fixedEventSeriesId,
  compact = false,
}: Props) {
  const [userId, setUserId] = useState(fixedUserId ?? data.users[0]?.id ?? 0);
  const [eventSeriesId, setEventSeriesId] = useState(fixedEventSeriesId ?? data.eventSeries[0]?.id ?? 0);
  const [role, setRole] = useState<EventSeriesAssignmentRole>("EDITOR");
  const [message, setMessage] = useState("");
  const [confirmationId, setConfirmationId] = useState<number | null>(null);
  const [confirmRoleChange, setConfirmRoleChange] = useState(false);
  const confirmationTitleId = useId();
  const cancelConfirmationRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (confirmRoleChange || confirmationId !== null) {
      cancelConfirmationRef.current?.focus();
    }
  }, [confirmRoleChange, confirmationId]);

  const memberships = useMemo(
    () => data.memberships.filter((membership) =>
      (fixedUserId === undefined || membership.userId === fixedUserId) &&
      (fixedEventSeriesId === undefined || membership.eventSeriesId === fixedEventSeriesId)),
    [data.memberships, fixedEventSeriesId, fixedUserId],
  );

  async function save(confirmedWithoutManager = false) {
    const result = await saveEventSeriesMembership({ userId, eventSeriesId, role, confirmedWithoutManager });
    setMessage(result.message);
    if (result.requiresConfirmation) {
      setConfirmationId(null);
      setConfirmRoleChange(true);
      return;
    }
    setConfirmRoleChange(false);
    if (result.success) window.location.reload();
  }

  async function remove(membershipId: number, confirmed = false) {
    const result = await removeEventSeriesMembership(membershipId, confirmed);
    setMessage(result.message);
    if (result.requiresConfirmation) {
      setConfirmRoleChange(false);
      setConfirmationId(membershipId);
      return;
    }
    setConfirmationId(null);
    if (result.success) window.location.reload();
  }

  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {fixedUserId === undefined && (
          <label>
            <span className="mb-1 block text-sm font-semibold">Benutzer</span>
            <select className={fieldClass} value={userId} onChange={(event) => setUserId(Number(event.target.value))}>
              {data.users.map((user) => <option key={user.id} value={user.id}>{user.name || user.email}</option>)}
            </select>
          </label>
        )}
        {fixedEventSeriesId === undefined && (
          <label>
            <span className="mb-1 block text-sm font-semibold">Eventreihe</span>
            <select className={fieldClass} value={eventSeriesId} onChange={(event) => setEventSeriesId(Number(event.target.value))}>
              {data.eventSeries.map((series) => <option key={series.id} value={series.id}>{series.name}</option>)}
            </select>
          </label>
        )}
        <label>
          <span className="mb-1 block text-sm font-semibold">Rolle in der Eventreihe</span>
          <select className={fieldClass} value={role} onChange={(event) => setRole(event.target.value as EventSeriesAssignmentRole)}>
            <option value="EDITOR">Editor</option>
            <option value="EVENT_MANAGER">Eventmanager</option>
          </select>
        </label>
      </div>
      <button
        type="button"
        onClick={() => save()}
        disabled={!userId || !eventSeriesId}
        className="min-h-11 w-full rounded-xl bg-slate-900 px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
      >
        Zuordnung speichern
      </button>
      {confirmRoleChange && (
        <div role="alertdialog" aria-labelledby={confirmationTitleId} className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm">
          <p id={confirmationTitleId} className="font-semibold">Diese Eventreihe besitzt danach keinen Eventmanager mehr.</p>
          <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row">
            <button ref={cancelConfirmationRef} type="button" onClick={() => setConfirmRoleChange(false)} className="min-h-11 rounded-xl border border-slate-300 px-4 py-2 font-semibold">Abbrechen</button>
            <button type="button" onClick={() => save(true)} className="min-h-11 rounded-xl bg-amber-800 px-4 py-2 font-semibold text-white">Rolle trotzdem ändern</button>
          </div>
        </div>
      )}

      <div className="grid gap-2">
        {memberships.map((membership) => (
          <article key={membership.id} className="rounded-xl border border-slate-200 p-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                {fixedUserId === undefined && <p className="break-words font-semibold">{membership.userName || membership.userEmail}</p>}
                {fixedEventSeriesId === undefined && <p className="break-words font-semibold">{membership.eventSeriesName}</p>}
                <p className="text-sm text-slate-600">{roleLabels[membership.role]}</p>
              </div>
              <button type="button" onClick={() => remove(membership.id)} className="min-h-11 rounded-xl border border-red-300 px-4 py-2 font-semibold text-red-800">
                Zuordnung entfernen
              </button>
            </div>
            {confirmationId === membership.id && (
              <div role="alertdialog" aria-labelledby={confirmationTitleId} className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm">
                <p id={confirmationTitleId} className="font-semibold">Diese Eventreihe besitzt danach keinen Eventmanager mehr.</p>
                <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row">
                  <button ref={cancelConfirmationRef} type="button" onClick={() => setConfirmationId(null)} className="min-h-11 rounded-xl border border-slate-300 px-4 py-2 font-semibold">Abbrechen</button>
                  <button type="button" onClick={() => remove(membership.id, true)} className="min-h-11 rounded-xl bg-red-700 px-4 py-2 font-semibold text-white">Trotzdem entfernen</button>
                </div>
              </div>
            )}
          </article>
        ))}
        {memberships.length === 0 && <p className="text-sm text-slate-500">Keine Eventreihenzuordnung vorhanden.</p>}
      </div>
      {message && <p role="status" className="rounded-xl bg-slate-100 p-3 text-sm">{message}</p>}
    </div>
  );
}
