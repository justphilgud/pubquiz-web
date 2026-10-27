import assert from "node:assert/strict";
import test from "node:test";
import { activeElapsedMs, addRound, assertSingleActiveRun, closeRound, createRun, drawNumber, endRun, openRound, pauseRun, resumeRun, startRun } from "./run";

const game = "22000000-0000-4000-8000-000000000001";
const prepared = () => addRound(createRun("run", game, 0), "r1");
const running = () => startRun(prepared(), "r1", 100, []);

test("versioned run anchored to existing game UUID; valid transitions and multiple pauses", () => {
  const initial = prepared();
  assert.equal(initial.version, 1);
  assert.equal(initial.rounds[0].version, 1);
  let run = startRun(initial, "r1", 100, []);
  run = pauseRun(run, 200);
  assert.equal(activeElapsedMs(run, 1000), 100);
  run = resumeRun(run, 1000);
  run = pauseRun(run, 1300);
  run = resumeRun(run, 2000);
  run = endRun(run, 2200);
  assert.equal(activeElapsedMs(run, 9000), 600);
  assert.equal(run.status, "ENDED");
  assert.equal(run.rounds[0].status, "CLOSED");
  assert.equal(initial.status, "PREPARED");
  assert.equal(initial.rounds[0].status, "PREPARED");
  assert.throws(() => startRun(run, "r1", 9000, []), /NOT_PREPARED/);
  assert.throws(() => resumeRun(run, 9000), /NOT_PAUSED/);
  assert.throws(() => addRound(run, "r2"), /RUN_ENDED/);
});

test("invalid transitions, timestamps, identities and drawing during pause are rejected", () => {
  assert.throws(() => createRun("x", "quiz-31", 0), /UUID/);
  assert.throws(() => createRun("", game, 0), /ID_REQUIRED/);
  for (const now of [-1, NaN, 1.5, Infinity]) assert.throws(() => createRun("x", game, now), /CLOCK/);
  assert.throws(() => pauseRun(prepared(), 100), /NOT_RUNNING/);
  assert.throws(() => resumeRun(running(), 200), /NOT_PAUSED/);
  assert.throws(() => startRun(running(), "r1", 200, []), /NOT_PREPARED/);
  assert.throws(() => startRun(prepared(), "absent", 100, []), /NOT_PREPARED/);
  assert.throws(() => openRound(prepared(), "r1"), /NOT_RUNNING/);
  assert.throws(() => openRound(addRound(running(), "r2"), "r2"), /OPEN_ROUND_EXISTS/);
  assert.throws(() => closeRound(prepared(), "r1"), /NOT_ACTIVE/);
  assert.throws(() => endRun(prepared(), 10), /NOT_ACTIVE/);
  assert.throws(() => pauseRun(running(), 99), /CLOCK/);
  assert.throws(() => drawNumber(pauseRun(running(), 200), "r1", "d", 1), /NOT_RUNNING/);
  assert.throws(() => addRound(prepared(), "r1"), /DUPLICATE_ROUND/);
});

test("one active or paused run per game in supplied set, other games unaffected", () => {
  const old = { ...running(), id: "old" };
  assert.throws(() => startRun(prepared(), "r1", 200, [old]), /ACTIVE_RUN_EXISTS/);
  assert.throws(() => startRun(prepared(), "r1", 200, [pauseRun(old, 150)]), /ACTIVE_RUN_EXISTS/);
  assert.throws(() => startRun(prepared(), "r1", 200, [running()]), /CONTAINS_SELF/);
  assert.doesNotThrow(() => startRun(prepared(), "r1", 200, [endRun(old, 150)]));
  assert.doesNotThrow(() => assertSingleActiveRun([old, { ...running(), gameId: "another" }], game));
});

test("new round starts empty while old draw history remains; no reopening closed round", () => {
  let run = drawNumber(running(), "r1", "draw", 25);
  const previous = run;
  run = closeRound(run, "r1");
  run = openRound(addRound(run, "r2", 20), "r2");
  assert.equal(run.rounds[0].status, "CLOSED");
  assert.deepEqual(run.rounds[0].draws, previous.rounds[0].draws);
  assert.deepEqual(run.rounds[1].draws, []);
  assert.deepEqual(run.rounds[1].claims, []);
  assert.equal(previous.rounds[0].status, "OPEN");
  assert.throws(() => openRound(closeRound(run, "r2"), "r1"), /NOT_PREPARED/);
});
