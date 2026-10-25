import type { EventSeriesAssignmentRole } from "@/app/eventreihen/eventSeriesAccessPolicy";

export type SeriesAssignmentDraft = { eventSeriesId: number; role: EventSeriesAssignmentRole | ""; manage: boolean };

/** Keep the union, including management-only rights and IDs outside the current view. */
export function initialSeriesDraft(
  assignments: readonly { eventSeriesId: number; role: EventSeriesAssignmentRole }[],
  managementIds: readonly number[],
): SeriesAssignmentDraft[] {
  return [...new Set([...assignments.map(row => row.eventSeriesId), ...managementIds])].map(eventSeriesId => ({
    eventSeriesId,
    role: assignments.find(row => row.eventSeriesId === eventSeriesId)?.role ?? "",
    manage: managementIds.includes(eventSeriesId),
  }));
}

/** Serialize the complete draft, never the filtered rows. Empty added rows grant nothing. */
export function seriesDraftPayload(rows: readonly SeriesAssignmentDraft[]) {
  return {
    assignments: rows.flatMap(row => row.role ? [{ eventSeriesId: row.eventSeriesId, role: row.role }] : []),
    managementIds: rows.filter(row => row.manage).map(row => row.eventSeriesId),
  };
}
