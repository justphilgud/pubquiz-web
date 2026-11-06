import {execFileSync} from "node:child_process";
import {BINGO_CARD_PLAN as plan,assertBingoCardManifest} from "./production-preflight-bingo-card-plan";
import {migrationFiles} from "./production-preflight";
import {compareFullSchema,DIAGNOSTIC_COLUMNS_SQL,DIAGNOSTIC_CATALOG_SQL,SCHEMA_OBJECTS_SQL,type SchemaEvidence} from "./production-preflight-schema";
type Row=Record<string,unknown>;
const tables=["bingo_term_sets"];
/** Only called in the secret-free, --network none disposable PostgreSQL container. */
export function testBingoCardDelta(sql:(v:string|Buffer)=>string,query:(v:string)=>unknown,baselineSha:string,candidateSha:string,manifest:SchemaEvidence["manifest"],columns:unknown,catalog:unknown,objects:unknown){
 const show=(sha:string,path:string)=>execFileSync("git",["show",`${sha}:${path}`],{encoding:"utf8"});
 assertBingoCardManifest(baselineSha,candidateSha,manifest,migrationFiles(candidateSha),show(baselineSha,"prisma/schema.prisma"),show(candidateSha,"prisma/schema.prisma"));
 const migration=show(candidateSha,`prisma/migrations/${plan.migrations[0].name}/migration.sql`);
 const identifier=(v:string)=>{if(!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(v))throw Error("IDENTIFIER");return `"${v}"`;};
 const oldTables=(objects as {relations:{schema:string;name:string;kind:string}[]}).relations.filter(r=>r.kind==="r"&&r.name!=="_prisma_migrations");
 const rows=()=>sql(oldTables.map(t=>`SELECT '${t.schema}.${t.name}' AS name,coalesce(jsonb_agg(v ORDER BY v::text),'[]')::text AS rows FROM (SELECT to_jsonb(t) v FROM ${identifier(t.schema)}.${identifier(t.name)} t) s`).join(" UNION ALL ")+" ORDER BY name");
 const game="97000000-0000-4000-8000-000000000001",round="97000000-0000-4000-8000-000000000002",series="97000000-0000-4000-8000-000000000003",card="97000000-0000-4000-8000-000000000005";
 const run="98000000-0000-4000-8000-000000000001",other="98000000-0000-4000-8000-000000000002";
 const cells=JSON.stringify(Array.from({length:5},(_,r)=>Array.from({length:5},(_,c)=>r===2&&c===2?null:c*15+r+1)));
 sql(`BEGIN;INSERT INTO pubquiz.users(id,name,email,password_hash,role,updated_at) VALUES(97000,'Isolated AP3','ap3@example.invalid','not-a-login-hash','USER',NOW());
 INSERT INTO pubquiz.eventreihen(eventreihe_id,name,slug) VALUES(97000,'Isolated AP3','isolated-ap3');
 INSERT INTO pubquiz.game_drafts(id,eventart,eventreihe_id,titel,updated_at) VALUES('${game}','BINGO',97000,'Isolated AP3',NOW());
 INSERT INTO pubquiz.bingo_preparations(game_id) VALUES('${game}');
 INSERT INTO pubquiz.bingo_rounds(id,game_id,position,label) VALUES('${round}','${game}',1,'Isolated AP3');
 INSERT INTO pubquiz.bingo_card_series(id,game_id,origin_round_id,code,card_count,request_id,request_hash,print_snapshot,created_by) VALUES('${series}','${game}','${round}','BG-AAAAAAAAAAAA',1,'97000000-0000-4000-8000-000000000004','${"a".repeat(64)}','{"version":2}',97000);
 INSERT INTO pubquiz.bingo_cards(id,series_id,ordinal,printed_code,cells,layout_hash) VALUES('${card}','${series}',1,'BG-AAAAAAAAAAAA-0001','${cells}','${"b".repeat(64)}');
 INSERT INTO pubquiz.bingo_round_series(round_id,series_id,game_id) VALUES('${round}','${series}','${game}');COMMIT;`);
 // Representative existing AP3 run and journal are created before the additive delta.
 const insertRun=(id:string,key:string)=>`INSERT INTO pubquiz.bingo_live_runs(id,game_id,round_id,eventreihe_id,status,created_by,round_snapshot,design_snapshot,visual_assets,audience_key,start_request_id,start_request_hash) VALUES('${id}','${game}','${round}',97000,'RUNNING',97000,'{}','{}','{}','${key}','${key}','${"c".repeat(64)}')`;
 sql(insertRun(run,run));
 sql(`INSERT INTO pubquiz.bingo_live_cards(run_id,game_id,card_id,series_id) VALUES('${run}','${game}','${card}','${series}');
 INSERT INTO pubquiz.bingo_live_events(run_id,revision,request_id,request_hash,actor_id,command) VALUES('${run}',1,'${run}','${"d".repeat(64)}',97000,'{"kind":"pause"}');`);
 const before=rows(),expected={baselineSha,manifest,major:17,columns,catalog,objects};
 const readSchema=()=>({major:17,columns:query(DIAGNOSTIC_COLUMNS_SQL),catalog:query(DIAGNOSTIC_CATALOG_SQL),objects:query(SCHEMA_OBJECTS_SQL)});
 sql("SET lock_timeout='2s'; SET statement_timeout='30s';\n"+migration.replace(/COMMIT;\s*$/,"ROLLBACK;"));
 if(rows()!==before||compareFullSchema(expected,readSchema(),baselineSha,manifest).status!=="PASS")throw Error("CARD_ROLLBACK_CHANGED_BASELINE");
 const started=Date.now();sql("SET lock_timeout='2s'; SET statement_timeout='30s';\n"+migration);
 const projectedRows=()=>sql(oldTables.map(t=>`SELECT '${t.schema}.${t.name}' AS name,coalesce(jsonb_agg(v ORDER BY v::text),'[]')::text AS rows FROM (SELECT to_jsonb(t)${t.schema==='pubquiz'&&t.name==='bingo_rounds'?"-'term_snapshot'":""} v FROM ${identifier(t.schema)}.${identifier(t.name)} t) s`).join(" UNION ALL ")+" ORDER BY name");
 if(projectedRows()!==before||sql('SELECT count(*) FROM pubquiz.bingo_rounds WHERE term_snapshot IS NOT NULL').trim()!=="0"||sql('SELECT count(*) FROM pubquiz.bingo_term_sets').trim()!=="0")throw Error("CARD_EXISTING_ROWS_CHANGED");
 const rejected=(statement:string)=>{let failed=false;try{sql(statement);}catch{failed=true;}if(!failed)throw Error("CARD_CONSTRAINT_NOT_ENFORCED");};
 // Fixture modifications are rolled back; existing cards, run and journal remain byte-equivalent.
 sql(`BEGIN;INSERT INTO pubquiz.bingo_card_series(id,game_id,origin_round_id,code,card_count,request_id,request_hash,print_snapshot,created_by) VALUES('${other}','${game}','${round}','BG-BBBBBBBBBBBB',1,'${other}','${"a".repeat(64)}','{"version":3}',97000);UPDATE pubquiz.bingo_rounds SET term_snapshot='{"version":1}' WHERE id='${round}';INSERT INTO pubquiz.bingo_print_versions(series_id,version,snapshot,created_by) VALUES('${series}',2,'{"version":3}',97000);INSERT INTO pubquiz.bingo_term_sets(id,game_id,config) VALUES('${other}','${game}','{"version":1}');ROLLBACK;`);
 rejected(`INSERT INTO pubquiz.bingo_card_series(id,game_id,origin_round_id,code,card_count,request_id,request_hash,print_snapshot,created_by) VALUES('${other}','${game}','${round}','BG-BBBBBBBBBBBB',1,'${other}','${"a".repeat(64)}','{"version":4}',97000)`);
 rejected(`INSERT INTO pubquiz.bingo_print_versions(series_id,version,snapshot,created_by) VALUES('${series}',2,'{"version":1}',97000)`);
 rejected(`UPDATE pubquiz.bingo_rounds SET term_snapshot='{"version":2}' WHERE id='${round}'`);
 rejected(`INSERT INTO pubquiz.bingo_term_sets(id,game_id,config) VALUES('${other}','${other}','{"version":1}')`);
 rejected(`INSERT INTO pubquiz.bingo_term_sets(id,game_id,config) VALUES('${other}','${game}','{"version":2}')`);
 rejected(`INSERT INTO pubquiz.bingo_term_sets(id,game_id,config,revision) VALUES('${other}','${game}','{"version":1}',-1)`);
 if(projectedRows()!==before)throw Error("CARD_OLD_ROWS_CHANGED_BY_PROBES");
 const actual=readSchema(),actualColumns=actual.columns as Row[],actualCatalog=actual.catalog as Record<string,Row[]>,actualObjects=actual.objects as Record<string,Row[]>;
 const isNew=(r:Row)=>(r.schema??r.schemaname)==="pubquiz"&&tables.includes(String(r.table??r.tablename??r.name));
 const changedNames=["bingo_card_series_print_snapshot_check","bingo_print_versions_snapshot_check"];
 const changed=(r:Row)=>r.schema==="pubquiz"&&((r.table==="bingo_card_series"&&r.name===changedNames[0])||(r.table==="bingo_print_versions"&&r.name===changedNames[1]));
 const newRoundCheck=(r:Row)=>r.schema==="pubquiz"&&r.table==="bingo_rounds"&&r.name==="bingo_round_terms_shape";
 // Independently construct only the three declared CHECK expressions, not a wildcard catalog exception.
 const expectedDefinitions=JSON.parse(sql(`BEGIN;CREATE TEMP TABLE card_expected_checks(print_snapshot jsonb,snapshot jsonb,term_snapshot jsonb,CONSTRAINT expected_series CHECK(jsonb_typeof(print_snapshot)='object' AND print_snapshot->>'version' IN ('1','2','3')),CONSTRAINT expected_version CHECK(jsonb_typeof(snapshot)='object' AND snapshot->>'version' IN ('2','3')),CONSTRAINT expected_round CHECK(term_snapshot IS NULL OR (jsonb_typeof(term_snapshot)='object' AND term_snapshot->>'version'='1')));SELECT json_object_agg(conname,pg_get_constraintdef(oid)) FROM pg_constraint WHERE conrelid='pg_temp.card_expected_checks'::regclass;ROLLBACK;`).split('\n').find(line=>line.startsWith('{'))!) as Record<string,string>;
 for(const [name,expectedName] of [...changedNames.map((name,i)=>[name,i?'expected_version':'expected_series']),['bingo_round_terms_shape','expected_round']]){
  const found=actualCatalog.constraints.filter(r=>r.schema==='pubquiz'&&r.name===name);
  const definition=expectedDefinitions[expectedName];
  if(found.length!==1||found[0].definition!==definition||found[0].validated!==true)throw Error('CARD_CHECK_DEFINITION_CHANGED');
 }
 if(actualObjects.relations.filter(isNew).length!==1||actualColumns.filter(isNew).length!==6||actualCatalog.constraints.filter(isNew).length!==4)throw Error("CARD_DELTA_OBJECT_SET");
 const projectedCatalog=Object.fromEntries(Object.entries(actualCatalog).map(([key,values])=>[key,key==='constraints'?[...values.filter(r=>!isNew(r)&&!changed(r)&&!newRoundCheck(r)),...(catalog as Record<string,Row[]>).constraints.filter(changed)]:values.filter(r=>!isNew(r))]));
 const projectedObjects={...actualObjects,relations:actualObjects.relations.filter(r=>!isNew(r))};
 const projectedColumns=actualColumns.filter(r=>!isNew(r)&&!(r.schema==='pubquiz'&&r.table==='bingo_rounds'&&r.column==='term_snapshot'));
 const termColumn=actualColumns.filter(r=>r.schema==='pubquiz'&&r.table==='bingo_rounds'&&r.column==='term_snapshot');
 if(termColumn.length!==1||termColumn[0].nullable!==true||termColumn[0].type!=="jsonb"||termColumn[0].default!==null||compareFullSchema(expected,{major:17,columns:projectedColumns,catalog:projectedCatalog,objects:projectedObjects},baselineSha,manifest).status!=="PASS")throw Error("UNEXPECTED_CARD_SCHEMA_DELTA");
 return {status:"PASS",baselineSha,candidateSha,migrations:plan.migrations,elapsedMs:Date.now()-started,rowsUnchanged:true,onlyExpectedSchemaChanges:true,oldColumnProjectionCompatible:true,constraintsEnforced:true,immutableHistory:true,legacyRunPreserved:true,v3Accepted:true,newTermsBound:true,rollbackProbe:true,lockTimeoutMs:2000,statementTimeoutMs:30000,applicationRollbackRequiresReview:true};
}
