import assert from "node:assert/strict";
import test from "node:test";
import {
  getQuestionLifecycleState,
  isValidNextReviewFrom,
  outdatedFromToValidUntil,
  validUntilToOutdatedFrom,
} from "./questionLifecycle";

test("legacy inclusive valid-until dates map to the following outdated-from day", () => {
  assert.equal(validUntilToOutdatedFrom("2026-08-18"), "2026-08-19");
  assert.equal(outdatedFromToValidUntil("2026-08-19"), "2026-08-18");
});

test("freshness confirmation clears a due date or schedules a future review", () => {
  assert.equal(isValidNextReviewFrom(null, "2026-08-18"), true);
  assert.equal(isValidNextReviewFrom("2026-08-18", "2026-08-18"), false);
  assert.equal(isValidNextReviewFrom("2026-08-19", "2026-08-18"), true);
});

test("timeless, outdated and review lifecycle states stay distinct", () => {
  const today = "2026-08-18";
  assert.deepEqual(
    getQuestionLifecycleState({ validUntil: null, reviewFrom: null, today }),
    {
      mode: "TIMELESS",
      outdatedFrom: null,
      isOutdated: false,
      isOutdatedSoon: false,
      isReviewDue: false,
      isReviewSoon: false,
      isCurrent: true,
    },
  );
  assert.equal(
    getQuestionLifecycleState({ validUntil: "2026-08-17", reviewFrom: null, today }).isOutdated,
    true,
  );
  assert.equal(
    getQuestionLifecycleState({ validUntil: null, reviewFrom: "2026-08-18", today }).isReviewDue,
    true,
  );
});

test("soon filters include the next 30 days but not due dates", () => {
  const today = "2026-08-18";
  assert.equal(
    getQuestionLifecycleState({ validUntil: "2026-09-16", reviewFrom: null, today }).isOutdatedSoon,
    true,
  );
  assert.equal(
    getQuestionLifecycleState({ validUntil: null, reviewFrom: "2026-09-17", today }).isReviewSoon,
    true,
  );
  assert.equal(
    getQuestionLifecycleState({ validUntil: null, reviewFrom: "2026-09-18", today }).isReviewSoon,
    false,
  );
});
