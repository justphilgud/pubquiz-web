import {createHash} from "node:crypto";
type File={name:string;checksum:string};
export const BINGO_CARD_PLAN=Object.freeze({
  "baselineSha": "f0a5b0643312b33a4387ad09872e358d8dab8ccd",
  "candidateSha": "94f442cedad38f67973f3f4e1714758e1c4f99bd",
  "baselineManifest": "e996d003df6d87260bbd3201e211e2eb11a419f6bf5c3b5cfa7def8ee1a6c498",
  "baselineSchema": "8de3ef99975080831c86be36cae7f62bc4a3abe5e2181e92b1a65b8d590d4947",
  "candidateSchema": "df7cd584585ca2fab7fab2926a63f5c90790d461bbc1ac7270733efdc4dab7e8",
  "migrations": [
    {
      "name": "20261106180000_bingo_card_design_v3",
      "checksum": "10a2d3fc57e285a5540ee235b08fe2f97f4e603ac03df804d0de6871a4d9537c"
    }
  ]
});
export function approvedBingoCardPlan(baseline:string,candidate:string){return baseline===BINGO_CARD_PLAN.baselineSha&&candidate===BINGO_CARD_PLAN.candidateSha?BINGO_CARD_PLAN:undefined;}
const hash=(v:string)=>createHash("sha256").update(v).digest("hex");
export function assertBingoCardManifest(baseline:string,candidate:string,before:readonly File[],after:readonly File[],beforeSchema:string,afterSchema:string){
 const p=approvedBingoCardPlan(baseline,candidate),files=(v:readonly File[])=>v.map(({name,checksum})=>({name,checksum}));
 if(!p||before.length!==69||after.length!==70||new Set(after.map(f=>f.name)).size!==70||
 hash(JSON.stringify(files(before)))!==p.baselineManifest||hash(beforeSchema)!==p.baselineSchema||hash(afterSchema)!==p.candidateSchema||
 JSON.stringify(files(after.slice(0,69)))!==JSON.stringify(files(before))||JSON.stringify(files(after.slice(69)))!==JSON.stringify(p.migrations))throw Error("BINGO_CARD_MANIFEST_UNVERIFIED");
 return p;
}
export function bingoCardDeltaEvidence(baseline:string,candidate:string,value:unknown){
 if(!approvedBingoCardPlan(baseline,candidate)||!value||typeof value!=="object")return false;
 const v=value as Record<string,unknown>;
 return v.status==="PASS"&&v.baselineSha===baseline&&v.candidateSha===candidate&&JSON.stringify(v.migrations)===JSON.stringify(BINGO_CARD_PLAN.migrations)&&
 ["rowsUnchanged","onlyExpectedSchemaChanges","oldColumnProjectionCompatible","constraintsEnforced","immutableHistory","legacyRunPreserved","v3Accepted","newTermsBound","rollbackProbe"].every(k=>v[k]===true);
}
