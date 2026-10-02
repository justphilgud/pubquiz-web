import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { validateLivePollInput } from "./livePoll";
import { aggregateLivePollState, getLivePollPollingDelay } from "./livePollRuntime";
import ParticipantLivePollCard, {
  type ParticipantLivePoll,
} from "../quiz/[quizId]/antworten/ParticipantLivePollCard";

const base = {
  type: "SINGLE_CHOICE",
  prompt: "Was interessiert euch?",
  publicationMode: "AUTOMATIC",
  options: [{ id: "a", label: "KI" }, { id: "b", label: "Datenschutz" }],
  status: "ACTIVE",
  scope: "EVENT_SERIES",
  eventSeriesId: 7,
};

test("live polls validate independently from quiz answers", () => {
  const result = validateLivePollInput(base);
  assert.equal(result.ok, true);
  assert.equal(validateLivePollInput({ ...base, options: [{ id: "a", label: "Nur eine" }] }).ok, false);
  assert.equal(validateLivePollInput({ ...base, type: "FREE_TEXT", options: [] }).ok, true);
});

test("latest effective selection aggregates without team identity", () => {
  const result = aggregateLivePollState({
    revision: "1:3",
    runId: 1,
    state: "OPEN",
    config: { version: 1, pollId: 2, pollRevisionId: 3, type: "SINGLE_CHOICE", prompt: "Thema?", publicationMode: "AUTOMATIC", options: base.options },
    includeModeration: false,
    responses: [
      { id: 1, teamId: 10, teamName: "A", avatarCode: "toaster", photoUrl: null, selectedOptionId: "b", originalText: null, publicText: null, isVisible: false, updatedAt: "2026-08-28T08:00:00.000Z" },
      { id: 2, teamId: 11, teamName: "B", avatarCode: "toaster", photoUrl: null, selectedOptionId: "b", originalText: null, publicText: null, isVisible: false, updatedAt: "2026-08-28T08:00:01.000Z" },
    ],
  });
  assert.deepEqual(result.audience.options.map(({ id, count }) => ({ id, count })), [{ id: "a", count: 0 }, { id: "b", count: 2 }]);
  assert.equal("teamName" in result.audience, false);
  assert.equal(result.moderationResponses, undefined);
});

test("free text publishes only sanitized visible projections and caps the wall", () => {
  const responses = Array.from({ length: 25 }, (_, index) => ({
    id: index + 1,
    teamId: index + 1,
    teamName: `Team ${index + 1}`,
    avatarCode: "toaster" as const,
    photoUrl: null,
    selectedOptionId: null,
    originalText: index === 24 ? "P3nis" : `Original ${index + 1}`,
    publicText: index === 24 ? "Sonnenblume" : `Öffentlich ${index + 1}`,
    isVisible: true,
    updatedAt: new Date(Date.UTC(2026, 7, 28, 8, 0, index)).toISOString(),
  }));
  const result = aggregateLivePollState({
    revision: "1:25",
    runId: 1,
    state: "OPEN",
    config: { version: 1, pollId: 2, pollRevisionId: 3, type: "FREE_TEXT", prompt: "Wunsch?", publicationMode: "AUTOMATIC", options: [] },
    responses,
    includeModeration: true,
  });
  assert.equal(result.audience.publicResponses.length, 20);
  assert.equal(result.audience.publicResponses.at(-1)?.publicText, "Sonnenblume");
  assert.equal(JSON.stringify(result.audience).includes("P3nis"), false);
  assert.equal(result.moderationResponses?.at(-1)?.originalText, "P3nis");
});

test("polling is hidden-tab aware and backs off", () => {
  assert.equal(getLivePollPollingDelay({ hidden: false, consecutiveFailures: 0 }), 1_200);
  assert.equal(getLivePollPollingDelay({ hidden: true, consecutiveFailures: 0 }), 5_000);
  assert.equal(getLivePollPollingDelay({ hidden: false, consecutiveFailures: 4 }), 15_000);
});

const openTextPoll: ParticipantLivePoll = {
  runId: 41,
  state: "OPEN",
  type: "FREE_TEXT",
  prompt: "Was soll verbessert werden?",
  options: [],
  response: null,
};

function renderPoll(input: {
  poll?: ParticipantLivePoll;
  active: boolean;
  saving?: boolean;
  text?: string;
}) {
  return renderToStaticMarkup(createElement(ParticipantLivePollCard, {
    poll: input.poll ?? openTextPoll,
    position: 2,
    active: input.active,
    response: input.poll?.response ?? null,
    text: input.text ?? "",
    saving: input.saving ?? false,
    onTextChange: () => undefined,
    onSave: () => undefined,
  }));
}

test("the active open free-text poll renders an editable textarea", () => {
  const html = renderPoll({ active: true, text: "Mein Entwurf" });
  assert.match(html, /<textarea[^>]*>Mein Entwurf<\/textarea>/);
  assert.doesNotMatch(html, /<textarea[^>]*\sdisabled=/);
  assert.match(html, /Antwort offen/);
});

test("a closed free-text poll keeps the own response visible and locked", () => {
  const poll: ParticipantLivePoll = {
    ...openTextPoll,
    state: "CLOSED",
    response: { selectedOptionId: null, text: "Letzter gültiger Beitrag" },
  };
  const html = renderPoll({ poll, active: true });
  assert.match(html, /<textarea[^>]*disabled[^>]*>Letzter gültiger Beitrag<\/textarea>/);
  assert.match(html, /Die Livefrage ist geschlossen/);
});

test("live-poll writes stay bound to the displayed open run", async () => {
  const source = readFileSync("app/umfragen/livePollRuntime.server.ts", "utf8");
  const body = source.slice(
    source.indexOf("function normalizeFreeText"),
    source.indexOf("export async function setLivePollResponseVisibility"),
  );
  const exported = {} as {
    saveLivePollResponse: (input: {
      quizId: number;
      quizTeamSessionId: number;
      interactionRunId: number;
      text?: string;
    }) => Promise<{ success: boolean; reason?: string }>;
  };
  let currentRunId = 41;
  let state = "OPEN";
  let writes = 0;
  const config = {
    pollRevisionId: 7,
    type: "FREE_TEXT",
    publicationMode: "MODERATED",
    options: [],
  };
  const transaction = async (callback: (tx: unknown) => unknown) => callback({
    $queryRaw: async () => [{ interaction_run_id: currentRunId }],
    quiz_interaction_runs: {
      findUnique: async () => ({
        interaction_run_id: currentRunId,
        state,
        is_hidden: false,
        config_snapshot: {},
      }),
      update: async () => ({}),
    },
    quiz_team_sessions: {
      findFirst: async () => ({ quiz_team_session_id: 9 }),
    },
    public_text_replacement_rules: { findMany: async () => [] },
    live_poll_responses: {
      upsert: async () => {
        writes += 1;
        return { live_poll_response_id: 12, revision: writes };
      },
    },
  });
  runInNewContext(
    ts.transpileModule(body, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    {
      exports: exported,
      prisma: { $transaction: transaction },
      requireQuizNotStopped: async () => undefined,
      readLivePollRunSnapshot: () => config,
      sanitizePublicLiveText: (text: string) => ({ publicText: text }),
    },
  );

  assert.equal((await exported.saveLivePollResponse({
    quizId: 3,
    quizTeamSessionId: 9,
    interactionRunId: 41,
    text: "Erster Entwurf",
  })).success, true);
  assert.equal((await exported.saveLivePollResponse({
    quizId: 3,
    quizTeamSessionId: 9,
    interactionRunId: 41,
    text: "Geänderter Entwurf",
  })).success, true);
  assert.equal(writes, 2, "updates remain possible while the same run is open");

  currentRunId = 42;
  const stale = await exported.saveLivePollResponse({
    quizId: 3,
    quizTeamSessionId: 9,
    interactionRunId: 41,
    text: "Verspäteter Entwurf",
  });
  assert.deepEqual(
    { success: stale.success, reason: stale.reason },
    { success: false, reason: "LIVE_STATE_CHANGED" },
  );
  assert.equal(writes, 2, "a stale client cannot write into the next poll");

  currentRunId = 41;
  state = "CLOSED";
  const closed = await exported.saveLivePollResponse({
    quizId: 3,
    quizTeamSessionId: 9,
    interactionRunId: 41,
    text: "Zu spät",
  });
  assert.deepEqual(
    { success: closed.success, reason: closed.reason },
    { success: false, reason: "LIVE_STATE_CHANGED" },
  );
  assert.equal(writes, 2, "closing keeps the last accepted response unchanged");
});

test("block close includes content polls from the same section", () => {
  const source = readFileSync("app/quiz/interaction/interaction.server.ts", "utf8");
  const close = source.slice(
    source.indexOf("export async function closeBlockInteractions"),
    source.indexOf("export async function startInteractionCountdown"),
  );
  assert.match(close, /quiz_fragen:\s*\{ quiz_abschnitt_id: quizAbschnittId \}/);
  assert.match(
    close,
    /quiz_ablauf_elemente:\s*\{[\s\S]*quiz_abschnitt_id: quizAbschnittId,[\s\S]*typ: "LIVE_POLL"/,
  );
  assert.match(close, /await closeRun\(db, run\.interaction_run_id/);
});
