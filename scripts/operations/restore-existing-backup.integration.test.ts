import test from "node:test";
import assert from "node:assert/strict";
import { Client } from "pg";
import { mkdtemp,writeFile,rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { collectSnapshot,compareSnapshots,sha256 } from "./snapshot";
import type { PgSession } from "./pg-session";
import { pgTool } from "./pg-session";
import { restoreSql,TARGET_PREFLIGHT_SQL,assertTargetPreflight } from "./acceptance-restore";
import { verifyMediaFiles } from "./private-artifacts";

test("actual PostgreSQL dump/restore: empty guard, rollback, permissions, complete DB/media",{skip:!process.env.RESTORE_CI_DATABASE_URL},async()=>{
 const url=new URL(process.env.RESTORE_CI_DATABASE_URL!);assert.equal(process.env.CI,"true");assert.equal(url.hostname,"postgres");assert.equal(url.pathname,"/restore_ci");
 const admin=new Client({connectionString:url.toString()});await admin.connect();
 const directory=await mkdtemp(join(tmpdir(),"restore-fixture-"));
 const envFor=(db:string,role="postgres")=>({NODE_ENV:"test",PATH:process.env.PATH,PGHOST:"postgres",PGPORT:"5432",PGUSER:role,PGDATABASE:db});
 const connect=async(db:string,role="postgres")=>{const c=new Client({host:"postgres",database:db,user:role});await c.connect();return c;};
 const snapshot=async(c:Client)=>collectSnapshot({json:async(sql:string)=>{const result=await c.query(sql);return Object.values(result.rows[0])[0];}} as unknown as PgSession);
 const prove=async(c:Client)=>{await c.query("BEGIN READ ONLY");try{const row=(await c.query(TARGET_PREFLIGHT_SQL)).rows[0];assertTargetPreflight(Object.values(row)[0] as Parameters<typeof assertTargetPreflight>[0]);}finally{await c.query("ROLLBACK");}};
 let source:Client|undefined,target:Client|undefined;
 try{
  await admin.query("CREATE ROLE neondb_owner LOGIN; CREATE ROLE restore_denied LOGIN");
  await admin.query("CREATE DATABASE restore_source");await admin.query("CREATE DATABASE neondb OWNER neondb_owner");
  source=await connect("restore_source");target=await connect("neondb","neondb_owner");
  await source.query(`CREATE SCHEMA pubquiz;
 CREATE TABLE pubquiz.users(id serial PRIMARY KEY,password_hash text NOT NULL);
 CREATE TABLE pubquiz.teams(team_id serial PRIMARY KEY,team_passwort text);
 CREATE TABLE pubquiz.quiz_team_sessions(quiz_team_session_id serial PRIMARY KEY,quiz_id int,team_id int REFERENCES pubquiz.teams);
 CREATE TABLE pubquiz.team_antworten(team_antwort_id serial PRIMARY KEY,quiz_team_session_id int REFERENCES pubquiz.quiz_team_sessions,vergebene_punkte numeric DEFAULT 0 CHECK(vergebene_punkte>=0),bewertung_final boolean DEFAULT true);
 INSERT INTO pubquiz.users(password_hash) VALUES('');INSERT INTO pubquiz.teams(team_passwort) VALUES(NULL);
 INSERT INTO pubquiz.quiz_team_sessions(quiz_id,team_id) VALUES(93,1);INSERT INTO pubquiz.team_antworten(quiz_team_session_id,vergebene_punkte) VALUES(1,2);`);
  const expected=await snapshot(source);
  const path=join(directory,"database.dump");pgTool("pg_dump",["--format=custom","--no-owner","--no-acl","--no-comments","--schema=public","--schema=pubquiz","--exclude-table-data=pubquiz.users","--exclude-table-data=pubquiz.teams","--file",path],envFor("restore_source"));
  const sql=restoreSql(directory,expected.authRows,{expected},envFor("neondb"));
  await prove(target);
  const ownerAdmin=await connect("neondb");
  try {
    await ownerAdmin.query("ALTER SCHEMA public OWNER TO postgres");
    await assert.rejects(prove(target), /RESTORE_TARGET_PRIVILEGES_BLOCKED/);
    await ownerAdmin.query("ALTER SCHEMA public OWNER TO pg_database_owner");
  } finally {await ownerAdmin.end();}
  await prove(target);
  // Single transaction includes guard and every DDL/data write: interruption rolls back.
  assert.throws(()=>pgTool("psql",["-X","-q","-v","ON_ERROR_STOP=1","--single-transaction","--file=-"],envFor("neondb","neondb_owner"),sql+"\nSELECT 1/0;"));
  await prove(target);assert.equal((await target.query("SELECT to_regclass('pubquiz.users') AS r")).rows[0].r,null);
  const denied=await connect("neondb","restore_denied");try{await assert.rejects(prove(denied));}finally{await denied.end();}
  await target.query("CREATE TABLE public.unexpected(id int); INSERT INTO public.unexpected VALUES(42)");await assert.rejects(prove(target));
  assert.throws(()=>pgTool("psql",["-X","-q","-v","ON_ERROR_STOP=1","--single-transaction","--file=-"],envFor("neondb","neondb_owner"),sql));
  assert.equal((await target.query("SELECT id FROM public.unexpected")).rows[0].id,42);await target.query("DROP TABLE public.unexpected");
  pgTool("psql",["-X","-q","-v","ON_ERROR_STOP=1","--single-transaction","--file=-"],envFor("neondb","neondb_owner"),sql);
  compareSnapshots(expected,await snapshot(target));
  for(const name of ["users_id_seq","teams_team_id_seq","quiz_team_sessions_quiz_team_session_id_seq","team_antworten_team_antwort_id_seq"]){
    assert.deepEqual((await target.query(`SELECT last_value::text,is_called FROM pubquiz.${name}`)).rows,
      (await source.query(`SELECT last_value::text,is_called FROM pubquiz.${name}`)).rows);
  }
  assert.equal((await target.query("SELECT sum(vergebene_punkte)::text AS p FROM pubquiz.team_antworten")).rows[0].p,"2");
  assert.equal((await target.query("SELECT password_hash FROM pubquiz.users")).rows[0].password_hash,"");
  await assert.rejects(target.query("INSERT INTO pubquiz.team_antworten(quiz_team_session_id) VALUES(999)"));
  const bytes=Buffer.from("synthetic media fixture"),name="media-"+"a".repeat(64)+".bin";
  const records=[{name,url:"https://synthetic.invalid",bytes:bytes.length,sha256:sha256(bytes),contentType:"application/octet-stream"}];
  await assert.rejects(verifyMediaFiles(records,directory));await writeFile(join(directory,name),bytes);assert.equal((await verifyMediaFiles(records,directory)).restoredOriginals,1);
  await writeFile(join(directory,name),"corrupt");await assert.rejects(verifyMediaFiles(records,directory));
  compareSnapshots(expected,await snapshot(source)); // Source was never a restore target.
 }finally{await source?.end();await target?.end();await admin.query("DROP DATABASE IF EXISTS neondb WITH (FORCE)");await admin.query("DROP DATABASE IF EXISTS restore_source WITH (FORCE)");await admin.query("DROP ROLE IF EXISTS restore_denied; DROP ROLE IF EXISTS neondb_owner");await admin.end();await rm(directory,{recursive:true,force:true});}
});
