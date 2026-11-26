import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {assertBingoEveningManifest} from './production-preflight-bingo-evening-plan';
import {migrationFiles} from './production-preflight';
import {compareFullSchema,DIAGNOSTIC_COLUMNS_SQL,DIAGNOSTIC_CATALOG_SQL,SCHEMA_OBJECTS_SQL,type SchemaEvidence} from './production-preflight-schema';

/** The existing network-isolated PostgreSQL builder supplies SQL; no live credentials. */
export function testBingoEveningDelta(sql:(v:string|Buffer)=>string,query:(v:string)=>unknown,baselineSha:string,candidateSha:string,manifest:SchemaEvidence['manifest'],columns:unknown,catalog:unknown,objects:unknown){
 const show=(sha:string,path:string)=>execFileSync('git',['show',`${sha}:${path}`],{encoding:'utf8'});
 const plan=assertBingoEveningManifest(baselineSha,candidateSha,manifest,migrationFiles(candidateSha),show(baselineSha,'prisma/schema.prisma'),show(candidateSha,'prisma/schema.prisma'));
 const migration=show(candidateSha,`prisma/migrations/${plan.migrations[0].name}/migration.sql`);
 const readSchema=()=>({major:17,columns:query(DIAGNOSTIC_COLUMNS_SQL),catalog:query(DIAGNOSTIC_CATALOG_SQL),objects:query(SCHEMA_OBJECTS_SQL)});
 const expected={baselineSha,manifest,major:17,columns,catalog,objects};
 const identifier=(v:string)=>{if(!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(v))throw Error('IDENTIFIER');return `"${v}"`;};
 const tables=(objects as {relations:{schema:string;name:string;kind:string}[]}).relations.filter(r=>r.kind==='r'&&r.name!=='_prisma_migrations');
 const rows=()=>sql(tables.map(t=>`SELECT '${t.schema}.${t.name}' AS name,coalesce(jsonb_agg(v ORDER BY v::text),'[]')::text AS rows FROM (SELECT to_jsonb(t) v FROM ${identifier(t.schema)}.${identifier(t.name)} t) s`).join(' UNION ALL ')+' ORDER BY name');
 const game='97000000-0000-4000-8000-000000000001',round='97000000-0000-4000-8000-000000000002',series='97000000-0000-4000-8000-000000000003',card='97000000-0000-4000-8000-000000000005',run='98000000-0000-4000-8000-000000000001';
 const cells=JSON.stringify(Array.from({length:5},(_,r)=>Array.from({length:5},(_,c)=>r===2&&c===2?null:c*15+r+1)));
 sql(`BEGIN;
 INSERT INTO pubquiz.users(id,name,email,password_hash,role,updated_at) VALUES(97000,'Isolated PR182','pr182@example.invalid','not-a-login-hash','USER',NOW());
 INSERT INTO pubquiz.eventreihen(eventreihe_id,name,slug) VALUES(97000,'Isolated PR182','isolated-pr182');
 INSERT INTO pubquiz.quiz(quiz_id,eventreihe_id,titel,quiz_datum,intro_begruessungstext) VALUES(97000,97000,'Existing quiz','2026-11-26','Preserve existing content');
 INSERT INTO pubquiz.game_drafts(id,eventart,eventreihe_id,titel,updated_at) VALUES('${game}','BINGO',97000,'Independent evening',NOW());
 INSERT INTO pubquiz.bingo_preparations(game_id) VALUES('${game}');
 INSERT INTO pubquiz.bingo_rounds(id,game_id,position,label) VALUES('${round}','${game}',1,'Round');
 INSERT INTO pubquiz.bingo_card_series(id,game_id,origin_round_id,code,card_count,request_id,request_hash,print_snapshot,created_by) VALUES('${series}','${game}','${round}','BG-AAAAAAAAAAAA',1,'${series}','${'a'.repeat(64)}','{"version":2}',97000);
 INSERT INTO pubquiz.bingo_cards(id,series_id,ordinal,printed_code,cells,layout_hash) VALUES('${card}','${series}',1,'BG-AAAAAAAAAAAA-0001','${cells}','${'b'.repeat(64)}');
 INSERT INTO pubquiz.bingo_round_series(round_id,series_id,game_id) VALUES('${round}','${series}','${game}');
 INSERT INTO pubquiz.bingo_live_runs(id,game_id,round_id,eventreihe_id,status,created_by,round_snapshot,design_snapshot,visual_assets,audience_key,start_request_id,start_request_hash) VALUES('${run}','${game}','${round}',97000,'RUNNING',97000,'{}','{}','{}','${run}','${run}','${'c'.repeat(64)}');
 INSERT INTO pubquiz.bingo_live_cards(run_id,game_id,card_id,series_id) VALUES('${run}','${game}','${card}','${series}');
 INSERT INTO pubquiz.bingo_live_events(run_id,revision,request_id,request_hash,actor_id,command) VALUES('${run}',1,'${run}','${'d'.repeat(64)}',97000,'{"kind":"pause"}');COMMIT;`);
 const before=rows();
 sql("BEGIN;SET LOCAL lock_timeout='2s';SET LOCAL statement_timeout='30s';\n"+migration+'\nROLLBACK;');
 if(rows()!==before||compareFullSchema(expected,readSchema(),baselineSha,manifest).status!=='PASS')throw Error('EVENING_ROLLBACK_CHANGED_BASELINE');
 const reference=readFileSync('scripts/operations/schema-reference/pr182-ceremony.sql','utf8');
 const capture=(q:string)=>JSON.parse(sql(`BEGIN;${reference}\n${q};ROLLBACK;`).split('\n').filter(line=>!['BEGIN','CREATE TABLE','ROLLBACK',''].includes(line.trim())).join('\n'));
 const expectedAdded={...expected,columns:capture(DIAGNOSTIC_COLUMNS_SQL),catalog:capture(DIAGNOSTIC_CATALOG_SQL),objects:capture(SCHEMA_OBJECTS_SQL)};
 const started=Date.now();
 sql("BEGIN;SET LOCAL lock_timeout='2s';SET LOCAL statement_timeout='30s';\n"+migration+'\nCOMMIT;');
 if(rows()!==before)throw Error('EVENING_EXISTING_ROWS_CHANGED');
 if(compareFullSchema(expectedAdded,readSchema(),baselineSha,manifest).status!=='PASS')throw Error('UNEXPECTED_EVENING_SCHEMA_DELTA');
 if(sql('SELECT count(*) FROM pubquiz.game_ceremonies').trim()!=='0')throw Error('EVENING_UNEXPECTED_BACKFILL');
 const standalone='99000000-0000-4000-8000-000000000001';
 const valid=`INSERT INTO pubquiz.game_drafts(id,eventart,eventreihe_id,titel,updated_at) VALUES('${standalone}','BINGO',97000,'Ceremony only',NOW());INSERT INTO pubquiz.game_ceremonies(game_id,state) VALUES('${standalone}','{}');`;
 sql(`BEGIN;${valid}UPDATE pubquiz.game_ceremonies SET state='{"revision":1}';ROLLBACK;`);
 const rejected=(statement:string)=>{let failed=false;try{sql(`BEGIN;${valid}${statement};ROLLBACK;`);}catch{failed=true;}if(!failed)throw Error('EVENING_CONSTRAINT_NOT_ENFORCED');};
 for(const statement of [
  "UPDATE pubquiz.game_ceremonies SET state='[]'", "UPDATE pubquiz.game_ceremonies SET state='null'",
  "UPDATE pubquiz.game_ceremonies SET state='1'", "UPDATE pubquiz.game_ceremonies SET state=NULL",
  "UPDATE pubquiz.game_ceremonies SET updated_at=NULL",
  `INSERT INTO pubquiz.game_ceremonies(game_id,state) VALUES('${standalone}','{}')`,
  `UPDATE pubquiz.game_ceremonies SET game_id='99000000-0000-4000-8000-000000000099'`,
  `DELETE FROM pubquiz.game_drafts WHERE id='${standalone}'`,
 ])rejected(statement);
 if(rows()!==before||sql('SELECT count(*) FROM pubquiz.game_ceremonies').trim()!=='0')throw Error('EVENING_PROBES_CHANGED_HISTORY');
 return {status:'PASS',baselineSha,candidateSha,migrations:plan.migrations,elapsedMs:Date.now()-started,rowsUnchanged:true,onlyExpectedSchemaChanges:true,oldColumnProjectionCompatible:true,constraintsEnforced:true,immutableHistory:true,legacyRunPreserved:true,noBackfill:true,newCeremonyObjectVerified:true,rollbackProbe:true,lockTimeoutMs:2000,statementTimeoutMs:30000,applicationRollbackRequiresReview:true};
}
