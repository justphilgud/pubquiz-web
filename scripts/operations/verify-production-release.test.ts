import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyPreflightRun,verifyReleaseEvidence} from './verify-production-release';
const candidate='b'.repeat(40),baseline='a'.repeat(40),pass={status:'PASS'};
test('only successful trusted main Read-only Preflight runs supply deployment artifacts',()=>{
 const run={id:7,run_attempt:1,path:'.github/workflows/production-read-only-preflight.yml',head_branch:'main',event:'workflow_dispatch',status:'completed',conclusion:'success',head_repository:{full_name:'justphilgud/pubquiz-web'}};
 verifyPreflightRun(run,7);
 for(const changed of [{id:8},{run_attempt:0},{path:'.github/workflows/other.yml'},{head_branch:'feature'},{event:'pull_request'},{status:'in_progress'},{conclusion:'failure'},{conclusion:'cancelled'},{head_repository:{full_name:'fork/pubquiz-web'}}])assert.throws(()=>verifyPreflightRun({...run,...changed},7));
 assert.throws(()=>verifyPreflightRun(run,NaN));
});
test('missing, failed, mixed or stale SHA evidence never reaches Production migrations',()=>{
 const deployment={candidateSha:candidate,baselineSha:baseline,sha:baseline,state:'READY',gate:pass,gates:[pass]};
 const database={candidateSha:candidate,baselineSha:baseline,gate:pass,migrationHistoryGate:pass,databaseIdentityGate:pass,schemaGate:pass,expectedDeltaGate:pass,deltaGate:pass,privilegesGate:pass,identity:{readOnly:true},failed:[],drift:[],baselineDrift:[]};
 assert.deepEqual(verifyReleaseEvidence(candidate,deployment,database),{candidateSha:candidate,baselineSha:baseline});
 for(const changed of [{candidateSha:baseline},{baselineSha:candidate},{sha:candidate},{state:'BUILDING'},{gate:{status:'FAIL'}},{gates:[]},{gates:[{status:'BLOCKED'}]}])assert.throws(()=>verifyReleaseEvidence(candidate,{...deployment,...changed},database));
 for(const changed of [{candidateSha:baseline},{baselineSha:candidate},{gate:{status:'FAIL'}},{schemaGate:undefined},{deltaGate:{status:"BLOCKED"}},{expectedDeltaGate:undefined},{migrationHistoryGate:{status:'BLOCKED'}},{identity:{readOnly:false}},{failed:['failed']},{drift:['changed']},{baselineDrift:['removed']},{failed:undefined}])assert.throws(()=>verifyReleaseEvidence(candidate,deployment,{...database,...changed}));
 assert.throws(()=>verifyReleaseEvidence(candidate.slice(0,8),deployment,database));
});
