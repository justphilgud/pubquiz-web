import assert from "node:assert/strict";
import test from "node:test";
import { Client } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/app/generated/prisma/client";
import { readFileSync, writeFileSync, mkdtempSync, unlinkSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { build } from "esbuild";
import bcrypt from "bcryptjs";

const base = process.env.EVENT_TYPE_TEST_DATABASE_URL;
const baseline = "5920a568afb6d650d52a9c819e347170b993ed80";
test("real PostgreSQL migration, current Actions, product lifecycle and legacy guards", { skip: !base, timeout: 120_000 }, async context => {
  const target = new URL(base!);
  // Explicit disposable base only. Never accept Production or a regular application database.
  assert.ok(["127.0.0.1", "localhost", "ep-dry-dust-aljik09f-pooler.c-3.eu-central-1.aws.neon.tech"].includes(target.hostname));
  if (target.hostname === "ep-dry-dust-aljik09f-pooler.c-3.eu-central-1.aws.neon.tech") assert.equal(target.pathname, "/neondb");
  else assert.match(target.pathname, /^\/(editorial_import_ci|event_type_test_base)$/);
  const name = `event_type_qa_${Date.now()}`;
  const control = new Client({ connectionString: target.toString() }); await control.connect();
  try { await control.query(`CREATE DATABASE ${name}`); } finally { await control.end(); }
  target.pathname = `/${name}`;
  const db = new Client({ connectionString: target.toString(), query_timeout: 30_000, statement_timeout: 30_000 }); await db.connect();
  context.after(async () => { await db.end(); });
  console.info("Event type DB stage: baseline schema");
  const directory = mkdtempSync(join(tmpdir(), "pubquiz-event-types-"));
  const schemaPath = join(directory, "schema.prisma");
  try {
    writeFileSync(schemaPath, execFileSync("git", ["show", `${baseline}:prisma/schema.prisma`], { encoding: "utf8" }));
    const sql = execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "diff", "--from-empty", "--to-schema", schemaPath, "--script"], {
      encoding: "utf8", env: { ...process.env, DATABASE_URL: target.toString() }, maxBuffer: 10_000_000,
    });
    // Prisma may omit schema qualifiers when DATABASE_URL contains schema=pubquiz;
    // node-postgres does not apply that Prisma-only URL parameter as search_path.
    await db.query("CREATE SCHEMA IF NOT EXISTS pubquiz; SET search_path TO pubquiz, public");
    await db.query(sql.slice(sql.indexOf("-- CreateSchema")));
  } finally { unlinkSync(schemaPath); rmdirSync(directory); }
  console.info("Event type DB stage: legacy fixtures");
  const hash = await bcrypt.hash("EventType-QA-Only-2026!", 10);
  for (const [id, label, role] of [[1,"Admin","ADMIN"],[2,"Global Editor","EDITOR"],[3,"Manager A","USER"],[4,"Editor A","USER"],[5,"Manager B","USER"],[6,"Legacy only","ADMIN"]] as const) {
    await db.query("INSERT INTO pubquiz.users(id,name,email,password_hash,role,updated_at)VALUES($1,$2,$3,$4,$5,NOW())", [id,label,`eventqa${id}@example.invalid`,hash,role]);
  }
  await db.query(`
    INSERT INTO pubquiz.eventreihen(eventreihe_id,name,slug)VALUES(10,'Eventart QA A','eventqa-a'),(20,'Eventart QA B','eventqa-b');
    INSERT INTO pubquiz.benutzer_rollenzuweisungen(benutzer_id,rolle,scope_typ,eventreihe_id,zugewiesen_von_user_id)VALUES
    (1,'ADMIN','GLOBAL',NULL,NULL),(2,'EDITOR','GLOBAL',NULL,NULL),(3,'EVENT_MANAGER','EVENT_SERIES',10,1),(4,'EDITOR','EVENT_SERIES',10,1),(5,'EVENT_MANAGER','EVENT_SERIES',20,1);
    INSERT INTO pubquiz.eventreihe_benutzerrollen(benutzer_id,rolle,eventreihe_id)VALUES(3,'EVENT_MANAGER',10),(4,'EVENT_EDITOR',10),(5,'EVENT_MANAGER',20),(6,'EVENT_MANAGER',20);
    INSERT INTO pubquiz.antworttyp(antworttyp_id,antworttyp)VALUES(1,'Standard');
    INSERT INTO pubquiz.medientyp(medientyp_id,medientyp)VALUES(1,'Bild'),(2,'Audio'),(3,'Video');
    INSERT INTO pubquiz.fragen(fragen_id,frage,geltungsbereich,created_by_user_id,review_status,freigegeben,ist_unfertig)VALUES
    (101,'Eventart QA A: Eigener Entwurf','EVENT_SERIES',4,'DRAFT',FALSE,TRUE),
    (102,'Eventart QA B: Fremder Entwurf','EVENT_SERIES',5,'DRAFT',FALSE,TRUE),
    (103,'Eventart QA Global: Eigener Entwurf','GLOBAL',2,'DRAFT',FALSE,TRUE),
    (104,'Wie viel ist eins plus eins?','GLOBAL',2,'APPROVED',TRUE,FALSE);
    INSERT INTO pubquiz.fragen_eventreihen(fragen_id,eventreihe_id)VALUES(101,10),(102,20);
    INSERT INTO pubquiz.antworten(fragen_id,antwort,ist_richtig,antworttyp_id)VALUES(104,'Zwei',TRUE,1);
    INSERT INTO pubquiz.quiz(quiz_id,eventreihe_id,titel,quiz_datum,intro_begruessungstitel,intro_begruessungstext)VALUES
    (11,10,'Eventarten Abnahme A','2026-10-25','Eventarten-Test','Nur isolierte Testdaten'),(12,20,'Eventarten Abnahme B','2026-10-25',NULL,NULL);
    INSERT INTO pubquiz.quiz_abschnitte(quiz_abschnitt_id,quiz_id,titel,abschnitt_typ,sortierung)VALUES
    (1,11,'Intro','intro',1),(2,11,'Block 1','fragenblock',2),(3,11,'Outro','outro',3),(4,12,'Intro','intro',1),(5,12,'Block 1','fragenblock',2),(6,12,'Outro','outro',3);
    INSERT INTO pubquiz.quiz_fragen(quiz_id,fragen_id,sortierung,quiz_abschnitt_id)VALUES(11,104,1,2),(12,104,1,5);
    SELECT setval(pg_get_serial_sequence('pubquiz.users','id'),100);
    SELECT setval(pg_get_serial_sequence('pubquiz.quiz','quiz_id'),100);
    SELECT setval(pg_get_serial_sequence('pubquiz.fragen','fragen_id'),200);
    SELECT setval(pg_get_serial_sequence('pubquiz.quiz_abschnitte','quiz_abschnitt_id'),100);
  `);
  const before = (await db.query("SELECT jsonb_agg(to_jsonb(q) ORDER BY quiz_id) AS data FROM pubquiz.quiz q")).rows[0].data;
  const oldRoles = (await db.query("SELECT * FROM pubquiz.benutzer_rollenzuweisungen ORDER BY rollenzuweisung_id")).rows;
  console.info("Event type DB stage: migration");
  await db.query(readFileSync("prisma/migrations/20261025140000_event_type_permissions/migration.sql", "utf8"));
  assert.deepEqual((await db.query("SELECT jsonb_agg(to_jsonb(q) ORDER BY quiz_id) AS data FROM pubquiz.quiz q")).rows[0].data, before);
  assert.deepEqual((await db.query("SELECT * FROM pubquiz.benutzer_rollenzuweisungen ORDER BY rollenzuweisung_id")).rows, oldRoles);
  assert.equal((await db.query("SELECT count(*)::int n FROM pubquiz.eventreihe_eventarten WHERE eventart='QUIZ' AND ist_freigeschaltet")).rows[0].n, 2);
  assert.equal((await db.query("SELECT count(*)::int n FROM pubquiz.benutzer_eventartrollen WHERE eventart <> 'QUIZ'")).rows[0].n, 0);
  assert.deepEqual((await db.query("SELECT benutzer_id,eventreihe_id FROM pubquiz.eventreihe_verwaltung ORDER BY benutzer_id")).rows, [{benutzer_id:3,eventreihe_id:10},{benutzer_id:5,eventreihe_id:20}]);
  await assert.rejects(db.query("UPDATE pubquiz.benutzer_rollenzuweisungen SET rolle='EDITOR' WHERE benutzer_id=3"), { code: "42501" });
  await assert.rejects(db.query("DELETE FROM pubquiz.eventreihe_benutzerrollen WHERE benutzer_id=3"), { code: "42501" });
  await assert.rejects(db.query("INSERT INTO pubquiz.benutzer_eventartrollen(benutzer_id,eventreihe_id,eventart,rolle)VALUES(4,20,'BINGO','ADMIN')"), { code: "23514" });
  const previousFormatRows = (await db.query("SELECT * FROM pubquiz.benutzer_eventartrollen ORDER BY benutzer_id,eventreihe_id,eventart")).rows;
  const seriesMigration = readFileSync("prisma/migrations/20261025160000_series_roles/migration.sql", "utf8");
  await db.query("INSERT INTO pubquiz.benutzer_eventartrollen(benutzer_id,eventreihe_id,eventart,rolle)VALUES(3,10,'BINGO','EDITOR')");
  await assert.rejects(db.query(seriesMigration), { code: "P0001" });
  await db.query("ROLLBACK");
  assert.equal((await db.query("SELECT to_regclass('pubquiz.benutzer_reihenrollen') name")).rows[0].name,null);
  await db.query("DELETE FROM pubquiz.benutzer_eventartrollen WHERE benutzer_id=3 AND eventreihe_id=10 AND eventart='BINGO'");
  await db.query(seriesMigration);
  assert.deepEqual((await db.query("SELECT * FROM pubquiz.benutzer_eventartrollen ORDER BY benutzer_id,eventreihe_id,eventart")).rows, previousFormatRows);
  assert.equal((await db.query("SELECT count(*)::int n FROM pubquiz.benutzer_reihenrollen")).rows[0].n,3);
  await assert.rejects(db.query("UPDATE pubquiz.benutzer_eventartrollen SET rolle='EDITOR' WHERE benutzer_id=3"), { code: "42501" });
  console.info("Event type DB stage: real Actions");
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: target.toString() }) });
  let currentUser = 1;
  const fixture = { db: prisma, session: () => ({ user: { id: String(currentUser) } }) };
  const bundled = await build({ stdin: { contents: `
    export * as actions from './app/roles/eventTypeActions';
    export * as actors from './app/roles/roleAssignments.server';
    export * as guard from './app/eventreihen/eventSeriesAccess.server';
    export * as legacy from './app/eventreihen/membershipActions';
    export * as live from './app/quiz/[quizId]/praesentation/statusActions';
    export * as users from './app/admin/users/actions';
    export * as series from './app/eventreihen/actions';
  `, resolveDir: process.cwd() }, bundle: true, write: false, platform: "node", format: "cjs", packages: "external", define: { "import.meta.url": JSON.stringify(import.meta.url) },
    plugins: [{ name: "adapters", setup(builder) {
      builder.onResolve({ filter: /^(server-only|@\/auth|@\/app\/lib\/prisma|next\/cache|next\/navigation)$/ }, args => ({ path: args.path, namespace: "fixture" }));
      builder.onLoad({ filter: /.*/, namespace: "fixture" }, args => ({ contents: args.path === "@/auth" ? "export const auth = async () => globalThis.fixture.session();" : args.path === "@/app/lib/prisma" ? "export const prisma = globalThis.fixture.db;" : args.path === "next/navigation" ? 'export function redirect(path) { throw new Error("REDIRECT:" + path); }' : args.path === "next/cache" ? "export function revalidatePath() {}" : "" }));
    } }],
  });
  const runtime = { exports: {} };
  runInNewContext(bundled.outputFiles![0].text, { module: runtime, exports: runtime.exports, require: createRequire(import.meta.url), fixture, console, process, Buffer, URL, Request, Response, Date, setTimeout, clearTimeout, performance, TextEncoder, TextDecoder, structuredClone }, { filename: "event-type-actions.cjs" });
  const api = runtime.exports as { series: typeof import("@/app/eventreihen/actions"); live: typeof import("@/app/quiz/[quizId]/praesentation/statusActions"); users: typeof import("@/app/admin/users/actions"); actions: typeof import("@/app/roles/eventTypeActions"); actors: typeof import("@/app/roles/roleAssignments.server"); guard: typeof import("@/app/eventreihen/eventSeriesAccess.server"); legacy: typeof import("@/app/eventreihen/membershipActions") };
  try {
    assert.equal((await api.actors.getActorPermissions(6)).assignments.length,0,"Legacy fields must never act as an authorization fallback");
    assert.equal((await api.actors.getActorPermissions(6)).managedEventSeriesIds?.length,0);
    async function saveSeriesRoles(userId: number, assignments: {eventSeriesId:number;role:"EDITOR"|"EVENT_MANAGER"}[], managementIds: number[] = []) {
      const form = new FormData(); form.set("id",String(userId)); form.set("name",`User ${userId}`); form.set("email",`eventqa${userId}@example.invalid`); form.set("is_active","true");
      form.set("seriesRolesVersion","1"); form.set("eventSeriesRoles",JSON.stringify(assignments));
      for (const id of managementIds) form.append("manageEventSeriesIds",String(id));
      return api.users.updateUserAction(form);
    }
    const seriesInput={name:"New format QA series",isPublic:false};
    assert.equal((await api.series.createEventSeries(seriesInput,["UNKNOWN" as never])).success,false);
    const createdSeries=await api.series.createEventSeries(seriesInput,["QUIZ","BINGO"]);
    assert.equal(createdSeries.success,true);
    assert.deepEqual((await db.query("SELECT eventart FROM pubquiz.eventreihe_eventarten WHERE eventreihe_id=$1 AND ist_freigeschaltet ORDER BY eventart",[createdSeries.eventSeriesId])).rows.map(r=>r.eventart),["BINGO","QUIZ"]);
    assert.equal((await api.actions.saveEventTypeMatrix(3, [])).success,false,"Stale matrix must not write rights");
    assert.equal((await saveSeriesRoles(3,[{eventSeriesId:10,role:"EVENT_MANAGER"},{eventSeriesId:20,role:"EDITOR"}])).success,true);
    assert.equal((await saveSeriesRoles(3,[{eventSeriesId:999999,role:"EVENT_MANAGER"}])).success,false);
    assert.equal((await db.query("SELECT count(*)::int n FROM pubquiz.benutzer_reihenrollen WHERE benutzer_id=3")).rows[0].n,2);
    const create = new FormData(); create.set("name","Scoped new editor"); create.set("email","series-new@example.invalid"); create.set("password","Isolated-Series-Only-2026!");
    create.set("seriesRolesVersion","1"); create.set("eventSeriesRoles",JSON.stringify([{eventSeriesId:20,role:"EDITOR"}]));
    assert.equal((await api.users.createUserAction(create)).success,true);
    const newUser=(await db.query("SELECT id FROM pubquiz.users WHERE email='series-new@example.invalid'")).rows[0].id;
    assert.equal((await api.actors.getActorPermissions(newUser)).assignments.some(a=>a.eventSeriesId===20&&a.role==='EDITOR'),true);
    let actor = await api.actors.getActorPermissions(3);
    assert.equal(actor.assignments.filter(r => r.scopeType === "EVENT_SERIES").length, 2);
    assert.equal(actor.eventTypeAssignments?.find(r => r.eventType === "BINGO")?.enabled, false);
    assert.equal((await api.actions.setEventTypeEnabled(20,"BINGO",true)).success, true);
    actor = await api.actors.getActorPermissions(3);
    assert.equal(actor.eventTypeAssignments?.find(r => r.eventType === "BINGO" && r.eventSeriesId === 20)?.enabled, true);
    assert.equal(actor.eventTypeAssignments?.find(r => r.eventType === "BINGO" && r.eventSeriesId === 20)?.role, "EDITOR");
    currentUser = 3;
    await assert.rejects(api.actions.setEventTypeEnabled(10,"QUIZ",false), /REDIRECT/);
    await assert.rejects(api.actions.saveEventTypeMatrix(4, []), /REDIRECT/);
    await assert.rejects(api.guard.requireEventSeriesEditor(10), /Zugriff/);
    assert.ok(await api.guard.requireEventSeriesAccess(10,"CONTROL_LIVE"));
    currentUser = 1;
    const identity = new FormData();
    identity.set("id","3"); identity.set("name","Manager A"); identity.set("email","eventqa3@example.invalid"); identity.set("is_active","true");
    assert.equal((await api.users.updateUserAction(identity)).success,true);
    assert.equal((await api.actors.getActorPermissions(3)).eventTypeAssignments?.length,6);
    await api.live.starteQuiz(11,0);
    assert.equal((await api.actions.setEventTypeEnabled(10,"QUIZ",false)).success, false);
    await db.query("UPDATE pubquiz.quiz_praesentation_status SET quiz_stopped_at=NOW() WHERE quiz_id=11");
    assert.equal((await api.actions.setEventTypeEnabled(10,"QUIZ",false)).success, true);
    await assert.rejects(api.live.starteQuiz(11,0), /nicht freigeschaltet/);
    actor = await api.actors.getActorPermissions(3);
    assert.equal(actor.assignments.some(r => r.eventSeriesId === 10), false);
    const disabledDetails = await api.series.getEventSeriesDetails(10);
    assert.deepEqual(disabledDetails?.accessSummary,{managerCount:1,editorCount:1},"Stored series roles remain visible when Quiz is disabled");
    assert.equal((await db.query("SELECT count(*)::int n FROM pubquiz.benutzer_reihenrollen WHERE benutzer_id=3 AND eventreihe_id=10")).rows[0].n,1);
    assert.equal((await api.actions.setEventTypeEnabled(10,"QUIZ",true)).success, true);
    assert.equal((await api.actors.getActorPermissions(3)).assignments.some(r => r.eventSeriesId === 10),true);
    await db.query("INSERT INTO pubquiz.quiz(quiz_id,eventreihe_id,titel)VALUES(14,10,'Isolierter Start-Deaktivierungs-Race')");
    console.info("Event type DB stage: concurrent start/deactivation");
    const race = await Promise.allSettled([api.live.starteQuiz(14,0), api.actions.setEventTypeEnabled(10,"QUIZ",false)]);
    const invariant = (await db.query(`SELECT
      (SELECT ist_freigeschaltet FROM pubquiz.eventreihe_eventarten WHERE eventreihe_id=10 AND eventart='QUIZ') AS enabled,
      EXISTS(SELECT 1 FROM pubquiz.quiz_praesentation_status WHERE quiz_id=14 AND quiz_started_at IS NOT NULL AND quiz_stopped_at IS NULL) AS running`)).rows[0];
    assert.equal(invariant.running && !invariant.enabled,false,"Concurrent start/deactivation must never leave a running disabled product");
    if (invariant.running) {
      assert.equal(race[0].status,"fulfilled");
      assert.equal(race[1].status,"fulfilled");
      assert.equal(race[1].status === "fulfilled" && race[1].value.success,false);
    } else {
      assert.equal(race[0].status,"rejected");
      assert.equal(race[1].status === "fulfilled" && race[1].value.success,true);
    }
    await api.actions.setEventTypeEnabled(10,"QUIZ",true);
    await db.query("UPDATE pubquiz.users SET is_active=false WHERE id=3");
    assert.equal((await api.actors.getActorPermissions(3)).assignments.length,0);
    await db.query("UPDATE pubquiz.users SET is_active=true WHERE id=3");
    assert.equal((await api.legacy.addEventSeriesRoleAssignment({userId:4,eventSeriesId:20,role:"EVENT_MANAGER"})).success,false);
    assert.equal((await saveSeriesRoles(4,[])).success,true);
    assert.equal((await api.actors.getActorPermissions(4)).assignments.length,0);
    assert.equal((await db.query("SELECT count(*)::int n FROM pubquiz.benutzer_eventartrollen WHERE benutzer_id=4")).rows[0].n,0,"Old Preview instances must not retain revoked format roles");
    await saveSeriesRoles(4,[{eventSeriesId:10,role:"EDITOR"}]);
    // Restore only synthetic QA role configuration for the following browser acceptance.
    await saveSeriesRoles(3,[{eventSeriesId:10,role:"EVENT_MANAGER"},{eventSeriesId:20,role:"EDITOR"}],[10]);
    console.info(`Isolated QA database retained for browser acceptance: ${name}`);
  } finally { await prisma.$disconnect(); }
});
