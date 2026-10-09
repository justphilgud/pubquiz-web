import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { Client } from "pg";
import { assertDatabase, assertOperationTransport } from "./guards";

export type Gate = { status: "PASS" | "BLOCKED" | "FAIL"; code: string };
export type Migration = { name: string; checksum: string };
export type Applied = { migration_name: string; checksum: string; finished_at: unknown; rolled_back_at: unknown };
export const gate = (status: Gate["status"], code: string): Gate => ({ status, code });
export function assessMigrations(candidate: Migration[], baseline: Migration[], applied: Applied[]) {
  const completed = applied.filter(row => row.finished_at && !row.rolled_back_at);
  const failed = applied.filter(row => !row.finished_at && !row.rolled_back_at).map(row => row.migration_name);
  const completedNames = new Set(completed.map(row => row.migration_name));
  const baselineNames = new Set(baseline.map(row => row.name));
  const expected = candidate.filter(row => !baselineNames.has(row.name)).map(row => row.name);
  const pending = candidate.filter(row => !completedNames.has(row.name)).map(row => row.name);
  const drift = completed.filter(row => !candidate.some(file => file.name === row.migration_name && file.checksum === row.checksum)).map(row => row.migration_name);
  const baselineDrift = baseline.filter(row => !candidate.some(file => file.name === row.name && file.checksum === row.checksum)).map(row => row.name);
  const unexpected = pending.filter(name => !expected.includes(name));
  return { applied: completed.map(row => row.migration_name), failed, expected, pending, drift, baselineDrift,
    gate: gate(failed.length || drift.length || baselineDrift.length || unexpected.length ? "FAIL" : "PASS",
      failed.length ? "FAILED_MIGRATION" : drift.length || baselineDrift.length ? "MIGRATION_DRIFT" : unexpected.length ? "UNEXPECTED_PENDING_MIGRATION" : "MIGRATIONS_CONFIRMED") };
}
export function migrationFiles(sha: string): Migration[] {
  if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error("INVALID_SHA");
  const names = execFileSync("git", ["ls-tree", "-r", "--name-only", sha, "prisma/migrations"], { encoding: "utf8" }).trim().split("\n");
  const files = names.filter(path => /^prisma\/migrations\/[a-zA-Z0-9_-]+\/migration\.sql$/.test(path));
  if (!files.length) throw new Error("MIGRATION_MANIFEST_UNAVAILABLE");
  return files.map(path => ({ name: path.split("/")[2], checksum: createHash("sha256").update(execFileSync("git", ["show", `${sha}:${path}`])).digest("hex") }));
}
export const DATABASE_READ_QUERIES = [
  "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY",
  "SET LOCAL statement_timeout='30s'",
  "SELECT current_user AS role, current_database() AS database, current_setting('transaction_read_only') AS read_only",
  "SELECT migration_name, checksum, finished_at, rolled_back_at FROM pubquiz._prisma_migrations ORDER BY migration_name, started_at",
] as const;
export async function readMigrationSession(client: Pick<Client, "query">, candidate: Migration[], baseline: Migration[], expectedRole = "pubquiz_backup_reader", expectedDatabase = "neondb") {
  try {
    await client.query(DATABASE_READ_QUERIES[0]);
    await client.query(DATABASE_READ_QUERIES[1]);
    const session = (await client.query(DATABASE_READ_QUERIES[2])).rows[0];
    if (session?.read_only !== "on" || session.role !== expectedRole || session.database !== expectedDatabase) return { gate: gate("BLOCKED", "DATABASE_SESSION_UNVERIFIED") };
    const rows = (await client.query(DATABASE_READ_QUERIES[3])).rows as Applied[];
    return { ...assessMigrations(candidate, baseline, rows), identity: { role: session.role, database: session.database, readOnly: true } };
  } catch { return { gate: gate("BLOCKED", "MIGRATION_STATUS_UNAVAILABLE") }; }
  finally { await client.query("ROLLBACK").catch(() => undefined); }
}
export async function readProductionMigrations(connectionString: string, candidate: Migration[], baseline: Migration[]) {
  try { assertDatabase(connectionString, "production"); assertOperationTransport(new URL(connectionString)); }
  catch { return { gate: gate("BLOCKED", "DATABASE_IDENTITY_OR_TRANSPORT_UNVERIFIED") }; }
  const client = new Client({ connectionString });
  try { await client.connect(); return await readMigrationSession(client, candidate, baseline); }
  catch { return { gate: gate("BLOCKED", "DATABASE_CONNECTION_UNAVAILABLE") }; }
  finally { await client.end().catch(() => undefined); }
}
type Json = Record<string, unknown>;
export async function readProductionDeployment(input: { token: string; project: string; team: string; alias: string; expectedSha: string }, request: typeof fetch = fetch) {
  if (!input.token || !/^prj_[a-zA-Z0-9]+$/.test(input.project) || !/^team_[a-zA-Z0-9]+$/.test(input.team) ||
      !/^[a-zA-Z0-9.-]+$/.test(input.alias) || !/^[a-f0-9]{40}$/.test(input.expectedSha)) return { gate: gate("BLOCKED", "DEPLOYMENT_INPUT_UNVERIFIED") };
  const get = async (path: string): Promise<Json> => {
    const response = await request(`https://api.vercel.com${path}?teamId=${encodeURIComponent(input.team)}`, {
      method: "GET", redirect: "error", headers: { Authorization: `Bearer ${input.token}` }, signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error("METADATA_UNAVAILABLE");
    return await response.json() as Json;
  };
  try {
    const alias = await get(`/v4/aliases/${encodeURIComponent(input.alias)}`);
    const aliasDeployment = alias.deployment as Json | undefined;
    const id = aliasDeployment?.id ?? alias.deploymentId;
    if (typeof id !== "string" || !/^dpl_[a-zA-Z0-9]+$/.test(id)) return { gate: gate("BLOCKED", "ALIAS_BINDING_UNVERIFIED") };
    const project = await get(`/v9/projects/${input.project}`);
    const deployment = await get(`/v13/deployments/${id}`);
    const targets = project.targets as Json | undefined;
    const production = targets?.production as Json | undefined;
    const meta = deployment.meta as Json | undefined;
    const source = deployment.gitSource as Json | undefined;
    const sha = meta?.githubCommitSha ?? source?.sha;
    if (project.id !== input.project || production?.id !== id || deployment.id !== id ||
        (deployment.projectId !== undefined && deployment.projectId !== input.project) || alias.projectId !== input.project || alias.redirect || alias.deletedAt ||
        deployment.target !== "production" || deployment.readyState !== "READY" || alias.alias !== input.alias ||
        typeof sha !== "string" || !/^[a-f0-9]{40}$/.test(sha)) return { gate: gate("BLOCKED", "PRODUCTION_DEPLOYMENT_UNVERIFIED") };
    if (sha !== input.expectedSha || (source?.sha && source.sha !== sha)) return { gate: gate("BLOCKED", "UNEXPECTED_PRODUCTION_SHA") };
    // Resolve again after metadata reads: a concurrent promotion invalidates this proof.
    const recheck = await get(`/v4/aliases/${encodeURIComponent(input.alias)}`);
    if (((recheck.deployment as Json | undefined)?.id ?? recheck.deploymentId) !== id || recheck.projectId !== input.project || recheck.alias !== input.alias || recheck.redirect || recheck.deletedAt) return { gate: gate("BLOCKED", "ALIAS_CHANGED_DURING_PREFLIGHT") };
    return { gate: gate("PASS", "PRODUCTION_SHA_ALIAS_CONFIRMED"), deploymentId: id, sha, alias: input.alias, state: "READY" };
  } catch { return { gate: gate("BLOCKED", "VERCEL_METADATA_UNAVAILABLE") }; }
}
export function assertPreflightContext(env: Readonly<Record<string, string | undefined>>) {
  if (env.GITHUB_ACTIONS !== "true" || env.GITHUB_REPOSITORY !== "justphilgud/pubquiz-web" || env.GITHUB_REF !== "refs/heads/main" ||
      env.GITHUB_EVENT_NAME !== "workflow_dispatch" || env.GITHUB_WORKFLOW_REF !== "justphilgud/pubquiz-web/.github/workflows/production-read-only-preflight.yml@refs/heads/main") throw new Error("PREFLIGHT_CONTEXT_UNVERIFIED");
}
