import assert from "node:assert/strict";
import test from "node:test";

import {
  assertQuizInteractionTransition,
  canTransitionQuizInteraction,
  isQuizInteractionWritable,
} from "./interactionStateMachine";

test("supports the AP2 interaction lifecycle and countdown paths", () => {
  assert.equal(canTransitionQuizInteraction("LOCKED", "OPEN"), true);
  assert.equal(canTransitionQuizInteraction("OPEN", "COUNTDOWN"), true);
  assert.equal(canTransitionQuizInteraction("COUNTDOWN", "OPEN"), true);
  assert.equal(canTransitionQuizInteraction("OPEN", "CLOSED"), true);
  assert.equal(canTransitionQuizInteraction("COUNTDOWN", "CLOSED"), true);
  assert.equal(canTransitionQuizInteraction("CLOSED", "REVEALED"), true);
});

test("rejects regressions and skips while accepting idempotent transitions", () => {
  assert.doesNotThrow(() => assertQuizInteractionTransition("OPEN", "OPEN"));
  assert.throws(
    () => assertQuizInteractionTransition("CLOSED", "OPEN"),
    /Ung\u00fcltiger Interaction-\u00dcbergang/,
  );
  assert.throws(
    () => assertQuizInteractionTransition("REVEALED", "CLOSED"),
    /Ung\u00fcltiger Interaction-\u00dcbergang/,
  );
});

test("uses the server deadline as the authoritative write boundary", () => {
  const now = new Date("2026-08-14T12:00:00.000Z");
  assert.equal(isQuizInteractionWritable("OPEN", null, now), true);
  assert.equal(
    isQuizInteractionWritable(
      "COUNTDOWN",
      new Date("2026-08-14T12:00:01.000Z"),
      now,
    ),
    true,
  );
  assert.equal(isQuizInteractionWritable("COUNTDOWN", now, now), false);
  assert.equal(isQuizInteractionWritable("CLOSED", null, now), false);
  assert.equal(isQuizInteractionWritable("REVEALED", null, now), false);
});
