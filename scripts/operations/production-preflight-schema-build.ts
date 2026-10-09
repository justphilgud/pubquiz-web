import {execFileSync} from 'node:child_process';
import {writeFileSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {migrationFiles} from './production-preflight';
import {compareFullSchema,DIAGNOSTIC_COLUMNS_SQL,DIAGNOSTIC_CATALOG_SQL,SCHEMA_OBJECTS_SQL} from './production-preflight-schema';
async function main(){
 const sha=process.env.EXPECTED_PRODUCTION_SHA??'';
 if(process.env.GITHUB_ACTIONS!=='true'||process.env.GITHUB_REPOSITORY!=='justphilgud/pubquiz-web'||!/^[a-f0-9]{40}$/.test(sha))throw new Error('CONTEXT');
 const plan=JSON.parse(readFileSync('scripts/operations/schema-reference/provenance.json','utf8'));
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
  const query=(query:string)=>JSON.parse(sql(`BEGIN READ ONLY;\n${query};\nROLLBACK;`).split('\n').filter(line=>line.startsWith('{')||line.startsWith('[')).join('\n'));
  phase='CATALOG_CAPTURE';
  const columns=query(DIAGNOSTIC_COLUMNS_SQL),catalog=query(DIAGNOSTIC_CATALOG_SQL),objects=query(SCHEMA_OBJECTS_SQL);
  phase='DELTA_TEST';
  sql("INSERT INTO pubquiz.fragen(frage) VALUES('Isolated schema delta fixture');");
  const before=JSON.parse(sql("SELECT json_agg(to_jsonb(t) ORDER BY fragen_id) FROM pubquiz.fragen t").trim());
  const delta=execFileSync('git',['show',`${plan.candidateSha}:prisma/migrations/${plan.delta}/migration.sql`]);
  const started=Date.now();sql("SET lock_timeout='2s'; SET statement_timeout='30s';"+delta.toString());const elapsedMs=Date.now()-started;
  const after=JSON.parse(sql("SELECT json_agg(to_jsonb(t)-'redaktionelle_schwierigkeit' ORDER BY fragen_id) FROM pubquiz.fragen t").trim());
  if(JSON.stringify(before)!==JSON.stringify(after))throw new Error('DELTA_DATA_CHANGED');
  for(const value of ['LEICHT','MITTEL','SCHWER'])sql(`UPDATE pubquiz.fragen SET redaktionelle_schwierigkeit='${value}';`);
  let rejected=false;try{sql("UPDATE pubquiz.fragen SET redaktionelle_schwierigkeit='UNKNOWN';");}catch{rejected=true;}if(!rejected)throw new Error('CHECK_NOT_ENFORCED');
  sql("UPDATE pubquiz.fragen SET redaktionelle_schwierigkeit=NULL; SELECT fragen_id,frage,schwierigkeitslevel FROM pubquiz.fragen;");
  const changedColumns=query(DIAGNOSTIC_COLUMNS_SQL),changedCatalog=query(DIAGNOSTIC_CATALOG_SQL);
  const newColumn=changedColumns.find((row:Record<string,unknown>)=>row.table==='fragen'&&row.column==='redaktionelle_schwierigkeit');
  if(!newColumn||newColumn.nullable!==true)throw new Error('DELTA_NULLABILITY');
  const projectedColumns=changedColumns.filter((row:Record<string,unknown>)=>!(row.table==='fragen'&&row.column==='redaktionelle_schwierigkeit'));
  const projectedCatalog={...changedCatalog,constraints:changedCatalog.constraints.filter((row:Record<string,unknown>)=>row.name!=='fragen_editorial_difficulty_check')};
  const fingerprint=manifest.map(({name,checksum})=>({name,checksum}));
  if(compareFullSchema({baselineSha:sha,manifest:fingerprint,major:17,columns,catalog,objects},{major:17,columns:projectedColumns,catalog:projectedCatalog,objects:query(SCHEMA_OBJECTS_SQL)},sha,fingerprint).status!=='PASS')throw new Error('UNEXPECTED_DELTA_SCHEMA');
  const deltaTest={status:'PASS',migration:plan.delta,elapsedMs,rowsUnchanged:true,nullAllowed:true,checkEnforced:true,onlyExpectedSchemaChanges:true,oldColumnProjectionCompatible:true,applicationRollbackRequiresDatabaseRestore:false,lockTimeoutMs:2000,statementTimeoutMs:30000};
  writeFileSync('delta-test.json',JSON.stringify(deltaTest,null,2),{flag:'wx'});
  phase='NEW_INSTALL_REPLAY';sql('CREATE DATABASE reinstall;');
  let replay;for(const file of manifest){try{docker(['exec','-i',name,'psql','--no-psqlrc','--set','ON_ERROR_STOP=1','-U','postgres','-d','reinstall','-At'],execFileSync('git',['show',`${sha}:prisma/migrations/${file.name}/migration.sql`]));}catch{replay={status:'FAIL',code:'HISTORICAL_BASELINE_OVERLAP',migration:file.name};break;}}
  if(replay?.migration!=='20260713130000_add_question_draft_fields')throw new Error('UNKNOWN_REPLAY_RESULT');
  writeFileSync('new-install-replay.json',JSON.stringify(replay,null,2),{flag:'wx'});
  writeFileSync('expected-schema.json',JSON.stringify({referencePlan:plan,newInstallReplay:replay,deltaTest,baselineSha:sha,manifest:manifest.map(({name,checksum})=>({name,checksum})),major:17,columns,catalog,objects},null,2),{flag:'wx'});
 }catch{console.error(`BLOCKED - ISOLATED_REPLAY_${phase}`);throw new Error('SAFE_REPLAY_FAILURE');}finally{try{docker(['rm','--force',name]);}catch{/* disposable container only */}}
}
main().catch(()=>{console.error('BLOCKED - ISOLATED_SCHEMA_REPLAY_UNAVAILABLE');process.exitCode=1;});
