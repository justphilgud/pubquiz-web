import {COLOR_SQL,COLOR_MIGRATION} from './bingo-color-release-plan';
import {createHash} from 'node:crypto';
import {compareFullSchema,DIAGNOSTIC_COLUMNS_SQL,DIAGNOSTIC_CATALOG_SQL,SCHEMA_OBJECTS_SQL,type SchemaEvidence} from './production-preflight-schema';

/** Only invoked inside the existing disposable, network-isolated PostgreSQL builder. */
export function testBingoColorDelta(sql:(s:string)=>string,query:(s:string)=>unknown,baseline:SchemaEvidence){
 const read=()=>({major:17,columns:query(DIAGNOSTIC_COLUMNS_SQL),catalog:query(DIAGNOSTIC_CATALOG_SQL),objects:query(SCHEMA_OBJECTS_SQL)});
 const id='97000000-0000-4000-8000-000000000001';
 sql(`INSERT INTO pubquiz.eventreihen(eventreihe_id,name,slug) VALUES(97000,'Color fixture','color-fixture');INSERT INTO pubquiz.game_drafts(id,eventart,eventreihe_id,titel,updated_at) VALUES('${id}','BINGO',97000,'Preserved game',NOW());INSERT INTO pubquiz.bingo_rounds(id,game_id,position,label) VALUES('${id}','${id}',1,'Preserved round');`);
 const rows=()=>sql("SELECT jsonb_agg(to_jsonb(r)-'presentation_color' ORDER BY id)::text FROM pubquiz.bingo_rounds r").trim();
 const before=rows();
 sql("BEGIN;SET LOCAL lock_timeout='2s';SET LOCAL statement_timeout='30s';"+COLOR_SQL+'ROLLBACK;');
 if(rows()!==before||compareFullSchema(baseline,read(),baseline.baselineSha,baseline.manifest).status!=='PASS')throw Error('COLOR_ROLLBACK_FAILED');
 sql("SET lock_timeout='2s';SET statement_timeout='30s';"+COLOR_SQL);
 if(rows()!==before||sql('SELECT count(*) FROM pubquiz.bingo_rounds WHERE presentation_color IS NOT NULL').trim()!=='0')throw Error('COLOR_ROWS_CHANGED');
 const columns=query(DIAGNOSTIC_COLUMNS_SQL) as Record<string,unknown>[],catalog=query(DIAGNOSTIC_CATALOG_SQL) as {constraints:Record<string,unknown>[]};
 const column=columns.find(c=>c.table==='bingo_rounds'&&c.column==='presentation_color');
 if(!column||column.nullable!==true)throw Error('COLOR_NULLABILITY');
 const projected={major:17,columns:columns.filter(c=>c!==column),catalog:{...catalog,constraints:catalog.constraints.filter(c=>c.name!=='bingo_round_color_hex')},objects:query(SCHEMA_OBJECTS_SQL)};
 if(compareFullSchema(baseline,projected,baseline.baselineSha,baseline.manifest).status!=='PASS')throw Error('COLOR_UNEXPECTED_SCHEMA');
 for(const color of ['#FFF9E9','#6A241C','#123abc'])sql(`UPDATE pubquiz.bingo_rounds SET presentation_color='${color}'`);
 let rejected=false;try{sql("UPDATE pubquiz.bingo_rounds SET presentation_color='invalid'");}catch{rejected=true;}
 if(!rejected)throw Error('COLOR_CHECK_MISSING');
 sql('UPDATE pubquiz.bingo_rounds SET presentation_color=NULL');
 if(rows()!==before)throw Error('COLOR_OLD_READER_CHANGED');
 return {status:'PASS',migration:COLOR_MIGRATION,checksum:createHash('sha256').update(COLOR_SQL).digest('hex'),rowsUnchanged:true,onlyExpectedSchemaChanges:true,oldColumnProjectionCompatible:true,constraintsEnforced:true,rollbackProbe:true,noBackfill:true};
}
