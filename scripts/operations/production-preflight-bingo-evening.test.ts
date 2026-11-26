import assert from "node:assert/strict";
import test from "node:test";
import {execFileSync} from "node:child_process";
import {readFileSync} from "node:fs";
import {BINGO_EVENING_PLAN,BINGO_EVENING_RELEASE_PLAN,approvedBingoEveningPlan,assertBingoEveningManifest} from "./production-preflight-bingo-evening-plan";
import {approvedBingoPlan,assertBingoManifest,bingoPendingDelta,bingoDeltaEvidence} from "./production-preflight-bingo-plan";
import {migrationFiles,assessMigrations} from "./production-preflight";
import {needsApplicationDeployment} from "./deployment-scope";
const schema=(sha:string)=>execFileSync("git",["show",`${sha}:prisma/schema.prisma`],{encoding:"utf8"});
for(const p of [BINGO_EVENING_PLAN,BINGO_EVENING_RELEASE_PLAN])test(`PR182 exact ${p.candidateSha}: both schema hashes, all 80 immutable historical files and one delta`,()=>{
 const before=migrationFiles(p.baselineSha),after=migrationFiles(p.candidateSha),a=schema(p.baselineSha),b=schema(p.candidateSha);
 const verify=(x=before,y=after,sa=a,sb=b,base:string=p.baselineSha,candidate:string=p.candidateSha)=>assertBingoEveningManifest(base,candidate,x,y,sa,sb);
 assert.equal(verify(),p);assert.equal(approvedBingoPlan(p.baselineSha,p.candidateSha),p);assert.equal(assertBingoManifest(p.baselineSha,p.candidateSha,before,after,a,b),p);
 for(const [base,candidate]of [[p.candidateSha,p.baselineSha],[p.baselineSha,"a".repeat(40)],["b".repeat(40),p.candidateSha],[p.baselineSha,p.candidateSha.slice(0,8)],[p.baselineSha,"94f442cedad38f67973f3f4e1714758e1c4f99bd"]]){assert.equal(approvedBingoEveningPlan(base,candidate),undefined);assert.equal(approvedBingoPlan(base,candidate),undefined);assert.throws(()=>verify(before,after,a,b,base,candidate));}
 for(const invalid of [after.slice(1),after.slice(0,-1),[...after,{name:"unexpected",checksum:"0".repeat(64)}],after.map((f,i)=>i===0||i===80?{...f,checksum:"0".repeat(64)}:f),after.map((f,i)=>i===79?after[80]:i===80?after[79]:f),[...after.slice(0,80),after[0]]])assert.throws(()=>verify(before,invalid));
 assert.throws(()=>verify(before,after,a+" ",b));assert.throws(()=>verify(before,after,a,b+" "));
 const changed=before.map((f,i)=>i===0?{...f,checksum:"0".repeat(64)}:f);assert.throws(()=>verify(changed,[...changed,...after.slice(80)]));
 const expected=p.migrations.map(m=>m.name),history=before.map(f=>({migration_name:f.name,checksum:f.checksum,finished_at:"done",rolled_back_at:null}));
 assert.equal(assessMigrations(after,before,history).gate.status,"PASS");assert.ok(bingoPendingDelta(p.baselineSha,p.candidateSha,expected,expected,after));
 for(const pending of [[],[...expected,"unexpected"],["unexpected"]])assert.equal(bingoPendingDelta(p.baselineSha,p.candidateSha,expected,pending,after),false);
 assert.equal(assessMigrations(after,before,[...history,{...history[0],migration_name:expected[0],finished_at:null as unknown as string}]).gate.status,"FAIL");
 const evidence={status:"PASS",baselineSha:p.baselineSha,candidateSha:p.candidateSha,migrations:p.migrations,rowsUnchanged:true,onlyExpectedSchemaChanges:true,oldColumnProjectionCompatible:true,constraintsEnforced:true,immutableHistory:true,legacyRunPreserved:true,noBackfill:true,newCeremonyObjectVerified:true,rollbackProbe:true};
 assert.ok(bingoDeltaEvidence(p.baselineSha,p.candidateSha,evidence));for(const key of Object.keys(evidence))assert.equal(bingoDeltaEvidence(p.baselineSha,p.candidateSha,{...evidence,[key]:null}),false,key);
});
test('PR184 release successor retains exact Preview application/schema/assets and only fixes the fixture',()=>{
 const release=BINGO_EVENING_RELEASE_PLAN.candidateSha;
 execFileSync('git',['merge-base','--is-ancestor',BINGO_EVENING_PLAN.candidateSha,release]);
 execFileSync('git',['diff','--exit-code',BINGO_EVENING_PLAN.candidateSha,release,'--','app','public','prisma','package.json','package-lock.json']);
 const paths=execFileSync('git',['diff','--name-only','5bfcb5fd0c5788c520fb0602a1c1f5f41f316bdf',release],{encoding:'utf8'}).trim().split(/\r?\n/).sort();
 assert.deepEqual(paths,['docs/architecture/bingo-evening-dramaturgy.md','scripts/testing/bingo-event.acceptance.ts']);
 for(const candidate of ['5bfcb5fd0c5788c520fb0602a1c1f5f41f316bdf','b3e26c014a10d04474120a91f5076b8023f0c1f2'])assert.equal(approvedBingoEveningPlan(BINGO_EVENING_RELEASE_PLAN.baselineSha,candidate),undefined);
});
test("PR182 Operations scope cannot deploy application and preserves secret-bearing read-only boundaries",()=>{
 const paths=["scripts/operations/production-preflight-bingo-evening-plan.ts","scripts/operations/production-preflight-bingo-evening-delta.ts","scripts/operations/production-preflight-bingo-evening.test.ts","scripts/operations/production-preflight-bingo-plan.ts","scripts/operations/production-preflight-schema-build.ts",".github/workflows/production-preflight-ci.yml","docs/operations/pr182-release-preflight.md","scripts/operations/schema-reference/pr182-ceremony.sql"];
 assert.equal(needsApplicationDeployment(paths),false);for(const path of ["prisma/schema.prisma","prisma/migrations/new/migration.sql","app/bingo/live/live.ts","package.json"])assert.equal(needsApplicationDeployment([...paths,path]),true);
 const workflow=readFileSync(".github/workflows/production-read-only-preflight.yml","utf8");assert.match(workflow,/environment: production/);assert.match(workflow,/environment: operations-backup/);assert.doesNotMatch(workflow,/db:deploy|vercel.*deploy/);
 const cli=readFileSync("scripts/operations/production-preflight-cli.ts","utf8");assert.doesNotMatch(cli,/git.*checkout|npm.*build|db:deploy|migrate deploy/);
 const delta=readFileSync("scripts/operations/production-preflight-bingo-evening-delta.ts","utf8");assert.doesNotMatch(delta,/DATABASE_URL|new Client|fetch\(/);assert.match(delta,/assertBingoEveningManifest/);assert.match(delta,/onlyExpectedSchemaChanges:true/);
});
