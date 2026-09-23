import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runKey } from "./bridge/lib/contract";
import { AUTH_COLUMNS, RESTORE_TARGET, type Environment } from "./acceptance-policy";
import { operationConnection, assertReaderPrivileges, READER_PRIVILEGES_SQL, type ReaderPrivileges } from "./credentials";
import { OperationsError, requireCondition } from "./guards";
import { libpqEnvironment } from "./libpq";
import { PgSession, pgTool, toolsVersion } from "./pg-session";
import { collectSnapshot, sha256, type Snapshot } from "./snapshot";
import { captureMedia, PrivateArtifacts, type Artifact } from "./private-artifacts";
import { backupMetadataFromEnvironment, type BackupMetadata } from "./backup-metadata";

export type AcceptanceManifest = {
  version: 2 | 3; mode: "ap94-manual" | "production-backup"; key: string; snapshotAt: string; completedAt: string;
  backup?: BackupMetadata;
  release: string; operationsCommit: string; source: { host: string; name: string; schema: string };
  target: typeof RESTORE_TARGET; authExcluded: string[];
  expected: Omit<Snapshot, "authRows">; artifacts: Artifact[];
  media: Awaited<ReturnType<typeof captureMedia>>;
  sequenceSql: string[]; timings: { backupMs: number; mediaMs: number };
};
export function dumpArguments(snapshot: string, path: string) {
  requireCondition(/^[A-Fa-f0-9-]+$/.test(snapshot), "SNAPSHOT_ID_INVALID");
  return ["--format=custom", "--no-owner", "--no-acl", "--no-comments", "--no-publications", "--no-subscriptions", "--quote-all-identifiers",
    "--schema=public", "--schema=pubquiz", "--exclude-table-data=pubquiz.users", "--exclude-table-data=pubquiz.teams", `--snapshot=${snapshot}`, "--file", path];
}
const backupPhases = ["SOURCE_SESSION", "SOURCE_CAPTURE", "ARCHIVE", "MEDIA_CAPTURE", "AUTH_OVERLAY_FILE", "DATA_UPLOAD", "MANIFEST_UPLOAD", "ANONYMOUS_READBACK", "CLEANUP"] as const;
type BackupPhase = typeof backupPhases[number];
export function backupPhaseError(error: unknown, phase: BackupPhase): OperationsError {
  requireCondition(backupPhases.includes(phase), "BACKUP_DIAGNOSTIC_PHASE_INVALID");
  if (error instanceof OperationsError) return error;
  // Never interpolate error messages, causes, provider names, paths or URLs.
  return new OperationsError(`BACKUP_${phase}_FAILED_DETAILS_WITHHELD`);
}
export function backupUploadPlan(mediaNames: string[]) {
  const data = ["database.dump", "auth-redacted.json", ...mediaNames];
  const total = data.length + 1;
  return {
    data: data.map((name, index) => ({ name, position: { index: index + 1, total } })),
    manifest: { name: "manifest.json", position: { index: total, total } },
  } as const;
}
export async function uploadBackupData(plan: ReturnType<typeof backupUploadPlan>,
  load: (name: string) => Promise<Buffer>,
  upload: (name: string, bytes: Buffer, position: { index: number; total: number }) => Promise<Artifact>) {
  const artifacts: Artifact[] = [];
  for (const item of plan.data) artifacts.push(await upload(item.name, await load(item.name), item.position));
  return artifacts;
}
export async function acceptanceBackup(env: Environment) {
  const backup = backupMetadataFromEnvironment(env);
  requireCondition(/^[a-f0-9]{40}$/.test(env.PRODUCTION_RELEASE_SHA ?? "") && /^[a-f0-9]{40}$/.test(env.GITHUB_SHA ?? ""), "RELEASE_SHA_REQUIRED");
  const verified = operationConnection(env.PRODUCTION_BACKUP_DATABASE_URL, "production");
  toolsVersion(env);
  const started = Date.now(); const key = runKey("acceptance", env.GITHUB_RUN_ID ?? "", env.GITHUB_RUN_ATTEMPT ?? "");
  const store = new PrivateArtifacts(env, key, "backup"); // check transport before opening the DB
  try { await store.clientPreflight(); }
  catch (error) { store.emitOidcDiagnostics(); throw error; }
  const directory = await mkdtemp(join(tmpdir(), "pubquiz-ap94-"));
  const session = new PgSession(verified.connectionString, env);
  let phase: BackupPhase = "SOURCE_SESSION";
  try {
    await session.sql("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; SET LOCAL search_path=pg_catalog; SET LOCAL TIME ZONE 'UTC'; SET LOCAL DateStyle='ISO, YMD'", "SOURCE_BEGIN");
    const identity = await session.json<{ role: string; database: string; major: number }>("SELECT json_build_object('role',current_user,'database',current_database(),'major',current_setting('server_version_num')::int/10000)", "SOURCE_IDENTITY");
    requireCondition(identity.role === "pubquiz_backup_reader" && identity.database === "neondb" && identity.major === 17, "SOURCE_SESSION_IDENTITY_MISMATCH");
    assertReaderPrivileges((await session.json<ReaderPrivileges[]>(`SELECT json_agg(x) FROM (${READER_PRIVILEGES_SQL}) x`, "SOURCE_PRIVILEGES"))[0]);
    const snapshot = await session.json<{ id: string; time: string }>("SELECT json_build_object('id',pg_export_snapshot(),'time',transaction_timestamp())", "SOURCE_SNAPSHOT");
    phase = "SOURCE_CAPTURE";
    const state = await collectSnapshot(session); // inspect redacted data before dump
    phase = "ARCHIVE";
    const path = join(directory, "database.dump");
    const pgEnv = libpqEnvironment(verified.connectionString, env);
    pgTool("pg_dump", dumpArguments(snapshot.id, path), pgEnv);
    const toolEnv = { PATH: env.PATH, SystemRoot: env.SystemRoot };
    pgTool("pg_restore", ["--list", path], toolEnv);
    const dataSql = pgTool("pg_restore", ["--section=data", "--no-owner", "--no-acl", "--file=-", path], toolEnv);
    requireCondition(!/COPY "?pubquiz"?\."?(users|teams)"?\s*\(/.test(dataSql), "AUTH_TABLE_DATA_IN_DUMP");
    const sequenceSql = dataSql.split(/\r?\n/).filter(line => line.startsWith("SELECT pg_catalog.setval("));
    requireCondition(sequenceSql.length === (state.catalog as { sequences: unknown[] }).sequences.length, "SEQUENCE_EVIDENCE_INCOMPLETE");
    await session.sql("COMMIT"); session.close();
    phase = "MEDIA_CAPTURE";
    const mediaStart = Date.now(); const media = await captureMedia(state.media, directory); const mediaMs = Date.now() - mediaStart;
    phase = "AUTH_OVERLAY_FILE";
    await writeFile(join(directory, "auth-redacted.json"), JSON.stringify(state.authRows), { mode: 0o600 });
    phase = "DATA_UPLOAD";
    const uploadPlan = backupUploadPlan(media.map(item => item.name));
    const artifacts = await uploadBackupData(uploadPlan, name => readFile(join(directory, name)),
      (name, bytes, position) => store.upload(name, bytes, position));
    const { authRows: _auth, ...expected } = state; void _auth;
    const manifest: AcceptanceManifest = { version: 3, mode: "production-backup", key, snapshotAt: snapshot.time, completedAt: new Date().toISOString(), backup,
      release: env.PRODUCTION_RELEASE_SHA!, operationsCommit: env.GITHUB_SHA!, source: verified.identity, target: RESTORE_TARGET,
      authExcluded: Object.keys(AUTH_COLUMNS), expected, artifacts, media, sequenceSql, timings: { backupMs: Date.now() - started, mediaMs } };
    phase = "MANIFEST_UPLOAD";
    const bytes = Buffer.from(JSON.stringify(manifest)); await store.upload(uploadPlan.manifest.name, bytes, uploadPlan.manifest.position);
    // An anonymous request must not be able to obtain the private manifest.
    phase = "ANONYMOUS_READBACK";
    const anonymous = await fetch(`https://${env.BACKUP_PRIVATE_BLOB_HOST}/${key}/manifest.json`, { redirect: "error", signal: AbortSignal.timeout(30000) });
    requireCondition([401, 403, 404].includes(anonymous.status), "PRIVATE_ANONYMOUS_ACCESS_NOT_REJECTED");
    return { key, manifestSha256: sha256(bytes), bytes: artifacts.reduce((n, a) => n + a.bytes, 0), snapshotAt: snapshot.time, backup,
      ...manifest.timings, authExcluded: true, privateReadback: "verified", restore: "required-reviewer-pending",
      oidc: store.oidcDiagnostics() };
  } catch (error) { throw backupPhaseError(error, phase); }
  finally {
    store.emitOidcDiagnostics();
    session.close();
    try { await rm(directory, { recursive: true, force: true }); }
    catch (error) { throw backupPhaseError(error, "CLEANUP"); }
  }
}
