import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { participantRequest, boundedParticipantAction, ParticipantRequestError } from "./participantRequest";
import { createDraftJournal, readDraftJournal } from "./draftJournal";
import { AnswerDraftController } from "./answerDraftController";
import { isQuizInteractionWritable } from "./interactionStateMachine";

const value = (text: string) => ({ antwortText: text, antwortId: null, antwortfelder: {} });
test("transport bounds missing requests and lost responses, including a stalled response body", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => { throw new Error("offline"); };
    await assert.rejects(participantRequest("/join", {}), /offline/);
    globalThis.fetch = async (_url, init) => new Promise((_, reject) => init!.signal!.addEventListener("abort", () => reject(new Error("aborted"))));
    await assert.rejects(participantRequest("/join", {}, 10), /aborted/);
    globalThis.fetch = async (_url, init) => ({ ok: true, json: () => new Promise((_, reject) => init!.signal!.addEventListener("abort", () => reject(new Error("body aborted")))) }) as Response;
    await assert.rejects(participantRequest("/save", {}, 10), /body aborted/);
    globalThis.fetch = async () => new Response(null, { status: 401 });
    await assert.rejects(participantRequest("/snapshot", {}), (error: unknown) => error instanceof ParticipantRequestError && error.status === 401);
    await assert.rejects(boundedParticipantAction(new Promise(() => {}), 10), ParticipantRequestError);
  } finally { globalThis.fetch = original; }
});

test("reload protects the latest unconfirmed text; one tab never deletes another tab's recovery copy", () => {
  const map = new Map<string, string>();
  const storage: Storage = { get length() { return map.size; }, key: i => [...map.keys()][i] ?? null,
    getItem: k => map.get(k) ?? null, setItem: (k,v) => { map.set(k,v); }, removeItem: k => { map.delete(k); }, clear: () => map.clear() };
  const a = createDraftJournal("quiz:team", storage, "A");
  const c = new AnswerDraftController({ save: async () => { throw new Error("offline"); }, persist: entries => a.save(entries), schedule: () => 0, cancel: () => {} });
  c.hydrate(1, 10, value("Berlin"), 4, true);
  c.edit(1, value("Hamburg"));
  const b = createDraftJournal("quiz:team", storage, "B");
  assert.equal(b.load()[1].value.antwortText, "Hamburg");
  b.save({});
  assert.equal(a.load()[1].value.antwortText, "Hamburg");
  assert.deepEqual(createDraftJournal("quiz:other-team", storage, "C").load(), {});
  assert.deepEqual(readDraftJournal("broken"), {});
  assert.deepEqual(readDraftJournal(JSON.stringify({ version: 1, at: 0, entries: c.journal() })), {});
});

test("a recovered backup cannot resurrect after confirmation or a deliberate choice and another reload", () => {
  const memory = (): Storage => {
    const map = new Map<string,string>();
    return { get length() { return map.size; }, key: i => [...map.keys()][i] ?? null,
      getItem: k => map.get(k) ?? null, setItem: (k,v) => { map.set(k,v); }, removeItem: k => { map.delete(k); }, clear: () => map.clear() };
  };
  const storage = memory(), tab = memory();
  const old = createDraftJournal("quiz:team", storage, "old", tab);
  const c = new AnswerDraftController({ save: async () => ({ success: true, draftRevision: 5 }), persist: e => old.save(e), schedule: () => 0, cancel: () => {} });
  c.hydrate(1,10,value("Berlin"),4,true); c.edit(1,value("Hamburg"));
  const reload = createDraftJournal("quiz:team", storage, "reload", tab);
  const recovered = reload.load();
  reload.save({ ...recovered, 1: { ...recovered[1], status: "saved", serverValue: value("Hamburg"), value: value("Hamburg"), baseRevision: 5, serverRevision: 5 } });
  assert.deepEqual(createDraftJournal("quiz:team", storage, "again", tab).load(), {});
  c.edit(1,value("Bremen"));
  const choice = createDraftJournal("quiz:team", storage, "choice", tab);
  const pending = choice.load();
  choice.save({ 1: { ...pending[1], status: "saved", value: value("Leipzig"), serverValue: value("Leipzig") } });
  assert.deepEqual(createDraftJournal("quiz:team", storage, "after-choice", tab).load(), {});
  assert.equal(createDraftJournal("quiz:team", storage, "other-tab", memory()).load()[1].value.antwortText, "Bremen");
});

// Execute the real write function with an in-memory transaction. The clock is sampled
// after locks, as in production; request start time never extends the deadline.
for (const offset of [-10000, -1, 0, 1, 5000]) {
  test(`server save and retry at deadline ${offset}ms preserve authority`, async () => {
    const deadline = new Date("2026-10-21T18:00:00Z");
    const now = new Date(deadline.getTime() + offset);
    const run = { interaction_run_id: 10, quiz_id: 7, quiz_fragen_id: 1, state: "COUNTDOWN", deadline_at: deadline, interaction_type: "FREE_TEXT", config_snapshot: {}, stopped_by_team_session_id: null };
    let writes = 0;
    const tx = {
      quiz_interaction_runs: { findUnique: async () => run },
      quiz_team_sessions: { findFirst: async () => ({}) },
      team_answer_submissions: { findFirst: async () => null },
      team_antworten: { findUnique: async () => null, upsert: async () => { writes++; return { team_antwort_id: 5 }; } },
      team_antwort_auswahlen: { deleteMany: async () => {}, createMany: async () => {} },
      team_antwortfelder: { deleteMany: async () => {}, createMany: async () => {} },
      $queryRaw: async () => [],
    };
    const source = readFileSync("app/quiz/interaction/interaction.server.ts", "utf8");
    const body = source.slice(source.indexOf("export async function saveTeamAnswerDraft("), source.indexOf("export async function submitTeamAnswer("));
    const exports: { saveTeamAnswerDraft?: (input: unknown) => Promise<{ success: boolean; reason?: string }> } = {};
    runInNewContext(ts.transpileModule(body, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
      exports, Date: class extends Date { constructor() { super(now); } },
      prisma: { $transaction: (fn: (t: typeof tx) => unknown) => fn(tx) },
      requireQuizNotStopped: async () => {},
      resolveInteractionAssignment: async () => ({ assignment: { quiz_abschnitt_id: 3, ergebnisdarstellung: "DEFAULT" }, interaction: {} }),
      lockRun: async () => {}, expireDeadlineIfNecessary: async () => run,
      isQuizInteractionWritable, readPixelLiveConfigSnapshot: () => null,
      isRunReleasedForAnswerWrite: async () => true,
      resolveInteractionSubmissionPolicy: () => ({ resubmissionAllowedWhileOpen: true }),
      validateInteractionPayload: () => ({}),
    });
    const input = { quizId: 7, quizFragenId: 1, quizAbschnittId: 3, interactionRunId: 10, quizTeamSessionId: 9, expectedDraftRevision: 0,
      draft: { answerText: "Hamburg", selectedAnswerIds: [], structuredAnswers: [] } };
    const result = await exports.saveTeamAnswerDraft!(input);
    assert.equal(result.success, offset < 0);
    assert.equal(writes, offset < 0 ? 1 : 0);
    if (offset >= 0) {
      assert.equal(result.reason, "LIVE_STATE_CHANGED");
      assert.equal((await exports.saveTeamAnswerDraft!(input)).success, false);
      assert.equal(writes, 0);
    }
  });
}
