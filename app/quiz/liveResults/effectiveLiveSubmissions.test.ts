import assert from "node:assert/strict";
import test from "node:test";

import { aggregateLiveChoiceResults } from "./liveChoiceResults";
import { selectEffectiveLiveSubmissions } from "./effectiveLiveSubmissions";

type Payload = { optionId: number | null };

function submission(input: {
  id: number;
  runId?: number;
  version: number;
  optionId: number;
}) {
  return {
    team_answer_submission_id: input.id,
    interaction_run_id: input.runId ?? 20,
    submission_version: input.version,
    payload: { optionId: input.optionId } satisfies Payload,
  };
}

test("moderation loads one effective persisted submission per team", () => {
  const effective = selectEffectiveLiveSubmissions({
    interactionRunId: 20,
    answers: [
      {
        interaction_run_id: 20,
        quiz_team_session_id: 1,
        submissions: [
          submission({ id: 1, version: 1, optionId: 1 }),
          submission({ id: 2, version: 2, optionId: 3 }),
        ],
      },
      {
        interaction_run_id: 20,
        quiz_team_session_id: 2,
        submissions: [submission({ id: 3, version: 1, optionId: 1 })],
      },
      {
        interaction_run_id: 20,
        quiz_team_session_id: 3,
        submissions: [submission({ id: 4, version: 1, optionId: 3 })],
      },
    ],
  });

  const result = aggregateLiveChoiceResults({
    interaction: {
      type: "SINGLE_CHOICE",
      selectionMode: "SINGLE",
      options: [
        { id: 1, label: "A" },
        { id: 2, label: "B" },
        { id: 3, label: "C" },
      ],
    },
    visible: true,
    state: "OPEN",
    totalTeams: 3,
    payloads: effective.map(({ payload }) => payload),
  });

  assert.equal(result.finalAnswers, 3);
  assert.deepEqual(result.options.map(({ count }) => count), [1, 0, 2]);
});

test("a submission from a different run is not effective for moderation", () => {
  const effective = selectEffectiveLiveSubmissions({
    interactionRunId: 20,
    answers: [
      {
        interaction_run_id: 20,
        quiz_team_session_id: 1,
        submissions: [
          submission({ id: 1, runId: 19, version: 9, optionId: 1 }),
          submission({ id: 2, version: 1, optionId: 3 }),
        ],
      },
      {
        interaction_run_id: 19,
        quiz_team_session_id: 2,
        submissions: [
          submission({ id: 3, runId: 19, version: 1, optionId: 1 }),
        ],
      },
    ],
  });

  assert.deepEqual(
    effective.map(({ team_answer_submission_id }) =>
      team_answer_submission_id),
    [2],
  );
});

test("visibility toggles do not mutate the selected submission set", () => {
  const answers = [{
    interaction_run_id: 20,
    quiz_team_session_id: 1,
    submissions: [submission({ id: 5, version: 1, optionId: 2 })],
  }];

  const before = selectEffectiveLiveSubmissions({
    interactionRunId: 20,
    answers,
  });
  const after = selectEffectiveLiveSubmissions({
    interactionRunId: 20,
    answers,
  });

  assert.deepEqual(after, before);
  assert.equal(answers[0].submissions.length, 1);
});
