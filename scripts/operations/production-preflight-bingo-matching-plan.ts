import {createHash} from "node:crypto";
type File={name:string;checksum:string};
export const BINGO_MATCHING_PLAN=Object.freeze({
 baselineSha:"338887775389567fd2703cf177f3927cf89a1086",
 candidateSha:"6915ec447bde62a8b7d2a63efb53633c8edb44fd",
 baselineManifest:"522f034347f0899994f056eafbf997fb80340b07b10d19f384b5c228172f6bb4",
 baselineSchema:"df7cd584585ca2fab7fab2926a63f5c90790d461bbc1ac7270733efdc4dab7e8",
 candidateSchema:"9d7d5860b8cd5a6fb497b880c283fe61e26993018200912fe6a71997803e6ac9",
 migrations:[{name:"20261107150000_bingo_matching",checksum:"7a5998e3b027ad002112c12f948e9f8435b462308858d85efcc495cb26c2447f"}],
});
export function approvedBingoMatchingPlan(baseline:string,candidate:string){return baseline===BINGO_MATCHING_PLAN.baselineSha&&candidate===BINGO_MATCHING_PLAN.candidateSha?BINGO_MATCHING_PLAN:undefined;}
const hash=(v:string)=>createHash("sha256").update(v).digest("hex");
export function assertBingoMatchingManifest(baseline:string,candidate:string,before:readonly File[],after:readonly File[],beforeSchema:string,afterSchema:string){
 const p=approvedBingoMatchingPlan(baseline,candidate),files=(v:readonly File[])=>v.map(({name,checksum})=>({name,checksum}));
 if(!p||before.length!==71||after.length!==72||new Set(after.map(f=>f.name)).size!==72||
 hash(JSON.stringify(files(before)))!==p.baselineManifest||hash(beforeSchema)!==p.baselineSchema||hash(afterSchema)!==p.candidateSchema||
 JSON.stringify(files(after.slice(0,71)))!==JSON.stringify(files(before))||JSON.stringify(files(after.slice(71)))!==JSON.stringify(p.migrations))throw Error("BINGO_MATCHING_MANIFEST_UNVERIFIED");
 return p;
}
export function bingoMatchingDeltaEvidence(baseline:string,candidate:string,value:unknown){
 if(!approvedBingoMatchingPlan(baseline,candidate)||!value||typeof value!=="object")return false;
 const v=value as Record<string,unknown>;
 return v.status==="PASS"&&v.baselineSha===baseline&&v.candidateSha===candidate&&JSON.stringify(v.migrations)===JSON.stringify(BINGO_MATCHING_PLAN.migrations)&&
 ["rowsUnchanged","onlyExpectedSchemaChanges","oldColumnProjectionCompatible","constraintsEnforced","immutableHistory","legacyRunPreserved","v2Accepted","assetIntegrity","noBackfill","newMatchingObjectsVerified","rollbackProbe"].every(k=>v[k]===true);
}
