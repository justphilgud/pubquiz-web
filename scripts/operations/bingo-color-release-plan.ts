import {createHash} from 'node:crypto';
import type {Migration} from './production-preflight';

export const COLOR_MIGRATION='20261127220000_bingo_round_color';
export const COLOR_SQL="-- Additive optional display setting; no backfill or changes to cards, journals or scores.\nALTER TABLE pubquiz.bingo_rounds\n  ADD COLUMN presentation_color varchar(7),\n  ADD CONSTRAINT bingo_round_color_hex CHECK (\n    presentation_color IS NULL OR presentation_color ~ '^#[0-9A-Fa-f]{6}$'\n  );\n";
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
const files=(values:readonly Migration[])=>values.map(({name,checksum})=>({name,checksum}));
export function bingoColorPlanFor(baselineSha:string,before:readonly Migration[],schema:string){
 if(!/^[a-f0-9]{40}$/.test(baselineSha)||before.length!==81||hash(JSON.stringify(files(before)))!=='85646ef7090288ee7f848dc32a289a9af7cf40a250cbc60d3569ff80e728e9a8'||hash(schema)!=='26cc4d670ef3c954731a14250b580c33667e51869c9edc176b238cbf7f6127b1')throw Error('COLOR_BASELINE_UNVERIFIED');
 return {version:1,kind:'BINGO_ROUND_COLOR' as const,baselineSha,migrationCount:82,lastMigration:COLOR_MIGRATION,manifestSha256:hash(JSON.stringify([...files(before),{name:COLOR_MIGRATION,checksum:hash(COLOR_SQL)}])),schemaSha256:hash(schema.replace('model bingo_rounds {','model bingo_rounds {\n  presentation_color String? @db.VarChar(7)'))};
}
export function verifyBingoColorPlan(value:unknown,baseline:string,candidate:string,before:readonly Migration[],after:readonly Migration[],beforeSchema:string,afterSchema:string){
 const plan=bingoColorPlanFor(baseline,before,beforeSchema);
 if(!/^[a-f0-9]{40}$/.test(candidate)||candidate===baseline||!value||typeof value!=='object'||JSON.stringify(Object.entries(value).sort())!==JSON.stringify(Object.entries(plan).sort())||JSON.stringify(files(after))!==JSON.stringify([...files(before),{name:COLOR_MIGRATION,checksum:hash(COLOR_SQL)}])||hash(afterSchema)!==plan.schemaSha256)throw Error('COLOR_DELTA_UNVERIFIED');
 return {...plan,baselineSha:baseline,candidateSha:candidate,manifest:files(after),featurePlanBlobSha256:hash(JSON.stringify(value))};
}
export function colorDeltaEvidence(value:unknown){
 if(!value||typeof value!=='object')return false;
 const v=value as Record<string,unknown>;
 return v.status==='PASS'&&v.migration===COLOR_MIGRATION&&v.checksum===hash(COLOR_SQL)&&['rowsUnchanged','onlyExpectedSchemaChanges','oldColumnProjectionCompatible','constraintsEnforced','rollbackProbe','noBackfill'].every(key=>v[key]===true);
}
