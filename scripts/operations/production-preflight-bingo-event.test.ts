import assert from "node:assert/strict";
import test from "node:test";
import {execFileSync} from "node:child_process";
import {readFileSync} from "node:fs";
import {BINGO_EVENT_PLAN as p,approvedBingoEventPlan,assertBingoEventManifest} from "./production-preflight-bingo-event-plan";
import {approvedBingoPlan,assertBingoManifest,bingoPendingDelta,bingoDeltaEvidence} from "./production-preflight-bingo-plan";
import {migrationFiles,assessMigrations} from "./production-preflight";
import {needsApplicationDeployment} from "./deployment-scope";
const schema=(sha:string)=>execFileSync("git",["show",`${sha}:prisma/schema.prisma`],{encoding:"utf8"});
test("Event binds only its exact pair, both schemas, all 68 old files and the single immutable migration",()=>{
 const before=migrationFiles(p.baselineSha),after=migrationFiles(p.candidateSha),a=schema(p.baselineSha),b=schema(p.candidateSha);
 const verify=(x=before,y=after,sa=a,sb=b,base:string=p.baselineSha,candidate:string=p.candidateSha)=>assertBingoEventManifest(base,candidate,x,y,sa,sb);
 assert.equal(verify(),p);assert.equal(approvedBingoPlan(p.baselineSha,p.candidateSha),p);assert.equal(assertBingoManifest(p.baselineSha,p.candidateSha,before,after,a,b),p);
 for(const [base,candidate]of [[p.candidateSha,p.baselineSha],[p.baselineSha,"a".repeat(40)],["b".repeat(40),p.candidateSha],[p.baselineSha,p.candidateSha.slice(0,8)]]){assert.equal(approvedBingoEventPlan(base,candidate),undefined);assert.equal(approvedBingoPlan(base,candidate),undefined);assert.throws(()=>verify(before,after,a,b,base,candidate));}
 for(const invalid of [after.slice(1),after.slice(0,-1),[...after,{name:"unexpected",checksum:"0".repeat(64)}],after.map((f,i)=>i===0||i===68?{...f,checksum:"0".repeat(64)}:f),after.map((f,i)=>i===67?after[68]:i===68?after[67]:f)])assert.throws(()=>verify(before,invalid));
 assert.throws(()=>verify(before,after,a+" ",b));assert.throws(()=>verify(before,after,a,b+" "));
 const changed=before.map((f,i)=>i===0?{...f,checksum:"0".repeat(64)}:f);assert.throws(()=>verify(changed,[...changed,...after.slice(68)]));
 const expected=p.migrations.map(m=>m.name),history=before.map(f=>({migration_name:f.name,checksum:f.checksum,finished_at:"done",rolled_back_at:null}));
 assert.equal(assessMigrations(after,before,history).gate.status,"PASS");assert.ok(bingoPendingDelta(p.baselineSha,p.candidateSha,expected,expected,after));
 for(const pending of [[],[...expected,"unexpected"],["unexpected"]])assert.equal(bingoPendingDelta(p.baselineSha,p.candidateSha,expected,pending,after),false);
 assert.equal(assessMigrations(after,before,[...history,{...history[0],migration_name:expected[0],finished_at:null as unknown as string}]).gate.status,"FAIL");
 const evidence={status:"PASS",baselineSha:p.baselineSha,candidateSha:p.candidateSha,migrations:p.migrations,rowsUnchanged:true,onlyExpectedSchemaChanges:true,oldColumnProjectionCompatible:true,constraintsEnforced:true,immutableHistory:true,legacyRunPreserved:true,rollbackProbe:true};
 assert.ok(bingoDeltaEvidence(p.baselineSha,p.candidateSha,evidence));for(const key of Object.keys(evidence))assert.equal(bingoDeltaEvidence(p.baselineSha,p.candidateSha,{...evidence,[key]:null}),false,key);
});
test("Event operations scope cannot deploy, candidate code is not checked out and existing protections remain",()=>{
 const paths=["scripts/operations/production-preflight-bingo-event-plan.ts","scripts/operations/production-preflight-bingo-event-delta.ts","scripts/operations/production-preflight-bingo-event.test.ts","scripts/operations/production-preflight-bingo-plan.ts","scripts/operations/production-preflight-schema-build.ts",".github/workflows/production-preflight-ci.yml","docs/operations/bingo-event-release-preflight.md"];
 assert.equal(needsApplicationDeployment(paths),false);for(const path of ["prisma/schema.prisma","app/bingo/live/live.ts"])assert.equal(needsApplicationDeployment([...paths,path]),true);
 const workflow=readFileSync(".github/workflows/production-read-only-preflight.yml","utf8");assert.match(workflow,/environment: production/);assert.match(workflow,/environment: operations-backup/);assert.doesNotMatch(workflow,/db:deploy|vercel.*deploy/);
 const cli=readFileSync("scripts/operations/production-preflight-cli.ts","utf8");assert.doesNotMatch(cli,/git.*checkout|npm.*build|db:deploy|migrate deploy/);
 const delta=readFileSync("scripts/operations/production-preflight-bingo-event-delta.ts","utf8");assert.doesNotMatch(delta,/DATABASE_URL|new Client|fetch\(/);assert.match(delta,/assertBingoEventManifest/);
});
