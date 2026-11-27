import {readFileSync,writeFileSync,appendFileSync} from 'node:fs';
import {join} from 'node:path';
import {githubRead,releaseCi,REPOSITORY} from './release-provenance';
import {readProductionDeployment} from './production-deployment-metadata';

type PreflightRun={id:number;run_attempt:number;path:string;head_branch:string;event:string;status:string;conclusion:string;head_repository:{full_name:string}};
export function verifyPreflightRun(run:PreflightRun,id:number){
 if(!Number.isSafeInteger(id)||id<1||run.id!==id||!Number.isSafeInteger(run.run_attempt)||run.run_attempt<1||run.path!=='.github/workflows/production-read-only-preflight.yml'||run.head_branch!=='main'||run.event!=='workflow_dispatch'||run.status!=='completed'||run.conclusion!=='success'||run.head_repository.full_name!==REPOSITORY)throw Error('PREFLIGHT_RUN_UNVERIFIED');
}
type Evidence={candidateSha?:string;baselineSha?:string;gate?:{status:string};state?:string;sha?:string;gates?:{status:string}[];migrationHistoryGate?:{status:string};databaseIdentityGate?:{status:string};schemaGate?:{status:string};expectedDeltaGate?:{status:string};deltaGate?:{status:string};privilegesGate?:{status:string};identity?:{readOnly:boolean};failed?:unknown[];drift?:unknown[];baselineDrift?:unknown[]};
export function verifyReleaseEvidence(candidate:string,deployment:Evidence,database:Evidence){
 const baseline=deployment.baselineSha;
 if(!/^[a-f0-9]{40}$/.test(candidate)||!baseline||!/^[a-f0-9]{40}$/.test(baseline)||candidate===baseline||deployment.candidateSha!==candidate||database.candidateSha!==candidate||database.baselineSha!==baseline||deployment.sha!==baseline||deployment.state!=='READY'||!deployment.gates?.length||deployment.gates.some(g=>g.status!=='PASS'))throw Error('PREFLIGHT_COMMIT_EVIDENCE_UNVERIFIED');
 for(const gate of [deployment.gate,database.gate,database.migrationHistoryGate,database.databaseIdentityGate,database.schemaGate,database.expectedDeltaGate,database.deltaGate,database.privilegesGate])if(gate?.status!=='PASS')throw Error('PREFLIGHT_GATE_UNVERIFIED');
 if(database.identity?.readOnly!==true||[database.failed,database.drift,database.baselineDrift].some(values=>!Array.isArray(values)||values.length))throw Error('PREFLIGHT_HISTORY_UNVERIFIED');
 return {candidateSha:candidate,baselineSha:baseline};
}
async function main(){
 if(process.env.GITHUB_ACTIONS!=='true'||process.env.GITHUB_REPOSITORY!==REPOSITORY||process.env.GITHUB_REF!=='refs/heads/main')throw Error('RELEASE_CONTEXT');
 const candidate=process.env.RELEASE_CANDIDATE_SHA??'',id=Number(process.env.PREFLIGHT_RUN_ID);
 if(!/^[a-f0-9]{40}$/.test(candidate)||!/^\d+$/.test(process.env.PREFLIGHT_RUN_ID??''))throw Error('RELEASE_INPUT');
 const mode=process.argv[2];
 if(mode==='metadata'){
  const run=await githubRead(`/repos/${REPOSITORY}/actions/runs/${id}`) as PreflightRun;verifyPreflightRun(run,id);
  await releaseCi(candidate);console.log('Exact merged candidate CI and trusted successful Preflight run confirmed');return;
 }
 const root=process.env.RELEASE_EVIDENCE_DIR??'release-evidence';
 if(mode==='evidence'){
  const deployment=JSON.parse(readFileSync(join(root,'deployment/preflight-deployment.json'),'utf8')) as Evidence;
  const database=JSON.parse(readFileSync(join(root,'migrations/preflight-database.json'),'utf8')) as Evidence;
  const run=await githubRead(`/repos/${REPOSITORY}/actions/runs/${id}`) as PreflightRun;verifyPreflightRun(run,id);
  const proof={...verifyReleaseEvidence(candidate,deployment,database),preflightRunId:id,preflightRunAttempt:run.run_attempt,ciRunId:await releaseCi(candidate)};
  writeFileSync(join(root,'validated.json'),JSON.stringify(proof,null,2));
  console.log('All mandatory Preflight artifacts match the exact release candidate');return;
 }
 if(mode==='fresh'){
  const proof=JSON.parse(readFileSync(join(root,'validated.json'),'utf8')) as {candidateSha:string;baselineSha:string;preflightRunId:number;preflightRunAttempt:number};
  if(proof.candidateSha!==candidate||proof.preflightRunId!==id)throw Error('RELEASE_ARTIFACT_MISMATCH');
  await releaseCi(candidate);
  const run=await githubRead(`/repos/${REPOSITORY}/actions/runs/${id}`) as PreflightRun;verifyPreflightRun(run,id);
  if(run.run_attempt!==proof.preflightRunAttempt)throw Error('PREFLIGHT_ATTEMPT_CHANGED');
  const result=await readProductionDeployment({token:process.env.VERCEL_TOKEN??'',project:process.env.VERCEL_PROJECT_ID??'',team:process.env.VERCEL_ORG_ID??'',alias:process.env.PRODUCTION_ALIAS??'',expectedSha:proof.baselineSha});
  if(result.gate.status!=='PASS')throw Error('PRODUCTION_BASE_CHANGED');
  if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,`Exact candidate: ${candidate}\nPreflight run: ${id}\nFresh Production alias/base: PASS\n`);
  console.log('Fresh Production alias and expected baseline confirmed using GET only');return;
 }
 throw Error('RELEASE_MODE');
}
// esbuild emits the same reviewed guard for the protected deployment job.
if(/(?:^|[\\/])verify-production-release\.ts$/.test(process.argv[1]??'')||process.argv[1]?.endsWith('release-guard.cjs'))void main().catch(()=>{console.error('BLOCKED: release evidence or current Production state unverified');process.exitCode=1;});
