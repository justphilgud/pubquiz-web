import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { existingBackupInput, verifiedExistingBackup } from "./restore-existing-backup";
import { parseManifest, assertTargetPreflight } from "./acceptance-restore";
import { RESTORE_TARGET, pinnedRestoreConnection } from "./acceptance-policy";
import { sha256 } from "./snapshot";
import { needsApplicationDeployment } from "./deployment-scope";
const key="production/acceptance/run-123-1", hash="a".repeat(64);
const run={id:123,run_attempt:1,path:".github/workflows/ap94-acceptance.yml",head_branch:"main",repository:{full_name:"justphilgud/pubquiz-web"},status:"completed",conclusion:"success",event:"workflow_dispatch"};
const evidence={version:1,backupId:key,backupRun:"123",backupAttempt:"1",manifestSha256:hash,productionSha:"b".repeat(40),source:{host:"ep-dawn-paper-alws45vx.c-3.eu-central-1.aws.neon.tech",database:"neondb",schema:"pubquiz"},completed:true,manifestPresent:true,integrityVerified:true,readbackVerified:true,snapshotAt:"2026-10-09T18:00:00Z",completedAt:"2026-10-09T18:30:00Z"};
test("existing verified backup requires successful exact main run and evidence",()=>{
 assert.equal(verifiedExistingBackup(key,hash,run,evidence).backupId,key);
 for(const change of [{id:999},{run_attempt:2},{head_branch:"other"},{conclusion:"failure"},{path:"other.yml"},{repository:{full_name:"other/repo"}}])assert.throws(()=>verifiedExistingBackup(key,hash,{...run,...change},evidence));
 for(const change of [{completed:false},{integrityVerified:false},{readbackVerified:false},{manifestPresent:false},{backupId:"unknown"},{manifestSha256:"f".repeat(64)},{completedAt:"invalid"}])assert.throws(()=>verifiedExistingBackup(key,hash,run,{...evidence,...change}));
 for(const unknown of ["unknown","../production/acceptance/run-123-1","synthetic/acceptance/run-123-1"])assert.throws(()=>existingBackupInput(unknown,hash));
});
test("corrupt manifest, missing media and checksum mismatch fail before writes",()=>{
 const m={version:3,mode:"production-backup",key,target:RESTORE_TARGET,source:{host:evidence.source.host,name:"neondb",schema:"pubquiz"},release:evidence.productionSha,backup:{type:"pre-deployment",protected:true,trigger:"workflow_dispatch"},authExcluded:["pubquiz.teams.team_passwort","pubquiz.users.password_hash"],artifacts:[{name:"database.dump"},{name:"auth-redacted.json"}],media:[],expected:{media:[]},snapshotAt:evidence.snapshotAt,completedAt:evidence.completedAt};
 const bytes=Buffer.from(JSON.stringify(m));assert.equal(parseManifest(bytes,sha256(bytes),key).key,key);
 assert.throws(()=>parseManifest(bytes,hash,key));assert.throws(()=>parseManifest(Buffer.from("broken"),sha256(Buffer.from("broken")),key));
 for(const changed of [{version:99},{media:[{name:"media-"+"a".repeat(64)+".bin",url:"https://invalid"}],expected:{media:["https://invalid"]}},{artifacts:[{name:"database.dump"}]}]){const b=Buffer.from(JSON.stringify({...m,...changed}));assert.throws(()=>parseManifest(b,sha256(b),key));}
});
test("pinned target rejects Production, Preview and arbitrary endpoints without credential output",()=>{
 for(const host of ["ep-dawn-paper-alws45vx.c-3.eu-central-1.aws.neon.tech","ep-wispy-bird-al4hfg4e.c-3.eu-central-1.aws.neon.tech","ep-other-abc.c-3.eu-central-1.aws.neon.tech"]){assert.throws(()=>pinnedRestoreConnection({RESTORE_TEST_DATABASE_URL:`postgresql://neondb_owner:SYNTHETIC_SECRET@${host}/neondb?sslmode=require&channel_binding=require`,RESTORE_TEST_EXPECTED_HOST:host}),error=>{assert.doesNotMatch(String(error),/SYNTHETIC_SECRET|postgresql/);return true;});}
 const proof={role:RESTORE_TARGET.role,db:"neondb",major:17,readOnly:true,empty:true,canRestore:true};assert.doesNotThrow(()=>assertTargetPreflight(proof));
 for(const change of [{empty:false},{canRestore:false},{readOnly:false},{role:"wrong"},{db:"wrong"}])assert.throws(()=>assertTargetPreflight({...proof,...change}));
});
test("restore-only uses exact trusted workflow and no backup, arbitrary target or application deploy",()=>{
 const workflow=readFileSync(".github/workflows/ap94-acceptance.yml","utf8");
 assert.match(workflow,/inputs.mode != 'restore-only'/);assert.match(workflow,/needs: \[backup, verify-existing-backup\]/);
 assert.match(workflow,/needs.verify-existing-backup.result == 'success'/);assert.match(workflow,/environment: operations-restore/);
 assert.match(workflow,/RESTORE_TARGET_KIND: isolated-test/);assert.match(workflow,/actions: read/);
 assert.doesNotMatch(workflow,/inputs\.(?:database_url|restore_target|storage_url)|db:deploy|--prod/);
 assert.equal(needsApplicationDeployment(['.github/workflows/ap94-acceptance.yml','scripts/operations/restore-existing-backup.ts','docs/operations/restore-only.md']),false);
});
