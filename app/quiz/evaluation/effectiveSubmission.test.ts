import assert from "node:assert/strict";
import test from "node:test";

import type { Prisma } from "@/app/generated/prisma/client";
import { resolveEffectiveSubmission } from "./effectiveSubmission";

const draft = {
  antwort_text: "neuer, nicht abgesendeter Draft",
  antwort_id: 99,
  antwortauswahlen: [{ antwort_id: 99 }],
  antwortfelder: [{ antwortfeld_id: 7, antwort_text: "Draft-Feld" }],
};

function submission(input: {
  id: number;
  version: number;
  payload: Prisma.JsonValue;
  status?: "SUBMITTED" | "AUTO_FINALIZED";
  type?: string;
}) {
  return {
    team_answer_submission_id: input.id,
    interaction_run_id: 10,
    submission_version: input.version,
    status: input.status ?? "SUBMITTED",
    interaction_type: input.type ?? "TEXT",
    payload: input.payload,
  };
}

test("uses v1 instead of a newer unsubmitted draft", () => {
  const result = resolveEffectiveSubmission({
    interactionRunId: 10,
    draft,
    submissions: [submission({ id: 1, version: 1, payload: { text: "v1" } })],
  });

  assert.equal(result?.source, "SUBMISSION");
  assert.equal(result?.submissionVersion, 1);
  assert.equal(result?.answerText, "v1");
  assert.deepEqual(result?.selectedAnswerIds, []);
});

test("uses the latest explicit submission version without accumulating versions", () => {
  const result = resolveEffectiveSubmission({
    interactionRunId: 10,
    draft,
    submissions: [
      submission({ id: 1, version: 1, payload: { optionId: 1 }, type: "SINGLE_CHOICE" }),
      submission({ id: 2, version: 2, payload: { optionId: 2 }, type: "SINGLE_CHOICE" }),
    ],
  });

  assert.equal(result?.submissionId, 2);
  assert.equal(result?.submissionVersion, 2);
  assert.deepEqual(result?.selectedAnswerIds, [2]);
});

test("uses an auto-finalized snapshot when it is the only submission", () => {
  const result = resolveEffectiveSubmission({
    interactionRunId: 10,
    draft,
    submissions: [
      submission({
        id: 1,
        version: 1,
        status: "AUTO_FINALIZED",
        payload: { value: "12.5" },
        type: "NUMBER",
      }),
    ],
  });

  assert.equal(result?.submissionStatus, "AUTO_FINALIZED");
  assert.equal(result?.answerText, "12.5");
});

test("does not fall back to a draft for a new run without a submission", () => {
  assert.equal(
    resolveEffectiveSubmission({
      interactionRunId: 10,
      draft,
      submissions: [],
    }),
    null,
  );
});

test("uses the explicitly isolated legacy adapter only without an interaction run", () => {
  const result = resolveEffectiveSubmission({
    interactionRunId: null,
    draft,
    submissions: [],
  });

  assert.equal(result?.source, "LEGACY");
  assert.equal(result?.answerText, draft.antwort_text);
  assert.deepEqual(result?.selectedAnswerIds, [99]);
  assert.equal(result?.structuredAnswers.get(7), "Draft-Feld");
});

test("decodes structured, multi-choice and ordering snapshots", () => {
  const structured = resolveEffectiveSubmission({
    interactionRunId: 10,
    draft,
    submissions: [submission({
      id: 1,
      version: 1,
      type: "STRUCTURED_TEXT",
      payload: { fields: { "7": "Ada", "8": "Grace" } },
    })],
  });
  assert.equal(structured?.structuredAnswers.get(8), "Grace");

  const multi = resolveEffectiveSubmission({
    interactionRunId: 10,
    draft,
    submissions: [submission({
      id: 2,
      version: 1,
      type: "MULTI_CHOICE",
      payload: { optionIds: [2, 1] },
    })],
  });
  assert.deepEqual(multi?.selectedAnswerIds, [2, 1]);

  const order = resolveEffectiveSubmission({
    interactionRunId: 10,
    draft,
    submissions: [submission({
      id: 3,
      version: 1,
      type: "ORDER",
      payload: { itemIds: ["a", "c", "b", "d"] },
    })],
  });
  assert.equal(order?.answerText, '["a","c","b","d"]');
});

test("never silently falls back to draft content for an invalid final payload", () => {
  assert.throws(
    () => resolveEffectiveSubmission({
      interactionRunId: 10,
      draft,
      submissions: [submission({
        id: 1,
        version: 1,
        type: "MULTI_CHOICE",
        payload: { optionIds: [1, 1] },
      })],
    }),
    /Submission-Snapshot ist ungültig/,
  );
});
