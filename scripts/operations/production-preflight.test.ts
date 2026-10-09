import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { assessMigrations, assertPreflightContext, DATABASE_READ_QUERIES, readProductionDeployment, readProductionMigrations } from "./production-preflight";
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

