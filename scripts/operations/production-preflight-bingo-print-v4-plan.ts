import {createHash} from "node:crypto";
type File={name:string;checksum:string};
export const BINGO_PRINT_V4_PLAN=Object.freeze({
 baselineSha:"e877959f12d6d9ba4cb07a43dc273516b577f4cf",
 candidateSha:"0143de26461070d08b701ffee01a8ca4b7db3eac",
 baselineManifest:"069b34755e9e5eb309c770ffcd17783e1f5bd8ca914096e803ac7d007d5325de",
 baselineSchema:"df7cd584585ca2fab7fab2926a63f5c90790d461bbc1ac7270733efdc4dab7e8",
 candidateSchema:"df7cd584585ca2fab7fab2926a63f5c90790d461bbc1ac7270733efdc4dab7e8",
 migrations:[{name:"20261106210000_bingo_print_templates_v4",checksum:"4a79c784a0faa372d238da36ad9e10852651f239dfbe3e4378e6b0764e64420c"}],
});
export function approvedBingoPrintV4Plan(baseline:string,candidate:string){return baseline===BINGO_PRINT_V4_PLAN.baselineSha&&candidate===BINGO_PRINT_V4_PLAN.candidateSha?BINGO_PRINT_V4_PLAN:undefined;}
const hash=(v:string)=>createHash("sha256").update(v).digest("hex");
export function assertBingoPrintV4Manifest(baseline:string,candidate:string,before:readonly File[],after:readonly File[],beforeSchema:string,afterSchema:string){
 const p=approvedBingoPrintV4Plan(baseline,candidate),files=(v:readonly File[])=>v.map(({name,checksum})=>({name,checksum}));
 if(!p||before.length!==70||after.length!==71||new Set(after.map(f=>f.name)).size!==71||
 hash(JSON.stringify(files(before)))!==p.baselineManifest||hash(beforeSchema)!==p.baselineSchema||hash(afterSchema)!==p.candidateSchema||
 JSON.stringify(files(after.slice(0,70)))!==JSON.stringify(files(before))||JSON.stringify(files(after.slice(70)))!==JSON.stringify(p.migrations))throw Error("BINGO_PRINT_V4_MANIFEST_UNVERIFIED");
 return p;
}
export function bingoPrintV4DeltaEvidence(baseline:string,candidate:string,value:unknown){
 if(!approvedBingoPrintV4Plan(baseline,candidate)||!value||typeof value!=="object")return false;
 const v=value as Record<string,unknown>;
 return v.status==="PASS"&&v.baselineSha===baseline&&v.candidateSha===candidate&&JSON.stringify(v.migrations)===JSON.stringify(BINGO_PRINT_V4_PLAN.migrations)&&
 ["rowsUnchanged","onlyExpectedSchemaChanges","oldColumnProjectionCompatible","constraintsEnforced","immutableHistory","legacyRunPreserved","v4Accepted","selectionV2Accepted","rollbackProbe"].every(k=>v[k]===true);
}
