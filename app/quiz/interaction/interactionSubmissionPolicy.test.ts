import assert from "node:assert/strict";
import test from "node:test";

import {
  isDraftChangedSinceSubmission,
  planSubmissionVersion,
  resolveInteractionSubmissionPolicy,
  shouldAutoFinalizeDraft,
} from "./interactionSubmissionPolicy";

test("allows normal productive interactions to be resubmitted while open", () => {
  for (const interactionType of [
    "TEXT",
    "STRUCTURED_TEXT",
    "NUMBER",
    "SINGLE_CHOICE",
    "MULTI_CHOICE",
    "ORDER",
  ]) {
    assert.equal(
      resolveInteractionSubmissionPolicy(interactionType)
        .resubmissionAllowedWhileOpen,
      true,
      interactionType,
    );
  }
  assert.equal(
    resolveInteractionSubmissionPolicy("PIXEL_STOP")
      .resubmissionAllowedWhileOpen,
    false,
  );
});

test("recognizes a draft changed after the latest submission", () => {
  assert.equal(isDraftChangedSinceSubmission(2, 2), false);
  assert.equal(isDraftChangedSinceSubmission(3, 2), true);
  assert.equal(isDraftChangedSinceSubmission(3, null), false);
});

test("retries the same draft idempotently and versions changed drafts", () => {
  const submissions = [
    { submissionVersion: 1, draftRevision: 2 },
    { submissionVersion: 2, draftRevision: 4 },
  ];
  assert.deepEqual(planSubmissionVersion(submissions, 4), {
    kind: "IDEMPOTENT",
    submission: submissions[1],
  });
  assert.deepEqual(planSubmissionVersion(submissions, 5), {
    kind: "CREATE",
    submissionVersion: 3,
  });
});

test("auto-finalizes only a contentful draft without an explicit submission", () => {
  assert.equal(
    shouldAutoFinalizeDraft({
      hasExplicitSubmission: false,
      hasContent: true,
    }),
    true,
  );
  assert.equal(
    shouldAutoFinalizeDraft({
      hasExplicitSubmission: true,
      hasContent: true,
    }),
    false,
  );
  assert.equal(
    shouldAutoFinalizeDraft({
      hasExplicitSubmission: false,
      hasContent: false,
    }),
    false,
  );
});
