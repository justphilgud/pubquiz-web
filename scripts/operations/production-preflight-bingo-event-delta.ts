import {execFileSync} from "node:child_process";
import {BINGO_EVENT_PLAN as plan,assertBingoEventManifest} from "./production-preflight-bingo-event-plan";
import {migrationFiles} from "./production-preflight";
import {compareFullSchema,DIAGNOSTIC_COLUMNS_SQL,DIAGNOSTIC_CATALOG_SQL,SCHEMA_OBJECTS_SQL,type SchemaEvidence} from "./production-preflight-schema";
type Row=Record<string,unknown>;
const tables=["bingo_event_creation_requests","bingo_event_runs","bingo_event_round_plan","bingo_event_rounds","bingo_event_round_cards"];
const triggers=["bingo_event_creation_immutable","bingo_event_runs_immutable","bingo_event_plan_immutable","bingo_event_rounds_immutable","bingo_event_cards_immutable"];
/** Only called in the secret-free, --network none disposable PostgreSQL container. */
export function testBingoEventDelta(sql:(v:string|Buffer)=>string,query:(v:string)=>unknown,baselineSha:string,candidateSha:string,manifest:SchemaEvidence["manifest"],columns:unknown,catalog:unknown,objects:unknown){
 const show=(sha:string,path:string)=>execFileSync("git",["show",`${sha}:${path}`],{encoding:"utf8"});
 assertBingoEventManifest(baselineSha,candidateSha,manifest,migrationFiles(candidateSha),show(baselineSha,"prisma/schema.prisma"),show(candidateSha,"prisma/schema.prisma"));
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
 INSERT INTO pubquiz.bingo_card_series(id,game_id,origin_round_id,code,card_count,request_id,request_hash,print_snapshot,created_by) VALUES('${series}','${game}','${round}','BG-AAAAAAAAAAAA',1,'97000000-0000-4000-8000-000000000004','${"a".repeat(64)}','{"version":1}',97000);
 INSERT INTO pubquiz.bingo_cards(id,series_id,ordinal,printed_code,cells,layout_hash) VALUES('${card}','${series}',1,'BG-AAAAAAAAAAAA-0001','${cells}','${"b".repeat(64)}');
 INSERT INTO pubquiz.bingo_round_series(round_id,series_id,game_id) VALUES('${round}','${series}','${game}');COMMIT;`);
 // Representative existing AP3 run and journal are created before the additive delta.
 const insertRun=(id:string,key:string)=>`INSERT INTO pubquiz.bingo_live_runs(id,game_id,round_id,eventreihe_id,status,created_by,round_snapshot,design_snapshot,visual_assets,audience_key,start_request_id,start_request_hash) VALUES('${id}','${game}','${round}',97000,'RUNNING',97000,'{}','{}','{}','${key}','${key}','${"c".repeat(64)}')`;
 sql(insertRun(run,run));
 sql(`INSERT INTO pubquiz.bingo_live_cards(run_id,game_id,card_id,series_id) VALUES('${run}','${game}','${card}','${series}');
 INSERT INTO pubquiz.bingo_live_events(run_id,revision,request_id,request_hash,actor_id,command) VALUES('${run}',1,'${run}','${"d".repeat(64)}',97000,'{"kind":"pause"}');`);
 const before=rows(),expected={baselineSha,manifest,major:17,columns,catalog,objects};
 sql("SET lock_timeout='2s'; SET statement_timeout='30s';\n"+migration.replace(/COMMIT;\s*$/,"ROLLBACK;"));
 const readSchema=()=>({major:17,columns:query(DIAGNOSTIC_COLUMNS_SQL),catalog:query(DIAGNOSTIC_CATALOG_SQL),objects:query(SCHEMA_OBJECTS_SQL)});
 if(rows()!==before||compareFullSchema(expected,readSchema(),baselineSha,manifest).status!=="PASS")throw Error("EVENT_ROLLBACK_CHANGED_BASELINE");
 const started=Date.now();sql("SET lock_timeout='2s'; SET statement_timeout='30s';\n"+migration);
 // The old event row only receives NULL; no AP3 data or initial snapshot is rewritten.
 const projectedRows=()=>sql(oldTables.map(t=>`SELECT '${t.schema}.${t.name}' AS name,coalesce(jsonb_agg(v ORDER BY v::text),'[]')::text AS rows FROM (SELECT to_jsonb(t)${t.schema==='pubquiz'&&t.name==='bingo_live_events'?"-'event_round_id'":""} v FROM ${identifier(t.schema)}.${identifier(t.name)} t) s`).join(" UNION ALL ")+" ORDER BY name");
 if(projectedRows()!==before||sql(`SELECT count(*) FROM pubquiz.bingo_live_events WHERE event_round_id IS NOT NULL`).trim()!=="0")throw Error("EVENT_EXISTING_ROWS_CHANGED");
 const rejected=(statement:string)=>{let failed=false;try{sql(statement);}catch{failed=true;}if(!failed)throw Error("EVENT_CONSTRAINT_NOT_ENFORCED");};
 const creation=`INSERT INTO pubquiz.bingo_event_creation_requests(request_id,game_id,created_by,request_hash)VALUES('${other}','${game}',97000,'${"a".repeat(64)}')`;
 const version=`INSERT INTO pubquiz.bingo_event_runs(run_id,version)VALUES('${run}',2)`;
 const planned=`INSERT INTO pubquiz.bingo_event_round_plan(run_id,game_id,round_id,position)VALUES('${run}','${game}','${round}',1)`;
 const opened=`INSERT INTO pubquiz.bingo_event_rounds(run_id,game_id,round_id,round_snapshot,opened_at)VALUES('${run}','${game}','${round}','{}',NOW())`;
 const frozen=`INSERT INTO pubquiz.bingo_event_round_cards(run_id,game_id,round_id,card_id,series_id)VALUES('${run}','${game}','${round}','${card}','${series}')`;
 rejected(planned);rejected(opened);rejected(frozen);
 rejected(`INSERT INTO pubquiz.bingo_event_runs(run_id,version)VALUES('${other}',2)`);
 rejected(`INSERT INTO pubquiz.bingo_event_runs(run_id,version)VALUES('${run}',3)`);
 sql(creation);rejected(creation);sql(version);sql(planned);sql(opened);sql(frozen);
 rejected(`INSERT INTO pubquiz.bingo_event_round_cards(run_id,game_id,round_id,card_id,series_id)VALUES('${run}','${game}','${round}','${other}','${series}')`);
 rejected(`INSERT INTO pubquiz.bingo_event_rounds(run_id,game_id,round_id,round_snapshot,opened_at)VALUES('${run}','${game}','${other}','{}',NOW())`);
 const event=(revision:number,command:string,roundId:string)=>`INSERT INTO pubquiz.bingo_live_events(run_id,revision,request_id,request_hash,actor_id,command,event_round_id)VALUES('${run}',${revision},'${other}','${"e".repeat(64)}',97000,'${command}',${roundId})`;
 rejected(event(2,'{"version":2}',"NULL"));
 rejected(event(2,'{}',`'${round}'`));
 rejected(event(2,'{"version":2}',`'${other}'`));
 // Constraint/immutability fixtures run inside rollback, preserving every old row.
 sql("BEGIN;"+event(2,'{"version":2}',`'${round}'`)+";ROLLBACK;");
 for(const table of tables){rejected(`UPDATE pubquiz.${table} SET ${table==='bingo_event_creation_requests'?"request_hash=request_hash":"run_id=run_id"}`);rejected(`DELETE FROM pubquiz.${table}`);}
 if(projectedRows()!==before)throw Error("EVENT_OLD_ROWS_CHANGED_BY_CONSTRAINT_TESTS");
 const actual=readSchema(),actualColumns=actual.columns as Row[],actualCatalog=actual.catalog as Record<string,Row[]>,actualObjects=actual.objects as Record<string,Row[]>;
 const isNew=(r:Row)=>(r.schema??r.schemaname)==="pubquiz"&&tables.includes(String(r.table??r.tablename??r.name));
 if(actualObjects.relations.filter(isNew).length!==5||actualObjects.triggers.filter(r=>r.schema==="pubquiz"&&triggers.includes(String(r.name))).length!==5)throw Error("AP3_DELTA_OBJECT_SET");
 const extraConstraint=(r:Row)=>r.schema==="pubquiz"&&r.table==="bingo_live_events"&&["bingo_event_round_reference","bingo_event_version_reference"].includes(String(r.name));
 const projectedCatalog=Object.fromEntries(Object.entries(actualCatalog).map(([key,values])=>[key,values.filter(r=>!isNew(r)&&!(key==="constraints"&&extraConstraint(r)))]));
 const projectedObjects={...actualObjects,relations:actualObjects.relations.filter(r=>!isNew(r)),triggers:actualObjects.triggers.filter(r=>!(r.schema==="pubquiz"&&triggers.includes(String(r.name))))};
 const projectedColumns=actualColumns.filter(r=>!isNew(r)&&!(r.schema==="pubquiz"&&r.table==="bingo_live_events"&&r.column==="event_round_id"));
 if(compareFullSchema(expected,{major:17,columns:projectedColumns,catalog:projectedCatalog,objects:projectedObjects},baselineSha,manifest).status!=="PASS")throw Error("UNEXPECTED_AP3_SCHEMA_DELTA");
 return {status:"PASS",baselineSha,candidateSha,migrations:plan.migrations,elapsedMs:Date.now()-started,rowsUnchanged:true,onlyExpectedSchemaChanges:true,oldColumnProjectionCompatible:true,constraintsEnforced:true,immutableHistory:true,legacyRunPreserved:true,rollbackProbe:true,lockTimeoutMs:2000,statementTimeoutMs:30000,applicationRollbackRequiresReview:true};
}
