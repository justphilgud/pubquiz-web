import assert from "node:assert/strict";
import test from "node:test";
import { Client } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/app/generated/prisma/client";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { build } from "esbuild";
import { COLUMN_SQL, CATALOG_SQL } from "../operations/snapshot";
import { auditColumns, inspectRow, type Column } from "../operations/acceptance-policy";

const base = process.env.GAME_DRAFT_TEST_DATABASE_URL;
test("additive game-team migration and real Actions with isolated PostgreSQL on isolated PostgreSQL", {skip:!base,timeout:180000}, async context => {
  const target = new URL(base!);
  assert.ok(["127.0.0.1","localhost","ep-dry-dust-aljik09f-pooler.c-3.eu-central-1.aws.neon.tech"].includes(target.hostname));
  assert.match(target.pathname, /^\/(neondb|editorial_import_ci|game_draft_test_base)$/);
  const control = new Client({connectionString:target.toString()}); await control.connect();
  const name = `game_team_qa_${Date.now()}`;
  try {await control.query(`CREATE DATABASE ${name}`);} finally {await control.end();}
  target.pathname = `/${name}`;
  const db = new Client({connectionString:target.toString()}); await db.connect();
  context.after(async()=>{await db.end();});
  const directory = mkdtempSync(join(tmpdir(),"game-draft-baseline-"));
  try {
    const schema = join(directory,"schema.prisma");
    writeFileSync(schema,execFileSync("git",["show","ab357ac939e6ec3150a9d23a9676d8b86aeed2b5:prisma/schema.prisma"],{encoding:"utf8"}));
    const sql = execFileSync(process.execPath,["node_modules/prisma/build/index.js","migrate","diff","--from-empty","--to-schema",schema,"--script"],{encoding:"utf8",env:{...process.env,DATABASE_URL:target.toString()},maxBuffer:10000000});
    await db.query("CREATE SCHEMA IF NOT EXISTS pubquiz; SET search_path TO pubquiz,public");
    await db.query(sql.slice(sql.indexOf("-- CreateSchema")));
  } finally {rmSync(directory,{recursive:true});}
  await db.query(readFileSync("prisma/migrations/20261026210000_shared_game_design/migration.sql","utf8"));
  const migration = readFileSync("prisma/migrations/20261026180000_game_team_assignments/migration.sql","utf8");
  // Empty existing schema: exercise then roll back only this test transaction.
  await db.query("BEGIN"); await db.query(migration);
  assert.equal((await db.query("SELECT count(*)::int n FROM pubquiz.game_team_assignments")).rows[0].n,0);
  await db.query("ROLLBACK");
  assert.equal((await db.query("SELECT to_regclass('pubquiz.game_team_assignments') t")).rows[0].t,null);
  await db.query(`
    INSERT INTO pubquiz.users(id,name,email,password_hash,role,updated_at) SELECT n,'Draft QA '||n,'draft-qa-'||n||'@example.invalid','not-a-login-hash','USER',NOW() FROM generate_series(1,6) n;
    INSERT INTO pubquiz.eventreihen(eventreihe_id,name,slug) VALUES(10,'Draft A','draft-a'),(20,'Draft B','draft-b'),(30,'Disabled','draft-disabled');
    INSERT INTO pubquiz.eventarten(kennung,name) VALUES('QUIZ','Quiz'),('BINGO','Bingo'),('POWERPOINT_KARAOKE','PowerPoint-Karaoke') ON CONFLICT DO NOTHING;
    INSERT INTO pubquiz.eventreihe_eventarten(eventreihe_id,eventart,ist_freigeschaltet) SELECT id,t,id<>30 FROM unnest(ARRAY[10,20,30]) id CROSS JOIN unnest(ARRAY['QUIZ','BINGO','POWERPOINT_KARAOKE']) t;
    INSERT INTO pubquiz.benutzer_rollenzuweisungen(benutzer_id,rolle,scope_typ,eventreihe_id) VALUES(1,'ADMIN','GLOBAL',NULL),(2,'EDITOR','GLOBAL',NULL);
    INSERT INTO pubquiz.benutzer_reihenrollen(benutzer_id,eventreihe_id,rolle) VALUES(3,10,'EVENT_MANAGER'),(4,10,'EDITOR'),(5,20,'EVENT_MANAGER');
    INSERT INTO pubquiz.eventreihe_verwaltung(benutzer_id,eventreihe_id)VALUES(6,10);
    INSERT INTO pubquiz.quiz(quiz_id,eventreihe_id,titel,quiz_datum,intro_begruessungstext)VALUES(11,10,'Existing synthetic quiz','2026-10-26','Preserve me');
    INSERT INTO pubquiz.game_drafts(id,eventart,eventreihe_id,titel,datum,uhrzeit)VALUES('99000000-0000-4000-8000-000000000001','BINGO',10,'Existing game before AP2','2026-11-20','19:30');
    INSERT INTO pubquiz.teams(team_id,teamname,teamname_normalisiert,avatar_code)VALUES(9000,'Existing team before AP2','existing team before ap2','toaster');
  `);
  const before = (await db.query("SELECT to_jsonb(q) data FROM pubquiz.quiz q WHERE quiz_id=11")).rows[0].data;
  const draftBefore=(await db.query("SELECT to_jsonb(g) data FROM pubquiz.game_drafts g WHERE id='99000000-0000-4000-8000-000000000001'")).rows[0].data;
  const teamBefore=(await db.query('SELECT to_jsonb(t) data FROM pubquiz.teams t WHERE team_id=9000')).rows[0].data;
  const rolesBefore = (await db.query("SELECT * FROM pubquiz.benutzer_reihenrollen ORDER BY benutzer_id")).rows;
  await db.query(migration);

  // Current game master-data writes also enforce the Bingo card-series move
  // guard. Keep this isolated repository fixture at the current additive schema;
  // all existing team/migration preservation assertions below remain unchanged.
  await db.query(readFileSync("prisma/migrations/20261027180000_bingo_preparation/migration.sql", "utf8"));

  assert.deepEqual((await db.query("SELECT to_jsonb(q) data FROM pubquiz.quiz q WHERE quiz_id=11")).rows[0].data,before);
  assert.deepEqual((await db.query("SELECT * FROM pubquiz.benutzer_reihenrollen ORDER BY benutzer_id")).rows,rolesBefore);
  assert.deepEqual((await db.query("SELECT to_jsonb(g) data FROM pubquiz.game_drafts g WHERE id='99000000-0000-4000-8000-000000000001'")).rows[0].data,draftBefore);
  assert.deepEqual((await db.query('SELECT to_jsonb(t) data FROM pubquiz.teams t WHERE team_id=9000')).rows[0].data,teamBefore);
  const prisma = new PrismaClient({adapter:new PrismaPg({connectionString:target.toString()})});
  context.after(async()=>{await prisma.$disconnect();});
  let currentUser: number | null = 3;
  const bundle = await build({stdin:{contents:"export * from './app/games/gameDraftRepository.server'; export * from './app/games/gameTeamsRepository.server'; export * as actions from './app/games/teamActions';",resolveDir:process.cwd()},bundle:true,write:false,platform:"node",format:"cjs",packages:"external",plugins:[{name:"database",setup(b){
    b.onResolve({filter:/^(server-only|@\/auth|next\/cache|next\/navigation|@\/app\/lib\/prisma)$/},a=>({path:a.path,namespace:"fixture"}));
    b.onLoad({filter:/.*/,namespace:"fixture"},a=>({contents:a.path==="server-only"?"":a.path==="@/auth"?"export const auth = async () => globalThis.session();":a.path==="next/cache"?"export function revalidatePath(){}":a.path==="next/navigation"?'export function redirect(path){throw new Error("REDIRECT:"+path)}':"export const prisma = globalThis.fixture;"}));
  }}]});
  const runtime = {exports:{}};
  runInNewContext(bundle.outputFiles[0].text,{module:runtime,exports:runtime.exports,require:createRequire(import.meta.url),fixture:prisma,session:()=>currentUser?{user:{id:String(currentUser)}}:null,console,process,Date,Buffer,setTimeout,clearTimeout});
  const api = runtime.exports as typeof import("@/app/games/gameDraftRepository.server") & typeof import("@/app/games/gameTeamsRepository.server") & {actions:typeof import("@/app/games/teamActions")};
  await db.query(`
    INSERT INTO pubquiz.quiz(quiz_id,eventreihe_id,titel)VALUES(12,20,'Foreign synthetic');
    INSERT INTO pubquiz.teams(team_id,teamname,teamname_normalisiert,team_passwort,avatar_code) SELECT n,'Team '||n,'team '||n,'secret-must-not-leak','toaster' FROM generate_series(1001,1060)n;
    INSERT INTO pubquiz.quiz_team_sessions(quiz_id,team_id,teamname)VALUES(11,1001,'Team 1001'),(12,1002,'Team 1002'),(11,1004,'Team 1004');
    INSERT INTO pubquiz.quiz_teams(quiz_id,team_id,punkte,platzierung)VALUES(11,1001,12.5,1);
    UPDATE pubquiz.teams SET ist_archiviert=true WHERE team_id=1004;
    INSERT INTO pubquiz.eventreihen(eventreihe_id,name,slug)VALUES(40,'Bingo-only','bingo-only');
    INSERT INTO pubquiz.eventreihe_eventarten(eventreihe_id,eventart,ist_freigeschaltet)VALUES(40,'BINGO',true),(40,'POWERPOINT_KARAOKE',true);
    INSERT INTO pubquiz.benutzer_reihenrollen(benutzer_id,eventreihe_id,rolle)VALUES(6,40,'EVENT_MANAGER');
  `);
  assert.equal((await api.readGameTeams(1,'BINGO',(await api.writeGameDraft(1,'BINGO',{seriesId:10,title:'Search coverage',date:'',time:''})).id)).hasMore,true);
  const profileBefore=(await db.query('SELECT to_jsonb(t) data FROM pubquiz.teams t WHERE team_id=1001')).rows[0].data;
  const sessionsBefore=(await db.query('SELECT jsonb_agg(to_jsonb(t) ORDER BY quiz_team_session_id) data FROM pubquiz.quiz_team_sessions t')).rows[0].data;
  const quizTeamsBefore=(await db.query('SELECT jsonb_agg(to_jsonb(t)) data FROM pubquiz.quiz_teams t')).rows[0].data;
  const input={seriesId:10,title:'Game with shared identity',date:'',time:''};
  const bingo=await api.writeGameDraft(3,'BINGO',input);
  const karaoke=await api.writeGameDraft(3,'POWERPOINT_KARAOKE',input);
  const other=await api.writeGameDraft(5,'BINGO',{...input,seriesId:20});
  const bingoOnly=await api.writeGameDraft(6,'BINGO',{...input,seriesId:40});
  const command=(game:typeof bingo,operation:'ADD'|'REMOVE',id:number|string)=>({gameId:game.id,seriesId:game.seriesId,updatedAt:game.updatedAt,operation,...(operation==='ADD'?{teamId:id}:{assignmentId:id})});
  assert.deepEqual((await api.readGameTeams(3,'BINGO',bingo.id)).candidates.map(t=>t.id),[1001]);
  assert.equal((await api.readGameTeams(6,'BINGO',bingoOnly.id)).hasTeamScope,false);
  assert.equal((await api.readGameTeams(6,'BINGO',bingoOnly.id)).candidates.length,0);
  await assert.rejects(api.changeGameTeam(6,'BINGO',command(bingoOnly,'ADD',1001)));
  for(const id of [1002,1003,1004,999999]) await assert.rejects(api.changeGameTeam(3,'BINGO',command(bingo,'ADD',id)));
  for(const user of [2,4,5,6]) await assert.rejects(api.changeGameTeam(user,'BINGO',command(bingo,'ADD',1001)));
  const results=await Promise.all(Array.from({length:4},()=>api.changeGameTeam(3,'BINGO',command(bingo,'ADD',1001))));
  const assignment=results[0].assigned[0];
  assert.ok(results.every(r=>r.assigned.length===1&&r.assigned[0].id===assignment.id));
  assert.equal((await api.readGameTeams(3,'BINGO',bingo.id)).candidates.length,0);
  currentUser=3;
  assert.equal((await api.actions.changeGameTeamAction('POWERPOINT_KARAOKE',command(karaoke,'ADD',1001))).success,true);
  assert.equal((await api.readGameTeams(3,'POWERPOINT_KARAOKE',karaoke.id)).assigned[0].team.id,1001);
  const readonly=await api.readGameTeams(4,'BINGO',bingo.id);
  assert.equal(readonly.canWrite,false); assert.equal(readonly.candidates.length,0);
  assert.deepEqual(Object.keys(readonly.assigned[0].team).sort(),['archived','avatar','id','name']);
  assert.equal(JSON.stringify(readonly).includes('secret-must-not-leak'),false);
  await assert.rejects(api.readGameTeams(4,'POWERPOINT_KARAOKE',karaoke.id));
  assert.equal((await api.actions.gameTeamsAction('BINGO',other.id,'')).success,false);
  assert.equal((await api.actions.gameTeamsAction('BINGO','../11','')).success,false);
  assert.equal((await api.actions.changeGameTeamAction('BINGO',command(karaoke,'ADD',1001))).success,false);
  await assert.rejects(api.changeGameTeam(3,'BINGO',command(bingo,'REMOVE',(await api.readGameTeams(3,'POWERPOINT_KARAOKE',karaoke.id)).assigned[0].id)));
  assert.equal((await api.actions.changeGameTeamAction('BINGO',{...command(bingo,'ADD',1001),teamId:'1001'})).success,false);
  currentUser=null;await assert.rejects(api.actions.gameTeamsAction('BINGO',bingo.id,''),/REDIRECT:\/login/); currentUser=3;
  await assert.rejects(api.writeGameDraft(1,'BINGO',{...input,id:bingo.id,updatedAt:bingo.updatedAt,seriesId:20}),/Reihenwechsel/);
  await assert.rejects(api.changeGameTeam(3,'BINGO',{...command(bingo,'ADD',1001),updatedAt:'2020-01-01T00:00:00.000Z'}),/inzwischen/);
  const edited=await api.writeGameDraft(3,'BINGO',{...input,id:bingo.id,updatedAt:bingo.updatedAt,title:'Master fields preserved'});
  await assert.rejects(api.changeGameTeam(3,'BINGO',command(bingo,'REMOVE',assignment.id)),/inzwischen/);
  await db.query('UPDATE pubquiz.teams SET ist_archiviert=true WHERE team_id=1001');
  assert.equal((await api.readGameTeams(3,'BINGO',bingo.id)).assigned[0].team.archived,true);
  await assert.rejects(api.changeGameTeam(3,'BINGO',command(edited,'ADD',1001)));
  await db.query('UPDATE pubquiz.eventreihen SET ist_archiviert=true WHERE eventreihe_id=10');
  assert.equal((await api.readGameTeams(3,'BINGO',bingo.id)).canAdd,false);
  await api.changeGameTeam(3,'BINGO',command(edited,'REMOVE',assignment.id));
  assert.equal((await api.readGameTeams(3,'POWERPOINT_KARAOKE',karaoke.id)).assigned.length,1);
  await db.query('UPDATE pubquiz.eventreihen SET ist_archiviert=false WHERE eventreihe_id=10');
  await db.query('UPDATE pubquiz.teams SET ist_archiviert=false WHERE team_id=1001');
  const afterMembership=await api.readGameDraft(3,'BINGO',bingo.id);
  assert.equal(afterMembership.game.updatedAt,edited.updatedAt,'membership must not silently change master version');
  await api.writeGameDraft(1,'BINGO',{...input,id:bingo.id,updatedAt:edited.updatedAt,seriesId:20});
  await db.query("UPDATE pubquiz.eventreihe_eventarten SET ist_freigeschaltet=false WHERE eventreihe_id=10 AND eventart='POWERPOINT_KARAOKE'");
  await assert.rejects(api.readGameTeams(1,'POWERPOINT_KARAOKE',karaoke.id));
  assert.equal((await api.actions.changeGameTeamAction('POWERPOINT_KARAOKE',command(karaoke,'ADD',1001))).success,false);
  await db.query("UPDATE pubquiz.eventreihe_eventarten SET ist_freigeschaltet=true WHERE eventreihe_id=10 AND eventart='POWERPOINT_KARAOKE'");
  await db.query('DELETE FROM pubquiz.benutzer_reihenrollen WHERE benutzer_id=3');
  assert.equal((await api.actions.gameTeamsAction('POWERPOINT_KARAOKE',karaoke.id,'')).success,false);
  assert.equal((await api.actions.changeGameTeamAction('POWERPOINT_KARAOKE',command(karaoke,'ADD',1001))).success,false);
  assert.equal((await api.readGameTeams(1,'POWERPOINT_KARAOKE',karaoke.id)).assigned.length,1,'revocation retains membership');
  const race=await api.writeGameDraft(1,'BINGO',{...input,title:'Serialized series move'});
  const raceResults=await Promise.allSettled([
    api.changeGameTeam(1,'BINGO',command(race,'ADD',1003)),
    api.writeGameDraft(1,'BINGO',{...input,id:race.id,updatedAt:race.updatedAt,seriesId:20})
  ]);
  assert.equal(raceResults.filter(r=>r.status==='fulfilled').length,1,'add and stale series move cannot both succeed');
  const raceRow=await api.readGameDraft(1,'BINGO',race.id);
  assert.equal((await api.readGameTeams(1,'BINGO',race.id)).assigned.length,raceRow.game.seriesId===10?1:0);
  const columns=(await db.query(COLUMN_SQL)).rows[0].coalesce as Column[]; auditColumns(columns);
  assert.equal(columns.filter(c=>c.table==='game_team_assignments'&&c.schema==='pubquiz').length,4);
  const catalog=(await db.query(CATALOG_SQL)).rows[0].json_build_object as {constraints:{table:string}[]};
  assert.equal(catalog.constraints.filter(c=>c.table==='game_team_assignments').length,3);
  const row=(await db.query('SELECT to_jsonb(t) data FROM pubquiz.game_team_assignments t')).rows[0].data;
  assert.doesNotThrow(()=>inspectRow(row,new Set(),'pubquiz','game_team_assignments'));
  await assert.rejects(db.query('INSERT INTO pubquiz.game_team_assignments(id,game_id,team_id)VALUES(gen_random_uuid(),$1,1001)',[karaoke.id]),{code:'23505'});
  await assert.rejects(db.query('DELETE FROM pubquiz.teams WHERE team_id=1001'),{code:'23503'});
  assert.deepEqual((await db.query('SELECT to_jsonb(t) data FROM pubquiz.teams t WHERE team_id=1001')).rows[0].data,profileBefore);
  assert.deepEqual((await db.query('SELECT jsonb_agg(to_jsonb(t) ORDER BY quiz_team_session_id) data FROM pubquiz.quiz_team_sessions t')).rows[0].data,sessionsBefore);
  assert.deepEqual((await db.query('SELECT jsonb_agg(to_jsonb(t)) data FROM pubquiz.quiz_teams t')).rows[0].data,quizTeamsBefore);
  assert.deepEqual((await db.query('SELECT to_jsonb(q) data FROM pubquiz.quiz q WHERE quiz_id=11')).rows[0].data,before);
  console.info('AP2 isolated empty/populated schema, real Actions, concurrency, access and backup inventory passed:',name);
});
