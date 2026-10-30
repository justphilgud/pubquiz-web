import {createHash} from "node:crypto";
type File={name:string;checksum:string};
export const BINGO_EVENT_PLAN=Object.freeze({
  "baselineSha": "8fa60b68c0713dfe06e5dd6a203a369e1e73b961",
  "candidateSha": "49350af73f6ceb69ff6d903701acd4f4d9ddd5c5",
  "baselineManifest": "9a0022cbaba217a74f7c13198efc62dc648310c91bfe3cac4aaeaf3601f37a34",
  "baselineSchema": "931dc99fdff6075f80a230f298f497f63b8b1eb04adc5c5fd700857b73331ed6",
  "candidateSchema": "8de3ef99975080831c86be36cae7f62bc4a3abe5e2181e92b1a65b8d590d4947",
  "migrations": [
    {
      "name": "20261030150000_bingo_event_operation",
      "checksum": "5c5b12ce13e0c637444626b681ce7da86a4bd3278dc5491b0f5d1bb4379df3d4"
    }
  ]
});
export function approvedBingoEventPlan(baseline:string,candidate:string){return baseline===BINGO_EVENT_PLAN.baselineSha&&candidate===BINGO_EVENT_PLAN.candidateSha?BINGO_EVENT_PLAN:undefined;}
const hash=(v:string)=>createHash("sha256").update(v).digest("hex");
export function assertBingoEventManifest(baseline:string,candidate:string,before:readonly File[],after:readonly File[],beforeSchema:string,afterSchema:string){
 const p=approvedBingoEventPlan(baseline,candidate),files=(v:readonly File[])=>v.map(({name,checksum})=>({name,checksum}));
 if(!p||before.length!==68||after.length!==69||new Set(after.map(f=>f.name)).size!==69||
 hash(JSON.stringify(files(before)))!==p.baselineManifest||hash(beforeSchema)!==p.baselineSchema||hash(afterSchema)!==p.candidateSchema||
 JSON.stringify(files(after.slice(0,68)))!==JSON.stringify(files(before))||JSON.stringify(files(after.slice(68)))!==JSON.stringify(p.migrations))throw Error("BINGO_EVENT_MANIFEST_UNVERIFIED");
 return p;
}
export function bingoEventDeltaEvidence(baseline:string,candidate:string,value:unknown){
 if(!approvedBingoEventPlan(baseline,candidate)||!value||typeof value!=="object")return false;
 const v=value as Record<string,unknown>;
 return v.status==="PASS"&&v.baselineSha===baseline&&v.candidateSha===candidate&&JSON.stringify(v.migrations)===JSON.stringify(BINGO_EVENT_PLAN.migrations)&&
 ["rowsUnchanged","onlyExpectedSchemaChanges","oldColumnProjectionCompatible","constraintsEnforced","immutableHistory","legacyRunPreserved","rollbackProbe"].every(k=>v[k]===true);
}
