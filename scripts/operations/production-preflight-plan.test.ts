import assert from "node:assert/strict";
import test from "node:test";
import {execFileSync} from "node:child_process";
import {migrationFiles,assessMigrations} from "./production-preflight";
import { readFileSync } from "node:fs";
import { APPROVED_PREFLIGHT_PLANS, approvedPreflightPlan, hasApprovedDeltaEvidence, hasApprovedPendingDelta,
  NO_DELTA_PREFLIGHT_PLAN, BINGO_AP1_NO_DELTA_PREFLIGHT_PLAN, ICON_ORDERING_NO_DELTA_PREFLIGHT_PLAN, approvedNoDeltaPreflightPlan, assertNoDeltaManifest, hasCompleteNoDeltaHistory } from "./production-preflight-plan";
import { needsApplicationDeployment } from "./deployment-scope";

test("only exact reviewed release pairs and SQL checksums are eligible", () => {
  for (const plan of APPROVED_PREFLIGHT_PLANS) {
    assert.equal(approvedPreflightPlan(plan.baselineSha, plan.candidateSha), plan);
    assert.equal(approvedPreflightPlan("a".repeat(40), plan.candidateSha), undefined);
    assert.equal(approvedPreflightPlan(plan.baselineSha, "b".repeat(40)), undefined);
    const files = [{name: plan.delta, checksum: plan.checksum}];
    assert.equal(hasApprovedPendingDelta(plan, [plan.delta], [plan.delta], files), true);
    assert.equal(hasApprovedPendingDelta(plan, [plan.delta, "unreviewed"], [plan.delta], files), false);
    assert.equal(hasApprovedPendingDelta(plan, [plan.delta], [], files), false);
    assert.equal(hasApprovedPendingDelta(plan, [plan.delta], [plan.delta, "unreviewed"], files), false);
    assert.equal(hasApprovedPendingDelta(plan, [plan.delta], [plan.delta], [{...files[0], checksum: "0".repeat(64)}]), false);
  }
});

for (const p of [NO_DELTA_PREFLIGHT_PLAN, BINGO_AP1_NO_DELTA_PREFLIGHT_PLAN]) {
test(`no-delta preflight accepts only exact pair ${p.candidateSha} and identical complete manifests`, () => {
  const manifest=Array.from({length:64},(_,i)=>({name:i===63?p.lastMigration:`migration_${i}`,checksum:String(i)}));
  const verify=(before=manifest,after=manifest,beforeSchema="schema",afterSchema="schema",baseline:string=p.baselineSha,candidate:string=p.candidateSha)=>
    assertNoDeltaManifest(baseline,candidate,before,after,beforeSchema,afterSchema);
  assert.equal(approvedNoDeltaPreflightPlan(p.baselineSha,p.candidateSha),p);
  for(const [baseline,candidate] of [[p.candidateSha,p.baselineSha],["a".repeat(40),p.candidateSha],[p.baselineSha,"b".repeat(40)],[p.baselineSha,p.candidateSha.slice(0,8)]]){
    assert.equal(approvedNoDeltaPreflightPlan(baseline,candidate),undefined);
    assert.throws(()=>verify(manifest,manifest,"schema","schema",baseline,candidate));
  }
  assert.equal(verify().kind,"NO_SCHEMA_MIGRATION_DELTA");
  assert.throws(()=>verify(manifest.slice(1),manifest.slice(1)));
  assert.throws(()=>verify(manifest,manifest.slice(1)));
  assert.throws(()=>verify(manifest,[...manifest,{name:"unexpected",checksum:"x"}]));
  assert.throws(()=>verify(manifest,manifest.map((m,i)=>i===0?{...m,checksum:"changed"}:m)));
  assert.throws(()=>verify(manifest,manifest,"schema","changed"));
  assert.throws(()=>verify(manifest,manifest.map((m,i)=>i===63?manifest[0]:m)));
  const history={gate:{status:"PASS"},applied:manifest.map(m=>m.name),pending:[],expected:[]};
  assert.equal(hasCompleteNoDeltaHistory(history,manifest),true);
  for(const invalid of [{...history,gate:{status:"BLOCKED"}},{...history,gate:{status:"FAIL"}},
    {...history,applied:history.applied.slice(1)},{...history,applied:[...history.applied,"unexpected"]},
    {...history,applied:history.applied.map((m,i)=>i===63?history.applied[0]:m)},
    {...history,pending:["unexpected"]},{...history,expected:["unexpected"]}]) {
    assert.equal(hasCompleteNoDeltaHistory(invalid,manifest),false);
  }
});
}

test("AP1 adds only its pinned pair, preserving the original layout and SQL approvals", () => {
  assert.equal(NO_DELTA_PREFLIGHT_PLAN.baselineSha,"a4c5a9fd9adb182776afcfae38a977a12805a9ea");
  assert.equal(NO_DELTA_PREFLIGHT_PLAN.candidateSha,"c50e56a0308276d16bc19681f3e6a7600c41682f");
  assert.deepEqual(BINGO_AP1_NO_DELTA_PREFLIGHT_PLAN,{
    baselineSha:"3ade18d276d7ead2cc43008a3d887e3d8feaae48",
    candidateSha:"0c23f07ecb263805482ef9bd75277d94f0eac718",
    migrationCount:64,lastMigration:"20261026210000_shared_game_design",
  });
  assert.equal(APPROVED_PREFLIGHT_PLANS.length,3);
  for(const [before,after] of [[NO_DELTA_PREFLIGHT_PLAN,BINGO_AP1_NO_DELTA_PREFLIGHT_PLAN],
    [BINGO_AP1_NO_DELTA_PREFLIGHT_PLAN,NO_DELTA_PREFLIGHT_PLAN]]) {
    assert.equal(approvedNoDeltaPreflightPlan(before.baselineSha,after.candidateSha),undefined);
  }
  const files=["scripts/operations/production-preflight-plan.ts","scripts/operations/production-preflight-plan.test.ts",
    ".github/workflows/production-preflight-ci.yml","docs/operations/bingo-ap1-release-preflight.md"];
  assert.equal(needsApplicationDeployment(files),false);
  assert.equal(needsApplicationDeployment([...files,"app/bingo/core/run.ts"]),true);
});

test("layout preflight operations files cannot deploy the application; mixed app changes still do", () => {
  const files=["scripts/operations/production-preflight-plan.ts","scripts/operations/production-preflight-plan.test.ts",
    "scripts/operations/production-preflight-cli.ts","scripts/operations/production-preflight-schema-build.ts",
    ".github/workflows/production-preflight-ci.yml","docs/operations/layout-release-preflight.md"];
  assert.equal(needsApplicationDeployment(files),false);
  assert.equal(needsApplicationDeployment([...files,"app/rendering/presentation/fitChoiceContent.ts"]),true);
  const cli=readFileSync("scripts/operations/production-preflight-cli.ts","utf8");
  assert.match(cli,/readProductionMigrations\(process.env.PRODUCTION_BACKUP_DATABASE_URL/);
  assert.doesNotMatch(cli,/git.*checkout|npm.*run.*build|migrate deploy|db:deploy/);
});

test("delta evidence is bound to both commits, exact SQL and actual isolated checks", () => {
  for (const plan of APPROVED_PREFLIGHT_PLANS) {
    const evidence = {status: "PASS", migration: plan.delta, baselineSha: plan.baselineSha, candidateSha: plan.candidateSha,
      checksum: plan.checksum, rowsUnchanged: true, onlyExpectedSchemaChanges: true, oldColumnProjectionCompatible: true,
      captureConfirmed: true, noBackfill: true, resetBarrierConfirmed: true, archiveSurvivesRuntimeDeletion: true};
    assert.equal(hasApprovedDeltaEvidence(plan, evidence), true);
    for (const key of ["status", "migration", "baselineSha", "candidateSha", "checksum", "rowsUnchanged", "onlyExpectedSchemaChanges", "oldColumnProjectionCompatible"]) {
      assert.equal(hasApprovedDeltaEvidence(plan, {...evidence, [key]: null}), false, key);
    }
    if (plan.kind === "meme-archive") {
      for (const key of ["captureConfirmed", "noBackfill", "resetBarrierConfirmed", "archiveSurvivesRuntimeDeletion"]) {
        assert.equal(hasApprovedDeltaEvidence(plan, {...evidence, [key]: false}), false, key);
      }
    }
    assert.equal(hasApprovedDeltaEvidence(undefined, evidence), false);
    assert.equal(hasApprovedDeltaEvidence(plan, undefined), false);
  }
});

test("PR116 operations-only update never starts migration or application deployment", () => {
  const paths = ["scripts/operations/production-preflight-plan.ts", "scripts/operations/production-preflight-plan.test.ts",
    "scripts/operations/production-preflight-archive-delta.ts", "scripts/operations/production-preflight-schema-build.ts",
    "scripts/operations/production-preflight.ts", "docs/operations/production-read-only-preflight.md",
    ".github/workflows/production-read-only-preflight.yml", ".github/workflows/production-preflight-ci.yml"];
  assert.equal(needsApplicationDeployment(paths), false);
  assert.equal(needsApplicationDeployment([...paths, "prisma/migrations/20261016120000_meme_archive/migration.sql"]), true);
  const workflow = readFileSync(".github/workflows/production-read-only-preflight.yml", "utf8");
  assert.match(workflow, /environment: production/);
  assert.match(workflow, /environment: operations-backup/);
  assert.match(workflow, /github.ref == 'refs\/heads\/main'/);
  assert.doesNotMatch(workflow, /db:deploy|vercel.*deploy|acceptance-cli|workflow_run:/);
});


test("PR149 no-delta pair pins all 69 SQL files, both schema bytes and complete history without broadening old releases",()=>{
 const p=ICON_ORDERING_NO_DELTA_PREFLIGHT_PLAN;
 const before=migrationFiles(p.baselineSha),after=migrationFiles(p.candidateSha);
 const schema=(sha:string)=>execFileSync("git",["show",`${sha}:prisma/schema.prisma`],{encoding:"utf8"});
 const a=schema(p.baselineSha),b=schema(p.candidateSha);
 const verify=(x=before,y=after,sa=a,sb=b,base:string=p.baselineSha,candidate:string=p.candidateSha)=>assertNoDeltaManifest(base,candidate,x,y,sa,sb);
 assert.equal(approvedNoDeltaPreflightPlan(p.baselineSha,p.candidateSha),p);assert.equal(verify().migrationCount,69);
 for(const [base,candidate]of [[p.candidateSha,p.baselineSha],[p.baselineSha,"a".repeat(40)],["b".repeat(40),p.candidateSha],[p.baselineSha,p.candidateSha.slice(0,8)],[NO_DELTA_PREFLIGHT_PLAN.baselineSha,p.candidateSha],[p.baselineSha,BINGO_AP1_NO_DELTA_PREFLIGHT_PLAN.candidateSha]]){
  assert.equal(approvedNoDeltaPreflightPlan(base,candidate),undefined);assert.throws(()=>verify(before,after,a,b,base,candidate));
 }
 for(const invalid of [after.slice(1),[...after,{name:"unexpected",checksum:"0".repeat(64)}],after.map((f,i)=>i===0?{...f,checksum:"0".repeat(64)}:f),after.map((f,i)=>i===68?after[0]:f)])assert.throws(()=>verify(before,invalid));
 const changed=before.map((f,i)=>i===0?{...f,checksum:"0".repeat(64)}:f);assert.throws(()=>verify(changed,changed));
 assert.throws(()=>verify(before,after,a+" ",b));assert.throws(()=>verify(before,after,a,b+" "));assert.throws(()=>verify(before,after,a+" ",b+" "));
 const history={gate:{status:"PASS"},applied:before.map(f=>f.name),pending:[],expected:[]};
 assert.equal(hasCompleteNoDeltaHistory(history,after,p),true);assert.equal(hasCompleteNoDeltaHistory(history,after),false);
 assert.equal(hasCompleteNoDeltaHistory(history,after,{baselineSha:p.candidateSha,candidateSha:p.baselineSha}),false);
 for(const invalid of [{...history,gate:{status:"BLOCKED"}},{...history,gate:{status:"FAIL"}},{...history,applied:history.applied.slice(1)},{...history,applied:[...history.applied,"extra"]},{...history,applied:history.applied.map((v,i)=>i===68?history.applied[0]:v)},{...history,pending:[p.lastMigration]},{...history,expected:["extra"]}])assert.equal(hasCompleteNoDeltaHistory(invalid,after,p),false);
 const rows=before.map(f=>({migration_name:f.name,checksum:f.checksum,finished_at:"done",rolled_back_at:null}));
 assert.equal(assessMigrations(after,before,rows).gate.status,"PASS");
 assert.equal(assessMigrations(after,before,rows.slice(1)).gate.status,"FAIL");
 assert.equal(assessMigrations(after,before,[...rows,{...rows[0],migration_name:"unknown"}]).gate.status,"FAIL");
 const paths=["scripts/operations/production-preflight-plan.ts","scripts/operations/production-preflight-plan.test.ts","scripts/operations/production-preflight-cli.ts",".github/workflows/production-preflight-ci.yml","docs/operations/icons-ordering-release-preflight.md"];
 assert.equal(needsApplicationDeployment(paths),false);for(const file of ["app/events/EventRow.tsx","prisma/schema.prisma"])assert.equal(needsApplicationDeployment([...paths,file]),true);
});
