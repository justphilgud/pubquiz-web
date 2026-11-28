import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {Client} from 'pg';
import {testCardSetDelta} from '../operations/bingo-card-set-release-delta';
import {cardSetDeltaEvidence} from '../operations/bingo-card-set-release-plan';
import {DIAGNOSTIC_COLUMNS_SQL,DIAGNOSTIC_CATALOG_SQL,SCHEMA_OBJECTS_SQL} from '../operations/production-preflight-schema';

const base=process.env.BINGO_PREPARATION_TEST_DATABASE_URL;
test('evening card set delta on complete disposable baseline: rollback, data, old readers and constraints',{skip:!base,timeout:120000},async()=>{
 const url=new URL(base!);assert.ok(['localhost','127.0.0.1'].includes(url.hostname));
 const name=`bingo_card_set_${process.pid}_${Date.now()}`,control=new Client({connectionString:base});
 await control.connect();await control.query(`CREATE DATABASE ${name}`);
 const psql=process.env.BINGO_TEST_PSQL??(process.platform==='win32'?'C:/Program Files/PostgreSQL/18/bin/psql.exe':'psql');
 const sql=(input:string)=>execFileSync(psql,['--no-psqlrc','--set','ON_ERROR_STOP=1','-h',url.hostname,'-p',url.port||'5432','-U',decodeURIComponent(url.username),'-d',name,'-At'],{input,encoding:'utf8',stdio:['pipe','pipe','pipe'],env:{...process.env,PGPASSWORD:decodeURIComponent(url.password)},maxBuffer:16*1024*1024});
 try{
  const baseline='8dd64266678841c0702d476ae8270f5450dc551a';
  sql(readFileSync('scripts/operations/schema-reference/prehistory.sql','utf8'));
  const names=execFileSync('git',['ls-tree','--name-only',`${baseline}:prisma/migrations`],{encoding:'utf8'}).trim().split('\n').filter(n=>/^\d/.test(n)&&n!=='0_init');
  for(const n of names)sql(execFileSync('git',['show',`${baseline}:prisma/migrations/${n}/migration.sql`],{encoding:'utf8'}));
  const query=(s:string)=>JSON.parse(sql(s).trim());
  const evidence={baselineSha:baseline,manifest:[],major:17,columns:query(DIAGNOSTIC_COLUMNS_SQL),catalog:query(DIAGNOSTIC_CATALOG_SQL),objects:query(SCHEMA_OBJECTS_SQL)};
  assert.equal(cardSetDeltaEvidence(testCardSetDelta(sql,query,evidence)),true);
 }finally{await control.query(`DROP DATABASE ${name} WITH (FORCE)`);await control.end();}
});
