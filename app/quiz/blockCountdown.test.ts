import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { countdownRemainingSeconds, presentationCountdownDeadline } from "./blockCountdown";
import { isQuizInteractionWritable } from "./interaction/interactionStateMachine";
import { AnswerDraftController } from "./interaction/answerDraftController";

function functions(path: string, names: string[]) {
  const source = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true);
  return source.statements.filter(node => ts.isFunctionDeclaration(node) && names.includes(node.name?.text ?? "")).map(node => node.getText(source)).join("\n");
}
const interactionSource = functions("app/quiz/interaction/interaction.server.ts", ["expireQuizBlockDeadlines", "requireQuizAnswerWindow", "ensureQuizBlockDeadlines", "closeBlockInteractions", "closeRun", "saveTeamAnswerDraft"]);
const countdownSource = functions("app/quiz/[quizId]/praesentation/statusActions.ts", ["starteCountdown", "resetCountdown"]);
const origin = Date.parse("2026-10-21T18:00:00Z");
type Draft = { team_antwort_id: number; quiz_team_session_id: number; interaction_run_id: number; antwort_text: string; draft_revision: number; draft_updated_at: Date };
function fixture() {
  let clock = origin;
  const status = { quiz_id: 7, lifecycle_revision: 1, countdown_status: "idle", countdown_started_at: null as Date | null, countdown_dauer_sekunden: null as number | null, countdown_ended_at: null as Date | null };
  const block = { quiz_id: 7, quiz_block_freigabe_id: 1, quiz_abschnitt_id: 3, ist_freigegeben: true, ist_geschlossen: false, answer_deadline_at: null as Date | null, geschlossen_ab: null as Date | null };
  const run = { quiz_id: 7, interaction_run_id: 10, quiz_fragen_id: 1, interaction_type: "TEXT", state: "OPEN", is_current: true, deadline_at: null, closed_at: null, stopped_at: null, config_snapshot: {}, revision: 0 };
  const drafts = new Map<number, Draft>();
  const finals: Draft[] = [];
  let writes = 0;
  let transactions = 0;
  let chain = Promise.resolve();
  const matches = (where: { quiz_id?: number; ist_freigegeben?: boolean; ist_geschlossen?: boolean; answer_deadline_at?: Date | null | { lte: Date } | { not: null } }) =>
    (where.quiz_id === undefined || where.quiz_id === block.quiz_id) &&
    (where.ist_freigegeben === undefined || where.ist_freigegeben === block.ist_freigegeben) &&
    (where.ist_geschlossen === undefined || where.ist_geschlossen === block.ist_geschlossen) &&
    (where.answer_deadline_at === undefined || (where.answer_deadline_at === null ? block.answer_deadline_at === null :
      "lte" in where.answer_deadline_at ? Boolean(block.answer_deadline_at && block.answer_deadline_at <= where.answer_deadline_at.lte) :
        "not" in where.answer_deadline_at ? block.answer_deadline_at !== null : block.answer_deadline_at?.getTime() === where.answer_deadline_at.getTime()));
  const db = {
    $queryRaw: async () => [],
    quiz_praesentation_status: {
      findUnique: async () => ({ ...status }), findUniqueOrThrow: async () => ({ ...status }),
      update: async ({ data }: { data: Partial<typeof status> }) => ({ ...Object.assign(status, data) }),
    },
    quiz_block_freigaben: {
      findMany: async ({ where }: { where: Parameters<typeof matches>[0] }) => matches(where) ? [{ ...block }] : [],
      update: async ({ data }: { data: Partial<typeof block> }) => Object.assign(block, data),
      updateMany: async ({ where, data }: { where: Parameters<typeof matches>[0]; data: Partial<typeof block> }) => { if (matches(where)) Object.assign(block, data); },
    },
    quiz_interaction_runs: {
      findMany: async () => ["OPEN", "COUNTDOWN"].includes(run.state) ? [{ interaction_run_id: 10 }] : [],
      findUnique: async () => ({ ...run }),
      update: async ({ data }: { data: Partial<Omit<typeof run, "revision">> & { revision?: { increment: number } } }) => {
        const { revision, ...rest } = data; Object.assign(run, rest); run.revision += revision?.increment ?? 0; return { ...run };
      },
    },
    quiz_team_sessions: { findFirst: async () => ({}) },
    team_answer_submissions: { findFirst: async () => null },
    team_antworten: {
      findUnique: async ({ where }: { where: { quiz_fragen_id_quiz_team_session_id: { quiz_team_session_id: number } } }) => drafts.get(where.quiz_fragen_id_quiz_team_session_id.quiz_team_session_id) ?? null,
      upsert: async ({ create, update }: { create: Draft; update: Partial<Draft> }) => {
        writes++; const old = drafts.get(create.quiz_team_session_id); const next = old ? { ...old, ...update } : { ...create, team_antwort_id: create.quiz_team_session_id }; drafts.set(create.quiz_team_session_id, next); return next;
      },
    },
    team_antwort_auswahlen: { deleteMany: async () => {}, createMany: async () => {} },
    team_antwortfelder: { deleteMany: async () => {}, createMany: async () => {} },
  };
  type SaveResult = { success: boolean; reason?: string; draftRevision?: number };
  type SaveInput = { quizId: number; quizAbschnittId: number; quizFragenId: number; interactionRunId: number; quizTeamSessionId: number; expectedDraftRevision: number; draft: { answerText: string; selectedAnswerIds: number[]; structuredAnswers: never[] } };
  type StartInput = { quizId: number; dauerSekunden: number; lifecycleRevision: number };
  const exports = {} as {
    requireQuizAnswerWindow: (tx: typeof db, id: number) => Promise<typeof status>;
    expireQuizBlockDeadlines: (tx: typeof db, id: number, now: Date) => Promise<void>;
    ensureQuizBlockDeadlines: (id: number) => Promise<typeof status>;
    saveTeamAnswerDraft: (input: SaveInput) => Promise<SaveResult>;
    starteCountdown: (input: StartInput) => Promise<{ status: typeof status }>;
    resetCountdown: (input: { quizId: number; lifecycleRevision: number }) => Promise<{ status: typeof status }>;
  };
  const context = {
    exports, Date: class extends Date { constructor(value?: string | number) { super(value ?? clock); } static now() { return clock; } },
    prisma: { ...db, $transaction: <T>(fn: (tx: typeof db) => Promise<T>) => {
      transactions++;
      const result = chain.then(() => fn(db)); chain = result.then(() => {}, () => {}); return result;
    } },
    presentationCountdownDeadline, requireQuizLiveController: async () => {},
    assertLifecycleRevision: (actual: number, expected: number) => assert.equal(actual, expected),
    lockQuizLifecycle: async () => ({ ...status }), requireQuizRunning: async () => ({ ...status }),
    requireQuizNotStopped: (tx: typeof db, id: number) => exports.requireQuizAnswerWindow(tx, id),
    lockRun: async () => {}, settlePixelStages: async () => {},
    readLivePollRunSnapshot: () => null, isPixelInteractionRun: () => false,
    autoFinalizeDrafts: async () => { finals.push(...[...drafts.values()].map(d => ({ ...d }))); return drafts.size; },
    resolveInteractionClosePolicy: () => ({ evaluateAutoFinalizedDrafts: false }),
    assertQuizInteractionTransition: () => {}, isPollInteractionType: () => false,
    resolveInteractionAssignment: async () => ({ assignment: { quiz_abschnitt_id: 3, ergebnisdarstellung: "DEFAULT" }, interaction: { type: "TEXT" } }),
    expireDeadlineIfNecessary: async () => ({ ...run }), isQuizInteractionWritable,
    readPixelLiveConfigSnapshot: () => null, isRunReleasedForAnswerWrite: async () => block.ist_freigegeben && !block.ist_geschlossen,
    resolveInteractionSubmissionPolicy: () => ({ resubmissionAllowedWhileOpen: true }),
    validateInteractionPayload: () => ({ payload: {}, hasContent: true }),
    draftInputFromStored: (d: Draft) => ({ answerText: d.antwort_text, selectedAnswerIds: [], structuredAnswers: [] }),
    hasAnswerContentChanged: (a: { answerText: string }, b: { answerText: string }) => a.answerText !== b.answerText,
  };
  runInNewContext(ts.transpileModule(interactionSource + "\n" + countdownSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, context);
  return {
    block, status, run, drafts, finals, writes: () => writes, transactions: () => transactions, at: (offset: number) => { clock = origin + offset; },
    start: () => exports.starteCountdown({ quizId: 7, dauerSekunden: 60, lifecycleRevision: 1 }),
    reset: () => exports.resetCountdown({ quizId: 7, lifecycleRevision: 1 }),
    read: () => exports.ensureQuizBlockDeadlines(7),
    save: (team: number, text: string, revision = 0) => exports.saveTeamAnswerDraft({ quizId: 7, quizAbschnittId: 3, quizFragenId: 1, interactionRunId: 10, quizTeamSessionId: team, expectedDraftRevision: revision, draft: { answerText: text, selectedAnswerIds: [], structuredAnswers: [] } }),
  };
}

for (const offset of [59999, 60000, 60001]) test(`general block lazy read/save at deadline offset ${offset - 60000} ms`, async () => {
  const f = fixture(); await f.start(); f.at(offset);
  const result = await f.save(1, "Grenze");
  assert.equal(result.success, offset < 60000);
  assert.equal(f.writes(), offset < 60000 ? 1 : 0);
  assert.equal(f.block.ist_geschlossen, offset >= 60000);
  await f.read(); assert.equal(f.status.countdown_status, offset < 60000 ? "running" : "finished");
  if (offset >= 60000) { assert.equal((await f.save(1, "Retry")).success, false); assert.equal(f.writes(), 0); }
});

test("parallel polls before deadline do not reserve transactions; overdue reads still close", async () => {
  const f = fixture(); await f.start();
  const initial = f.transactions();
  f.at(59999); await Promise.all(Array.from({ length: 80 }, () => f.read()));
  assert.equal(f.transactions(), initial);
  assert.equal(f.block.ist_geschlossen, false);
  f.at(60000); await f.read();
  assert.equal(f.transactions(), initial + 1);
  assert.equal(f.block.ist_geschlossen, true);
  await Promise.all(Array.from({ length: 80 }, () => f.read()));
  assert.equal(f.transactions(), initial + 1);
});

test("no controller: reads after deadline finalize accepted drafts exactly once", async () => {
  const f = fixture(); await f.start(); await f.save(1, "rechtzeitig"); f.at(90000);
  await Promise.all([f.read(), f.read(), f.read()]);
  assert.equal(f.block.ist_geschlossen, true); assert.equal(f.finals.length, 1);
  assert.equal(f.block.geschlossen_ab?.getTime(), origin + 60000);
  assert.equal(f.finals[0].antwort_text, "rechtzeitig");
  assert.equal(f.status.countdown_ended_at?.getTime(), origin + 60000);
});

test("reload/start retry cannot extend deadline; navigation does not erase block deadline", async () => {
  const f = fixture(); await f.start(); f.at(20000); await f.read(); await f.start();
  assert.equal(f.block.answer_deadline_at?.getTime(), origin + 60000);
  Object.assign(f.status, { countdown_status: "idle", countdown_started_at: null });
  f.at(30000); await f.start();
  assert.equal(presentationCountdownDeadline(f.status)?.getTime(), origin + 60000);
  f.at(60000); assert.equal((await f.save(1, "spät")).success, false);
});

test("reset cancels only a running deadline, never reopens an expired block", async () => {
  const f = fixture(); await f.start(); f.at(20000); await f.reset();
  assert.equal(f.block.answer_deadline_at, null); await f.start();
  assert.equal(presentationCountdownDeadline(f.status)?.getTime(), origin + 80000);
  f.at(80000); await f.reset(); assert.equal(f.block.ist_geschlossen, true);
  assert.equal((await f.save(1, "spät")).success, false);
});

test("two writers and moderator/presentation reads serialize at the same boundary", async () => {
  const f = fixture(); await f.start(); f.at(59999); assert.equal((await f.save(1, "vorher")).success, true);
  f.at(60000); const results = await Promise.all([f.save(2, "danach"), f.read(), f.read(), f.save(1, "Retry", 1)]);
  assert.equal(results[0].success, false); assert.equal(results[3].success, false);
  assert.equal(f.writes(), 1); assert.deepEqual(f.finals.map(d => d.antwort_text), ["vorher"]);
});

test("AP9.1 lost response reconciles accepted content after deadline; blocked local content stays closed", async () => {
  const f = fixture(); await f.start();
  const value = (text: string) => ({ antwortText: text, antwortId: null, antwortfelder: {} });
  const c = new AnswerDraftController({ save: async (_q, _r, revision, v) => {
    await f.save(1, v.antwortText!, revision); throw Error("lost response");
  }, persist: () => {}, schedule: () => 0, cancel: () => {} });
  c.hydrate(1, 10, value(""), 0, true); c.edit(1, value("angenommen")); await c.flush(1);
  assert.equal(c.getSnapshot()[1].status, "error");
  f.at(60001); await f.read(); const saved = f.drafts.get(1)!;
  c.hydrate(1, 10, value(saved.antwort_text), saved.draft_revision, false);
  assert.equal(c.getSnapshot()[1].status, "saved");
  const other = new AnswerDraftController({ save: async () => { throw Error("offline"); }, persist: () => {}, schedule: () => 0, cancel: () => {} });
  other.hydrate(1, 10, value(""), 0, true); other.edit(1, value("nicht angekommen"));
  other.hydrate(1, 10, value(""), 0, false); assert.equal(other.getSnapshot()[1].status, "closed");
  assert.equal((await f.save(2, "nicht angekommen")).success, false); assert.equal(f.finals.length, 1);
});

test("countdown display uses server time and preserves zero after finished/reload", () => {
  const started = new Date(origin).toISOString();
  assert.equal(countdownRemainingSeconds(started, 60, "running", origin + 59999), 1);
  assert.equal(countdownRemainingSeconds(started, 60, "running", origin + 60000), 0);
  assert.equal(countdownRemainingSeconds(started, 60, "finished", origin), 0);
});

test("a request started before the boundary but acquiring the lock afterward is rejected", async () => {
  const f = fixture(); await f.start(); f.at(59999);
  const pending = f.save(1, "request initiated before deadline");
  f.at(60000); assert.equal((await pending).success, false); assert.equal(f.writes(), 0);
});

test("an accepted response delivered after close remains confirmed", async () => {
  const f = fixture(); await f.start(); f.at(59999);
  let release!: () => void;
  const responseGate = new Promise<void>(resolve => { release = resolve; });
  let accepted!: () => void;
  const acceptedGate = new Promise<void>(resolve => { accepted = resolve; });
  const value = { antwortText: "rechtzeitig", antwortId: null, antwortfelder: {} };
  const c = new AnswerDraftController({ save: async () => {
    const result = await f.save(1, "rechtzeitig"); accepted(); await responseGate;
    return result.success ? { success: true, draftRevision: result.draftRevision! } : { success: false, reason: "LIVE_STATE_CHANGED" };
  }, persist: () => {}, schedule: () => 0, cancel: () => {} });
  c.hydrate(1, 10, { ...value, antwortText: "" }, 0, true); c.edit(1, value);
  const pending = c.flush(1); await acceptedGate;
  f.at(60000); await f.read(); c.pauseMissing(new Set()); release(); await pending;
  assert.equal(c.getSnapshot()[1].status, "saved"); assert.equal(f.finals[0].antwort_text, "rechtzeitig");
});
