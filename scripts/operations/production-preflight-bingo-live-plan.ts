import {createHash} from "node:crypto";
type File={name:string;checksum:string};
export const BINGO_AP3_PLAN=Object.freeze({
 baselineSha:"4f437c17d675cdf027b25cb2c2196f9ef19f5345",candidateSha:"6381b8be4e74f47e0267fa8f542d1ac4661759ef",
 baselineManifest:"49944dfe6addacad154ed2cf39cada2ec3809d0c1f8dcfc53c2afa070dfb4ed9",
 baselineSchema:"c44b7c2491b4bea5596b57f7aafa6ae0fda565fcfcfd29cad5b4fe2da454e219",candidateSchema:"931dc99fdff6075f80a230f298f497f63b8b1eb04adc5c5fd700857b73331ed6",
 migrations:[{name:"20261028090000_bingo_live",checksum:"43b739f502a8f6e556191538f24f368c15ed546b4f38d8639ad55878e6c5bca4"}] as readonly File[],
});
export function approvedBingoLivePlan(baseline:string,candidate:string){return baseline===BINGO_AP3_PLAN.baselineSha&&candidate===BINGO_AP3_PLAN.candidateSha?BINGO_AP3_PLAN:undefined;}
const hash=(v:string)=>createHash("sha256").update(v).digest("hex");
export function assertBingoLiveManifest(baseline:string,candidate:string,before:readonly File[],after:readonly File[],beforeSchema:string,afterSchema:string){
 const p=approvedBingoLivePlan(baseline,candidate),files=(v:readonly File[])=>v.map(({name,checksum})=>({name,checksum}));
 if(!p||before.length!==67||after.length!==68||new Set(after.map(f=>f.name)).size!==68||
 hash(JSON.stringify(files(before)))!==p.baselineManifest||hash(beforeSchema)!==p.baselineSchema||hash(afterSchema)!==p.candidateSchema||
 JSON.stringify(files(after.slice(0,67)))!==JSON.stringify(files(before))||JSON.stringify(files(after.slice(67)))!==JSON.stringify(p.migrations))throw Error("BINGO_AP3_MANIFEST_UNVERIFIED");
 return p;
}
export function bingoLiveDeltaEvidence(baseline:string,candidate:string,value:unknown){
 if(!approvedBingoLivePlan(baseline,candidate)||!value||typeof value!=="object")return false;
 const v=value as Record<string,unknown>;
 return v.status==="PASS"&&v.baselineSha===baseline&&v.candidateSha===candidate&&JSON.stringify(v.migrations)===JSON.stringify(BINGO_AP3_PLAN.migrations)&&
 ["rowsUnchanged","onlyExpectedSchemaChanges","oldColumnProjectionCompatible","constraintsEnforced","immutableHistory","singleActiveRun","rollbackProbe"].every(k=>v[k]===true);
}
