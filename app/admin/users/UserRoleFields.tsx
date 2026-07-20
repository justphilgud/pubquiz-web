"use client";

import { useState } from "react";
import type { AppLocale } from "@/app/i18n/locale";
import type { RoleMessages } from "@/app/i18n/roleMessages";
import type { EventSeriesAssignmentRole } from "@/app/eventreihen/eventSeriesAccessPolicy";
import type { SelectableEventSeries } from "./eventSeriesSelectionPolicy";
import { EventSeriesPicker } from "./EventSeriesPicker";

type Props = {
  eventSeries: readonly SelectableEventSeries[];
  initialGlobalRoles?: readonly ("ADMIN" | "EDITOR")[];
  initialEventSeriesAssignments?: readonly {
    eventSeriesId: number;
    role: EventSeriesAssignmentRole;
  }[];
  locale: AppLocale;
  messages: RoleMessages;
};

const roleRowClass =
  "min-w-0 border-b border-slate-200 py-4 last:border-b-0";

export function UserRoleFields({
  eventSeries,
  initialGlobalRoles = ["EDITOR"],
  initialEventSeriesAssignments = [],
  locale,
  messages,
}: Props) {
  const initialEditorIds = initialEventSeriesAssignments.flatMap((assignment) =>
    assignment.role === "EDITOR" ? [assignment.eventSeriesId] : [],
  );
  const initialManagerIds = initialEventSeriesAssignments.flatMap((assignment) =>
    assignment.role === "EVENT_MANAGER" ? [assignment.eventSeriesId] : [],
  );
  const [administrator, setAdministrator] = useState(
    initialGlobalRoles.includes("ADMIN"),
  );
  const [editor, setEditor] = useState(
    initialGlobalRoles.includes("EDITOR") || initialEditorIds.length > 0,
  );
  const [editorScope, setEditorScope] = useState<"GLOBAL" | "EVENT_SERIES">(
    initialEditorIds.length > 0 && !initialGlobalRoles.includes("EDITOR")
      ? "EVENT_SERIES"
      : "GLOBAL",
  );
  const [editorEventSeriesIds, setEditorEventSeriesIds] =
    useState(initialEditorIds);
  const [eventManager, setEventManager] = useState(initialManagerIds.length > 0);
  const [eventManagerEventSeriesIds, setEventManagerEventSeriesIds] =
    useState(initialManagerIds);

  return (
    <fieldset className="min-w-0">
      <legend className="text-sm font-semibold text-slate-950">
        {messages.fields.rolesAndPermissions}
      </legend>

      <div className="mt-2 min-w-0">
        <section className={roleRowClass}>
          <label className="flex min-h-11 items-start gap-3">
            <input
              type="checkbox"
              name="roleAdministrator"
              checked={administrator}
              onChange={(event) => setAdministrator(event.target.checked)}
              className="mt-1 h-4 w-4 shrink-0"
            />
            <span className="min-w-0">
              <span className="block font-medium">
                {messages.assignmentRoles.ADMIN}
              </span>
              <span className="mt-1 block text-xs text-slate-500">
                {messages.roleConfiguration.administratorDescription}
              </span>
            </span>
          </label>
        </section>

        <section className={roleRowClass}>
          <label className="flex min-h-11 items-start gap-3">
            <input
              type="checkbox"
              name="roleEditor"
              checked={editor}
              onChange={(event) => setEditor(event.target.checked)}
              className="mt-1 h-4 w-4 shrink-0"
            />
            <span className="min-w-0">
              <span className="block font-medium">
                {messages.assignmentRoles.EDITOR}
              </span>
              <span className="mt-1 block text-xs text-slate-500">
                {messages.roleConfiguration.editorDescription}
              </span>
            </span>
          </label>

          {editor && (
            <div className="ml-0 mt-3 min-w-0 space-y-3 sm:ml-7">
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="flex min-h-11 items-center gap-3 rounded-xl border border-slate-200 px-3 py-2 text-sm">
                  <input
                    type="radio"
                    name="editorScope"
                    value="GLOBAL"
                    checked={editorScope === "GLOBAL"}
                    onChange={() => setEditorScope("GLOBAL")}
                  />
                  {messages.fields.global}
                </label>
                <label className="flex min-h-11 items-center gap-3 rounded-xl border border-slate-200 px-3 py-2 text-sm">
                  <input
                    type="radio"
                    name="editorScope"
                    value="EVENT_SERIES"
                    checked={editorScope === "EVENT_SERIES"}
                    onChange={() => setEditorScope("EVENT_SERIES")}
                  />
                  {messages.roleConfiguration.selectedEventSeries}
                </label>
              </div>

              {editorScope === "EVENT_SERIES" && (
                <EventSeriesPicker
                  eventSeries={eventSeries}
                  selectedIds={editorEventSeriesIds}
                  unavailableIds={eventManagerEventSeriesIds}
                  onChange={setEditorEventSeriesIds}
                  inputName="editorEventSeriesIds"
                  label={messages.roleConfiguration.selectEditorSeries}
                  locale={locale}
                  messages={messages}
                />
              )}
            </div>
          )}
        </section>

        <section className={roleRowClass}>
          <label className="flex min-h-11 items-start gap-3">
            <input
              type="checkbox"
              name="roleEventManager"
              checked={eventManager}
              onChange={(event) => setEventManager(event.target.checked)}
              className="mt-1 h-4 w-4 shrink-0"
            />
            <span className="min-w-0">
              <span className="block font-medium">
                {messages.assignmentRoles.EVENT_MANAGER}
              </span>
              <span className="mt-1 block text-xs text-slate-500">
                {messages.roleConfiguration.eventManagerDescription}
              </span>
            </span>
          </label>

          {eventManager && (
            <div className="ml-0 mt-3 min-w-0 sm:ml-7">
              <EventSeriesPicker
                eventSeries={eventSeries}
                selectedIds={eventManagerEventSeriesIds}
                unavailableIds={
                  editor && editorScope === "EVENT_SERIES"
                    ? editorEventSeriesIds
                    : []
                }
                onChange={setEventManagerEventSeriesIds}
                inputName="eventManagerEventSeriesIds"
                label={messages.roleConfiguration.selectManagerSeries}
                locale={locale}
                messages={messages}
              />
            </div>
          )}
        </section>
      </div>
    </fieldset>
  );
}
