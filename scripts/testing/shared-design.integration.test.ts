import assert from "node:assert/strict";
import test from "node:test";
import { Client } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@/app/generated/prisma/client";
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
test("shared design additive migration, real policies, inheritance and frozen runtime", {skip:!base,timeout:180000}, async context => {
  const target = new URL(base!);
  assert.ok(["127.0.0.1","localhost","ep-dry-dust-aljik09f-pooler.c-3.eu-central-1.aws.neon.tech"].includes(target.hostname));
  assert.match(target.pathname, /^\/(neondb|editorial_import_ci|game_draft_test_base)$/);
  const control = new Client({connectionString:target.toString()}); await control.connect();
  const name = `shared_design_qa_${Date.now()}`;
  try {await control.query(`CREATE DATABASE ${name}`);} finally {await control.end();}
  target.pathname = `/${name}`;
  const db = new Client({connectionString:target.toString()}); await db.connect();
  context.after(async()=>{await db.end();});
  const directory = mkdtempSync(join(tmpdir(),"game-draft-baseline-"));
  try {
    const schema = join(directory,"schema.prisma");
    writeFileSync(schema,execFileSync("git",["show","c09184d1127b7630c8cb55b7228a37d736059f96:prisma/schema.prisma"],{encoding:"utf8"}));
    const sql = execFileSync(process.execPath,["node_modules/prisma/build/index.js","migrate","diff","--from-empty","--to-schema",schema,"--script"],{encoding:"utf8",env:{...process.env,DATABASE_URL:target.toString()},maxBuffer:10000000});
    await db.query("CREATE SCHEMA IF NOT EXISTS pubquiz; SET search_path TO pubquiz,public");
    await db.query(sql.slice(sql.indexOf("-- CreateSchema")));
  } finally {rmSync(directory,{recursive:true});}

  const migration=readFileSync('prisma/migrations/20261026210000_shared_game_design/migration.sql','utf8');
  await db.query('BEGIN');await db.query(migration);
  assert.equal((await db.query("SELECT count(*)::int n FROM information_schema.columns WHERE table_schema='pubquiz' AND column_name LIKE 'shared_design_%'")).rows[0].n,4);
  await db.query('ROLLBACK');
  await db.query(`
    INSERT INTO pubquiz.users(id,name,email,password_hash,role,updated_at)SELECT n,'AP3 '||n,'ap3-'||n||'@example.invalid','not-a-login','USER',NOW() FROM generate_series(1,6)n;
    INSERT INTO pubquiz.eventreihen(eventreihe_id,name,slug)VALUES(10,'Design A','design-a'),(20,'Design B','design-b');
    INSERT INTO pubquiz.eventarten(kennung,name)VALUES('QUIZ','Quiz'),('BINGO','Bingo'),('POWERPOINT_KARAOKE','Karaoke') ON CONFLICT DO NOTHING;
    INSERT INTO pubquiz.eventreihe_eventarten(eventreihe_id,eventart,ist_freigeschaltet)SELECT id,t,true FROM unnest(ARRAY[10,20])id CROSS JOIN unnest(ARRAY['QUIZ','BINGO','POWERPOINT_KARAOKE'])t;
    INSERT INTO pubquiz.benutzer_rollenzuweisungen(benutzer_id,rolle,scope_typ)VALUES(1,'ADMIN','GLOBAL');
    INSERT INTO pubquiz.benutzer_reihenrollen(benutzer_id,eventreihe_id,rolle)VALUES(3,10,'EVENT_MANAGER'),(4,10,'EDITOR'),(5,20,'EVENT_MANAGER');
    INSERT INTO pubquiz.eventreihe_verwaltung(benutzer_id,eventreihe_id)VALUES(6,10);
    INSERT INTO pubquiz.quiz(quiz_id,eventreihe_id,titel,presentation_template_id,answer_form_template_id)VALUES(11,10,'Preserved Quiz','lovd-ungegoogelt','minimal');
    INSERT INTO pubquiz.game_drafts(id,eventart,eventreihe_id,titel)VALUES('33000000-0000-4000-8000-000000000001','BINGO',10,'AP3 Bingo'),('33000000-0000-4000-8000-000000000002','POWERPOINT_KARAOKE',10,'AP3 Karaoke');
    INSERT INTO pubquiz.teams(team_id,teamname,teamname_normalisiert,team_passwort)VALUES(1001,'Preserved team','preserved team','not-a-real-password');
    INSERT INTO pubquiz.game_team_assignments(id,game_id,team_id)VALUES('33000000-0000-4000-8000-000000000003','33000000-0000-4000-8000-000000000001',1001);
  `);
  const quizBefore=(await db.query('SELECT to_jsonb(t) data FROM pubquiz.quiz t')).rows[0].data;
  const gameBefore=(await db.query('SELECT to_jsonb(t) data FROM pubquiz.game_drafts t ORDER BY id')).rows.map(r=>r.data);
  const linksBefore=(await db.query('SELECT to_jsonb(t) data FROM pubquiz.game_team_assignments t')).rows;
  await db.query(migration);
  assert.deepEqual((await db.query("SELECT to_jsonb(t)-'shared_design_template_id'-'shared_design_snapshot' data FROM pubquiz.quiz t")).rows[0].data,quizBefore);
  assert.deepEqual((await db.query("SELECT to_jsonb(t)-'shared_design_template_id' data FROM pubquiz.game_drafts t ORDER BY id")).rows.map(r=>r.data),gameBefore);
  const prisma=new PrismaClient({adapter:new PrismaPg({connectionString:target.toString()})});context.after(()=>prisma.$disconnect());
  let currentUser:number|null=1;
  const bundle=await build({stdin:{contents:"export * from './app/rendering/sharedDesign/sharedDesignRepository.server'; export * as actions from './app/rendering/sharedDesign/actions'; export * from './app/rendering/resolveQuizTemplates.server'; export {starteQuiz} from './app/quiz/[quizId]/praesentation/statusActions'; export {updateQuiz} from './app/quiz/actions'; export {setPresentationTemplateArchived} from './app/rendering/presentationTemplates/actions'; export {listManagedPresentationTemplates} from './app/rendering/presentationTemplates/presentationTemplateRepository.server';",resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'cjs',packages:'external',plugins:[{name:'real-database',setup(b){
    b.onResolve({filter:/^(server-only|@\/auth|next\/cache|next\/navigation|@\/app\/generated\/prisma\/client|@\/app\/lib\/prisma)$/},a=>({path:a.path,namespace:'fixture'}));
    b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:a.path==='@/app/generated/prisma/client'?'export const Prisma=globalThis.prismaValue;':a.path==='server-only'?'':a.path==='@/auth'?'export const auth=async()=>globalThis.session();':a.path==='next/cache'?'export function revalidatePath(){}':a.path==='next/navigation'?'export function redirect(path){throw new Error("REDIRECT:"+path)}':'export const prisma=globalThis.fixture;'}));
  }}]});
  const runtime={exports:{}};runInNewContext(bundle.outputFiles[0].text,{module:runtime,exports:runtime.exports,require:createRequire(import.meta.url),fixture:prisma,prismaValue:Prisma,session:()=>currentUser?{user:{id:String(currentUser)}}:null,console,process,Date,Buffer,setTimeout,clearTimeout,structuredClone});
  const api=runtime.exports as typeof import('@/app/rendering/sharedDesign/sharedDesignRepository.server') & typeof import('@/app/rendering/resolveQuizTemplates.server') & Pick<typeof import('@/app/rendering/presentationTemplates/actions'),'setPresentationTemplateArchived'> & Pick<typeof import('@/app/rendering/presentationTemplates/presentationTemplateRepository.server'),'listManagedPresentationTemplates'> & Pick<typeof import('@/app/quiz/actions'),'updateQuiz'> & Pick<typeof import('@/app/quiz/[quizId]/praesentation/statusActions'),'starteQuiz'> & {actions:typeof import('@/app/rendering/sharedDesign/actions')};
  const series={kind:'SERIES' as const,id:'10'},quiz={kind:'QUIZ' as const,id:'11'},bingo={kind:'BINGO' as const,id:gameBefore[0].id as string},karaoke={kind:'POWERPOINT_KARAOKE' as const,id:gameBefore[1].id as string};
  async function save(t:typeof series|typeof quiz|typeof bingo|typeof karaoke,selection:string|null,user=1){currentUser=user;const old=await api.readDesign(user,t);const result=await api.actions.saveSharedDesign({target:t,selection,expectedSelection:old.selection,expectedSeriesId:old.seriesId});assert.equal(result.success,true,JSON.stringify(result));}
  const legacy=await api.resolveQuizTemplates(11);assert.equal(legacy?.presentation.template.id,'lovd-ungegoogelt');
  await save(series,'phil-gud',6);await save(quiz,'INHERIT',3);
  for(const t of [quiz,bingo,karaoke])assert.equal((await api.readDesign(3,t)).design.templateId,'phil-gud');
  const resolved=await api.resolveQuizTemplates(11);assert.equal(resolved?.presentation.template.id,'phil-gud');assert.equal(resolved?.answerForm.template.id,'minimal');
  currentUser=3;assert.equal((await api.actions.saveSharedDesign({target:quiz,selection:'INHERIT',expectedSelection:'INHERIT',expectedSeriesId:10,answerSelection:'phil-gud',expectedAnswerSelection:'minimal'})).success,true);
  assert.equal((await api.resolveQuizTemplates(11))?.answerForm.template.id,'phil-gud');
  assert.equal((await api.actions.saveSharedDesign({target:quiz,selection:'INHERIT',expectedSelection:'INHERIT',expectedSeriesId:10,answerSelection:'minimal',expectedAnswerSelection:'phil-gud'})).success,true);
  await save(series,'lovd-ungegoogelt',6);for(const t of [quiz,bingo,karaoke])assert.equal((await api.readDesign(3,t)).design.templateId,'lovd-ungegoogelt');
  await save(bingo,'phil-gud',3);assert.equal((await api.readDesign(3,bingo)).source,'Spielauswahl');assert.equal((await api.readDesign(3,karaoke)).design.templateId,'lovd-ungegoogelt');
  await save(bingo,null,3);assert.equal((await api.readDesign(3,bingo)).design.templateId,'lovd-ungegoogelt');
  const custom=structuredClone((await api.readDesign(1,bingo)).design.config);
  await prisma.presentation_templates.create({data:{presentation_template_id:'ap3-custom',name:'Synthetic custom LOVD',status:'ACTIVE',theme_config_json:custom as unknown as Prisma.InputJsonValue}});
  await save(bingo,'ap3-custom',3);assert.equal((await api.readDesign(3,bingo)).design.templateId,'ap3-custom');
  assert.ok((await api.listManagedPresentationTemplates()).templates.find(t=>t.id==='ap3-custom')!.usageCount>0);
  currentUser=1;await api.setPresentationTemplateArchived('ap3-custom',true);assert.equal((await prisma.presentation_templates.findUniqueOrThrow({where:{presentation_template_id:'ap3-custom'}})).status,'ACTIVE','common assignment must protect existing archive action');
  await save(bingo,null,3);
  currentUser=1;await api.setPresentationTemplateArchived('ap3-custom',true);assert.equal((await prisma.presentation_templates.findUniqueOrThrow({where:{presentation_template_id:'ap3-custom'}})).status,'ARCHIVED');
  currentUser=3;assert.equal((await api.actions.saveSharedDesign({target:bingo,selection:'ap3-custom',expectedSelection:null,expectedSeriesId:10})).success,false);
  await prisma.presentation_templates.update({where:{presentation_template_id:'ap3-custom'},data:{status:'ACTIVE'}});
  currentUser=1;await Promise.all([api.actions.saveSharedDesign({target:bingo,selection:'ap3-custom',expectedSelection:null,expectedSeriesId:10}),api.setPresentationTemplateArchived('ap3-custom',true)]);
  const raceGame=await prisma.game_drafts.findUniqueOrThrow({where:{id:bingo.id}}),raceTemplate=await prisma.presentation_templates.findUniqueOrThrow({where:{presentation_template_id:'ap3-custom'}});
  if(raceGame.shared_design_template_id==='ap3-custom'){assert.equal(raceTemplate.status,'ACTIVE','archive raced a committed shared reference');await save(bingo,null,1);}else assert.equal(raceTemplate.status,'ARCHIVED');

  const invalid=structuredClone(custom) as unknown as {tokens:{typography:{displayFamily:string}}};invalid.tokens.typography.displayFamily='invalid-font';
  await prisma.presentation_templates.update({where:{presentation_template_id:'ap3-custom'},data:{status:'ACTIVE',theme_config_json:invalid as unknown as Prisma.InputJsonValue}});
  assert.equal((await api.actions.saveSharedDesign({target:bingo,selection:'ap3-custom',expectedSelection:null,expectedSeriesId:10})).success,false);
  for(const t of [series,quiz,bingo,karaoke]){
    await assert.rejects(api.readDesign(5,t));
    const old=await api.readDesign(1,t);currentUser=4;assert.equal((await api.actions.saveSharedDesign({target:t,selection:'phil-gud',expectedSelection:old.selection,expectedSeriesId:10})).success,false);
  }
  await assert.rejects(api.readDesign(4,karaoke));assert.equal((await api.readDesign(4,bingo)).canWrite,false);
  for(const id of ['../secret','1 OR 1=1','0','999999'])await assert.rejects(api.readDesign(1,{kind:'QUIZ',id}));
  await assert.rejects(api.readDesign(1,{kind:'POWERPOINT_KARAOKE',id:bingo.id}));
  const old=await api.readDesign(1,bingo);currentUser=1;
  for(const selection of ['ungegoogelt-default','birthday-reference','missing-template','../bad'])assert.equal((await api.actions.saveSharedDesign({target:bingo,selection,expectedSelection:old.selection,expectedSeriesId:10})).success,false);
  assert.equal((await api.actions.saveSharedDesign({target:bingo,selection:'phil-gud',expectedSelection:'wrong',expectedSeriesId:10})).success,false);
  await db.query("UPDATE pubquiz.eventreihe_eventarten SET ist_freigeschaltet=false WHERE eventreihe_id=10 AND eventart='BINGO'");await assert.rejects(api.readDesign(1,bingo));assert.equal((await api.actions.saveSharedDesign({target:bingo,selection:'phil-gud',expectedSelection:old.selection,expectedSeriesId:10})).success,false);await db.query("UPDATE pubquiz.eventreihe_eventarten SET ist_freigeschaltet=true WHERE eventreihe_id=10 AND eventart='BINGO'");
  await db.query('DELETE FROM pubquiz.benutzer_reihenrollen WHERE benutzer_id=3');await assert.rejects(api.readDesign(3,bingo));await db.query("INSERT INTO pubquiz.benutzer_reihenrollen(benutzer_id,eventreihe_id,rolle)VALUES(3,10,'EVENT_MANAGER')");
  currentUser=3;
  assert.equal((await api.updateQuiz({quizId:11,eventSeriesId:10,titel:'Preserved Quiz',quizDatum:'2026-10-26',bemerkung:'',presentationTemplateId:'phil-gud'})).success,true);
  assert.equal((await prisma.quiz.findUniqueOrThrow({where:{quiz_id:11}})).answer_form_template_id,'minimal','old master form must preserve separate AP3 choice');
  await api.starteQuiz(11,0);
  const firstSnapshot=JSON.stringify((await prisma.quiz.findUniqueOrThrow({where:{quiz_id:11}})).shared_design_snapshot);
  const frozen=(await api.resolveQuizTemplates(11))?.presentation.template.tokens;
  await db.query("UPDATE pubquiz.quiz SET answer_form_template_id='phil-gud' WHERE quiz_id=11");
  assert.equal((await api.resolveQuizTemplates(11))?.answerForm.template.id,'minimal','running answer design must stay frozen');
  await save(series,'phil-gud',6);assert.deepEqual((await api.resolveQuizTemplates(11))?.presentation.template.tokens,frozen);
  currentUser=3;await api.starteQuiz(11,0);assert.equal(JSON.stringify((await prisma.quiz.findUniqueOrThrow({where:{quiz_id:11}})).shared_design_snapshot),firstSnapshot,'idempotent start must not refresh design');
  assert.equal((await api.readDesign(3,quiz)).canWrite,false);currentUser=3;assert.equal((await api.actions.saveSharedDesign({target:quiz,selection:'phil-gud',expectedSelection:'INHERIT',expectedSeriesId:10})).success,false);
  const snapshot=(await db.query('SELECT to_jsonb(t) data FROM pubquiz.quiz t')).rows[0].data;assert.doesNotThrow(()=>inspectRow(snapshot,new Set(),'pubquiz','quiz'));
  assert.deepEqual((await db.query('SELECT to_jsonb(t) data FROM pubquiz.game_team_assignments t')).rows,linksBefore);
  const cols=(await db.query(COLUMN_SQL)).rows[0].coalesce as Column[];
  auditColumns(cols); const catalog=(await db.query(CATALOG_SQL)).rows; assert.ok(catalog.length);
  assert.ok(cols.some(c=>c.column==='shared_design_snapshot'));
  console.info('AP3 empty/populated migration, real Actions, inheritance, runtime snapshot and access PASS:',name);
});
