import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { RESTORE_TARGET, pinnedRestoreConnection, assertRestoreAcceptance } from "./acceptance-policy";
import { temporaryRestoreTarget, temporaryRestoreConnection, temporaryDatabaseMarker, assertTemporaryDatabaseMarker, temporaryCleanupPlan } from "./temporary-restore-target";
import { temporaryEmptyTargetSql } from "./acceptance-restore";
import { needsApplicationDeployment } from "./deployment-scope";
const now = Date.parse("2026-10-09T20:00:00Z");
const id = "a".repeat(32);
const target = { version: 1 as const, id, project: RESTORE_TARGET.project, branch: RESTORE_TARGET.branch,
  endpoint: RESTORE_TARGET.endpoint, database: `ap94_restore_${id}`, createdAt: "2026-10-09T19:00:00Z",
  expiresAt: "2026-10-10T19:00:00Z", backupId: "production/acceptance/run-37971426600-1", manifestSha256: "b".repeat(64) };
const env = { RESTORE_TEMPORARY_TARGET: JSON.stringify(target), AP94_BACKUP_KEY: target.backupId, AP94_MANIFEST_SHA256: target.manifestSha256 };
test("temporary target binds exact isolated project, unique database, backup and bounded lease", () => {
  assert.deepEqual(temporaryRestoreTarget(env, now), target);
  for (const change of [{project:"sparkling-dust-66487393"}, {branch:"other"}, {endpoint:"ep-dawn-paper-alws45vx"},
    {database:"neondb"}, {database:"preview"}, {id:"../"}, {expiresAt:"2026-10-12T00:00:00Z"},
    {expiresAt:"2026-10-09T19:30:00Z"}, {createdAt:"2026-10-10T00:00:00Z"}, {backupId:"unknown"}, {password:"SECRET"}]) {
    assert.throws(() => temporaryRestoreTarget({...env,RESTORE_TEMPORARY_TARGET:JSON.stringify({...target,...change})},now));
  }
  assert.throws(() => temporaryRestoreTarget({...env,AP94_MANIFEST_SHA256:"f".repeat(64)},now));
  assert.throws(() => temporaryRestoreTarget({...env,RESTORE_TEMPORARY_TARGET:""},now));
});
test("existing pinned Nonprod transport reused without credential output or persistent destination", () => {
  const base = `postgresql://neondb_owner:SYNTHETIC_SECRET@${RESTORE_TARGET.host}/neondb?sslmode=require&channel_binding=require`;
  const pinned = pinnedRestoreConnection({RESTORE_TEST_DATABASE_URL:base,RESTORE_TEST_EXPECTED_HOST:RESTORE_TARGET.host});
  const url = new URL(temporaryRestoreConnection(pinned,target));
  assert.equal(url.pathname,`/${target.database}`); assert.equal(url.hostname,RESTORE_TARGET.host);
  assert.equal(url.searchParams.get("channel_binding"),"require");
  for (const host of ["ep-dawn-paper-alws45vx.c-3.eu-central-1.aws.neon.tech","ep-wispy-bird-al4hfg4e.c-3.eu-central-1.aws.neon.tech"]) {
    assert.throws(() => temporaryRestoreConnection(base.replace(RESTORE_TARGET.host,host),target),e=>{assert.doesNotMatch(String(e),/SECRET|postgresql/);return true;});
  }
});
test("marker and transactional guard protect persistent and unregistered databases", () => {
  const marker = temporaryDatabaseMarker(target);
  assert.doesNotThrow(()=>assertTemporaryDatabaseMarker(marker,target));
  for(const value of [null,"",marker.replace(id,"c".repeat(32))]) assert.throws(()=>assertTemporaryDatabaseMarker(value,target));
  const sql = temporaryEmptyTargetSql(target.database,marker);
  assert.match(sql,/pg_advisory_xact_lock/);assert.ok(sql.includes(`current_database() <> '${target.database}'`));
  assert.match(sql,/RESTORE_MARKER/); assert.match(sql,/RESTORE_TARGET_NOT_EMPTY/);
  assert.throws(()=>temporaryEmptyTargetSql("neondb",marker));
  assert.throws(()=>temporaryEmptyTargetSql(target.database,"'; DROP DATABASE neondb;--"));
});
test("cleanup is a bounded separately approved plan only, never forced or automatic deletion", () => {
  const proof = {project:target.project,branch:target.branch,endpoint:target.endpoint,database:target.database,
    marker:temporaryDatabaseMarker(target),restoreActive:false,connections:0,separatelyApproved:true};
  assert.equal(temporaryCleanupPlan(target,proof).database,target.database);
  for(const change of [{database:"neondb"},{project:"other"},{branch:"other"},{endpoint:"other"},{marker:"unknown"},
    {restoreActive:true},{connections:1},{separatelyApproved:false}]) assert.throws(()=>temporaryCleanupPlan(target,{...proof,...change}));
  const source=readFileSync("scripts/operations/temporary-restore-target.ts","utf8");
  assert.doesNotMatch(source,/fetch\(|execFile|\.query\(|DROP DATABASE|pg_terminate_backend/);
});
test("temporary destination has no public input; default denies unregistered real restore and deploy scope stays operations-only", () => {
  const workflow = readFileSync(".github/workflows/ap94-acceptance.yml","utf8");
  assert.match(workflow,/RESTORE_TEMPORARY_TARGET: \$\{\{ vars.RESTORE_TEMPORARY_TARGET \}\}/);
  assert.doesNotMatch(workflow,/inputs\.(?:restore_database|database_url|temporary_target)/);
  const source=readFileSync("scripts/operations/acceptance-restore.ts","utf8");
  assert.ok(source.indexOf("const target = temporaryRestoreTarget(env)") < source.indexOf("new PrivateArtifacts"));
  assert.ok(source.indexOf("assertTemporaryDatabaseMarker(await probe.json") < source.indexOf('pgTool("psql"'));
  assert.ok(source.indexOf('assertTargetPreflight(await probe.json') < source.indexOf('pgTool("psql"'));
  assert.equal(needsApplicationDeployment(["scripts/operations/temporary-restore-target.ts",".github/workflows/ap94-acceptance.yml","docs/operations/temporary-restore.md"]),false);
});

test("read-only mode has an explicit no-write claim and branch/repository authorization remains mandatory",()=>{
  const allowed={GITHUB_REPOSITORY:"justphilgud/pubquiz-web",GITHUB_REF:"refs/heads/main",GITHUB_EVENT_NAME:"workflow_dispatch",AP94_MANUAL_ACCEPTANCE:"true",AP96_RUN_RESTORE:"false",AP94_RESTORE_PREFLIGHT:"true"};
  assert.doesNotThrow(()=>assertRestoreAcceptance(allowed));
  for(const change of [{GITHUB_REF:"refs/heads/other"},{GITHUB_REPOSITORY:"fork/repo"},{AP94_RESTORE_PREFLIGHT:"false"}])assert.throws(()=>assertRestoreAcceptance({...allowed,...change}));
  const source=readFileSync("scripts/operations/acceptance-restore.ts","utf8");
  assert.ok(source.indexOf('if (env.AP94_RESTORE_PREFLIGHT === "true") return') < source.indexOf('const writeEnv ='));
  assert.match(source,/restoreExecuted: false/);
});
