import test from 'node:test';
import assert from 'node:assert/strict';
import {Client} from 'pg';
import {compareFullSchema,DIAGNOSTIC_COLUMNS_SQL,DIAGNOSTIC_CATALOG_SQL,SCHEMA_OBJECTS_SQL} from './production-preflight-schema';
import {assessMigrations} from './production-preflight';
import {createHash} from 'node:crypto';
test('EOL equivalence is narrow and unknown/changed SQL remains drift',()=>{
 const hash=(s:string)=>createHash('sha256').update(s).digest('hex'),script='SELECT 1;\n';
 const file={name:'a',checksum:hash(script),eolChecksums:{lf:hash(script),crlf:hash(script.replaceAll('\n','\r\n'))}};
 const row={migration_name:'a',checksum:file.eolChecksums.crlf,finished_at:'date',rolled_back_at:null};
 assert.equal(assessMigrations([file],[file],[row]).gate.status,'PASS');
 assert.equal(assessMigrations([file],[file],[row]).checksumComparisons[0].match,'EOL_EQUIVALENT');
 for(const checksum of [hash('SELECT 2;\n'),'f'.repeat(64)])assert.equal(assessMigrations([file],[file],[{...row,checksum}]).gate.code,'MIGRATION_DRIFT');
});
test('real catalog match and every changed schema section fail closed',{skip:!process.env.PREFLIGHT_TEST_DATABASE_URL},async()=>{
 const url=new URL(process.env.PREFLIGHT_TEST_DATABASE_URL!);assert.equal(process.env.CI,'true');assert.equal(url.hostname,'127.0.0.1');assert.equal(url.pathname,'/preflight_ci');
 const client=new Client({connectionString:process.env.PREFLIGHT_TEST_DATABASE_URL});await client.connect();
 try{
  await client.query('CREATE SCHEMA schema_fixture; CREATE TABLE schema_fixture.parent(id int PRIMARY KEY); CREATE TABLE schema_fixture.child(id int PRIMARY KEY,p int REFERENCES schema_fixture.parent(id) ON DELETE CASCADE,v int DEFAULT 1,UNIQUE(v),CHECK(v>0)); CREATE INDEX child_p ON schema_fixture.child(p)');
  // Scope is deliberately the same public/pubquiz catalog used by Production; disposable fixture lives in pubquiz.
  await client.query('ALTER TABLE schema_fixture.parent SET SCHEMA public; ALTER TABLE schema_fixture.child SET SCHEMA public');
  const collect=async()=>({major:17,columns:(await client.query(DIAGNOSTIC_COLUMNS_SQL)).rows[0].columns,catalog:(await client.query(DIAGNOSTIC_CATALOG_SQL)).rows[0].catalog,objects:(await client.query(SCHEMA_OBJECTS_SQL)).rows[0].objects});
  const actual=await collect(),sha='a'.repeat(40),manifest=[{name:'a',checksum:'1'}],expected={...actual,baselineSha:sha,manifest};
  assert.equal(compareFullSchema(expected,actual,sha,manifest).status,'PASS');
  const mutations=[['DROP INDEX public.child_p','CREATE INDEX child_p ON public.child(p)'],['ALTER TABLE public.child ALTER COLUMN v SET DEFAULT 2','ALTER TABLE public.child ALTER COLUMN v SET DEFAULT 1'],['ALTER TABLE public.child DROP CONSTRAINT child_p_fkey','ALTER TABLE public.child ADD CONSTRAINT child_p_fkey FOREIGN KEY(p) REFERENCES public.parent(id) ON DELETE CASCADE'],['ALTER TABLE public.child DROP CONSTRAINT child_v_check','ALTER TABLE public.child ADD CONSTRAINT child_v_check CHECK(v>0)'],['CREATE TABLE public.unknown_fixture(id int)','DROP TABLE public.unknown_fixture']];
  for(const [change,restore]of mutations){await client.query(change);assert.equal(compareFullSchema(expected,await collect(),sha,manifest).status,'FAIL');await client.query(restore);}
  assert.equal(compareFullSchema(undefined,actual,sha,manifest).status,'BLOCKED');
 }finally{await client.query('DROP TABLE IF EXISTS public.child; DROP TABLE IF EXISTS public.parent; DROP SCHEMA schema_fixture');await client.end();}
});
