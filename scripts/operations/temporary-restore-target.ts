import { RESTORE_TARGET, type Environment } from "./acceptance-policy";
import { OperationsError, requireCondition } from "./guards";
import { existingBackupInput } from "./restore-existing-backup";

// Metadata comes only from the reviewer-protected operations-restore variable.
// No dispatch input, URL, provider API credential or provisioning side effect.
export type TemporaryRestoreTarget = {
  version: 1; id: string; project: string; branch: string; endpoint: string;
  database: string; createdAt: string; expiresAt: string;
  backupId: string; manifestSha256: string;
};
export function temporaryRestoreTarget(env: Environment, now = Date.now()): TemporaryRestoreTarget {
  let target: TemporaryRestoreTarget;
  try { target = JSON.parse(env.RESTORE_TEMPORARY_TARGET ?? "") as TemporaryRestoreTarget; }
  catch { throw new OperationsError("TEMPORARY_RESTORE_TARGET_REQUIRED"); }
  requireCondition(target && typeof target === "object" && !Array.isArray(target) &&
    Object.keys(target).sort().join() === "backupId,branch,createdAt,database,endpoint,expiresAt,id,manifestSha256,project,version",
  "TEMPORARY_RESTORE_METADATA_INVALID");
  requireCondition(target.version === 1 && /^[a-f0-9]{32}$/.test(target.id) &&
    target.database === `ap94_restore_${target.id}`, "TEMPORARY_RESTORE_DATABASE_INVALID");
  requireCondition(target.project === RESTORE_TARGET.project && target.branch === RESTORE_TARGET.branch &&
    target.endpoint === RESTORE_TARGET.endpoint, "TEMPORARY_RESTORE_PROJECT_INVALID");
  requireCondition(typeof target.createdAt === "string" && typeof target.expiresAt === "string" && /^[0-9TZ:.+-]+$/.test(target.expiresAt), "TEMPORARY_RESTORE_LEASE_INVALID");
  const created = Date.parse(target.createdAt), expires = Date.parse(target.expiresAt);
  requireCondition(Number.isFinite(created) && Number.isFinite(expires) && created <= now && now < expires &&
    expires > created && expires - created <= 24 * 60 * 60 * 1000, "TEMPORARY_RESTORE_LEASE_INVALID");
  existingBackupInput(target.backupId, target.manifestSha256);
  requireCondition(target.backupId === env.AP94_BACKUP_KEY && target.manifestSha256 === env.AP94_MANIFEST_SHA256,
    "TEMPORARY_RESTORE_BACKUP_MISMATCH");
  return target;
}
export function temporaryDatabaseMarker(target: TemporaryRestoreTarget) {
  return `ap94:restore-test:${target.id}:${target.expiresAt}`;
}
export function assertTemporaryDatabaseMarker(actual: unknown, target: TemporaryRestoreTarget) {
  requireCondition(actual === temporaryDatabaseMarker(target), "TEMPORARY_RESTORE_MARKER_INVALID");
}
// PostgreSQL superusers/provider administrators cannot be isolated by database ACLs.
// Ordinary other login roles and PUBLIC must have no effective CONNECT permission.
export const TEMPORARY_DATABASE_ACCESS_SQL = `SELECT json_build_object(
  'publicConnect', EXISTS(SELECT 1 FROM pg_database d,
    LATERAL aclexplode(coalesce(d.datacl,acldefault('d',d.datdba))) a
    WHERE d.datname=current_database() AND a.grantee=0 AND a.privilege_type='CONNECT'),
  'otherLoginRoles', (SELECT count(*)::int FROM pg_roles r WHERE r.rolcanlogin AND NOT r.rolsuper
    AND r.rolname NOT IN (current_user,'cloud_admin')
    AND has_database_privilege(r.oid,(SELECT oid FROM pg_database WHERE datname=current_database()),'CONNECT'))) `;
export function assertTemporaryDatabaseAccess(proof: { publicConnect: boolean; otherLoginRoles: number }) {
  requireCondition(proof.publicConnect === false && proof.otherLoginRoles === 0, "TEMPORARY_RESTORE_ACCESS_NOT_ISOLATED");
}
export function temporaryRestoreConnection(base: string, target: TemporaryRestoreTarget) {
  // Caller must first verify the existing pinned Nonprod host/role/TLS connection.
  const url = new URL(base);
  requireCondition(url.hostname === RESTORE_TARGET.host && decodeURIComponent(url.username) === RESTORE_TARGET.role &&
    target.database === `ap94_restore_${target.id}` && /^[a-f0-9]{32}$/.test(target.id), "TEMPORARY_RESTORE_CONNECTION_INVALID");
  url.pathname = `/${target.database}`;
  return url.toString();
}
export function temporaryCleanupPlan(target: TemporaryRestoreTarget, proof: {
  project: string; branch: string; endpoint: string; database: string; marker: string;
  restoreActive: boolean; connections: number; separatelyApproved: boolean;
}) {
  requireCondition(proof.project === RESTORE_TARGET.project && proof.branch === RESTORE_TARGET.branch &&
    proof.endpoint === RESTORE_TARGET.endpoint && proof.database === target.database &&
    /^[a-f0-9]{32}$/.test(target.id) && target.database === `ap94_restore_${target.id}`,
  "TEMPORARY_CLEANUP_IDENTITY_INVALID");
  assertTemporaryDatabaseMarker(proof.marker, target);
  requireCondition(proof.separatelyApproved && !proof.restoreActive && proof.connections === 0,
    "TEMPORARY_CLEANUP_NOT_AUTHORIZED");
  // Plan only. Never terminate sessions, drop a database, branch, endpoint or schema.
  return { database: target.database, project: RESTORE_TARGET.project, action: "manual-drop-temporary-database-only" };
}
