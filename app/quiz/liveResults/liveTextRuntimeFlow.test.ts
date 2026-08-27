import assert from "node:assert/strict";
import test from "node:test";

import { resolveEffectiveSubmission } from "../evaluation/effectiveSubmission";
import { isQuizInteractionWritable } from "../interaction/interactionStateMachine";
import { selectEffectiveLiveSubmissions } from "./effectiveLiveSubmissions";
import { aggregateLiveTextResults } from "./liveTextResults";

const rules = [{ id: 1, searchTerm: "Penis", replacement: "Sonnenblume" }];

function storedAnswer(isVisible: boolean) {
  return {
    interaction_run_id: 40,
    quiz_team_session_id: 7,
    antwort_text: "P3nis",
    antwort_id: null,
    antwortauswahlen: [],
    antwortfelder: [],
    submissions: [{
      team_answer_submission_id: 91,
      interaction_run_id: 40,
      quiz_team_session_id: 7,
      submission_version: 1,
      status: "SUBMITTED" as const,
      interaction_type: "TEXT",
      payload: { text: "P3nis" },
      draft_revision: 1,
      live_text_publication: { is_visible: isVisible },
      quiz_team_session: {
        team_id: 12,
        teamname: "Team A",
        team: {
          team_id: 12,
          avatar_code: "toaster",
          foto_url: null,
          foto_upload_gesperrt: false,
        },
      },
    }],
  };
}

function resultState(isVisible: boolean, state: "OPEN" | "CLOSED") {
  const answer = storedAnswer(isVisible);
  const submissions = selectEffectiveLiveSubmissions({
    interactionRunId: 40,
    answers: [answer],
  });
  return aggregateLiveTextResults({
    visible: true,
    state,
    totalTeams: 1,
    rules,
    includeModeration: true,
    submissions: submissions.map((submission) => ({
      submissionId: submission.team_answer_submission_id,
      teamId: submission.quiz_team_session.team_id,
      teamName: submission.quiz_team_session.teamname,
      avatarCode: "toaster",
      photoUrl: null,
      originalText: submission.payload.text,
      isVisible: submission.live_text_publication.is_visible,
    })),
  });
}

test("open LIVE text keeps original and public projection separate until publication", () => {
  const state = resultState(false, "OPEN");

  assert.equal(state.moderationResponses?.[0]?.teamName, "Team A");
  assert.equal(state.moderationResponses?.[0]?.originalText, "P3nis");
  assert.equal(state.moderationResponses?.[0]?.publicText, "Sonnenblume");
  assert.equal(state.moderationResponses?.[0]?.changed, true);
  assert.deepEqual(state.publicResponses, []);
});

test("publish exposes only sanitized text and hide removes only the public projection", () => {
  const published = resultState(true, "OPEN");
  assert.deepEqual(published.publicResponses, [{
    submissionId: 91,
    publicText: "Sonnenblume",
  }]);
  assert.equal(JSON.stringify(published.publicResponses).includes("P3nis"), false);
  assert.equal(JSON.stringify(published.publicResponses).includes("Team A"), false);
  assert.deepEqual(resultState(false, "OPEN").publicResponses, []);
  assert.equal(resultState(false, "OPEN").moderationResponses?.[0]?.originalText, "P3nis");
});

test("evaluation consumes the original submission and close preserves moderation", () => {
  const answer = storedAnswer(true);
  const effective = resolveEffectiveSubmission({
    interactionRunId: answer.interaction_run_id,
    draft: answer,
    submissions: answer.submissions,
  });

  assert.equal(effective?.answerText, "P3nis");
  assert.notEqual(effective?.answerText as string | null, "Sonnenblume");
  assert.equal(resultState(true, "CLOSED").moderationResponses?.[0]?.originalText, "P3nis");
  assert.equal(resultState(true, "CLOSED").publicResponses[0]?.publicText, "Sonnenblume");
  assert.equal(isQuizInteractionWritable("CLOSED", null, new Date()), false);
});
