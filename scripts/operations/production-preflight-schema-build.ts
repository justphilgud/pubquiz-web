import {approvedBingoEventPlan} from "./production-preflight-bingo-event-plan";
import {testBingoEventDelta} from "./production-preflight-bingo-event-delta";
import {approvedBingoLivePlan} from "./production-preflight-bingo-live-plan";
import {testBingoLiveDelta} from "./production-preflight-bingo-live-delta";
import {approvedBingoPlan,assertBingoManifest} from './production-preflight-bingo-plan';
import {testBingoDelta} from './production-preflight-bingo-delta';
import {execFileSync} from 'node:child_process';
import {writeFileSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {migrationFiles} from './production-preflight';
import {compareFullSchema,DIAGNOSTIC_COLUMNS_SQL,DIAGNOSTIC_CATALOG_SQL,SCHEMA_OBJECTS_SQL} from './production-preflight-schema';
import {approvedPreflightPlan,approvedNoDeltaPreflightPlan,assertNoDeltaManifest} from './production-preflight-plan';
import {assertOnlyArchiveSchemaAdded,ARCHIVE_CAPTURE_FIXTURE_SQL} from './production-preflight-archive-delta';
async function main(){
 const sha=process.env.EXPECTED_PRODUCTION_SHA??'';
 if(process.env.GITHUB_ACTIONS!=='true'||process.env.GITHUB_REPOSITORY!=='justphilgud/pubquiz-web'||!/^[a-f0-9]{40}$/.test(sha))throw new Error('CONTEXT');
 const candidate=process.env.RELEASE_CANDIDATE_SHA??'';
 if(approvedNoDeltaPreflightPlan(sha,candidate)){
  const schema=(revision:string)=>execFileSync('git',['show',`${revision}:prisma/schema.prisma`],{encoding:'utf8'});
  const proof=assertNoDeltaManifest(sha,candidate,migrationFiles(sha),migrationFiles(candidate),schema(sha),schema(candidate));
  writeFileSync('expected-schema.json',JSON.stringify(proof,null,2),{flag:'wx'});
  writeFileSync('delta-test.json',JSON.stringify({status:'PASS',code:'NO_SCHEMA_MIGRATION_DELTA',baselineSha:sha,candidateSha:candidate}),{flag:'wx'});
  writeFileSync('new-install-replay.json',JSON.stringify({status:'NOT_RUN',code:'HISTORICAL_BOOTSTRAP_LIMITATION_UNCHANGED'}),{flag:'wx'});
  return;
 }
 const reference=JSON.parse(readFileSync('scripts/operations/schema-reference/provenance.json','utf8'));
 const bingo=approvedBingoPlan(sha,candidate);
 if(bingo){const schema=(rev:string)=>execFileSync('git',['show',`${rev}:prisma/schema.prisma`],{encoding:'utf8'});assertBingoManifest(sha,candidate,migrationFiles(sha),migrationFiles(candidate),schema(sha),schema(candidate));}
 const approved=approvedPreflightPlan(sha,process.env.RELEASE_CANDIDATE_SHA??reference.candidateSha)??(bingo?{baselineSha:sha,candidateSha:candidate,delta:'',checksum:'',kind:approvedBingoEventPlan(sha,candidate)?'bingo-event':approvedBingoLivePlan(sha,candidate)?'bingo-ap3':'bingo-ap2'}:undefined);
 if(!approved)throw new Error('RELEASE_PLAN_UNAPPROVED');
 const plan={...reference,...approved};
 const bootstrap=readFileSync('scripts/operations/schema-reference/prehistory.sql');
 if(sha!==plan.baselineSha||createHash('sha256').update(bootstrap).digest('hex')!==plan.referenceDdlSha256||createHash('sha256').update(execFileSync('git',['show',`${plan.modelSourceSha}:prisma/schema.prisma`])).digest('hex')!==plan.modelSourceSha256)throw new Error('REFERENCE_PROVENANCE');
 const manifest=migrationFiles(sha),name=`preflight-schema-${process.env.GITHUB_RUN_ID}`;
 if(!/^preflight-schema-[0-9]+$/.test(name))throw new Error('NAME');
 const docker=(args:string[],input?:Buffer|string)=>execFileSync('docker',args,{input,encoding:'utf8',stdio:['pipe','pipe','pipe'],maxBuffer:16*1024*1024,timeout:60000});
 let phase='CONTAINER_START';
 try{
  docker(['run','--detach','--name',name,'--network','none','--cap-drop','ALL','--security-opt','no-new-privileges','--user','postgres','--env','POSTGRES_HOST_AUTH_METHOD=trust','postgres:17']);
  phase='CONTAINER_READY';
  let ready=false;for(let i=0;i<30;i++){try{if(!docker(['logs',name]).includes('PostgreSQL init process complete; ready for start up.'))throw new Error('INITIALIZING');docker(['exec',name,'pg_isready','-U','postgres']);ready=true;break;}catch{await new Promise(r=>setTimeout(r,1000));}}
  if(!ready)throw new Error('UNAVAILABLE');
  const sql=(query:Buffer|string)=>docker(['exec','-i',name,'psql','--no-psqlrc','--set','ON_ERROR_STOP=1','-U','postgres','-d','postgres','-At'],query);
  phase='REFERENCE_BOOTSTRAP';sql(bootstrap);
  for(const file of manifest.filter(file=>file.name!==plan.baselineSnapshot)){phase=`REFERENCE_INCREMENT_${file.name}`;sql(execFileSync('git',['show',`${sha}:prisma/migrations/${file.name}/migration.sql`]));}
  const query=(query:string)=>JSON.parse(sql(`BEGIN READ ONLY;\n${query};\nROLLBACK;`).split('\n').filter(line=>!['BEGIN','ROLLBACK',''].includes(line.trim())).join('\n'));
  phase='CATALOG_CAPTURE';
  const columns=query(DIAGNOSTIC_COLUMNS_SQL),catalog=query(DIAGNOSTIC_CATALOG_SQL),objects=query(SCHEMA_OBJECTS_SQL);
  phase='DELTA_TEST';
  if(bingo){
    const deltaTest=(approvedBingoEventPlan(sha,candidate)?testBingoEventDelta:approvedBingoLivePlan(sha,candidate)?testBingoLiveDelta:testBingoDelta)(sql,query,sha,candidate,manifest,columns,catalog,objects);
    writeFileSync('delta-test.json',JSON.stringify(deltaTest,null,2),{flag:'wx'});
    phase='NEW_INSTALL_REPLAY';sql('CREATE DATABASE reinstall;');
    let replay;for(const file of manifest){try{docker(['exec','-i',name,'psql','--no-psqlrc','--set','ON_ERROR_STOP=1','-U','postgres','-d','reinstall','-At'],execFileSync('git',['show',`${sha}:prisma/migrations/${file.name}/migration.sql`]));}catch{replay={status:'FAIL',code:'HISTORICAL_BASELINE_OVERLAP',migration:file.name};break;}}
    if(replay?.migration!=='20260713130000_add_question_draft_fields')throw new Error('UNKNOWN_REPLAY_RESULT');
    writeFileSync('new-install-replay.json',JSON.stringify(replay,null,2),{flag:'wx'});
    writeFileSync('expected-schema.json',JSON.stringify({referencePlan:{...reference,...bingo},newInstallReplay:replay,deltaTest,baselineSha:sha,manifest:manifest.map(({name,checksum})=>({name,checksum})),major:17,columns,catalog,objects},null,2),{flag:'wx'});
    return;
  }
  sql("INSERT INTO pubquiz.fragen(frage) VALUES('Isolated schema delta fixture');");
  const before=JSON.parse(sql("SELECT json_agg(to_jsonb(t) ORDER BY fragen_id) FROM pubquiz.fragen t").trim());
  const delta=execFileSync('git',['show',`${plan.candidateSha}:prisma/migrations/${plan.delta}/migration.sql`]);
  if(createHash('sha256').update(delta).digest('hex')!==plan.checksum)throw new Error('DELTA_CHECKSUM');
  const started=Date.now();sql("SET lock_timeout='2s'; SET statement_timeout='30s';"+delta.toString());const elapsedMs=Date.now()-started;
  const after=JSON.parse(sql(`SELECT json_agg(${plan.kind==='difficulty'?"to_jsonb(t)-'redaktionelle_schwierigkeit'":"to_jsonb(t)"} ORDER BY fragen_id) FROM pubquiz.fragen t`).trim());
  if(JSON.stringify(before)!==JSON.stringify(after))throw new Error('DELTA_DATA_CHANGED');
  const fingerprint=manifest.map(({name,checksum})=>({name,checksum}));
  const provenance={baselineSha:sha,candidateSha:plan.candidateSha,checksum:plan.checksum};
  let deltaTest;
  if(plan.kind==='difficulty'){
  for(const value of ['LEICHT','MITTEL','SCHWER'])sql(`UPDATE pubquiz.fragen SET redaktionelle_schwierigkeit='${value}';`);
  let rejected=false;try{sql("UPDATE pubquiz.fragen SET redaktionelle_schwierigkeit='UNKNOWN';");}catch{rejected=true;}if(!rejected)throw new Error('CHECK_NOT_ENFORCED');
  sql("UPDATE pubquiz.fragen SET redaktionelle_schwierigkeit=NULL; SELECT fragen_id,frage,schwierigkeitslevel FROM pubquiz.fragen;");
  const changedColumns=query(DIAGNOSTIC_COLUMNS_SQL),changedCatalog=query(DIAGNOSTIC_CATALOG_SQL);
  const newColumn=changedColumns.find((row:Record<string,unknown>)=>row.table==='fragen'&&row.column==='redaktionelle_schwierigkeit');
  if(!newColumn||newColumn.nullable!==true)throw new Error('DELTA_NULLABILITY');
  const projectedColumns=changedColumns.filter((row:Record<string,unknown>)=>!(row.table==='fragen'&&row.column==='redaktionelle_schwierigkeit'));
  const projectedCatalog={...changedCatalog,constraints:changedCatalog.constraints.filter((row:Record<string,unknown>)=>row.name!=='fragen_editorial_difficulty_check')};
  if(compareFullSchema({baselineSha:sha,manifest:fingerprint,major:17,columns,catalog,objects},{major:17,columns:projectedColumns,catalog:projectedCatalog,objects:query(SCHEMA_OBJECTS_SQL)},sha,fingerprint).status!=='PASS')throw new Error('UNEXPECTED_DELTA_SCHEMA');
  deltaTest={...provenance,status:'PASS',migration:plan.delta,elapsedMs,rowsUnchanged:true,nullAllowed:true,checkEnforced:true,onlyExpectedSchemaChanges:true,oldColumnProjectionCompatible:true,applicationRollbackRequiresDatabaseRestore:false,lockTimeoutMs:2000,statementTimeoutMs:30000};
  }else{
   const changed={major:17,columns:query(DIAGNOSTIC_COLUMNS_SQL),catalog:query(DIAGNOSTIC_CATALOG_SQL),objects:query(SCHEMA_OBJECTS_SQL)};
   assertOnlyArchiveSchemaAdded({baselineSha:sha,manifest:fingerprint,major:17,columns,catalog,objects},changed);
   if(sql('SELECT count(*) FROM pubquiz.meme_archive_entries').trim()!=='0')throw new Error('UNEXPECTED_BACKFILL');
   sql('SELECT fragen_id,frage,schwierigkeitslevel FROM pubquiz.fragen;');
   sql(ARCHIVE_CAPTURE_FIXTURE_SQL);
   if(sql('SELECT count(*) FROM pubquiz.meme_archive_entries WHERE status=\'PENDING\'').trim()!=='1')throw new Error('CAPTURE_NOT_CONFIRMED');
   let blocked=false;try{sql('SELECT pubquiz.assert_meme_archive_reset_safe(quiz_id) FROM pubquiz.quiz WHERE titel=\'PR116 isolated\';');}catch{blocked=true;}
   if(!blocked)throw new Error('RESET_BARRIER_NOT_ENFORCED');
   sql("UPDATE pubquiz.meme_archive_sources SET image_bytes=decode('89504e47','hex'); SELECT pubquiz.assert_meme_archive_reset_safe(quiz_id) FROM pubquiz.quiz WHERE titel='PR116 isolated';");
   sql("DELETE FROM pubquiz.quiz_team_sessions WHERE teamname='PR116 isolated'; DELETE FROM pubquiz.quiz_interaction_runs WHERE quiz_id IN (SELECT quiz_id FROM pubquiz.quiz WHERE titel='PR116 isolated');");
   if(sql('SELECT count(*) FROM pubquiz.meme_archive_entries').trim()!=='1')throw new Error('ARCHIVE_LOST_AFTER_RUNTIME_DELETE');
   deltaTest={...provenance,status:'PASS',migration:plan.delta,elapsedMs,rowsUnchanged:true,onlyExpectedSchemaChanges:true,oldColumnProjectionCompatible:true,
    noBackfill:true,captureConfirmed:true,resetBarrierConfirmed:true,archiveSurvivesRuntimeDeletion:true,applicationRollbackRequiresDatabaseRestore:false,
    oldApplicationResetBarrierAvailable:false,rollbackRestriction:'No Meme reset on old app until archive-aware app restored',lockTimeoutMs:2000,statementTimeoutMs:30000};
  }
  writeFileSync('delta-test.json',JSON.stringify(deltaTest,null,2),{flag:'wx'});
  phase='NEW_INSTALL_REPLAY';sql('CREATE DATABASE reinstall;');
  let replay;for(const file of manifest){try{docker(['exec','-i',name,'psql','--no-psqlrc','--set','ON_ERROR_STOP=1','-U','postgres','-d','reinstall','-At'],execFileSync('git',['show',`${sha}:prisma/migrations/${file.name}/migration.sql`]));}catch{replay={status:'FAIL',code:'HISTORICAL_BASELINE_OVERLAP',migration:file.name};break;}}
  if(replay?.migration!=='20260713130000_add_question_draft_fields')throw new Error('UNKNOWN_REPLAY_RESULT');
  writeFileSync('new-install-replay.json',JSON.stringify(replay,null,2),{flag:'wx'});
  writeFileSync('expected-schema.json',JSON.stringify({referencePlan:plan,newInstallReplay:replay,deltaTest,baselineSha:sha,manifest:manifest.map(({name,checksum})=>({name,checksum})),major:17,columns,catalog,objects},null,2),{flag:'wx'});
 }catch{console.error(`BLOCKED - ISOLATED_REPLAY_${phase}`);throw new Error('SAFE_REPLAY_FAILURE');}finally{try{docker(['rm','--force',name]);}catch{/* disposable container only */}}
}
main().catch(()=>{console.error('BLOCKED - ISOLATED_SCHEMA_REPLAY_UNAVAILABLE');process.exitCode=1;});
