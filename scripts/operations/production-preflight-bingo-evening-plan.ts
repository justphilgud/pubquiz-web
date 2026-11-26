import {createHash} from "node:crypto";
type File={name:string;checksum:string};
export const BINGO_EVENING_PLAN=Object.freeze({
 baselineSha:"93f074973c4bf73ed4bf6c489d375682f510ba82",
 candidateSha:"2d1fce671ad7d670a015dd6f7abd91cfa231926f",
 baselineManifest:"54a307058df8a29a9ab214cb4b76f57e04112be631cfbc308514e9074d8df6a4",
 baselineSchema:"53ce29a7a086bca7d22e9b46657b1b112190cf03404942a53093e85ffc5e484d",
 candidateSchema:"26cc4d670ef3c954731a14250b580c33667e51869c9edc176b238cbf7f6127b1",
 migrations:[{name:"20261126120000_event_ceremony",checksum:"d352c4b66ed8b031fe6d678709ee4c6c0f65fd24c9705eb5e6525a52867a1da1"}],
});
export function approvedBingoEveningPlan(baseline:string,candidate:string){return baseline===BINGO_EVENING_PLAN.baselineSha&&candidate===BINGO_EVENING_PLAN.candidateSha?BINGO_EVENING_PLAN:undefined;}
const hash=(v:string)=>createHash("sha256").update(v).digest("hex");
export function assertBingoEveningManifest(baseline:string,candidate:string,before:readonly File[],after:readonly File[],beforeSchema:string,afterSchema:string){
 const p=approvedBingoEveningPlan(baseline,candidate),files=(v:readonly File[])=>v.map(({name,checksum})=>({name,checksum}));
 if(!p||before.length!==80||after.length!==81||new Set(after.map(f=>f.name)).size!==81||
 hash(JSON.stringify(files(before)))!==p.baselineManifest||hash(beforeSchema)!==p.baselineSchema||hash(afterSchema)!==p.candidateSchema||
 JSON.stringify(files(after.slice(0,80)))!==JSON.stringify(files(before))||JSON.stringify(files(after.slice(80)))!==JSON.stringify(p.migrations))throw Error("BINGO_EVENING_MANIFEST_UNVERIFIED");
 return p;
}
export function bingoEveningDeltaEvidence(baseline:string,candidate:string,value:unknown){
 if(!approvedBingoEveningPlan(baseline,candidate)||!value||typeof value!=="object")return false;
 const v=value as Record<string,unknown>;
 return v.status==="PASS"&&v.baselineSha===baseline&&v.candidateSha===candidate&&JSON.stringify(v.migrations)===JSON.stringify(BINGO_EVENING_PLAN.migrations)&&
 ["rowsUnchanged","onlyExpectedSchemaChanges","oldColumnProjectionCompatible","constraintsEnforced","immutableHistory","legacyRunPreserved","noBackfill","newCeremonyObjectVerified","rollbackProbe"].every(k=>v[k]===true);
}
