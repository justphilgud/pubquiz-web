import { test } from "node:test";
import assert from "node:assert/strict";
import { generateCard } from "../core/cards";
import { activeElapsedMs } from "../core/run";
import { applyLiveEvent, initialState, replayLive, parseLiveCommand, type LiveCommand, type LiveEvent } from "./live";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const round = { id: id(3), label: "Runde", target: 30, issued: null, seriesIds: [id(4)] };
const card = generateCard(id(5), () => 0);
test("capturing a call before lookup preserves its cutoff despite later draws", () => {
  let state = initialState(id(1), id(2), round, 1000), n = 10;
  const events: LiveEvent[] = [];
  function send(command: LiveCommand) {
    const event = { id: id(n++), at: 1000 + n, actorId: 1, command };
    events.push(event); state = applyLiveEvent(state, event, [card]); return event.id;
  }
  const early = send({ kind: "call", stage: "BINGO" });
  for (const number of card.cells[0]) send({ kind: "draw", number: number! });
  send({ kind: "identify", callId: early, cardId: card.id });
  assert.equal(state.run.rounds[0].claims[0].throughPosition, 0);
  assert.throws(() => send({ kind: "decide", callId: early, action: "CONFIRM", reason: "Prüfung" }), /CLAIM_NOT_COVERED/);
  events.pop();
  send({ kind: "decide", callId: early, action: "REJECT", reason: "Beim Ruf keine Linie" });
  const valid = send({ kind: "call", stage: "BINGO" });
  send({ kind: "identify", callId: valid, cardId: card.id });
  send({ kind: "decide", callId: valid, action: "CONFIRM", reason: "Linie geprüft" });
  send({ kind: "correct", number: 75, reason: "Letzte Kugel falsch erfasst" });
  assert.equal(state.run.rounds[0].claims[1].needsReview, true);
  send({ kind: "decide", callId: valid, action: "REVOKE", reason: "Nachprüfung" });
  assert.deepEqual(replayLive(id(1), id(2), round, 1000, events, [card]), state);
});
test("pause, server time, immutable end and validation", () => {
  let state = initialState(id(1), id(2), round, 1000);
  const event = (command: LiveCommand, at: number, n: number) => ({ id: id(n), actorId: 1, at, command });
  state = applyLiveEvent(state, event({ kind: "pause" }, 2000, 10), []);
  assert.equal(activeElapsedMs(state.run, 9000), 1000);
  assert.throws(() => applyLiveEvent(state, event({ kind: "draw", number: 2 }, 9000, 11), []), /RUN_NOT_RUNNING/);
  state = applyLiveEvent(state, event({ kind: "resume" }, 9000, 12), []);
  state = applyLiveEvent(state, event({ kind: "end" }, 10000, 13), []);
  assert.equal(activeElapsedMs(state.run, 20000), 2000);
  assert.throws(() => applyLiveEvent(state, event({ kind: "resume" }, 21000, 14), []), /RUN_ENDED/);
  for (const value of [0, 76, 1.5, "1", null]) assert.throws(() => parseLiveCommand({ kind: "draw", number: value }));
  assert.throws(() => parseLiveCommand({ kind: "pause", now: 1 }));
});
