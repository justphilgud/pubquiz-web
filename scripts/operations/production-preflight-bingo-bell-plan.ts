import {createHash} from "node:crypto";
type File={name:string;checksum:string};
export const BINGO_BELL_PLAN=Object.freeze({
 baselineSha:"8f049b8182cf498079d7ad26aec3fc64dcf842d7",
 candidateSha:"72ea417c4857fedc3d1e59b443ddff5298c8665f",
 baselineManifest:"8af6aff9799497bf6415f2e235bf5f74e7d2807c449d0872761d5e70fc0adb35",
 baselineSchema:"c285d05ddb25bebba4314e74afd075f480462b816fb3ba0da468780e515727f8",
 candidateSchema:"53ce29a7a086bca7d22e9b46657b1b112190cf03404942a53093e85ffc5e484d",
 migrations:[{name:"20261125120000_bingo_round_content",checksum:"c3fc878b7c90f764a2a23603414e4e292ce338fbd69f93e1a2f4a11988017b9a"}],
});
export function approvedBingoBellPlan(baseline:string,candidate:string){return baseline===BINGO_BELL_PLAN.baselineSha&&candidate===BINGO_BELL_PLAN.candidateSha?BINGO_BELL_PLAN:undefined;}
const hash=(v:string)=>createHash("sha256").update(v).digest("hex");
export function assertBingoBellManifest(baseline:string,candidate:string,before:readonly File[],after:readonly File[],beforeSchema:string,afterSchema:string){
 const p=approvedBingoBellPlan(baseline,candidate),files=(v:readonly File[])=>v.map(({name,checksum})=>({name,checksum}));
 if(!p||before.length!==79||after.length!==80||new Set(after.map(f=>f.name)).size!==80||
 hash(JSON.stringify(files(before)))!==p.baselineManifest||hash(beforeSchema)!==p.baselineSchema||hash(afterSchema)!==p.candidateSchema||
 JSON.stringify(files(after.slice(0,79)))!==JSON.stringify(files(before))||JSON.stringify(files(after.slice(79)))!==JSON.stringify(p.migrations))throw Error("BINGO_BELL_MANIFEST_UNVERIFIED");
 return p;
}
export function bingoBellDeltaEvidence(baseline:string,candidate:string,value:unknown){
 if(!approvedBingoBellPlan(baseline,candidate)||!value||typeof value!=="object")return false;
 const v=value as Record<string,unknown>;
 return v.status==="PASS"&&v.baselineSha===baseline&&v.candidateSha===candidate&&JSON.stringify(v.migrations)===JSON.stringify(BINGO_BELL_PLAN.migrations)&&
 ["rowsUnchanged","onlyExpectedSchemaChanges","oldColumnProjectionCompatible","constraintsEnforced","immutableHistory","legacyRunPreserved","noBackfill","newContentObjectsVerified","rollbackProbe"].every(k=>v[k]===true);
}
