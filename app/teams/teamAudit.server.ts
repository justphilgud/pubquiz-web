import "server-only";

export type TeamAuditEvent =
  | "team_password_changed"
  | "team_password_randomized"
  | "team_archived"
  | "team_reactivated"
  | "team_deleted"
  | "team_force_deleted";

export function logTeamAudit(
  event: TeamAuditEvent,
  details: { actorUserId: number; teamId: number; participationCount?: number },
) {
  console.info("Teamverwaltung", { event, ...details });
}
