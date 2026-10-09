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
export function assertPrismaModelConfiguration(schema: string) {
  const datasource=schema.match(/datasource\s+db\s*\{([^}]+)\}/)?.[1];
  if (!datasource || !/provider\s*=\s*"postgresql"/.test(datasource) || !/schemas\s*=\s*\[\s*"pubquiz"\s*\]/.test(datasource)) throw new Error('PRISMA_SCHEMA_CONFIGURATION_UNVERIFIED');
}
export function migrationFiles(sha: string): Migration[] {
  if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error("INVALID_SHA");
  assertPrismaModelConfiguration(execFileSync('git',['show',`${sha}:prisma/schema.prisma`],{encoding:'utf8'}));
  const names = execFileSync("git", ["ls-tree", "-r", "--name-only", sha, "prisma/migrations"], { encoding: "utf8" }).trim().split("\n");
  const files = names.filter(path => /^prisma\/migrations\/[a-zA-Z0-9_-]+\/migration\.sql$/.test(path));
  if (!files.length) throw new Error("MIGRATION_MANIFEST_UNAVAILABLE");
  return files.map(path => ({ name: path.split("/")[2], checksum: createHash("sha256").update(execFileSync("git", ["show", `${sha}:${path}`])).digest("hex") }));
}
export const MIGRATION_CATALOG_SQL = `SELECT current_setting('search_path') AS search_path,
  ARRAY(SELECT nspname::text FROM pg_namespace WHERE nspname !~ '^pg_' AND nspname <> 'information_schema' ORDER BY nspname) AS schemas,
  ARRAY(SELECT n.nspname::text FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE c.relname='_prisma_migrations' AND c.relkind IN ('r','p') ORDER BY n.nspname) AS migration_schemas`;
// Catalog diagnosis never chooses a relation or reads migration contents.
export const PUBLIC_MIGRATION_PRIVILEGES_SQL = `SELECT
  to_regclass('public._prisma_migrations') IS NOT NULL AS relation_exists,
  has_schema_privilege(current_user, 'public', 'USAGE') AS schema_usage,
  has_table_privilege(current_user, to_regclass('public._prisma_migrations'), 'SELECT') AS can_select,
  has_table_privilege(current_user, to_regclass('public._prisma_migrations'), 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') AS can_write,
  EXISTS (SELECT 1 FROM pg_roles WHERE rolname=current_user AND
    (rolsuper OR rolcreaterole OR rolcreatedb OR rolreplication OR rolbypassrls)) AS elevated_role,
  EXISTS (SELECT 1 FROM pg_roles WHERE rolname<>current_user AND pg_has_role(current_user,oid,'MEMBER')) AS role_membership,
  EXISTS (SELECT 1 FROM pg_class WHERE oid=to_regclass('public._prisma_migrations')
    AND pg_has_role(current_user,relowner,'USAGE')) AS owns_relation`;
export const MIGRATION_PRIVILEGES_SQL = PUBLIC_MIGRATION_PRIVILEGES_SQL;
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
  "SELECT migration_name, checksum, finished_at, rolled_back_at FROM public._prisma_migrations ORDER BY migration_name, started_at",
] as const;
export async function readMigrationSession(client: Pick<Client, "query">, candidate: Migration[], baseline: Migration[], expectedRole = "pubquiz_backup_reader", expectedDatabase = "neondb") {
  try {
    await client.query(DATABASE_READ_QUERIES[0]);
    await client.query(DATABASE_READ_QUERIES[1]);
    const session = (await client.query(DATABASE_READ_QUERIES[2])).rows[0];
    if (session?.read_only !== "on" || session.role !== expectedRole || session.database !== expectedDatabase) return { gate: gate("BLOCKED", "DATABASE_SESSION_UNVERIFIED") };
    const catalogRow = (await client.query(MIGRATION_CATALOG_SQL)).rows[0];
    const safeNames = (value: unknown): string[] | undefined => Array.isArray(value) && value.every(name=>typeof name==='string' && /^[a-zA-Z_][a-zA-Z0-9_$]{0,62}$/.test(name)) ? value : undefined;
    const schemas=safeNames(catalogRow?.schemas), migrationSchemas=safeNames(catalogRow?.migration_schemas);
    if (!schemas || !migrationSchemas || typeof catalogRow?.search_path !== 'string' || !/^[a-zA-Z0-9_$", .]+$/.test(catalogRow.search_path)) return {gate:gate('BLOCKED','MIGRATION_CATALOG_UNVERIFIED')};
    const diagnosis={searchPath:catalogRow.search_path,schemas,migrationSchemas,
      identity:{role:session.role,database:session.database,readOnly:true}};
    if (migrationSchemas.length!==1 || migrationSchemas[0]!=='public' || !schemas.includes('pubquiz')) return {gate:gate('BLOCKED','MIGRATION_SCHEMA_BINDING_UNVERIFIED'),diagnosis};
    const publicPrivileges=(await client.query(MIGRATION_PRIVILEGES_SQL)).rows[0] as MigrationPrivileges | undefined;
    const privileges=publicPrivileges;
    const privilegesGate = assessMigrationPrivileges(privileges);
    if (privilegesGate.status !== 'PASS') return { gate: privilegesGate, privileges, diagnosis };
    const rows = (await client.query(DATABASE_READ_QUERIES[4])).rows as Applied[];
    return { ...assessMigrations(candidate, baseline, rows), privileges, privilegesGate, diagnosis, identity: { role: session.role, database: session.database, readOnly: true } };
  } catch (error) { return { gate: gate("BLOCKED", (error as { code?: string }).code === "42501" ? "DATABASE_SELECT_PERMISSION_MISSING" : "MIGRATION_STATUS_UNAVAILABLE") }; }
  finally { await client.query("ROLLBACK").catch(() => undefined); }
}
export async function readProductionMigrations(connectionString: string, candidate: Migration[], baseline: Migration[]) {
  let identity;
  try { identity = assertDatabase(connectionString, "production"); assertOperationTransport(new URL(connectionString)); }
  catch { return { gate: gate("BLOCKED", "DATABASE_IDENTITY_OR_TRANSPORT_UNVERIFIED") }; }
  const client = new Client({ connectionString });
  try { await client.connect(); return { ...await readMigrationSession(client, candidate, baseline), endpointIdentity: identity, connectionSchemaParameter:new URL(connectionString).searchParams.get("schema") ?? null }; }
  catch { return { gate: gate("BLOCKED", "DATABASE_CONNECTION_UNAVAILABLE") }; }
  finally { await client.end().catch(() => undefined); }
}
export const APPROVED_ROLLBACK = Object.freeze({
  project:'prj_9Nnwer6B43P0nfrOZPIEygFWg666',team:'team_BE4XNxNRwsaEnSb9N8FFvWEH',alias:'pubquiz-web.vercel.app',
  publicId:'dpl_Hr5Dji8br1THcwJdf79rLaLrz3SD',publicSha:'2258c182e68c40a54fbdc4f0a855c9a7306d1a10',
  targetId:'dpl_9CkTLdWXqJLcM3cdcT2S8UDZw54o',targetSha:'e6faf92eee0465808bfbcaa5ddfe08cc1b45a066',
  rollbackFrom:'dpl_9fTFdUSaL253rDDhQPfDJ6uzRPaV',rollbackAt:1791153618367,aliasAssignedAt:1791278176618,
});
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
    try { response=await request(`https://api.vercel.com${path}${path.includes('?')?'&':'?'}teamId=${encodeURIComponent(input.team)}`, {
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
    const targetId=object(object(project.targets).production).id;
    if (!deploymentId(targetId)) { gates.push(gate('BLOCKED','PROJECT_PRODUCTION_DEPLOYMENT_ID_MISSING'));return finish(); }
    const rollbackMismatch=targetId!==id;
    if (!rollbackMismatch) check('PROJECT_PRODUCTION_DEPLOYMENT_ID',targetId,id,deploymentId);
    check('DEPLOYMENT_ID',deployment.id,id,deploymentId);
    // Alias and project response establish project ownership; optional deployment projectId must never contradict them.
    if (deployment.projectId!==undefined) check('DEPLOYMENT_PROJECT',deployment.projectId,input.project,string);
    check('DEPLOYMENT_ENVIRONMENT',deployment.target,'production',string);
    check('DEPLOYMENT_STATE',deployment.readyState,'READY',string);
    const meta=object(deployment.meta),source=object(deployment.gitSource);
    const sha=meta.githubCommitSha ?? source.sha;
    check('DEPLOYMENT_SHA',sha,input.expectedSha,shaValue);
    if (meta.githubCommitSha!==undefined && source.sha!==undefined) check('DEPLOYMENT_SHA_SOURCES',source.sha,meta.githubCommitSha,shaValue);
    if (rollbackMismatch) {
      const approved=APPROVED_ROLLBACK;
      const exact=id===approved.publicId && targetId===approved.targetId && sha===approved.publicSha &&
        input.expectedSha===approved.publicSha && input.project===approved.project && input.team===approved.team && input.alias===approved.alias;
      if (!exact) { gates.push(gate('FAIL','UNAPPROVED_PRODUCTION_TARGET_DRIFT'));return finish(); }
      gates.push(gate('PASS','APPROVED_ROLLBACK_PAIR_CONFIRMED'));
      check('ROLLBACK_PUBLIC_PROJECT',deployment.projectId,approved.project,string);
      check('ROLLBACK_AUTO_ASSIGN',project.autoAssignCustomDomains,false,v=>typeof v==='boolean');
      const target=await get(`/v13/deployments/${approved.targetId}`,'ROLLBACK_TARGET');
      check('ROLLBACK_TARGET_ID',target.id,approved.targetId,deploymentId);
      check('ROLLBACK_TARGET_PROJECT',target.projectId,approved.project,string);
      check('ROLLBACK_TARGET_ENVIRONMENT',target.target,'production',string);
      check('ROLLBACK_TARGET_STATE',target.readyState,'READY',string);
      const targetMeta=object(target.meta),targetSource=object(target.gitSource),targetSha=targetMeta.githubCommitSha ?? targetSource.sha;
      check('ROLLBACK_TARGET_SHA',targetSha,approved.targetSha,shaValue);
      if (targetMeta.githubCommitSha!==undefined && targetSource.sha!==undefined) check('ROLLBACK_TARGET_SHA_SOURCES',targetSource.sha,targetMeta.githubCommitSha,shaValue);
      const history=await get(`/v3/events?projectIds=${approved.project}&since=2026-10-04T22%3A39%3A00.000Z&until=2026-10-06T09%3A17%3A00.000Z&limit=100&withPayload=true`,'ROLLBACK_HISTORY');
      const events=Array.isArray(history.events)?history.events.map(object):[];
      const rollback=events.some(event=>event.type==='instant-rollback-created' && event.createdAt===approved.rollbackAt &&
        object(event.payload).projectId===approved.project && object(event.payload).fromDeploymentId===approved.rollbackFrom && object(event.payload).toDeploymentId===approved.targetId);
      const assignment=events.some(event=>event.type==='aliases-assigned' && event.createdAt===approved.aliasAssignedAt &&
        object(event.payload).projectId===approved.project && object(object(event.payload).deployment).id===approved.publicId);
      gates.push(gate(rollback?'PASS':'BLOCKED',rollback?'ROLLBACK_EVENT_CONFIRMED':'ROLLBACK_EVENT_MISSING'));
      gates.push(gate(assignment?'PASS':'BLOCKED',assignment?'ROLLBACK_ALIAS_HISTORY_CONFIRMED':'ROLLBACK_ALIAS_HISTORY_MISSING'));
      const projectRecheck=await get(`/v9/projects/${input.project}`,'ROLLBACK_PROJECT_RECHECK');
      check('ROLLBACK_PROJECT_RECHECK_ID',projectRecheck.id,approved.project,string);
      check('ROLLBACK_PROJECT_RECHECK_TARGET',object(object(projectRecheck.targets).production).id,approved.targetId,deploymentId);
      check('ROLLBACK_PROJECT_RECHECK_AUTO_ASSIGN',projectRecheck.autoAssignCustomDomains,false,v=>typeof v==='boolean');
    }
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

