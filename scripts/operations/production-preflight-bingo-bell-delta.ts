import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {BINGO_BELL_PLAN as plan,assertBingoBellManifest} from './production-preflight-bingo-bell-plan';
import {migrationFiles} from './production-preflight';
import {compareFullSchema,DIAGNOSTIC_COLUMNS_SQL,DIAGNOSTIC_CATALOG_SQL,SCHEMA_OBJECTS_SQL,type SchemaEvidence} from './production-preflight-schema';

/** Disposable PostgreSQL supplied by the existing isolated builder; no live connection. */
export function testBingoBellDelta(sql:(v:string|Buffer)=>string,query:(v:string)=>unknown,baselineSha:string,candidateSha:string,manifest:SchemaEvidence['manifest'],columns:unknown,catalog:unknown,objects:unknown){
 const show=(sha:string,path:string)=>execFileSync('git',['show',`${sha}:${path}`],{encoding:'utf8'});
 assertBingoBellManifest(baselineSha,candidateSha,manifest,migrationFiles(candidateSha),show(baselineSha,'prisma/schema.prisma'),show(candidateSha,'prisma/schema.prisma'));
 const migration=show(candidateSha,`prisma/migrations/${plan.migrations[0].name}/migration.sql`);
 const readSchema=()=>({major:17,columns:query(DIAGNOSTIC_COLUMNS_SQL),catalog:query(DIAGNOSTIC_CATALOG_SQL),objects:query(SCHEMA_OBJECTS_SQL)});
 const expected={baselineSha,manifest,major:17,columns,catalog,objects};
 const identifier=(v:string)=>{if(!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(v))throw Error('IDENTIFIER');return `"${v}"`;};
 const tables=(objects as {relations:{schema:string;name:string;kind:string}[]}).relations.filter(r=>r.kind==='r'&&r.name!=='_prisma_migrations');
 const rows=()=>sql(tables.map(t=>`SELECT '${t.schema}.${t.name}' AS name,coalesce(jsonb_agg(v ORDER BY v::text),'[]')::text AS rows FROM (SELECT to_jsonb(t) v FROM ${identifier(t.schema)}.${identifier(t.name)} t) s`).join(' UNION ALL ')+' ORDER BY name');
 const game='97000000-0000-4000-8000-000000000001',round='97000000-0000-4000-8000-000000000002',series='97000000-0000-4000-8000-000000000003',card='97000000-0000-4000-8000-000000000005',run='98000000-0000-4000-8000-000000000001';
 const cells=JSON.stringify(Array.from({length:5},(_,r)=>Array.from({length:5},(_,c)=>r===2&&c===2?null:c*15+r+1)));
 sql(`BEGIN;
 INSERT INTO pubquiz.users(id,name,email,password_hash,role,updated_at) VALUES(97000,'Isolated PR180','pr180@example.invalid','not-a-login-hash','USER',NOW());
 INSERT INTO pubquiz.eventreihen(eventreihe_id,name,slug) VALUES(97000,'Isolated PR180','isolated-pr180');
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
 sql("SET lock_timeout='2s';SET statement_timeout='30s';\n"+migration.replace(/COMMIT;\s*$/,'ROLLBACK;'));
 if(rows()!==before||compareFullSchema(expected,readSchema(),baselineSha,manifest).status!=='PASS')throw Error('BELL_ROLLBACK_CHANGED_BASELINE');
 // Build expected additions independently, capture full catalogs in one rolled-back session.
 const reference=readFileSync('scripts/operations/schema-reference/pr180-content.sql','utf8');
 const capture=(q:string)=>JSON.parse(sql(`BEGIN;${reference}\n${q};ROLLBACK;`).split('\n').filter(line=>!['BEGIN','CREATE TABLE','CREATE INDEX','ROLLBACK',''].includes(line.trim())).join('\n'));
 const expectedAdded={...expected,columns:capture(DIAGNOSTIC_COLUMNS_SQL),catalog:capture(DIAGNOSTIC_CATALOG_SQL),objects:capture(SCHEMA_OBJECTS_SQL)};
 const started=Date.now();sql("SET lock_timeout='2s';SET statement_timeout='30s';\n"+migration);
 if(rows()!==before)throw Error('BELL_EXISTING_ROWS_CHANGED');
 if(compareFullSchema(expectedAdded,readSchema(),baselineSha,manifest).status!=='PASS')throw Error('UNEXPECTED_BELL_SCHEMA_DELTA');
 const counts=JSON.parse(sql("SELECT json_build_array((SELECT count(*) FROM pubquiz.bingo_round_templates),(SELECT count(*) FROM pubquiz.bingo_print_jobs),(SELECT count(*) FROM pubquiz.bingo_print_job_items))").trim());
 if(JSON.stringify(counts)!=='[0,0,0]')throw Error('BELL_UNEXPECTED_BACKFILL');
 const template='99000000-0000-4000-8000-000000000001',job='99000000-0000-4000-8000-000000000002';
 const valid=`INSERT INTO pubquiz.bingo_round_templates(id,eventreihe_id,name,source_game_id,created_by) VALUES('${template}',97000,'Template','${game}',97000);INSERT INTO pubquiz.bingo_print_jobs(id,game_id,request_hash,cards_per_round,created_by) VALUES('${job}','${game}','${'e'.repeat(64)}',13,97000);INSERT INTO pubquiz.bingo_print_job_items(job_id,game_id,round_id,series_id,round_position,round_label) VALUES('${job}','${game}','${round}','${series}',1,'Round');`;
 sql(`BEGIN;${valid}ROLLBACK;`);
 const rejected=(statement:string)=>{let failed=false;try{sql(`BEGIN;${valid}${statement};ROLLBACK;`);}catch{failed=true;}if(!failed)throw Error('BELL_CONSTRAINT_NOT_ENFORCED');};
 for(const statement of [`UPDATE pubquiz.bingo_round_templates SET planned_draws=76`,`UPDATE pubquiz.bingo_round_templates SET name=' '`,`UPDATE pubquiz.bingo_round_templates SET config='[]'`,`UPDATE pubquiz.bingo_round_templates SET revision=-1`,`UPDATE pubquiz.bingo_print_jobs SET cards_per_round=0`,`UPDATE pubquiz.bingo_print_job_items SET round_position=0`,`UPDATE pubquiz.bingo_print_job_items SET game_id='${template}'`,`DELETE FROM pubquiz.bingo_print_jobs`,`DELETE FROM pubquiz.bingo_rounds WHERE id='${round}'`,`DELETE FROM pubquiz.game_drafts WHERE id='${game}'`])rejected(statement);
 if(rows()!==before)throw Error('BELL_PROBES_CHANGED_HISTORY');
 return {status:'PASS',baselineSha,candidateSha,migrations:plan.migrations,elapsedMs:Date.now()-started,rowsUnchanged:true,onlyExpectedSchemaChanges:true,oldColumnProjectionCompatible:true,constraintsEnforced:true,immutableHistory:true,legacyRunPreserved:true,noBackfill:true,newContentObjectsVerified:true,rollbackProbe:true,lockTimeoutMs:2000,statementTimeoutMs:30000,applicationRollbackRequiresReview:true};
}
