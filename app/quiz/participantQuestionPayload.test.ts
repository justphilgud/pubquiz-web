import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";
import { canPublishParticipantMedium, projectParticipantQuestionContent } from "./participantQuestionProjection";
import { selectQuizAnswerAssignments, selectReleasedQuizAnswerAssignmentIds } from "./quizAnswerLiveState";
import { resolveQuizAnswerInteraction } from "./answerInteraction";
import { resolveParticipantInteractionFromSnapshot } from "./interaction/interactionStoredAnswer";

type Payload = { liveRevision: string; answerPhase: string; fragen: Array<{
  fragen_id: number; templateConfig?: { templateData?: Record<string, unknown> } | null;
  resolution?: { answers: string[] } | null; gespeicherteAntwort: { antwortText: string } | null;
  interaction: Record<string, unknown>;
}> };
function execute(name: string, file: string, bindings: Record<string, unknown>) {
  const source = readFileSync(file, "utf8");
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const declaration = ast.statements.find(statement => ts.isFunctionDeclaration(statement) && statement.name?.text === name);
  assert.ok(declaration);
  const exports: Record<string, (...args: unknown[]) => Promise<unknown>> = {};
  const code = ts.transpileModule(declaration.getText(ast), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  vm.runInNewContext(code, { exports, Request, Response, Buffer, performance, ...bindings });
  return exports[name];
}
async function status(response: "YEAR" | "COUNTRY" | "TEXT" | "TRUE_FALSE", state: string, overrides: {
  hidden?: boolean; reset?: boolean; ownAnswer?: string; validSession?: boolean;
} = {}) {
  const now = new Date("2026-10-05T08:00:00Z");
  const assignment = { quiz_fragen_id: 1, fragen_id: 10, quiz_abschnitt_id: 20,
    sortierung: 1, antwort_reihenfolge: [], freie_antwort_erlaubt: false, punkte_modus: "standard" };
  const future = { ...assignment, quiz_fragen_id: 2, fragen_id: 11, sortierung: 2 };
  const run = { interaction_run_id: 100, quiz_fragen_id: 1, is_current: !overrides.reset,
    is_hidden: overrides.hidden ?? false, state, interaction_type: "TEXT", opened_at: now,
    revision: 1, deadline_at: null, config_snapshot: null, quiz_ablauf_element_id: null };
  const release = { quiz_abschnitt_id: 20, quiz_block_freigabe_id: 1, ist_freigegeben: true,
    ist_geschlossen: false, freigegeben_ab: overrides.reset ? new Date(now.getTime() + 1000) : now };
  const quiz = { quiz_id: 7, titel: "Isolated fixture", ist_archiviert: false,
    aufloesungsstrategie: "AFTER_EACH_QUESTION", quiz_abschnitte: [{ quiz_abschnitt_id: 20,
      titel: "Block", abschnitt_typ: "FRAGEN", quiz_block_freigaben: [release] }],
    quiz_fragen: [assignment, future], praesentation_status: { updated_at: now } };
  const templateId = response === "YEAR" ? "fakten_jahr" : response === "COUNTRY" ? "fakten_land"
    : response === "TRUE_FALSE" ? "wahr_falsch" : "fakten_frei";
  const details = { ...assignment, fragen: { fragen_id: 10, frage: "Public question",
    template_config_json: { templateData: response === "TRUE_FALSE"
      ? { kind: "TRUE_FALSE", correctAnswer: true, explanation: "private-explanation" }
      : { kind: "FACTS", response, solution: "private-solution", acceptedVariants: ["private-alias"],
          facts: [{ id: "1", text: "Public clue" }], options: [], nestedFutureSolution: "private-future" } },
    vorlage: { code: templateId }, antworten: [
      { antwort_id: 1, antwort: "Wahr", ist_richtig: true, antworttyp: { antworttyp: "Auswahl" } },
      { antwort_id: 2, antwort: "Falsch", ist_richtig: false, antworttyp: { antworttyp: "Auswahl" } },
    ], medien: [], antwortfelder: [] } };
  const own = overrides.ownAnswer === undefined ? [] : [{ quiz_fragen_id: 1,
    interaction_run_id: 100, antwort_id: null, antwort_text: overrides.ownAnswer,
    antwortauswahlen: [], antwortfelder: [], submissions: [{ interaction_run_id: 100,
      status: "AUTO_FINALIZED", draft_revision: 1, submission_version: 1 }], draft_revision: 1,
    draft_updated_at: now, aktualisiert_am: now }];
  const fn = execute("getQuizAntwortStatus", process.env.PARTICIPANT_ACTIONS_SOURCE ?? "app/quiz/actions.ts", {
    canPublishParticipantMedium, projectParticipantQuestionContent,
    resolveParticipantSession: async () => overrides.validSession === false ? null : { quiz_team_session_id: 9, team: {} },
    resolveQuizLifecycle: () => "RUNNING",
    ensureQuizBlockDeadlines: async () => {}, repairQuizSpecificOrderingAssignments: async () => {},
    loadStoredQuizFlowItems: async () => [], toStoredQuizFlowItem: (x: unknown) => x,
    parseStoredQuizFlowItem: (x: unknown) => x, isQuestionSection: () => true,
    sortQuizQuestionAssignments: (x: unknown) => x,
    resolvePresentationLiveState: () => ({ lifecycle: "RUNNING", slideKey: "question:1" }),
    resolvePresentationAudienceState: () => ({ kind: "QUESTION", phase: "QUESTION",
      questionAssignmentId: 1, questionId: 10, sectionId: 20 }),
    selectReleasedQuizAnswerAssignmentIds, selectQuizAnswerAssignments,
    resolveQuizBlockSequence: () => ({ entries: [{ kind: "QUESTION", question: assignment }] }),
    buildParticipantAnswerSequence: () => [{ kind: "QUESTION", questionAssignmentId: 1 }],
    readLivePollRunSnapshot: () => null,
    resolveQuizQuestionAnswerMode: () => ({ originalMode: response === "TRUE_FALSE" ? "CLOSED" : "OPEN",
      effectiveMode: response === "TRUE_FALSE" ? "CLOSED" : "OPEN" }),
    resolveQuizAnswerInteraction, resolveParticipantInteractionFromSnapshot,
    selectParticipantQuestionMedia: () => [], serializeQuizParticipantLiveRevision: () => "revision",
    mapTeamProfile: () => null,
    prisma: { quiz: { findUnique: async () => quiz, findFirst: async () => ({ quiz_id: 7, titel: "Public", praesentation_status: {} }) },
      quiz_interaction_runs: { findMany: async () => [run] },
      quiz_fragen: { findMany: async (query: { where: { quiz_fragen_id: { in: number[] } } }) =>
        query.where.quiz_fragen_id.in.includes(1) ? [details] : [] },
      team_antworten: { findMany: async (query: { where: { quiz_team_session_id: number } }) => {
        assert.equal(query.where.quiz_team_session_id, 9); return own;
      } } },
  });
  return await fn(7, "test-session") as Payload;
}
for (const response of ["YEAR", "COUNTRY", "TEXT", "TRUE_FALSE"] as const) {
  for (const state of ["OPEN", "COUNTDOWN", "CLOSED", "LOCKED"]) {
    test(`actual server status/HTTP: ${response} ${state} has no secret or future question`, async () => {
      const payload = await status(response, state, { ownAnswer: "private-solution" });
      assert.equal(payload.fragen.length, 1);
      assert.equal(payload.fragen[0].resolution ?? null, null);
      const editorial = { ...payload.fragen[0], gespeicherteAntwort: null };
      assert.doesNotMatch(JSON.stringify(editorial), /private-solution|private-alias|private-explanation|nestedFutureSolution/);
      assert.equal(payload.fragen[0].gespeicherteAntwort?.antwortText, "private-solution");
      for (const light of [false, true]) {
        const route = execute("POST", "app/api/quiz/team-live-snapshot/route.ts", {
          getQuizAntwortStatus: async () => payload,
          resolveParticipantSession: async () => ({ quiz_team_session_id: 9 }),
          getQuizLiveSnapshotData: async () => ({ liveRevision: "changed", activeQuestionReference: { quizFragenId: 1 } }),
          withPrismaQueryDiagnostics: async (fn: () => Promise<unknown>) => ({ result: await fn(), diagnostics: null }),
          logLivePerformance: () => {},
        });
        const res = await route(new Request("https://example.invalid/api/quiz/team-live-snapshot", {
          method: "POST", body: JSON.stringify({ quizId: 7, quizTeamSessionToken: "test-session",
            includeAnswerStatus: !light, knownLiveRevision: "old", role: "ADMIN", includeLiveModeration: true }),
        })) as Response;
        assert.equal(res.status, 200);
        assert.equal(res.headers.get("cache-control"), "no-store");
        const json = await res.json(); const returned = light ? json.answerStatus : json;
        assert.equal(returned.fragen[0].resolution ?? null, null);
        assert.equal(returned.fragen[0].gespeicherteAntwort.antwortText, "private-solution");
        assert.equal(returned.fragen.length, 1);
      }
    });
  }
  test(`actual server: ${response} REVEALED only releases current scoped canonical answer`, async () => {
    const payload = await status(response, "REVEALED");
    assert.equal(payload.fragen.length, 1);
    assert.deepEqual(JSON.parse(JSON.stringify(payload.fragen[0].resolution?.answers)),
      [response === "TRUE_FALSE" ? "Wahr" : "private-solution"]);
    assert.doesNotMatch(JSON.stringify(payload), /private-alias|private-future|private-explanation/);
  });
}
test("actual server reset/reconnect and hidden runs cannot replay prior revealed payload", async () => {
  for (const overrides of [{ reset: true }, { hidden: true }]) {
    const payload = await status("TEXT", "REVEALED", overrides);
    assert.equal(payload.fragen.length, 0);
  }
  const reload = await status("TEXT", "OPEN");
  assert.equal(reload.fragen[0].resolution, null);
});
test("initial/RSC call with no valid participant session has no questions or solutions", async () => {
  assert.equal((await status("TEXT", "REVEALED", { validSession: false })).fragen.length, 0);
});
test("direct Server Action cannot request presentation scope without quiz authorization", async () => {
  let reads = 0;
  const fn = execute("getQuizLiveSnapshot", "app/quiz/actions.ts", {
    resolveParticipantSession: async () => ({ quiz_team_session_id: 9 }),
    requireQuizViewer: async () => { throw new Error("FORBIDDEN"); },
    getQuizLiveSnapshotData: async () => { reads++; return { participant: true }; },
  });
  await assert.rejects(fn(7, "normal-team-token", true, true, 999), /FORBIDDEN/);
  assert.equal(reads, 0);
  await fn(7, "normal-team-token");
  assert.equal(reads, 1);
});
test("moderator HTTP transport rejects a normal participant before reading data", async () => {
  let reads = 0;
  const fn = execute("POST", "app/api/quiz/live-snapshot/route.ts", {
    auth: async () => null,
    getQuizLiveSnapshotData: async () => { reads++; },
    withPrismaQueryDiagnostics: async (f: () => Promise<unknown>) => ({ result: await f(), diagnostics: null }),
    logLivePerformance: () => {},
  });
  const res = await fn(new Request("https://example.invalid/api/quiz/live-snapshot", {
    method: "POST", body: JSON.stringify({ quizId: 7, role: "ADMIN", includeLiveModeration: true }),
  })) as Response;
  assert.equal(res.status, 401); assert.equal(reads, 0);
});
