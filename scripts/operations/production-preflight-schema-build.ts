import {execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {migrationFiles} from './production-preflight';
import {DIAGNOSTIC_COLUMNS_SQL,DIAGNOSTIC_CATALOG_SQL,SCHEMA_OBJECTS_SQL} from './production-preflight-schema';
async function main(){
 const sha=process.env.EXPECTED_PRODUCTION_SHA??'';
 if(process.env.GITHUB_ACTIONS!=='true'||process.env.GITHUB_REPOSITORY!=='justphilgud/pubquiz-web'||!/^[a-f0-9]{40}$/.test(sha))throw new Error('CONTEXT');
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
  for(const file of manifest){phase=`MIGRATION_${file.name}`;sql(execFileSync('git',['show',`${sha}:prisma/migrations/${file.name}/migration.sql`]));}
  const query=(query:string)=>JSON.parse(sql(`BEGIN READ ONLY;\n${query};\nROLLBACK;`).split('\n').filter(line=>line.startsWith('{')||line.startsWith('[')).join('\n'));
  phase='CATALOG_CAPTURE';
  const columns=query(DIAGNOSTIC_COLUMNS_SQL),catalog=query(DIAGNOSTIC_CATALOG_SQL),objects=query(SCHEMA_OBJECTS_SQL);
  writeFileSync('expected-schema.json',JSON.stringify({baselineSha:sha,manifest:manifest.map(({name,checksum})=>({name,checksum})),major:17,columns,catalog,objects},null,2),{flag:'wx'});
 }catch{console.error(`BLOCKED - ISOLATED_REPLAY_${phase}`);throw new Error('SAFE_REPLAY_FAILURE');}finally{try{docker(['rm','--force',name]);}catch{/* disposable container only */}}
}
main().catch(()=>{console.error('BLOCKED - ISOLATED_SCHEMA_REPLAY_UNAVAILABLE');process.exitCode=1;});
