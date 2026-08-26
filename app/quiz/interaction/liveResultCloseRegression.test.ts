import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { resolveEffectiveSubmission } from "../evaluation/effectiveSubmission";
import { aggregateLiveChoiceResults } from "../liveResults/liveChoiceResults";
import { selectEffectiveLiveSubmissions } from "../liveResults/effectiveLiveSubmissions";
import { shouldReuseQuestionInteractionRun } from "./interactionRunReuse";
import { isQuizInteractionWritable } from "./interactionStateMachine";

type ChoicePayload =
  | { optionId: number | null }
  | { optionIds: number[] };

function answer(input: {
  payloads: ChoicePayload[];
  type?: "SINGLE_CHOICE" | "MULTI_CHOICE";
}) {
  const interactionType = input.type ?? "SINGLE_CHOICE";
  return {
    interaction_run_id: 40,
    quiz_team_session_id: 7,
    antwort_text: null,
    antwort_id: null,
    antwortauswahlen: [],
    antwortfelder: [],
    submissions: input.payloads.map((payload, index) => ({
      team_answer_submission_id: index + 1,
      interaction_run_id: 40,
      submission_version: index + 1,
      status: "SUBMITTED" as const,
      interaction_type: interactionType,
      payload,
    })),
  };
}

function effectiveAfterClose(storedAnswer: ReturnType<typeof answer>) {
  assert.equal(shouldReuseQuestionInteractionRun({
    state: "CLOSED",
    liveResultsEnabled: true,
    stoppedPixelRunReusable: false,
  }), true);
  assert.equal(isQuizInteractionWritable("CLOSED", null, new Date()), false);

  const live = selectEffectiveLiveSubmissions({
    interactionRunId: 40,
    answers: [storedAnswer],
  });
  const evaluation = resolveEffectiveSubmission({
    interactionRunId: storedAnswer.interaction_run_id,
    draft: storedAnswer,
    submissions: storedAnswer.submissions,
  });
  return { live, evaluation };
}

test("closing keeps a single-choice submission effective for live results and evaluation", () => {
  const storedAnswer = answer({ payloads: [{ optionId: 3 }] });
  const before = selectEffectiveLiveSubmissions({
    interactionRunId: 40,
    answers: [storedAnswer],
  });
  const after = effectiveAfterClose(storedAnswer);
  const result = aggregateLiveChoiceResults({
    interaction: {
      type: "SINGLE_CHOICE",
      selectionMode: "SINGLE",
      options: [{ id: 1, label: "A" }, { id: 3, label: "C" }],
    },
    visible: true,
    state: "CLOSED",
    totalTeams: 1,
    payloads: after.live.map(({ payload }) => payload),
  });

  assert.deepEqual(after.live, before);
  assert.deepEqual(result.options.map(({ count }) => count), [0, 1]);
  assert.deepEqual(after.evaluation?.selectedAnswerIds, [3]);
  assert.equal(after.evaluation?.submissionStatus, "SUBMITTED");
});

test("closing preserves multiple-choice selections exactly", () => {
  const after = effectiveAfterClose(answer({
    type: "MULTI_CHOICE",
    payloads: [{ optionIds: [1, 3] }],
  }));

  assert.deepEqual(after.live[0].payload, { optionIds: [1, 3] });
  assert.deepEqual(after.evaluation?.selectedAnswerIds, [1, 3]);
});

test("true-false remains the same single-choice submission after close", () => {
  const after = effectiveAfterClose(answer({ payloads: [{ optionId: 1 }] }));

  assert.deepEqual(after.live[0].payload, { optionId: 1 });
  assert.deepEqual(after.evaluation?.selectedAnswerIds, [1]);
});

test("only the last pre-close change remains effective and post-close writes are rejected", () => {
  const after = effectiveAfterClose(answer({
    payloads: [{ optionId: 1 }, { optionId: 2 }],
  }));

  assert.equal(after.live.length, 1);
  assert.deepEqual(after.live[0].payload, { optionId: 2 });
  assert.deepEqual(after.evaluation?.selectedAnswerIds, [2]);
  assert.equal(isQuizInteractionWritable("CLOSED", null, new Date()), false);
});

test("the production close action targets the validated run and never deletes submissions", () => {
  const actions = readFileSync("app/quiz/actions.ts", "utf8");
  const service = readFileSync(
    "app/quiz/interaction/interaction.server.ts",
    "utf8",
  );
  const closeAction = actions.slice(
    actions.indexOf("export async function closeQuizQuestionAnswerPhase"),
    actions.indexOf("export async function setLiveTextResponsePublication"),
  );
  const closeService = service.slice(
    service.indexOf("export async function closeQuizQuestionInteraction"),
    service.indexOf("export async function closeBlockInteractions"),
  );

  assert.match(closeAction, /interactionRunId: run\.interaction_run_id/);
  assert.doesNotMatch(closeAction, /closeCurrentInteraction/);
  assert.match(closeService, /run\.quiz_id !== input\.quizId/);
  assert.match(closeService, /run\.quiz_fragen_id !== input\.quizFragenId/);
  assert.doesNotMatch(closeService, /team_answer_submissions\.(delete|update)/);
});

test("closed standard questions retain their existing lifecycle behavior", () => {
  assert.equal(shouldReuseQuestionInteractionRun({
    state: "CLOSED",
    liveResultsEnabled: false,
    stoppedPixelRunReusable: false,
  }), false);
  assert.equal(shouldReuseQuestionInteractionRun({
    state: "REVEALED",
    liveResultsEnabled: true,
    stoppedPixelRunReusable: false,
  }), false);
});
