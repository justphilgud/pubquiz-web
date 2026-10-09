import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { assessMigrationPrivileges, readMigrationSession, assessMigrations, assertPreflightContext, DATABASE_READ_QUERIES, readProductionDeployment, readProductionMigrations } from "./production-preflight";
const a = { name: "a", checksum: "1" };
const b = { name: "b", checksum: "2" };
const installed = { migration_name: "a", checksum: "1", finished_at: "date", rolled_back_at: null };
test("expected pending, unexpected pending, failed and checksum drift are distinguished", () => {
  assert.deepEqual(assessMigrations([a,b],[a],[installed]).pending,["b"]);
  assert.equal(assessMigrations([a,b],[a],[installed]).gate.status,"PASS");
  assert.equal(assessMigrations([a,b],[a],[]).gate.code,"UNEXPECTED_PENDING_MIGRATION");
  assert.equal(assessMigrations([a,b],[a],[installed,{...installed,migration_name:"b",finished_at:null}]).gate.code,"FAILED_MIGRATION");
  assert.equal(assessMigrations([a],[a],[{...installed,checksum:"changed"}]).gate.code,"MIGRATION_DRIFT");
  assert.equal(assessMigrations([a],[{...a,checksum:"changed"}],[installed]).gate.status,"FAIL");
});
test("unknown connection identity blocks without connecting or printing secrets", async () => {
  const result=await readProductionMigrations("postgresql://user:SECRET@unknown.invalid/neondb",[a],[a]);
  assert.equal(result.gate.status,"BLOCKED");assert.ok(!JSON.stringify(result).includes("SECRET"));
});
test("Vercel target, alias, project and exact SHA must agree; every request is GET", async () => {
  const sha="a".repeat(40); const input={token:"SECRET",project:"prj_x",team:"team_x",alias:"quiz.example.com",expectedSha:sha};
  const responses=[{alias:input.alias,projectId:input.project,deployment:{id:"dpl_x"}},{id:input.project,targets:{production:{id:"dpl_x"}}},
    {id:"dpl_x",projectId:input.project,target:"production",readyState:"READY",meta:{githubCommitSha:sha}}, {alias:input.alias,projectId:input.project,deployment:{id:"dpl_x"}}];
  const request=(async (_url:unknown, options:RequestInit)=>{assert.equal(options.method,"GET");return new Response(JSON.stringify(responses.shift()),{status:200});}) as typeof fetch;
  assert.equal((await readProductionDeployment(input,request)).gate.status,"PASS");
  const denied=(async()=>new Response("SECRET",{status:403})) as typeof fetch;
  const result=await readProductionDeployment(input,denied);assert.equal(result.gate.status,"BLOCKED");assert.ok(!JSON.stringify(result).includes("SECRET"));
  const wrong=(async (url:unknown)=>new Response(JSON.stringify(String(url).includes("projects")?{id:input.project,targets:{production:{id:"dpl_x"}}}:String(url).includes("deployments")?
    {id:"dpl_x",projectId:input.project,target:"production",readyState:"READY",meta:{githubCommitSha:"b".repeat(40)}}:{alias:input.alias,projectId:input.project,deployment:{id:"dpl_x"}}))) as typeof fetch;
  assert.equal((await readProductionDeployment(input,wrong)).gate.code,"UNEXPECTED_PRODUCTION_SHA");
});
test("workflow is main-only, manual, separate from backup and deploy; SQL allowlist is read-only", () => {
  const workflow=readFileSync(".github/workflows/production-read-only-preflight.yml","utf8");
  assert.match(workflow,/workflow_dispatch:/);assert.match(workflow,/refs\/heads\/main/);
  assert.ok(!/db:deploy|vercel.*deploy|acceptance-cli|production-writer|workflow_run:/.test(workflow));
  assert.ok(DATABASE_READ_QUERIES.every(sql=>/^(BEGIN|SET LOCAL|SELECT)\b/.test(sql)));
  assert.throws(()=>assertPreflightContext({}),/CONTEXT_UNVERIFIED/);
});


test('unconfirmed privileges block before any migration-history read', async()=>{
  const proof={relation_exists:true,schema_usage:true,can_select:true,can_write:false,elevated_role:false,role_membership:false,owns_relation:false};
  assert.equal(assessMigrationPrivileges(proof).status,'PASS');
  for (const field of ['can_write','elevated_role','role_membership','owns_relation'] as const) assert.equal(assessMigrationPrivileges({...proof,[field]:true}).status,'BLOCKED');
  assert.equal(assessMigrationPrivileges(undefined).status,'BLOCKED');
  const queries:string[]=[];
  const client={query:async(sql:string)=>{queries.push(sql);return {rows: sql===DATABASE_READ_QUERIES[2] ? [{role:'pubquiz_backup_reader',database:'neondb',read_only:'on'}] : sql===DATABASE_READ_QUERIES[3] ? [{...proof,can_write:true}] : []};}};
  const result=await readMigrationSession(client as Parameters<typeof readMigrationSession>[0],[a],[a]);
  assert.equal(result.gate.status,'BLOCKED');assert.ok(!queries.includes(DATABASE_READ_QUERIES[4]));assert.equal(queries.at(-1),'ROLLBACK');
});

test('registration push never executes either protected Production job',()=>{
  const workflow=readFileSync('.github/workflows/production-read-only-preflight.yml','utf8');
  assert.match(workflow,/push:\r?\n    paths: \['.github\/workflows\/production-read-only-preflight.yml'\]/);
  for (const job of ['deployment-metadata','migrations']) {
    const block=workflow.split(`  ${job}:`)[1];
    assert.ok(block);assert.match(block.split('    steps:')[0],/if: github.event_name == 'workflow_dispatch' && github.repository == 'justphilgud\/pubquiz-web' && github.ref == 'refs\/heads\/main'/);
  }
});
