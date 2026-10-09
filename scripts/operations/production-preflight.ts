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
export const MIGRATION_PRIVILEGES_SQL = `SELECT
  to_regclass('pubquiz._prisma_migrations') IS NOT NULL AS relation_exists,
  has_schema_privilege(current_user, 'pubquiz', 'USAGE') AS schema_usage,
  has_table_privilege(current_user, to_regclass('pubquiz._prisma_migrations'), 'SELECT') AS can_select,
  has_table_privilege(current_user, to_regclass('pubquiz._prisma_migrations'), 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') AS can_write,
  EXISTS (SELECT 1 FROM pg_roles WHERE rolname=current_user AND
    (rolsuper OR rolcreaterole OR rolcreatedb OR rolreplication OR rolbypassrls)) AS elevated_role,
  EXISTS (SELECT 1 FROM pg_roles WHERE rolname<>current_user AND pg_has_role(current_user,oid,'MEMBER')) AS role_membership,
  EXISTS (SELECT 1 FROM pg_class WHERE oid=to_regclass('pubquiz._prisma_migrations')
    AND pg_has_role(current_user,relowner,'USAGE')) AS owns_relation`;
export type MigrationPrivileges = { relation_exists: boolean; schema_usage: boolean; can_select: boolean;
  can_write: boolean; elevated_role: boolean; role_membership: boolean; owns_relation: boolean };
export function assessMigrationPrivileges(proof: MigrationPrivileges | undefined): Gate {
  if (!proof || proof.relation_exists !== true || proof.schema_usage !== true) return gate('BLOCKED','MIGRATION_RELATION_UNVERIFIED');
  if (proof.can_select !== true) return gate('BLOCKED','DATABASE_SELECT_PERMISSION_MISSING');
  if ([proof.can_write,proof.elevated_role,proof.role_membership,proof.owns_relation].some(value=>value!==false))
    return gate('BLOCKED','DATABASE_READER_PRIVILEGES_REJECTED');
  return gate('PASS','DATABASE_READER_PRIVILEGES_CONFIRMED');
}
export const DATABASE_READ_QUERIES = [
  "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY",
  "SET LOCAL statement_timeout='30s'",
  "SELECT current_user AS role, current_database() AS database, current_setting('transaction_read_only') AS read_only",
  MIGRATION_PRIVILEGES_SQL,
  "SELECT migration_name, checksum, finished_at, rolled_back_at FROM pubquiz._prisma_migrations ORDER BY migration_name, started_at",
] as const;
export async function readMigrationSession(client: Pick<Client, "query">, candidate: Migration[], baseline: Migration[], expectedRole = "pubquiz_backup_reader", expectedDatabase = "neondb") {
  try {
    await client.query(DATABASE_READ_QUERIES[0]);
    await client.query(DATABASE_READ_QUERIES[1]);
    const session = (await client.query(DATABASE_READ_QUERIES[2])).rows[0];
    if (session?.read_only !== "on" || session.role !== expectedRole || session.database !== expectedDatabase) return { gate: gate("BLOCKED", "DATABASE_SESSION_UNVERIFIED") };
    const privileges = (await client.query(DATABASE_READ_QUERIES[3])).rows[0] as MigrationPrivileges | undefined;
    const privilegesGate = assessMigrationPrivileges(privileges);
    if (privilegesGate.status !== 'PASS') return { gate: privilegesGate, privileges };
    const rows = (await client.query(DATABASE_READ_QUERIES[4])).rows as Applied[];
    return { ...assessMigrations(candidate, baseline, rows), privileges, privilegesGate, identity: { role: session.role, database: session.database, readOnly: true } };
  } catch (error) { return { gate: gate("BLOCKED", (error as { code?: string }).code === "42501" ? "DATABASE_SELECT_PERMISSION_MISSING" : "MIGRATION_STATUS_UNAVAILABLE") }; }
  finally { await client.query("ROLLBACK").catch(() => undefined); }
}
export async function readProductionMigrations(connectionString: string, candidate: Migration[], baseline: Migration[]) {
  let identity;
  try { identity = assertDatabase(connectionString, "production"); assertOperationTransport(new URL(connectionString)); }
  catch { return { gate: gate("BLOCKED", "DATABASE_IDENTITY_OR_TRANSPORT_UNVERIFIED") }; }
  const client = new Client({ connectionString });
  try { await client.connect(); return { ...await readMigrationSession(client, candidate, baseline), endpointIdentity: identity }; }
  catch { return { gate: gate("BLOCKED", "DATABASE_CONNECTION_UNAVAILABLE") }; }
  finally { await client.end().catch(() => undefined); }
}
type Json = Record<string, unknown>;
const object = (value: unknown): Json => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Json : {};
export async function readProductionDeployment(input: { token: string; project: string; team: string; alias: string; expectedSha: string }, request: typeof fetch = fetch) {
  const gates: Gate[] = [];
  const finish = () => ({ gate: gates.find(g=>g.status==='FAIL') ?? gates.find(g=>g.status==='BLOCKED') ?? gate('PASS','PRODUCTION_SHA_ALIAS_CONFIRMED'), gates });
  const check = (code:string, value:unknown, expected:unknown, valid:(value:unknown)=>boolean) => {
    gates.push(gate(!valid(value) ? 'BLOCKED' : value===expected ? 'PASS' : 'FAIL', !valid(value) ? `${code}_MISSING` : value===expected ? `${code}_CONFIRMED` : `${code}_MISMATCH`));
  };
  const string = (v:unknown)=>typeof v==='string' && v.length>0;
  const deploymentId = (v:unknown)=>typeof v==='string' && /^dpl_[a-zA-Z0-9]+$/.test(v);
  const shaValue = (v:unknown)=>typeof v==='string' && /^[a-f0-9]{40}$/.test(v);
  if (!input.token || !/^prj_[a-zA-Z0-9]+$/.test(input.project) || !/^team_[a-zA-Z0-9]+$/.test(input.team) ||
      !/^[a-zA-Z0-9.-]+$/.test(input.alias) || !shaValue(input.expectedSha)) return { gate: gate('BLOCKED','DEPLOYMENT_INPUT_UNVERIFIED'), gates:[gate('BLOCKED','DEPLOYMENT_INPUT_UNVERIFIED')] };
  const get = async (path:string, endpoint:string):Promise<Json> => {
    let response:Response;
    try { response=await request(`https://api.vercel.com${path}?teamId=${encodeURIComponent(input.team)}`, {
      method:'GET',redirect:'error',headers:{Authorization:`Bearer ${input.token}`},signal:AbortSignal.timeout(30000) }); }
    catch { gates.push(gate('BLOCKED',`${endpoint}_API_NETWORK_ERROR`));throw new Error('SAFE_API_ERROR'); }
    if (!response.ok) { gates.push(gate('BLOCKED',`${endpoint}_API_${response.status===401||response.status===403?'PERMISSION_DENIED':response.status===404?'NOT_FOUND':'HTTP_ERROR'}`));throw new Error('SAFE_API_ERROR'); }
    try { const json:unknown=await response.json();if (json===null || typeof json!=='object' || Array.isArray(json)) throw new Error('INVALID');
      gates.push(gate('PASS',`${endpoint}_API_CONFIRMED`));return json as Json; }
    catch { gates.push(gate('BLOCKED',`${endpoint}_API_RESPONSE_INVALID`));throw new Error('SAFE_API_ERROR'); }
  };
  try {
    const alias=await get(`/v4/aliases/${encodeURIComponent(input.alias)}`,'ALIAS');
    const id=object(alias.deployment).id ?? alias.deploymentId;
    check('ALIAS_HOST',alias.alias,input.alias,string);
    check('ALIAS_PROJECT',alias.projectId,input.project,string);
    gates.push(gate(deploymentId(id)?'PASS':'BLOCKED',deploymentId(id)?'ALIAS_DEPLOYMENT_ID_CONFIRMED':'ALIAS_DEPLOYMENT_ID_MISSING'));
    if (alias.deploymentId!==undefined && object(alias.deployment).id!==undefined) check('ALIAS_DEPLOYMENT_IDS',alias.deploymentId,object(alias.deployment).id,deploymentId);
    gates.push(gate(alias.redirect || alias.deletedAt ? 'FAIL':'PASS',alias.redirect || alias.deletedAt?'ALIAS_REDIRECT_OR_DELETED':'ALIAS_ACTIVE_CONFIRMED'));
    if (!deploymentId(id)) return finish();
    const project=await get(`/v9/projects/${input.project}`,'PROJECT');
    const deployment=await get(`/v13/deployments/${id}`,'DEPLOYMENT');
    check('PROJECT_ID',project.id,input.project,string);
    check('PROJECT_PRODUCTION_DEPLOYMENT_ID',object(object(project.targets).production).id,id,deploymentId);
    check('DEPLOYMENT_ID',deployment.id,id,deploymentId);
    // Alias and project response establish project ownership; optional deployment projectId must never contradict them.
    if (deployment.projectId!==undefined) check('DEPLOYMENT_PROJECT',deployment.projectId,input.project,string);
    check('DEPLOYMENT_ENVIRONMENT',deployment.target,'production',string);
    check('DEPLOYMENT_STATE',deployment.readyState,'READY',string);
    const meta=object(deployment.meta),source=object(deployment.gitSource);
    const sha=meta.githubCommitSha ?? source.sha;
    check('DEPLOYMENT_SHA',sha,input.expectedSha,shaValue);
    if (meta.githubCommitSha!==undefined && source.sha!==undefined) check('DEPLOYMENT_SHA_SOURCES',source.sha,meta.githubCommitSha,shaValue);
    const recheck=await get(`/v4/aliases/${encodeURIComponent(input.alias)}`,'ALIAS_RECHECK');
    check('ALIAS_RECHECK_HOST',recheck.alias,input.alias,string);
    check('ALIAS_RECHECK_PROJECT',recheck.projectId,input.project,string);
    check('ALIAS_RECHECK_DEPLOYMENT_ID',object(recheck.deployment).id ?? recheck.deploymentId,id,deploymentId);
    gates.push(gate(recheck.redirect || recheck.deletedAt?'FAIL':'PASS',recheck.redirect || recheck.deletedAt?'ALIAS_RECHECK_REDIRECT_OR_DELETED':'ALIAS_RECHECK_ACTIVE_CONFIRMED'));
    // Only validated identifiers enter the public artifact; never raw API fields or arbitrary strings.
    return { ...finish(), deploymentId: deploymentId(id)?id:undefined, sha:shaValue(sha)?sha:undefined, alias:input.alias,
      state:deployment.readyState==='READY'?'READY':undefined };
  } catch {
    if (!gates.some(g=>g.status==='BLOCKED'||g.status==='FAIL')) gates.push(gate('BLOCKED','DEPLOYMENT_DIAGNOSTIC_UNAVAILABLE'));
    return finish();
  }
}
export function assertPreflightContext(env: Readonly<Record<string, string | undefined>>) {
  if (env.GITHUB_ACTIONS !== "true" || env.GITHUB_REPOSITORY !== "justphilgud/pubquiz-web" || env.GITHUB_REF !== "refs/heads/main" ||
      env.GITHUB_EVENT_NAME !== "workflow_dispatch" || env.GITHUB_WORKFLOW_REF !== "justphilgud/pubquiz-web/.github/workflows/production-read-only-preflight.yml@refs/heads/main") throw new Error("PREFLIGHT_CONTEXT_UNVERIFIED");
}
