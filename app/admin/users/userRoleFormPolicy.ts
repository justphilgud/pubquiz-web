export type UserEventSeriesRole = "EDITOR" | "EVENT_MANAGER";

export type UserRoleSelection = {
  administrator: boolean;
  editor: boolean;
  editorScope: unknown;
  editorEventSeriesIds: readonly number[];
  eventManager: boolean;
  eventManagerEventSeriesIds: readonly number[];
};

export type ResolvedUserRoleSelection = {
  globalRoles: ("ADMIN" | "EDITOR")[];
  eventSeriesAssignments: {
    eventSeriesId: number;
    role: UserEventSeriesRole;
  }[];
};

function uniquePositiveIds(values: readonly number[], field: string) {
  if (!values.every((value) => Number.isInteger(value) && value > 0)) {
    throw new Error(`Ungültige Eventreihenauswahl für ${field}.`);
  }
  return [...new Set(values)];
}

export function resolveUserRoleSelection(
  selection: UserRoleSelection,
): ResolvedUserRoleSelection {
  if (!selection.administrator && !selection.editor && !selection.eventManager) {
    throw new Error("Mindestens eine Rolle muss ausgewählt werden.");
  }

  const editorEventSeriesIds = uniquePositiveIds(
    selection.editorEventSeriesIds,
    "Editor",
  );
  const eventManagerEventSeriesIds = uniquePositiveIds(
    selection.eventManagerEventSeriesIds,
    "Eventmanager",
  );

  if (
    selection.editor &&
    selection.editorScope !== "GLOBAL" &&
    selection.editorScope !== "EVENT_SERIES"
  ) {
    throw new Error("Für die Editor-Rolle muss ein Geltungsbereich gewählt werden.");
  }
  if (
    selection.editor &&
    selection.editorScope === "EVENT_SERIES" &&
    editorEventSeriesIds.length === 0
  ) {
    throw new Error("Für einen Eventreihen-Editor muss mindestens eine Eventreihe gewählt werden.");
  }
  if (selection.eventManager && eventManagerEventSeriesIds.length === 0) {
    throw new Error("Für einen Eventmanager muss mindestens eine Eventreihe gewählt werden.");
  }

  const scopedEditorIds =
    selection.editor && selection.editorScope === "EVENT_SERIES"
      ? editorEventSeriesIds
      : [];
  const managerIds = selection.eventManager ? eventManagerEventSeriesIds : [];
  const conflictingId = scopedEditorIds.find((id) => managerIds.includes(id));
  if (conflictingId !== undefined) {
    throw new Error("Eine Eventreihe kann pro Benutzer nur einer Rolle zugeordnet werden.");
  }

  return {
    globalRoles: [
      ...(selection.administrator ? (["ADMIN"] as const) : []),
      ...(selection.editor && selection.editorScope === "GLOBAL"
        ? (["EDITOR"] as const)
        : []),
    ],
    eventSeriesAssignments: [
      ...scopedEditorIds.map((eventSeriesId) => ({
        eventSeriesId,
        role: "EDITOR" as const,
      })),
      ...managerIds.map((eventSeriesId) => ({
        eventSeriesId,
        role: "EVENT_MANAGER" as const,
      })),
    ],
  };
}
