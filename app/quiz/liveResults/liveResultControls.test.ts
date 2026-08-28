import assert from "node:assert/strict";
import test from "node:test";

import {
  canIncludeLiveResultAggregates,
  canCloseLiveResultAnswerPhase,
  canToggleLiveResultVisibility,
  isLiveResultVisibleToAudience,
} from "./liveResultControls";

test("OPEN supports closing but never an audience result reveal", () => {
  assert.equal(canToggleLiveResultVisibility("OPEN"), false);
  assert.equal(canCloseLiveResultAnswerPhase("OPEN"), true);
  assert.equal(isLiveResultVisibleToAudience("OPEN", true), false);
});

test("COUNTDOWN remains closable while only CLOSED can reveal results", () => {
  assert.equal(canToggleLiveResultVisibility("COUNTDOWN"), false);
  assert.equal(canCloseLiveResultAnswerPhase("COUNTDOWN"), true);
  assert.equal(canToggleLiveResultVisibility("CLOSED"), true);
  assert.equal(canCloseLiveResultAnswerPhase("CLOSED"), false);
  assert.equal(isLiveResultVisibleToAudience("CLOSED", false), false);
  assert.equal(isLiveResultVisibleToAudience("CLOSED", true), true);
});

test("LOCKED and REVEALED never expose a misleading live-result action", () => {
  for (const state of ["LOCKED", "REVEALED"] as const) {
    assert.equal(canToggleLiveResultVisibility(state), false);
    assert.equal(canCloseLiveResultAnswerPhase(state), false);
  }
});

test("response aggregates stay private until close and explicit reveal", () => {
  assert.equal(canIncludeLiveResultAggregates({
    state: "OPEN",
    requestedVisibility: true,
    includeModeration: false,
  }), false);
  assert.equal(canIncludeLiveResultAggregates({
    state: "OPEN",
    requestedVisibility: false,
    includeModeration: true,
  }), true);
  assert.equal(canIncludeLiveResultAggregates({
    state: "CLOSED",
    requestedVisibility: false,
    includeModeration: false,
  }), false);
  assert.equal(canIncludeLiveResultAggregates({
    state: "CLOSED",
    requestedVisibility: true,
    includeModeration: false,
  }), true);
  assert.equal(canIncludeLiveResultAggregates({
    state: "REVEALED",
    requestedVisibility: false,
    includeModeration: false,
  }), true);
});
