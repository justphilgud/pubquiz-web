import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { assertLifecycleRevision, resolveQuizLifecycle } from "./quizLifecycle";
import { resolvePresentationLiveState, resolvePresentationOpeningState, resolvePresentationSequenceIndex } from "../rendering/presentation/presentationLiveState";
import { isQuizAnswerRunReleasedForWrite, selectQuizAnswerAssignments, selectReleasedQuizAnswerAssignmentIds } from "./quizAnswerLiveState";
import { RESET_PRESENTATION_DATA, lockQuizLifecycle } from "./quizLifecycle.server";
import type { Prisma } from "../generated/prisma/client";

const read = (path: string) => readFileSync(path, "utf8");
const actions = read("app/quiz/[quizId]/praesentation/statusActions.ts");
const interactions = read("app/quiz/interaction/interaction.server.ts");
const section = (source: string, from: string, to: string) => source.slice(source.indexOf(from), source.indexOf(to));

test("A: preparation surfaces and team registration have no start side effect", () => {
  assert.equal(resolveQuizLifecycle(null), "PREPARATION");
  assert.equal(resolveQuizLifecycle({}), "PREPARATION");
  const opening = section(actions, "export async function getOrCreate", "export async function getPraesentationStatus");
  assert.doesNotMatch(opening, /syncInteractionForPresentation|quiz_started_at/);
  for (const path of ["moderation/page.tsx", "praesentation/page.tsx", "praesentation/QuizPraesentationPlayer.tsx"]) {
    assert.doesNotMatch(read(`app/quiz/[quizId]/${path}`), /starteQuiz\(/);
  }
  const joining = section(read("app/quiz/actions.ts"), "export async function startQuizTeamSession", "export async function freigabeQuizBlock");
  assert.doesNotMatch(joining, /quiz_started_at|starteQuiz\(/);
  assert.match(read("app/teams/teamSession.server.ts"), /requireQuizNotStopped\(transaction, input.quizId\)/);
});

test("B: explicit start is persistent and idempotent; stale reset generations are rejected", () => {
  const start = section(actions, "export async function starteQuiz", "export async function stoppeQuiz");
  assert.match(start, /requireQuizLiveController/);
  assert.match(start, /prisma\.\$transaction/);
  assert.match(start, /=== "RUNNING"\) return status/);
  assert.match(start, /quiz_started_at: new Date\(\)/);
  assert.equal(resolveQuizLifecycle({ quiz_started_at: "2026-09-07T18:00:00Z" }), "RUNNING");
  assert.doesNotThrow(() => assertLifecycleRevision(2, 2));
  assert.throws(() => assertLifecycleRevision(3, 2));
  assert.throws(() => assertLifecycleRevision(3, NaN));
});

test("C: presentation requires local activation for each start/reset and keeps media fallback", () => {
  const player = read("app/quiz/[quizId]/praesentation/QuizPraesentationPlayer.tsx");
  assert.match(player, /useState<string \| null>\(null\)/);
  assert.match(player, /liveState\.lifecycleRevision.*liveState\.quizStartedAt/);
  assert.match(player, /playbackCommand: activated \? liveState.playbackCommand : null/);
  assert.match(player, /media\.play\(\)/);
  assert.match(read("app/rendering/presentation/PresentationSlideRenderer.tsx"), /Medienwiedergabe einmalig aktivieren/);
});

test("D/H: reset removes only quiz-scoped runtime data atomically and restores preparation", () => {
  const reset = section(actions, "export async function resetQuizDurchlauf", "export async function setQuizQuestionHidden");
  assert.match(reset, /confirmed !== true/);
  assert.match(reset, /assertLifecycleRevision/);
  assert.match(reset, /prisma\.\$transaction/);
  for (const table of ["quiz_team_sessions", "quiz_interaction_runs", "quiz_block_freigaben", "quiz_teams"]) {
    assert.ok(reset.includes(`tx.${table}.deleteMany({ where: { quiz_id: quizId } })`));
  }
  assert.doesNotMatch(reset, /tx\.(teams|fragen|quiz_fragen)\.delete/);
  assert.match(reset, /lifecycle_revision: \{ increment: 1 \}/);
  assert.equal(resolveQuizLifecycle(RESET_PRESENTATION_DATA), "PREPARATION");
  assert.equal(resolvePresentationLiveState(RESET_PRESENTATION_DATA).slideIndex, 0);
  assert.equal(RESET_PRESENTATION_DATA.countdown_started_at, null);
  assert.equal(RESET_PRESENTATION_DATA.slide_key, null);
});

test("E: returning from question 7 to question 6 hides 7 and rejects delayed saves", () => {
  const opened = new Date("2026-09-07T18:00:00Z");
  const runs = [
    { quiz_fragen_id: 6, opened_at: opened, is_current: true, is_hidden: false },
    { quiz_fragen_id: 7, opened_at: opened, is_current: false, is_hidden: true },
  ];
  assert.deepEqual(selectReleasedQuizAnswerAssignmentIds([6, 7], runs, opened), [6]);
  assert.equal(isQuizAnswerRunReleasedForWrite({
    run: { isCurrent: true, isPixel: false, openedAt: opened, isHidden: true },
    assignmentSectionId: 1, requestedSectionId: 1,
    release: { isReleased: true, isClosed: false, releasedAt: opened },
  }), false);
  const navigation = section(actions, "export async function setPraesentationSlideIndex", "async function getAntwortStatusData");
  assert.match(navigation, /slideIndex < previousStatus.slide_index/);
  assert.match(navigation, /is_hidden: true/);
  assert.doesNotMatch(navigation, /deleteMany|team_antworten\.update|team_answer_submissions\.update/);
});

test("F: hidden current question never leaks through fallback; re-entry keeps finalized run", () => {
  assert.deepEqual(selectQuizAnswerAssignments({
    kind: "QUESTION", phase: "QUESTION", slideKey: "question:7:question",
    questionAssignmentId: 7, questionId: 7, sectionId: 1,
  }, [{ quiz_fragen_id: 7 }], []), []);
  const visibility = section(actions, "export async function setQuizQuestionHidden", "export async function speicherePraesentationsdauer");
  assert.doesNotMatch(visibility, /delete|team_antworten|team_answer_submissions|state: "OPEN"/);
  const sync = section(interactions, "export async function syncInteractionForPresentation", "export async function closeCurrentInteraction");
  assert.match(read("app/quiz/interaction/interactionRunReuse.ts"), /input.state === "CLOSED" \|\| input.state === "REVEALED"/);
  assert.match(sync, /where: \{ interaction_run_id: previousRun.interaction_run_id \}/);
  assert.doesNotMatch(sync, /deleteMany|team_answer_submissions\.update/);
});

test("G: preparation opens/reloads at one; running and stopped retain stable slide identity", () => {
  for (const lifecycle of ["PREPARATION", "RUNNING", "STOPPED"] as const) {
    const stored = resolvePresentationLiveState({
      slide_index: 7, slide_key: "question:8:question",
      quiz_started_at: lifecycle === "PREPARATION" ? null : "2026-09-07T18:00:00Z",
      quiz_stopped_at: lifecycle === "STOPPED" ? "2026-09-07T20:00:00Z" : null,
    });
    const open = resolvePresentationOpeningState(stored);
    assert.equal(open.slideIndex, lifecycle === "PREPARATION" ? 0 : 7);
    assert.deepEqual(resolvePresentationOpeningState(stored), open);
    if (lifecycle !== "PREPARATION") {
      assert.equal(resolvePresentationSequenceIndex(open, ["intro", "question:8:question"]).index, 1);
    }
  }
});

test("stop persists the terminal state and retains existing close/finalization semantics", () => {
  const stop = section(actions, "export async function stoppeQuiz", "export async function resetQuizDurchlauf");
  assert.match(stop, /closeBlockInteractions/);
  assert.match(stop, /quiz_stopped_at: new Date\(\)/);
  assert.doesNotMatch(stop, /deleteMany/);
  assert.equal(resolveQuizLifecycle({ quiz_stopped_at: "2026-09-07" }), "STOPPED");
});

test("quiz lock precedes status creation, including first-open races", async () => {
  const calls: string[] = [];
  const expected = { quiz_id: 10, lifecycle_revision: 0 };
  const db = {
    $queryRaw: async () => { calls.push("lock"); return [{ quiz_id: 10 }]; },
    quiz_praesentation_status: { upsert: async () => { calls.push("status"); return expected; } },
  } as unknown as Prisma.TransactionClient;
  assert.equal(await lockQuizLifecycle(db, 10), expected);
  assert.deepEqual(calls, ["lock", "status"]);
});

test("Preview integration retains global identities and content-poll responses on navigation", () => {
  const teamService = read("app/teams/teamSession.server.ts");
  assert.match(teamService, /requireQuizNotStopped/);
  assert.match(teamService, /quiz_id_team_id/);
  const pollSync = section(interactions, "async function syncLivePollForPresentation", "export async function closeCurrentInteraction");
  assert.match(pollSync, /quiz_ablauf_element_id: input.placementId/);
  assert.match(pollSync, /if \(previousRun\) return db.quiz_interaction_runs.update/);
  assert.doesNotMatch(pollSync, /deleteMany|live_poll_responses/);
  const pollWrites = read("app/umfragen/livePollRuntime.server.ts");
  assert.match(pollWrites, /requireQuizNotStopped\(tx, input.quizId\)/);
  assert.match(pollWrites, /run.is_hidden/);
});
