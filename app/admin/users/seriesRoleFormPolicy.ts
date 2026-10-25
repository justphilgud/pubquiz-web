import type { EventSeriesRoleAssignmentInput } from "@/app/roles/roleAssignmentWrites.server";

/** Missing marker means an already-open identity-only form: preserve scoped rights. */
export function readSeriesRoleForm(form: FormData): { assignments: EventSeriesRoleAssignmentInput[]; managementIds: number[] } | null {
  if (!form.has("seriesRolesVersion")) return null;
  if (form.get("seriesRolesVersion") !== "1") throw new Error("Bitte das Benutzerformular neu laden.");
  const parsed: unknown = JSON.parse(String(form.get("eventSeriesRoles") ?? ""));
  if (!Array.isArray(parsed) || parsed.length > 10000) throw new Error("Ungültige Reihenrollen.");
  const assignments = parsed.map((row: unknown): EventSeriesRoleAssignmentInput => {
    if (!row || typeof row !== "object" || !("eventSeriesId" in row) || !("role" in row) ||
      !Number.isSafeInteger(row.eventSeriesId) || Number(row.eventSeriesId) <= 0 ||
      (row.role !== "EDITOR" && row.role !== "EVENT_MANAGER")) throw new Error("Ungültige Reihenrolle.");
    return { eventSeriesId: Number(row.eventSeriesId), role: row.role };
  });
  if (new Set(assignments.map(r => r.eventSeriesId)).size !== assignments.length) throw new Error("Eine Rolle je Eventreihe erlaubt.");
  const managementIds = form.getAll("manageEventSeriesIds").map(value => Number(value));
  if (managementIds.some(id => !Number.isSafeInteger(id) || id <= 0)) throw new Error("Ungültige Reihenverwaltung.");
  return { assignments, managementIds: [...new Set(managementIds)] };
}
