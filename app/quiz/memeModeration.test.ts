import assert from "node:assert/strict";
import test from "node:test";

import {
  collectValidMemeSubmissions,
  createMemeSelectionPlan,
  randomizeMemeCandidates,
  validateMemeReviewCompletion,
  type StoredMemeSubmission,
} from "./memeModeration";

function submission(
  id: number,
  team: number,
  version: number,
  payload: unknown = { topText: `Oben ${id}`, bottomText: "" },
): StoredMemeSubmission {
  return {
    team_answer_submission_id: id,
    interaction_run_id: 11,
    quiz_team_session_id: team,
    submission_version: version,
    status: "SUBMITTED",
    interaction_type: "MEME_CAPTION",
    payload,
  };
}

test("uses only the latest meaningful final Meme submission per team and run", () => {
  const valid = collectValidMemeSubmissions(11, [
    submission(1, 1, 1),
    submission(2, 1, 2, { topText: "Neu", bottomText: "Stand" }),
    submission(3, 2, 1, { topText: "", bottomText: "" }),
    { ...submission(4, 3, 1), interaction_run_id: 12 },
    { ...submission(5, 4, 1), interaction_type: "TEXT" },
    submission(6, 5, 1, { topText: "Gültig", bottomText: "" }),
  ]);

  assert.deepEqual(
    valid.map((entry) => [entry.team_answer_submission_id, entry.payload]),
    [
      [2, { topText: "Neu", bottomText: "Stand" }],
      [6, { topText: "Gültig", bottomText: "" }],
    ],
  );
});

test("All selects every valid submission once in a server-generated stable order", () => {
  const valid = collectValidMemeSubmissions(11, [
    submission(1, 1, 1),
    submission(2, 2, 1),
    submission(3, 3, 1),
  ]);
  const random = () => 0;
  const plan = createMemeSelectionPlan(valid, null, random);

  assert.equal(plan.validSubmissionCount, 3);
  assert.deepEqual(
    plan.selected.map((entry) => entry.team_answer_submission_id),
    [2, 3, 1],
  );
  assert.equal(new Set(plan.selected).size, 3);
});

test("fixed limits select distinct candidates and retain all below or at the limit", () => {
  const valid = collectValidMemeSubmissions(
    11,
    Array.from({ length: 8 }, (_, index) =>
      submission(index + 1, index + 1, 1),
    ),
  );
  const selected = createMemeSelectionPlan(valid, 4, () => 0).selected;
  assert.equal(selected.length, 4);
  assert.equal(new Set(selected.map((entry) => entry.quiz_team_session_id)).size, 4);
  assert.equal(createMemeSelectionPlan(valid.slice(0, 3), 8, () => 0).selected.length, 3);
  assert.equal(createMemeSelectionPlan(valid.slice(0, 4), 4, () => 0).selected.length, 4);
});

test("final presentation selection randomizes only approved inputs and applies the limit once", () => {
  const approved = ["A", "B", "C", "D"];
  assert.deepEqual(randomizeMemeCandidates(approved, 2, () => 0), ["B", "C"]);
  assert.deepEqual(randomizeMemeCandidates(approved, null, () => 0), ["B", "C", "D", "A"]);
  assert.throws(() => randomizeMemeCandidates(approved, null, () => 99));
});

test("review completion requires decisions and at least one approved candidate", () => {
  assert.deepEqual(validateMemeReviewCompletion({ candidateStatuses: [] }), {
    ok: true,
    nextState: "SKIPPED",
  });
  assert.equal(
    validateMemeReviewCompletion({
      candidateStatuses: ["APPROVED", "PENDING_REVIEW"],
    }).ok,
    false,
  );
  assert.equal(
    validateMemeReviewCompletion({
      candidateStatuses: ["REJECTED", "REJECTED"],
    }).ok,
    false,
  );
  assert.deepEqual(
    validateMemeReviewCompletion({
      candidateStatuses: ["APPROVED", "REJECTED"],
    }),
    { ok: true, nextState: "COMPLETED" },
  );
});
