import assert from "node:assert/strict";
import test from "node:test";
import { createTiebreakState, projectTiebreak, readTiebreakState, revealTiebreakRound, saveTiebreakAnswer, startTiebreakRound, tiebreakPlaces, unresolvedTiebreakGroups, verifiedTiebreakPlaces } from "./estimationTiebreak";
const question = { questionId: 10, question: "Wie viele?", unit: "Stück", correctValue: 100 };
const initial = () => createTiebreakState([{ sessionId: 1, points: 10 }, { sessionId: 2, points: 10 }, { sessionId: 3, points: 5 }, { sessionId: 4, points: 5 }, { sessionId: 5, points: 2 }]);
test("no tie does not create a round", () => {
  const state = createTiebreakState([{ sessionId: 1, points: 10 }, { sessionId: 2, points: 8 }]);
  assert.equal(unresolvedTiebreakGroups(state).length, 0);
  assert.deepEqual(startTiebreakRound(state, question), state);
});
test("two groups, absolute distance, missing answer, idempotence and unchanged regular scores", () => {
  const before = initial();
  let state = startTiebreakRound(before, question);
  assert.deepEqual(startTiebreakRound(state, question), state);
  state = saveTiebreakAnswer(state, { roundId: 1, sessionId: 2, value: 99, expectedRevision: 0 });
  assert.deepEqual(saveTiebreakAnswer(state, { roundId: 1, sessionId: 2, value: 99, expectedRevision: 0 }), state);
  assert.throws(() => saveTiebreakAnswer(state, { roundId: 1, sessionId: 2, value: 98, expectedRevision: 0 }));
  assert.throws(() => saveTiebreakAnswer(state, { roundId: 1, sessionId: 3, value: 100, expectedRevision: 0 }));
  assert.equal("correctValue" in projectTiebreak(state, 2).round!, false);
  assert.equal(projectTiebreak(state, 1).round!.ownAnswer, null);
  state = revealTiebreakRound(state, 1);
  assert.deepEqual(revealTiebreakRound(state, 1), state);
  assert.deepEqual([...tiebreakPlaces(state)], [[2, 1], [1, 2], [3, 3], [4, 3], [5, 5]]);
  assert.deepEqual(state.standings, before.standings);
  assert.deepEqual(startTiebreakRound(state, { ...question, questionId: 11 }).rounds.at(-1)!.teamIds, [3, 4]);
});
test("three teams: equal distance retries only the tied subset", () => {
  let state = startTiebreakRound(createTiebreakState([1, 2, 3].map(sessionId => ({ sessionId, points: 10 }))), question);
  for (const [sessionId, value] of [[1, 90], [2, 110], [3, 130]]) state = saveTiebreakAnswer(state, { roundId: 1, sessionId, value, expectedRevision: 0 });
  state = revealTiebreakRound(state, 1);
  assert.deepEqual([...tiebreakPlaces(state)], [[1, 1], [2, 1], [3, 3]]);
  state = startTiebreakRound(state, { ...question, questionId: 11 });
  assert.deepEqual(state.rounds.at(-1)!.teamIds, [1, 2]);
  state = saveTiebreakAnswer(state, { roundId: 2, sessionId: 2, value: 101, expectedRevision: 0 });
  state = revealTiebreakRound(state, 2);
  assert.deepEqual([...tiebreakPlaces(state)], [[2, 1], [1, 2], [3, 3]]);
  assert.deepEqual(readTiebreakState(JSON.parse(JSON.stringify(state))), state);
});
test("all missing stays tied; no zero answer or invented winner; changed regular standings invalidate refinements", () => {
  const state = revealTiebreakRound(startTiebreakRound(initial(), question), 1);
  assert.deepEqual(state.groups, initial().groups);
  assert.equal(unresolvedTiebreakGroups(state).length, 2);
  assert.equal(verifiedTiebreakPlaces(state, state.standings).size, 5);
  assert.equal(verifiedTiebreakPlaces(state, state.standings.map(team => ({ ...team, points: team.points + 1 }))).size, 0);
  assert.throws(() => startTiebreakRound(state, question));
  assert.throws(() => readTiebreakState({ ...state, version: 2 }));
  assert.throws(() => readTiebreakState({ ...state, groups: [[[1, 1]]] }));
});
