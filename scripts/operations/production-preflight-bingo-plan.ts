import {approvedBingoEventPlan,assertBingoEventManifest,bingoEventDeltaEvidence} from "./production-preflight-bingo-event-plan";
import {approvedBingoLivePlan,assertBingoLiveManifest,bingoLiveDeltaEvidence} from "./production-preflight-bingo-live-plan";
import {createHash} from 'node:crypto';
type File={name:string;checksum:string};
export const BINGO_AP2_PLAN=Object.freeze({
 baselineSha:'8d2af14f959c920869a3375bc1236a46d2247533',candidateSha:'834242e51f8d9819aaf05d3e006f50a5694b6345',
 baselineManifest:'c05c655d2e211f1027e35bb9e95a6cfdf0a4d0e90a2a6b4d4e3df3f3fca43391',
 baselineSchema:'0113219a5b9e3794a1b182e29170a16a080e1fd8db7e0e14fea4bd0dc900c03c',candidateSchema:'c44b7c2491b4bea5596b57f7aafa6ae0fda565fcfcfd29cad5b4fe2da454e219',
 migrations:[
 {name:'20261027180000_bingo_preparation',checksum:'7eb3f09ef62dcf44d508219dacdfdd68ad1a31831aa4a41c5dc0cb92e18fabc2'},
 {name:'20261027210000_bingo_print_design',checksum:'5ddc528da448e994c8da48d4bbf3d698298e648913b3cfa059b050b94ae088b7'},
 {name:'20261027213000_bingo_label_allocation',checksum:'09a5d228854865c5712779bdd007b5d165a52d650afd62637769e8b3412b82e6'},
 ] as readonly File[],
});
export function approvedBingoPlan(baseline:string,candidate:string){return approvedBingoEventPlan(baseline,candidate)??approvedBingoLivePlan(baseline,candidate)??(baseline===BINGO_AP2_PLAN.baselineSha&&candidate===BINGO_AP2_PLAN.candidateSha?BINGO_AP2_PLAN:undefined);}
const hash=(v:string)=>createHash('sha256').update(v).digest('hex');
export function assertBingoManifest(baseline:string,candidate:string,before:readonly File[],after:readonly File[],beforeSchema:string,afterSchema:string){
 if(approvedBingoEventPlan(baseline,candidate))return assertBingoEventManifest(baseline,candidate,before,after,beforeSchema,afterSchema);
 if(approvedBingoLivePlan(baseline,candidate))return assertBingoLiveManifest(baseline,candidate,before,after,beforeSchema,afterSchema);
 const plan=approvedBingoPlan(baseline,candidate);
 const files=(v:readonly File[])=>v.map(({name,checksum})=>({name,checksum}));
 if(!plan||before.length!==64||after.length!==67||new Set(after.map(f=>f.name)).size!==67||
  hash(JSON.stringify(files(before)))!==plan.baselineManifest||hash(beforeSchema)!==plan.baselineSchema||hash(afterSchema)!==plan.candidateSchema||
  JSON.stringify(files(after.slice(0,64)))!==JSON.stringify(files(before))||
  JSON.stringify(files(after.slice(64)))!==JSON.stringify(plan.migrations))throw Error('BINGO_AP2_MANIFEST_UNVERIFIED');
 return plan;
}
export function bingoPendingDelta(baseline:string,candidate:string,expected:readonly string[],pending:readonly string[],files:readonly File[]){
 const p=approvedBingoPlan(baseline,candidate);return Boolean(p&&JSON.stringify(expected)===JSON.stringify(p.migrations.map(m=>m.name))&&JSON.stringify(pending)===JSON.stringify(expected)&&p.migrations.every(m=>files.some(f=>f.name===m.name&&f.checksum===m.checksum)));
}
export function bingoDeltaEvidence(baseline:string,candidate:string,value:unknown){
 if(approvedBingoEventPlan(baseline,candidate))return bingoEventDeltaEvidence(baseline,candidate,value);
 if(approvedBingoLivePlan(baseline,candidate))return bingoLiveDeltaEvidence(baseline,candidate,value);
 if(!approvedBingoPlan(baseline,candidate)||!value||typeof value!=='object')return false;const v=value as Record<string,unknown>;
 return v.status==='PASS'&&v.baselineSha===baseline&&v.candidateSha===candidate&&JSON.stringify(v.migrations)===JSON.stringify(BINGO_AP2_PLAN.migrations)&&
 ['rowsUnchanged','onlyExpectedSchemaChanges','oldColumnProjectionCompatible','constraintsEnforced','stableLabels','rollbackProbe'].every(k=>v[k]===true);
}
