import "server-only";

type RoleAuditEvent =
  | "role_assignment_added"
  | "role_assignment_changed"
  | "role_assignment_removed"
  | "last_admin_protected"
  | "invalid_role_assignment_rejected"
  | "legacy_assignment_inconsistency";

export function logRoleAudit(
  event: RoleAuditEvent,
  details: Record<string, number | string | null | boolean>,
) {
  const logger = event.includes("protected") || event.includes("rejected") || event.includes("inconsistency")
    ? console.warn
    : console.info;
  logger("Rollenänderung", { event, ...details });
}
