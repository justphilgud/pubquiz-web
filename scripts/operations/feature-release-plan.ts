import {verifyCardSetPlan} from './bingo-card-set-release-plan';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {migrationFiles,type Migration} from './production-preflight';

export const FEATURE_PLAN_PATH='release/plan.json';
import {releaseCi} from './release-provenance';
import {verifyBingoColorPlan} from './bingo-color-release-plan';
export {verifiedReleaseCi,type CiRun,type MergedPull} from './release-provenance';
export type FeaturePlan={version:1;kind:'NO_DELTA';baselineSha:string;migrationCount:number;lastMigration:string;manifestSha256:string;schemaSha256:string};
const sha=(value:string)=>/^[a-f0-9]{40}$/.test(value);
const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
const manifest=(files:readonly Migration[])=>files.map(({name,checksum})=>({name,checksum}));
export function featurePlanFor(baselineSha:string,files:readonly Migration[],schema:string):FeaturePlan{
 if(!sha(baselineSha)||!files.length||new Set(files.map(f=>f.name)).size!==files.length)throw Error('FEATURE_PLAN_INVALID');
 return {version:1,kind:'NO_DELTA',baselineSha,migrationCount:files.length,lastMigration:files.at(-1)!.name,manifestSha256:hash(JSON.stringify(manifest(files))),schemaSha256:hash(schema)};
}
export function verifyFeaturePlan(value:unknown,baseline:string,candidate:string,before:readonly Migration[],after:readonly Migration[],beforeSchema:string,afterSchema:string){
 if(value&&typeof value==='object'&&'kind' in value&&value.kind==='BINGO_CARD_SET')return verifyCardSetPlan(value,baseline,candidate,before,after,beforeSchema,afterSchema);
 if(value&&typeof value==='object'&&'kind' in value&&value.kind==='BINGO_ROUND_COLOR')return verifyBingoColorPlan(value,baseline,candidate,before,after,beforeSchema,afterSchema);
 if(!value||typeof value!=='object'||Array.isArray(value)||!sha(baseline)||!sha(candidate)||baseline===candidate)throw Error('FEATURE_PLAN_INVALID');
 const expected=featurePlanFor(baseline,before,beforeSchema),v=value as FeaturePlan;
 if(Object.keys(v).sort().join()!==Object.keys(expected).sort().join()||Object.entries(expected).some(([k,val])=>v[k as keyof FeaturePlan]!==val)||
 beforeSchema!==afterSchema||JSON.stringify(manifest(before))!==JSON.stringify(manifest(after)))throw Error('FEATURE_PLAN_BYTES_UNVERIFIED');
 return {kind:'NO_SCHEMA_MIGRATION_DELTA' as const,baselineSha:baseline,candidateSha:candidate,migrationCount:v.migrationCount,lastMigration:v.lastMigration,manifestSha256:v.manifestSha256,schemaSha256:v.schemaSha256,manifest:manifest(after),featurePlanBlobSha256:hash(JSON.stringify(value))};
}
/** Read candidate data only. No imports, scripts, dependencies or SQL from it execute. */
export async function featureReleaseProof(baseline:string,candidate:string){
 if(!sha(baseline)||!sha(candidate))throw Error('INVALID_SHA');
 const paths=execFileSync('git',['ls-tree','--name-only',candidate,FEATURE_PLAN_PATH],{encoding:'utf8'}).trim();
 if(!paths)return null;
 execFileSync('git',['merge-base','--is-ancestor',baseline,candidate],{stdio:'pipe'});
 execFileSync('git',['merge-base','--is-ancestor',candidate,'origin/main'],{stdio:'pipe'});
 const read=(revision:string,path:string)=>execFileSync('git',['show',`${revision}:${path}`],{encoding:'utf8'});
 const proof=verifyFeaturePlan(JSON.parse(read(candidate,FEATURE_PLAN_PATH)),baseline,candidate,migrationFiles(baseline),migrationFiles(candidate),read(baseline,'prisma/schema.prisma'),read(candidate,'prisma/schema.prisma'));
 return {...proof,ciRunId:await releaseCi(candidate)};
}
export function completeFeatureHistory(result:{gate:{status:string};applied?:readonly string[];pending?:readonly string[];expected?:readonly string[]},proof:NonNullable<Awaited<ReturnType<typeof featureReleaseProof>>>){
 return result.gate.status==='PASS'&&result.applied?.length===proof.manifest.length&&new Set(result.applied).size===proof.manifest.length&&proof.manifest.every(f=>result.applied?.includes(f.name))&&result.pending?.length===0&&result.expected?.length===0;
}
