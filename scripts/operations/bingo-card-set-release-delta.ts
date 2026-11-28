import {createHash} from 'node:crypto';
import {CARD_SET_SQL,CARD_SET_MIGRATION} from './bingo-card-set-release-plan';
import {compareFullSchema,DIAGNOSTIC_COLUMNS_SQL,DIAGNOSTIC_CATALOG_SQL,SCHEMA_OBJECTS_SQL,type SchemaEvidence} from './production-preflight-schema';
/** Trusted exact SQL only, inside the existing disposable network-isolated PG17 builder. */
export function testCardSetDelta(sql:(s:string)=>string,query:(s:string)=>unknown,baseline:SchemaEvidence){
 const read=()=>({major:17,columns:query(DIAGNOSTIC_COLUMNS_SQL),catalog:query(DIAGNOSTIC_CATALOG_SQL),objects:query(SCHEMA_OBJECTS_SQL)});
 const tables=(baseline.objects as {relations:{schema:string;name:string;kind:string}[]}).relations.filter(r=>r.kind==='r'&&r.name!=='_prisma_migrations');
 const identifier=(v:string)=>{if(!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(v))throw Error('IDENTIFIER');return `"${v}"`;};
 const rows=()=>sql(tables.map(t=>`SELECT '${t.schema}.${t.name}' AS name,coalesce(jsonb_agg(v ORDER BY v::text),'[]')::text AS rows FROM (SELECT to_jsonb(t) v FROM ${identifier(t.schema)}.${identifier(t.name)} t) s`).join(' UNION ALL ')+' ORDER BY name');
 const game='97000000-0000-4000-8000-000000000001',round='97000000-0000-4000-8000-000000000002',series='97000000-0000-4000-8000-000000000003',card='97000000-0000-4000-8000-000000000004',set='97000000-0000-4000-8000-000000000005';
 const cells=JSON.stringify(Array.from({length:5},(_,r)=>Array.from({length:5},(_,c)=>r===2&&c===2?null:c*15+r+1)));
 sql(`BEGIN;INSERT INTO pubquiz.users(id,name,email,password_hash,role,updated_at) VALUES(97000,'Isolated card set','card-set@example.invalid','not-a-login-hash','USER',NOW());INSERT INTO pubquiz.eventreihen(eventreihe_id,name,slug) VALUES(97000,'Card set fixture','card-set-fixture');INSERT INTO pubquiz.game_drafts(id,eventart,eventreihe_id,titel,updated_at) VALUES('${game}','BINGO',97000,'Preserved game',NOW());INSERT INTO pubquiz.bingo_rounds(id,game_id,position,label) VALUES('${round}','${game}',1,'Preserved round');INSERT INTO pubquiz.bingo_card_series(id,game_id,origin_round_id,code,card_count,request_id,request_hash,print_snapshot,created_by) VALUES('${series}','${game}','${round}','BG-AAAAAAAAAAAA',1,'${series}','${'a'.repeat(64)}','{"version":2}',97000);INSERT INTO pubquiz.bingo_cards(id,series_id,ordinal,printed_code,cells,layout_hash) VALUES('${card}','${series}',1,'BG-AAAAAAAAAAAA-0001','${cells}','${'b'.repeat(64)}');INSERT INTO pubquiz.bingo_round_series(round_id,series_id,game_id) VALUES('${round}','${series}','${game}');COMMIT;`);
 const before=rows();
 sql(CARD_SET_SQL.replace(/COMMIT;\s*$/,'ROLLBACK;'));
 if(rows()!==before||compareFullSchema(baseline,read(),baseline.baselineSha,baseline.manifest).status!=='PASS')throw Error('CARD_SET_ROLLBACK_FAILED');
 const capture=(q:string)=>JSON.parse(sql(CARD_SET_SQL.replace(/COMMIT;\s*$/,`${q};ROLLBACK;`)).split('\n').filter(line=>!['BEGIN','CREATE TABLE','CREATE FUNCTION','CREATE TRIGGER','ROLLBACK',''].includes(line.trim())).join('\n'));
 const expected={...baseline,columns:capture(DIAGNOSTIC_COLUMNS_SQL),catalog:capture(DIAGNOSTIC_CATALOG_SQL),objects:capture(SCHEMA_OBJECTS_SQL)};
 sql(CARD_SET_SQL);
 if(rows()!==before||compareFullSchema(expected,read(),baseline.baselineSha,baseline.manifest).status!=='PASS')throw Error('CARD_SET_UNEXPECTED_DELTA');
 for(const table of ['bingo_card_set_settings','bingo_evening_card_sets','bingo_wildcard_series'])if(sql(`SELECT count(*) FROM pubquiz.${table}`).trim()!=='0')throw Error('CARD_SET_BACKFILL');
 const valid=`INSERT INTO pubquiz.bingo_card_set_settings(game_id,config) VALUES('${game}','{}');INSERT INTO pubquiz.bingo_evening_card_sets(id,game_id,request_hash,manifest,created_by) VALUES('${set}','${game}','${'e'.repeat(64)}','{}',97000);INSERT INTO pubquiz.bingo_wildcard_series(series_id,game_id,round_id) VALUES('${series}','${game}','${round}');`;
 sql(`BEGIN;${valid}SET CONSTRAINTS ALL IMMEDIATE;ROLLBACK;`);
 const rejected=(statement:string)=>{let failed=false;try{sql(`BEGIN;${valid}${statement};SET CONSTRAINTS ALL IMMEDIATE;ROLLBACK;`);}catch{failed=true;}if(!failed)throw Error('CARD_SET_CONSTRAINT_MISSING');};
 for(const statement of [`UPDATE pubquiz.bingo_evening_card_sets SET request_hash=request_hash`,`DELETE FROM pubquiz.bingo_evening_card_sets`,`DELETE FROM pubquiz.bingo_wildcard_series`,`UPDATE pubquiz.bingo_wildcard_series SET round_id=round_id`,`UPDATE pubquiz.bingo_card_set_settings SET config='[]'`,`INSERT INTO pubquiz.bingo_rounds(id,game_id,position,label) VALUES('${set}','${game}',2,'Cannot replace final round')`,`DELETE FROM pubquiz.game_drafts WHERE id='${game}'`])rejected(statement);
 if(rows()!==before)throw Error('CARD_SET_OLD_READERS_CHANGED');
 return {status:'PASS',migration:CARD_SET_MIGRATION,checksum:createHash('sha256').update(CARD_SET_SQL).digest('hex'),rowsUnchanged:true,onlyExpectedSchemaChanges:true,oldReadersCompatible:true,constraintsEnforced:true,rollbackProbe:true,noBackfill:true};
}
