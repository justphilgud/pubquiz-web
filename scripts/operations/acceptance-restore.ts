import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assertRestoreAcceptance, pinnedRestoreConnection, RESTORE_TARGET, type Environment } from "./acceptance-policy";
import { requireCondition } from "./guards";
import { libpqEnvironment } from "./libpq";
import { PgSession, pgTool, toolsVersion } from "./pg-session";
import { authInsertSql, collectSnapshot, compareSnapshots, sha256 } from "./snapshot";
import { artifactName, backupKey, PrivateArtifacts, verifyMediaFiles } from "./private-artifacts";
import type { AcceptanceManifest } from "./acceptance-backup";
import { validateBackupMetadata } from "./backup-metadata";
import { formatQuizPoints } from "../../app/quiz/formatQuizPoints";
import { rankScores } from "../../app/rendering/presentation/presentationRankingPolicy";

export function parseManifest(bytes: Buffer, expectedSha: string, key: string): AcceptanceManifest {
  requireCondition(/^[a-f0-9]{64}$/.test(expectedSha) && sha256(bytes) === expectedSha, "MANIFEST_CHECKSUM_MISMATCH");
  const m = JSON.parse(bytes.toString("utf8")) as AcceptanceManifest;
  const legacy = m.version === 2 && m.mode === "ap94-manual" && m.backup === undefined;
  const current = m.version === 3 && m.mode === "production-backup" && !!m.backup;
  requireCondition((legacy || current) && m.key === backupKey(key) &&
    JSON.stringify(m.target) === JSON.stringify(RESTORE_TARGET), "MANIFEST_IDENTITY_MISMATCH");
  if (current) validateBackupMetadata(m.backup);
  requireCondition(m.source.host === "ep-dawn-paper-alws45vx.c-3.eu-central-1.aws.neon.tech" && m.source.name === "neondb" &&
    m.source.schema === "pubquiz" && /^[a-f0-9]{40}$/.test(m.release), "MANIFEST_SOURCE_MISMATCH");
  requireCondition(m.authExcluded.slice().sort().join() === "pubquiz.teams.team_passwort,pubquiz.users.password_hash", "MANIFEST_AUTH_POLICY_MISMATCH");
  requireCondition(Array.isArray(m.artifacts) && m.artifacts.length >= 2 && m.artifacts.length <= 2048, "MANIFEST_ARTIFACTS_INVALID");
  const names = m.artifacts.map(a => artifactName(a.name));
  requireCondition(new Set(names).size === names.length && names.includes("database.dump") && names.includes("auth-redacted.json") &&
    m.media.every(a => names.includes(a.name)) && m.expected.media.join() === m.media.map(a => a.url).join(), "MANIFEST_INCOMPLETE");
  requireCondition(Number.isFinite(Date.parse(m.snapshotAt)) && Date.parse(m.completedAt) >= Date.parse(m.snapshotAt), "MANIFEST_TIMES_INVALID");
  return m;
}
export const EMPTY_TARGET_SQL = `SELECT pg_advisory_xact_lock(940914);
DO $ap94$ BEGIN
 IF current_database() <> 'neondb' OR current_user <> 'neondb_owner' THEN RAISE EXCEPTION 'RESTORE_IDENTITY'; END IF;
 IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname <> 'information_schema' AND c.relkind IN ('r','p','v','m','S','f'))
 OR EXISTS(SELECT 1 FROM pg_namespace WHERE nspname NOT IN ('public','information_schema') AND nspname NOT LIKE 'pg_%')
 THEN RAISE EXCEPTION 'RESTORE_TARGET_NOT_EMPTY'; END IF;
END $ap94$;
DROP SCHEMA public;`;

export function restoreSql(directory: string, auth: Record<string, string>, manifest: Pick<AcceptanceManifest, "expected">, env: Environment) {
  const args = ["--no-owner", "--no-acl", "--file=-", join(directory, "database.dump")];
  const toolEnv = { PATH: env.PATH, SystemRoot: env.SystemRoot };
  const pre = pgTool("pg_restore", ["--section=pre-data", ...args], toolEnv);
  const data = pgTool("pg_restore", ["--section=data", ...args], toolEnv);
  const post = pgTool("pg_restore", ["--section=post-data", ...args], toolEnv);
  requireCondition(!/COPY "?pubquiz"?\."?(users|teams)"?\s*\(/.test(data), "AUTH_TABLE_DATA_IN_DUMP");
  return `${EMPTY_TARGET_SQL}\n${pre}\n${data}\nSET standard_conforming_strings=on;\n${authInsertSql(auth, manifest.expected.columns)}\n${post}`;
}
export async function acceptanceRestore(env: Environment) {
  assertRestoreAcceptance(env); const connection = pinnedRestoreConnection(env); toolsVersion(env);
  const store = new PrivateArtifacts(env, env.AP94_BACKUP_KEY ?? "", "restore");
  const manifest = parseManifest(await store.read("manifest.json"), env.AP94_MANIFEST_SHA256 ?? "", store.key);
  const directory = await mkdtemp(join(tmpdir(), "pubquiz-ap94-restore-"));
  try {
    for (const artifact of manifest.artifacts) await store.download(artifact, directory);
    const media = await verifyMediaFiles(manifest.media, directory);
    const auth = JSON.parse(await readFile(join(directory, "auth-redacted.json"), "utf8")) as Record<string, string>;
    const sql = restoreSql(directory, auth, manifest, env);
    const probe = new PgSession(connection, env);
    try {
      const identity = await probe.json<{ role: string; db: string; major: number }>("SELECT json_build_object('role',current_user,'db',current_database(),'major',current_setting('server_version_num')::int/10000)");
      requireCondition(identity.role === RESTORE_TARGET.role && identity.db === RESTORE_TARGET.database && identity.major === RESTORE_TARGET.major, "RESTORE_SESSION_IDENTITY_MISMATCH");
    } finally { probe.close(); }
    const started = Date.now();
    // The only write connection: hard-pinned again at the call site. No caller-supplied
    // arbitrary target env or SQL path; psql owns one transaction including the empty guard.
    const writeEnv = libpqEnvironment(pinnedRestoreConnection(env), env);
    writeEnv.PGOPTIONS = "-c default_transaction_read_only=off -c statement_timeout=600000";
    pgTool("psql", ["-X", "-w", "-q", "-v", "ON_ERROR_STOP=1", "--single-transaction", "--file=-"], writeEnv, sql);
    const restoreMs = Date.now() - started; const validateStart = Date.now();
    const session = new PgSession(connection, env);
    let smoke: { quizResults: number; formattedResults: number };
    try {
      await session.sql("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; SET LOCAL search_path=pg_catalog; SET LOCAL TIME ZONE 'UTC'; SET LOCAL DateStyle='ISO, YMD'");
      const actual = await collectSnapshot(session); compareSnapshots(manifest.expected, actual);
      // Auth values MUST remain the inert placeholders after actual restoration.
      const authCount = await session.json<number>("SELECT ((SELECT count(*) FROM pubquiz.users WHERE password_hash <> '') + (SELECT count(*) FROM pubquiz.teams WHERE team_passwort IS NOT NULL))::int");
      requireCondition(authCount === 0, "RESTORED_AUTH_VALUES_PRESENT");
      for (const line of manifest.sequenceSql) {
        const match = /^SELECT pg_catalog\.setval\('((?:"?[A-Za-z_][A-Za-z0-9_]*"?\.)"?[A-Za-z_][A-Za-z0-9_]*"?)', (-?\d+), (true|false)\);$/.exec(line);
        requireCondition(match && /^"?(public|pubquiz)"?\./.test(match[1]), "SEQUENCE_EVIDENCE_INVALID");
        const value = await session.json<{ value: string; called: boolean }>(`SELECT json_build_object('value',last_value::text,'called',is_called) FROM ${match[1]}`);
        requireCondition(value.value === match[2] && value.called === (match[3] === "true"), "SEQUENCE_STATE_MISMATCH");
      }
      let formattedResults = 0;
      for (const value of actual.resultRows) {
        const row = JSON.parse(value) as { final_points: string };
        requireCondition(Number.isFinite(Number(row.final_points)) && !!formatQuizPoints(Number(row.final_points)), "APPLICATION_POINTS_SMOKE_FAILED"); formattedResults++;
      }
      const rank = (rows: string[]) => {
        const grouped = new Map<number, { teamId: number; punkte: number }[]>();
        for (const value of rows) {
          const r = JSON.parse(value) as { quiz_id: number; team_id: number; final_points: string };
          grouped.set(r.quiz_id, [...(grouped.get(r.quiz_id) ?? []), { teamId: r.team_id, punkte: Number(r.final_points) }]);
        }
        return [...grouped].map(([id, scores]) => [id, rankScores(scores)]);
      };
      requireCondition(JSON.stringify(rank(manifest.expected.resultRows)) === JSON.stringify(rank(actual.resultRows)), "APPLICATION_RANKING_MISMATCH");
      smoke = { quizResults: actual.resultRows.length, formattedResults };
      await session.sql("COMMIT");
    } finally { session.close(); }
    const evidence = { version: 1, key: store.key, target: RESTORE_TARGET, completedAt: new Date().toISOString(),
      restoreMs, validationMs: Date.now() - validateStart, ...media, ...smoke,
      schemaTablesConstraintsSequencesMigrationsCountsSamples: "matched", authenticationValues: "excluded",
      resultReconstruction: "persisted-final-points-and-ranking-matched", applicationSmoke: "domain-points-formatter-and-ranking",
      browserSmoke: "not-executed", snapshotAt: manifest.snapshotAt,
      snapshotAgeAtRestoreMs: started - Date.parse(manifest.snapshotAt),
      measuredRecoveryMs: Date.now() - started, deletionEnabled: false };
    await writeFile(join(directory, "validation.json"), JSON.stringify(evidence), { mode: 0o600 });
    // Restore is read-only in Blob. Evidence is returned to the protected GitHub run.
    return evidence;
  } finally { await rm(directory, { recursive: true, force: true }); }
}
