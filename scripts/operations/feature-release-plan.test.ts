import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {featurePlanFor,verifyFeaturePlan,verifiedReleaseCi,featureReleaseProof,type CiRun,type MergedPull} from './feature-release-plan';
import {migrationFiles} from './production-preflight';
const base='a'.repeat(40),candidate='b'.repeat(40),files=[{name:'0_init',checksum:'1'.repeat(64)},{name:'next',checksum:'2'.repeat(64)}],schema='reviewed schema';
test('feature PR plan pins complete baseline bytes without a self-referential merge SHA',()=>{
 const plan=featurePlanFor(base,files,schema),verify=(value:unknown=plan,before=files,after=files,beforeSchema=schema,afterSchema=schema)=>verifyFeaturePlan(value,base,candidate,before,after,beforeSchema,afterSchema);
 assert.equal(verify().candidateSha,candidate);
 for(const wrong of [{...plan,baselineSha:candidate},{...plan,kind:'SQL'},{...plan,extra:true},{...plan,migrationCount:1},{...plan,lastMigration:'wrong'},{...plan,manifestSha256:'0'.repeat(64)},{...plan,schemaSha256:'0'.repeat(64)}])assert.throws(()=>verify(wrong));
 for(const changed of [files.slice(1),[...files,files[0]],files.map(f=>({...f,checksum:'3'.repeat(64)})),[...files].reverse()]){
  assert.throws(()=>verify(plan,files,changed));assert.throws(()=>verify(plan,changed,changed));
 }
 assert.throws(()=>verify(plan,files,files,'tampered','tampered'));
 assert.throws(()=>verify(plan,files,files,schema,'changed'));
 assert.throws(()=>verifyFeaturePlan(plan,base,base,files,files,schema,schema));
 assert.throws(()=>verifyFeaturePlan(plan,base.slice(0,8),candidate,files,files,schema,schema));
});
test('exact successful latest main CI and a merged same-repository PR are required',()=>{
 const run:CiRun={id:5,head_sha:candidate,head_branch:'main',event:'push',path:'.github/workflows/ci.yml',status:'completed',conclusion:'success',head_repository:{full_name:'justphilgud/pubquiz-web'}};
 const pull:MergedPull={merge_commit_sha:candidate,merged_at:'now',base:{ref:'main',repo:{full_name:'justphilgud/pubquiz-web'}},head:{repo:{full_name:'justphilgud/pubquiz-web'}}};
 assert.equal(verifiedReleaseCi(candidate,[run],[pull]),5);
 for(const bad of [{head_sha:base},{head_branch:'feature'},{event:'pull_request'},{path:'.github/workflows/other.yml'},{status:'in_progress'},{conclusion:'failure'},{head_repository:{full_name:'fork/pubquiz-web'}}])assert.throws(()=>verifiedReleaseCi(candidate,[{...run,...bad}],[pull]));
 assert.throws(()=>verifiedReleaseCi(candidate,[run,{...run,id:6,conclusion:'failure'}],[pull]));
 assert.throws(()=>verifiedReleaseCi(candidate,[run],[]),'direct main pushes cannot manufacture a release');
 for(const bad of [{...pull,merge_commit_sha:base},{...pull,merged_at:null},{...pull,head:{repo:{full_name:'fork/pubquiz-web'}}},{...pull,base:{ref:'other',repo:pull.base.repo}}])assert.throws(()=>verifiedReleaseCi(candidate,[run],[bad]));
});
test('CI checks each PR head once and main after merge; protection and narrow scope remain',()=>{
 for(const path of ['ci.yml','production-preflight-ci.yml','ap94-bridge-ci.yml']){
  const workflow=readFileSync('.github/workflows/'+path,'utf8');
  assert.match(workflow,/push:\s+branches: \[main\]/);assert.match(workflow,/pull_request:/);
 }
 const ci=readFileSync('.github/workflows/ci.yml','utf8');assert.match(ci,/ref: \$\{\{ github.event.pull_request.head.sha \|\| github.sha \}\}/);
 const live=readFileSync('.github/workflows/production-read-only-preflight.yml','utf8');
 assert.match(live,/environment: production/);assert.match(live,/environment: operations-backup/);assert.match(live,/cancel-in-progress: false/);
 assert.doesNotMatch(live,/db:deploy|vercel.*deploy|acceptance-cli/);
});
test('real immutable Git trees and mocked GitHub provenance produce the same exact proof without candidate execution',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'pubquiz-feature-plan-')),previous=process.cwd(),fetchBefore=globalThis.fetch,tokenBefore=process.env.GH_TOKEN;
 try{
  process.chdir(directory);
  const git=(...args:string[])=>execFileSync('git',args,{encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
  git('init');git('config','user.name','Synthetic Test');git('config','user.email','synthetic@example.invalid');
  mkdirSync('prisma/migrations/0_init',{recursive:true});writeFileSync('prisma/migrations/0_init/migration.sql','SELECT 1;');
  const schema='datasource db {\n provider = "postgresql"\n schemas = ["pubquiz"]\n}\n';writeFileSync('prisma/schema.prisma',schema);
  git('add','.');git('commit','-m','synthetic baseline');const baseline=git('rev-parse','HEAD');
  assert.equal(await featureReleaseProof(baseline,baseline),null);
  mkdirSync('release');writeFileSync('release/plan.json',JSON.stringify(featurePlanFor(baseline,migrationFiles(baseline),schema)));
  writeFileSync('candidate-code.mjs','throw Error("Candidate code must never execute")');
  git('add','.');git('commit','-m','synthetic feature with reviewed plan');const candidate=git('rev-parse','HEAD');git('update-ref','refs/remotes/origin/main',candidate);
  process.env.GH_TOKEN='synthetic-metadata-test-only';
  globalThis.fetch=(async(input)=>{
   const url=String(input);assert.ok(url.startsWith('https://api.github.com/repos/justphilgud/pubquiz-web/'));
   return Response.json(url.includes('/pulls?')?[{merge_commit_sha:candidate,merged_at:'now',base:{ref:'main',repo:{full_name:'justphilgud/pubquiz-web'}},head:{repo:{full_name:'justphilgud/pubquiz-web'}}}]:{workflow_runs:[{id:9,head_sha:candidate,head_branch:'main',event:'push',path:'.github/workflows/ci.yml',status:'completed',conclusion:'success',head_repository:{full_name:'justphilgud/pubquiz-web'}}]});
  }) as typeof fetch;
  const first=await featureReleaseProof(baseline,candidate);assert.equal(first?.ciRunId,9);assert.equal(first?.candidateSha,candidate);assert.equal(first?.manifest.length,1);
  assert.deepEqual(await featureReleaseProof(baseline,candidate),first,'independent jobs reproduce the immutable artifact');
  git('commit','--allow-empty','-m','later baseline');const later=git('rev-parse','HEAD');
  await assert.rejects(featureReleaseProof(later,candidate),'non-ancestor release blocked');
 }finally{
  process.chdir(previous);globalThis.fetch=fetchBefore;if(tokenBefore===undefined)delete process.env.GH_TOKEN;else process.env.GH_TOKEN=tokenBefore;
  rmSync(directory,{recursive:true,force:true});
 }
});
