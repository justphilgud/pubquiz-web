import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as flow from "./flow/quizFlow";
import * as policy from "./fixedSlidesPolicy";
import * as booking from "./bookingSlide";
import * as difficultyAudit from "./evaluation/difficultyAudit";

function load(file: string, dependencies: Record<string, unknown>) {
  const exports: Record<string, (...args: unknown[]) => Promise<unknown>> = {};
  runInNewContext(ts.transpileModule(readFileSync(new URL(file, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, Date, require: (id: string) => {
      if (id in dependencies) return dependencies[id];
      throw new Error(`Unexpected dependency: ${id}`);
    },
  });
  return exports;
}

function fixture() {
  const quiz = { quiz_id: 1, titel: "QA", intro_regeln: "Alte Regel", quiz_abschnitte: [], quiz_fragen: [], quiz_ablauf_elemente: [
    { quiz_ablauf_element_id: 1, quiz_id: 1, typ: "RULES", anker_typ: "BEFORE_QUIZ", anker_schluessel: "GLOBAL", quiz_abschnitt_id: null, quiz_fragen_id: null, sortierung: 2000, ist_sichtbar: true, bezeichnung: null, konfiguration: { version: 1, title: "Die Regeln", rules: flow.rulesFromText("Alte Regel") }, konfigurations_version: 1, ist_standard: true },
    { quiz_ablauf_element_id: 2, quiz_id: 1, typ: "RULES", anker_typ: "BEFORE_QUIZ", anker_schluessel: "GLOBAL", quiz_abschnitt_id: null, quiz_fragen_id: null, sortierung: 2500, ist_sichtbar: true, bezeichnung: "Zusatz", konfiguration: { version: 1, rules: flow.rulesFromText("Individuelle Regel") }, konfigurations_version: 1, ist_standard: false },
  ] };
  let fail = false;
  let denied = false;
  let transactions = 0;
  const db = {
    quiz: {
      findUnique: async () => quiz,
      findUniqueOrThrow: async () => quiz,
      update: async ({ data }: { data: object }) => Object.assign(quiz, data),
    },
    quiz_ablauf_elemente: {
      findMany: async () => quiz.quiz_ablauf_elemente,
      createMany: async ({ data }: { data: (typeof quiz.quiz_ablauf_elemente)[number][] }) => data.forEach(row => quiz.quiz_ablauf_elemente.push({ ...row, quiz_ablauf_element_id: quiz.quiz_ablauf_elemente.length + 1 })),
      update: async ({ where, data }: { where: { quiz_ablauf_element_id: number }; data: object }) => {
        if (fail) throw new Error("Simulated flow write failure");
        Object.assign(quiz.quiz_ablauf_elemente.find(row => row.quiz_ablauf_element_id === where.quiz_ablauf_element_id)!, data);
      },
    },
    $executeRaw: async () => 1,
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
      const before = structuredClone(quiz); transactions++;
      try { return await fn(db); } catch (error) { Object.assign(quiz, before); throw error; }
    },
  };
  const repository = load("./flow/quizFlowRepository.server.ts", {
    "server-only": {}, "@/app/generated/prisma/client": { Prisma: {} }, "@/app/lib/prisma": { prisma: db }, "./quizFlow": flow,
    "./quizBlockSequence": {}, "@/app/story-elemente/storyPlacement": {},
  });
  const actions = load("./[quizId]/slides/fixedSlideActions.ts", {
    "next/cache": { revalidatePath: () => {} }, "@/app/quiz/bookingSlide": booking,
    "@/lib/prisma": { prisma: db }, "@/app/quiz/quizAccess.server": { requireQuizEditor: async () => { if (denied) throw new Error("Denied"); }, requireQuizViewer: async () => {} },
    "@/app/quiz/fixedSlidesPolicy": policy, "@/app/quiz/flow/quizFlowRepository.server": repository, "@/app/quiz/flow/quizFlow": flow,
  });
  return { quiz, fail: () => { fail = true; }, deny: () => { denied = true; }, transactions: () => transactions,
    saveSlide: async (outro: boolean, slideId: string, values: Record<string, string>) => {
      const data = new FormData(); data.set("quizId", "1"); data.set("slideId", slideId); data.set("enabled", "on");
      Object.entries(values).forEach(([key, value]) => data.set(key, value));
      return actions[outro ? "saveOutroSlide" : "saveIntroSlide"]({}, data) as Promise<{ status: string }>;
    },
    save: async (text: string, enabled: boolean) => {
      const data = new FormData(); data.set("quizId", "1"); data.set("slideId", "rules"); data.set("regeln", text); if (enabled) data.set("enabled", "on");
      return actions.saveIntroSlide({}, data) as Promise<{ status: string }>;
    },
  };
}

test("welcome and closing save current copy and explicit clearing cannot resurrect a materialized old copy", async () => {
  const data = fixture();
  for (const [outro, id, values, type, expected] of [
    [false, "welcome", { titel: "im LOVD", begruessung: "Absatz 1\n\nAbsatz 2" }, "WELCOME", "Absatz 1\n\nAbsatz 2"],
    [true, "announcements", { bekanntmachungen: "Eigener Schluss\n\nBis bald" }, "CLOSING", "Eigener Schluss\n\nBis bald"],
    [false, "welcome", { titel: "", begruessung: "" }, "WELCOME", "Willkommen zum heutigen Quizabend!"],
    [true, "announcements", { bekanntmachungen: "" }, "CLOSING", "Wir freuen uns auf den nächsten gemeinsamen Quizabend."],
  ] as const) {
    assert.equal((await data.saveSlide(outro, id, values)).status, "success");
    const stored = data.quiz.quiz_ablauf_elemente.find(item => item.typ === type && item.ist_standard);
    assert.equal((stored?.konfiguration as { body?: string })?.body, expected);
    assert.equal(JSON.parse(JSON.stringify(stored))?.konfiguration.body, expected);
  }
});

test("explicitly empty calendar and submission copy is retained, not filled from defaults", async () => {
  for (const id of ["calendar", "questionSubmission"]) {
    const data = fixture();
    assert.equal((await data.saveSlide(true, id, { title: "", body: "", ctaText: "" })).status, "success");
    const config = data.quiz.quiz_ablauf_elemente.find(item => item.typ === (id === "calendar" ? "CALENDAR_SUBSCRIPTION" : "QUESTION_SUBMISSION_QR"))?.konfiguration as { title?: string; body?: string };
    assert.equal(config.title, ""); assert.equal(config.body, "");
  }
});

test("saving after materialization synchronizes legacy and standard flow, preserves custom rules", async () => {
  const data = fixture();
  const custom = JSON.stringify(data.quiz.quiz_ablauf_elemente[1]);
  assert.equal((await data.save("Neue Regel\r\nNoch eine Regel", false)).status, "success");
  assert.equal(data.quiz.intro_regeln, "Neue Regel\nNoch eine Regel");
  const standard = data.quiz.quiz_ablauf_elemente[0];
  assert.equal(standard.ist_sichtbar, false);
  assert.equal(JSON.stringify(standard.konfiguration.rules), JSON.stringify(flow.rulesFromText("Neue Regel\nNoch eine Regel")));
  assert.equal(JSON.stringify(data.quiz.quiz_ablauf_elemente[1]), custom);
  assert.equal(data.transactions(), 1);
  assert.equal((await data.save("", true)).status, "success");
  assert.equal(data.quiz.intro_regeln, null);
  assert.equal(JSON.stringify(standard.konfiguration.rules), JSON.stringify(flow.rulesFromText(null)));
});

test("failed rule write rolls back legacy change and denied writes never start a transaction", async () => {
  const data = fixture(); const before = JSON.stringify(data.quiz);
  data.fail(); assert.equal((await data.save("Must roll back", true)).status, "error");
  assert.equal(JSON.stringify(data.quiz), before);
  const denied = fixture(); denied.deny();
  assert.equal((await denied.save("Must not write", true)).status, "error"); assert.equal(denied.transactions(), 0);
});

test("saving text/visibility preserves disabled individual rules, including duplicate lines", async () => {
  const data = fixture();
  data.quiz.quiz_ablauf_elemente[0].konfiguration.rules = [
    { id: "a", text: "Alte Regel", enabled: false }, { id: "b", text: "Alte Regel", enabled: true },
  ];
  assert.equal((await data.save("Alte Regel\nAlte Regel\nNeue Regel", true)).status, "success");
  assert.deepEqual(Array.from(data.quiz.quiz_ablauf_elemente[0].konfiguration.rules.map(rule => rule.enabled)), [false, true, true]);
  assert.equal(data.quiz.intro_regeln, "Alte Regel\nNeue Regel");
});

test("PostgreSQL: real materialization, committed reload, rollback and READ ONLY enforcement", { skip: !process.env.EDITORIAL_IMPORT_TEST_DATABASE_URL }, async () => {
  assert.equal(process.env.CI, "true");
  const url = new URL(process.env.EDITORIAL_IMPORT_TEST_DATABASE_URL!);
  assert.equal(url.hostname, "127.0.0.1"); assert.equal(url.pathname, "/editorial_import_ci");
  const { PrismaClient, Prisma } = await import("@/app/generated/prisma/client");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString() }) });
  const marker = `rules-qa-${crypto.randomUUID()}`;
  let seriesId: number | undefined;
  let questionId: number | undefined;
  const teamIds: number[] = [];
  let fail = false;
  try {
    const series = await db.eventreihen.create({ data: { name: marker, slug: marker } }); seriesId = series.eventreihe_id;
    const quiz = await db.quiz.create({ data: { eventreihe_id: seriesId, titel: marker, intro_regeln: "Alte Regel" } });
    const block = await db.quiz_abschnitte.create({ data: { quiz_id: quiz.quiz_id, titel: marker, abschnitt_typ: "FRAGEN", sortierung: 1 } });
    const question = await db.fragen.create({ data: { frage: marker, schwierigkeitslevel: 33 } }); questionId = question.fragen_id;
    const assignment = await db.quiz_fragen.create({ data: { quiz_id: quiz.quiz_id, fragen_id: questionId, quiz_abschnitt_id: block.quiz_abschnitt_id, richtigeantworten: 2, falscheantworten: 1 } });
    for (const status of ["CORRECT", "CORRECT", "PARTIAL", "UNANSWERED", "REVIEW_REQUIRED"] as const) {
      const name = `${marker}-${teamIds.length}`;
      const team = await db.teams.create({ data: { teamname: name, teamname_normalisiert: name } }); teamIds.push(team.team_id);
      const session = await db.quiz_team_sessions.create({ data: { quiz_id: quiz.quiz_id, team_id: team.team_id, teamname: name } });
      await db.team_antworten.create({ data: { quiz_id: quiz.quiz_id, quiz_abschnitt_id: block.quiz_abschnitt_id, quiz_fragen_id: assignment.quiz_fragen_id, quiz_team_session_id: session.quiz_team_session_id, bewertungsstatus: status } });
    }
    const custom = await db.quiz_ablauf_elemente.create({ data: { quiz_id: quiz.quiz_id, typ: "RULES", anker_typ: "BEFORE_QUIZ", anker_schluessel: "QUIZ", sortierung: 999, konfiguration: { version: 1, rules: flow.rulesFromText("Individuell") }, ist_standard: false } });
    const guarded = new Proxy(db, { get(target, key) {
      if (key !== "$transaction") return Reflect.get(target, key);
      return (fn: (tx: unknown) => Promise<unknown>) => db.$transaction(tx => fn(new Proxy(tx, { get(inner, property) {
        if (property === "quiz_ablauf_elemente" && fail) return { ...tx.quiz_ablauf_elemente, update: () => { throw new Error("Simulated DB interruption"); } };
        return Reflect.get(inner, property);
      } })));
    } });
    const repository = load("./flow/quizFlowRepository.server.ts", { "server-only": {}, "@/app/generated/prisma/client": { Prisma: {} }, "@/app/lib/prisma": { prisma: guarded }, "./quizFlow": flow, "./quizBlockSequence": {}, "@/app/story-elemente/storyPlacement": {} });
    const actions = load("./[quizId]/slides/fixedSlideActions.ts", { "next/cache": { revalidatePath: () => {} }, "@/app/quiz/bookingSlide": booking, "@/lib/prisma": { prisma: guarded }, "@/app/quiz/quizAccess.server": { requireQuizEditor: async () => {}, requireQuizViewer: async () => {} }, "@/app/quiz/fixedSlidesPolicy": policy, "@/app/quiz/flow/quizFlowRepository.server": repository, "@/app/quiz/flow/quizFlow": flow });
    const save = (text: string) => { const data = new FormData(); data.set("quizId", String(quiz.quiz_id)); data.set("slideId", "rules"); data.set("regeln", text); data.set("enabled", "on"); return actions.saveIntroSlide({}, data) as Promise<{ status: string }>; };
    assert.equal((await save("Erste Speicherung")).status, "success");
    assert.equal((await save("Neue Regel\nZweite Zeile")).status, "success");
    const before = await db.quiz_ablauf_elemente.findMany({ where: { quiz_id: quiz.quiz_id }, orderBy: { quiz_ablauf_element_id: "asc" } });
    assert.deepEqual(before.find(row => row.ist_standard && row.typ === "RULES")!.konfiguration, { version: 1, title: "Die Regeln", rules: flow.rulesFromText("Neue Regel\nZweite Zeile") });
    assert.deepEqual(before.find(row => row.quiz_ablauf_element_id === custom.quiz_ablauf_element_id), custom);
    fail = true; assert.equal((await save("Rollback")).status, "error");
    assert.equal((await db.quiz.findUniqueOrThrow({ where: { quiz_id: quiz.quiz_id } })).intro_regeln, "Neue Regel\nZweite Zeile");
    assert.deepEqual(await db.quiz_ablauf_elemente.findMany({ where: { quiz_id: quiz.quiz_id }, orderBy: { quiz_ablauf_element_id: "asc" } }), before);
    await assert.rejects(db.$transaction(async tx => { await tx.$executeRaw`SET TRANSACTION READ ONLY`; await tx.quiz.update({ where: { quiz_id: quiz.quiz_id }, data: { titel: "Forbidden" } }); }), /read-only|read only/i);
    assert.equal((await db.quiz.findUniqueOrThrow({ where: { quiz_id: quiz.quiz_id } })).titel, marker);
    const auditModule = load("./evaluation/difficultyAudit.server.ts", { "server-only": {}, "@/app/generated/prisma/client": { Prisma }, "@/app/lib/prisma": { prisma: db }, "@/app/quiz/quizAccess.server": { requireQuizViewer: async () => {} }, "./difficultyAudit": difficultyAudit });
    const audit = await auditModule.readQuizDifficultyAudit(quiz.quiz_id) as { rows: ReturnType<typeof difficultyAudit.compareDifficultyRow>[] };
    assert.equal(audit.rows.length, 1);
    assert.equal(audit.rows[0].raw.sampleSize, 3); assert.equal(audit.rows[0].raw.difficulty, 33);
    assert.equal(audit.rows[0].partial, 1); assert.equal(audit.rows[0].unanswered, 1); assert.equal(audit.rows[0].review_required, 1);
    assert.equal(audit.rows[0].counterMismatch, false); assert.equal(audit.rows[0].difficultyMismatch, false);
    assert.deepEqual(Object.keys(audit.rows[0]).filter(key => /team|payload|antwort_text/.test(key)), []);
  } finally {
    if (seriesId) { await db.quiz.deleteMany({ where: { eventreihe_id: seriesId } }); await db.eventreihen.delete({ where: { eventreihe_id: seriesId } }); }
    if (questionId) await db.fragen.delete({ where: { fragen_id: questionId } });
    await db.teams.deleteMany({ where: { team_id: { in: teamIds } } });
    await db.$disconnect();
  }
});
