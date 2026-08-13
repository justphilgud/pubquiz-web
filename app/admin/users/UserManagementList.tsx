"use client";

import { useMemo, useState } from "react";
import { CheckCircleIcon, XCircleIcon, XMarkIcon } from "@heroicons/react/24/solid";
import { SearchInput, Select } from "@/components/ui";
import type { RoleAssignmentOptions } from "@/app/eventreihen/membershipActions";
import type { RoleMessages } from "@/app/i18n/roleMessages";
import type { AppLocale } from "@/app/i18n/locale";
import { formatMessage } from "@/app/i18n/formatMessage";
import { getUserInitials } from "@/app/lib/userDisplay";
import { ROLE_ASSIGNMENT_ROLES, type RoleAssignmentRoleValue } from "@/app/roles/roleAssignmentPolicy";
import { countEventSeriesRoleAssignments } from "@/app/eventreihen/membershipPolicy";
import {
  EMPTY_USER_LIST_FILTERS,
  filterUsers,
  hasActiveUserFilters,
  type UserEventSeriesFilter,
  type UserListFilters,
  type UserRoleFilter,
  type UserStatusFilter,
} from "./userFilterPolicy";
import EditUserDialog from "./EditUserDialog";
import { ArchiveUser } from "./ArchiveUser";
import { ReactivateUser } from "./ReactivateUser";

type UserRow = {
  id: number;
  name: string | null;
  email: string;
  isActive: boolean;
  globalRoles: ("ADMIN" | "EDITOR")[];
  roles: RoleAssignmentRoleValue[];
  eventSeriesIds: number[];
};

function FilterResetButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${label} zurücksetzen`}
      title={`${label} zurücksetzen`}
      className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400"
    >
      <XMarkIcon className="h-4 w-4" aria-hidden="true" />
      {label}
    </button>
  );
}

export function UserManagementList({
  users,
  assignmentData,
  locale,
  messages,
}: {
  users: UserRow[];
  assignmentData: RoleAssignmentOptions;
  locale: AppLocale;
  messages: RoleMessages;
}) {
  const [filters, setFilters] = useState<UserListFilters>(EMPTY_USER_LIST_FILTERS);
  const visibleUsers = useMemo(() => filterUsers(users, filters, locale), [filters, locale, users]);

  function updateFilter<Key extends keyof UserListFilters>(key: Key, value: UserListFilters[Key]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  return (
    <section aria-label="Benutzerliste">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="sm:col-span-2 lg:col-span-1">
            <span className="mb-1 block text-xs font-semibold text-slate-700">Name oder E-Mail</span>
            <SearchInput
              value={filters.query}
              onChange={(event) => updateFilter("query", event.target.value)}
              placeholder="Benutzer suchen"
              className="min-h-11 rounded-xl"
            />
          </label>
          <label>
            <span className="mb-1 block text-xs font-semibold text-slate-700">Eventreihe</span>
            <Select
              value={String(filters.eventSeries)}
              onChange={(event) => updateFilter(
                "eventSeries",
                event.target.value === "ALL" || event.target.value === "NONE"
                  ? event.target.value as UserEventSeriesFilter
                  : Number(event.target.value),
              )}
              className="min-h-11 rounded-xl"
            >
              <option value="ALL">Alle Eventreihen</option>
              <option value="NONE">Keine Eventreihenzuweisung</option>
              {assignmentData.eventSeries.map((series) => (
                <option key={series.id} value={series.id}>{series.name}{series.archived ? " (archiviert)" : ""}</option>
              ))}
            </Select>
          </label>
          <label>
            <span className="mb-1 block text-xs font-semibold text-slate-700">Rolle</span>
            <Select
              value={filters.role}
              onChange={(event) => updateFilter("role", event.target.value as UserRoleFilter)}
              className="min-h-11 rounded-xl"
            >
              <option value="ALL">Alle Rollen</option>
              {ROLE_ASSIGNMENT_ROLES.map((role) => (
                <option key={role} value={role}>{messages.assignmentRoles[role]}</option>
              ))}
            </Select>
          </label>
          <label>
            <span className="mb-1 block text-xs font-semibold text-slate-700">Status</span>
            <Select
              value={filters.status}
              onChange={(event) => updateFilter("status", event.target.value as UserStatusFilter)}
              className="min-h-11 rounded-xl"
            >
              <option value="ALL">Alle Status</option>
              <option value="ACTIVE">Aktiv</option>
              <option value="INACTIVE">Inaktiv</option>
            </Select>
          </label>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-slate-700" aria-live="polite">
            {visibleUsers.length} von {users.length} Benutzern
          </p>
          {hasActiveUserFilters(filters) && (
            <div className="flex flex-wrap gap-2">
              {filters.query && <FilterResetButton label="Suche" onClick={() => updateFilter("query", "")} />}
              {filters.eventSeries !== "ALL" && <FilterResetButton label="Eventreihe" onClick={() => updateFilter("eventSeries", "ALL")} />}
              {filters.role !== "ALL" && <FilterResetButton label="Rolle" onClick={() => updateFilter("role", "ALL")} />}
              {filters.status !== "ALL" && <FilterResetButton label="Status" onClick={() => updateFilter("status", "ALL")} />}
              <button type="button" onClick={() => setFilters(EMPTY_USER_LIST_FILTERS)} className="min-h-10 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800">
                Alle zurücksetzen
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {visibleUsers.map((user) => {
          const assignments = assignmentData.assignments.filter((assignment) => assignment.userId === user.id);
          const counts = countEventSeriesRoleAssignments(assignments);
          return (
            <article key={user.id} className="border-b border-slate-100 px-4 py-4 last:border-b-0 sm:px-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-200 text-sm font-semibold text-slate-700">
                    {getUserInitials(user.name, user.email)}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{user.name || user.email}</div>
                    <div className="truncate text-sm text-slate-500">{user.email}</div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                    {messages.fields.globalRoles}: {user.globalRoles.length > 0
                      ? user.globalRoles.map((role) => messages.assignmentRoles[role]).join(", ")
                      : messages.summaries.noGlobalRole}
                  </span>
                  <span className={user.isActive
                    ? "inline-flex items-center gap-1 rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700"
                    : "inline-flex items-center gap-1 rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700"}
                  >
                    {user.isActive ? <CheckCircleIcon className="h-4 w-4" /> : <XCircleIcon className="h-4 w-4" />}
                    {user.isActive ? messages.status.active : messages.status.archived}
                  </span>
                  <div className="flex items-center gap-2">
                    <EditUserDialog user={{ ...user, is_active: user.isActive }} assignmentData={assignmentData} messages={messages} locale={locale} />
                    {user.isActive ? <ArchiveUser userId={user.id} /> : <ReactivateUser userId={user.id} />}
                  </div>
                </div>
              </div>
              <div className="mt-3 text-sm text-slate-600">
                {assignments.length === 0 ? messages.summaries.noAssignment : (
                  <>
                    <p className="font-medium">{assignments.length === 1 ? messages.summaries.oneAssignment : formatMessage(messages.summaries.multipleAssignments, { count: assignments.length })}</p>
                    <p className="mt-1 break-words text-xs text-slate-500">
                      {formatMessage(messages.summaries.managers, { count: counts.EVENT_MANAGER })} · {formatMessage(messages.summaries.editors, { count: counts.EDITOR })}
                    </p>
                  </>
                )}
              </div>
            </article>
          );
        })}
        {visibleUsers.length === 0 && (
          <p className="px-4 py-10 text-center text-sm text-slate-600">Keine Benutzer entsprechen den aktuellen Filtern.</p>
        )}
      </div>
    </section>
  );
}
