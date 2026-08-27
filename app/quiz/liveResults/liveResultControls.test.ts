import assert from "node:assert/strict";
import test from "node:test";

import {
  canCloseLiveResultAnswerPhase,
  canToggleLiveResultVisibility,
} from "./liveResultControls";

test("OPEN explicitly supports showing and hiding the current live result", () => {
  assert.equal(canToggleLiveResultVisibility("OPEN"), true);
  assert.equal(canCloseLiveResultAnswerPhase("OPEN"), true);
});

test("COUNTDOWN and CLOSED follow the existing response-phase contract", () => {
  assert.equal(canToggleLiveResultVisibility("COUNTDOWN"), true);
  assert.equal(canCloseLiveResultAnswerPhase("COUNTDOWN"), true);
  assert.equal(canToggleLiveResultVisibility("CLOSED"), true);
  assert.equal(canCloseLiveResultAnswerPhase("CLOSED"), false);
});

test("LOCKED and REVEALED never expose a misleading live-result action", () => {
  for (const state of ["LOCKED", "REVEALED"] as const) {
    assert.equal(canToggleLiveResultVisibility(state), false);
    assert.equal(canCloseLiveResultAnswerPhase(state), false);
  }
});
