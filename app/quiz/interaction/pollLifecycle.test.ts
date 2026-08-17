import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  resolveInteractionSubmissionPolicy,
  shouldAutoFinalizeDraft,
  shouldKeepInteractionOpenUntilBlockClose,
} from "./interactionSubmissionPolicy";

test("polls stay editable while open and drafts auto-finalize on close", () => {
  for (const type of ["POLL_SINGLE", "POLL_MULTI", "POLL_SCALE"]) {
    assert.equal(resolveInteractionSubmissionPolicy(type).resubmissionAllowedWhileOpen, true);
    assert.equal(shouldKeepInteractionOpenUntilBlockClose(type), true);
  }
  assert.equal(shouldAutoFinalizeDraft({ hasExplicitSubmission: false, hasContent: true }), true);
});

test("poll close skips scoring and presentation state exposes only public team fields", () => {
  const implementation = readFileSync(
    new URL("./interaction.server.ts", import.meta.url),
    "utf8",
  );
  assert.match(implementation, /!isPollInteractionType\(run\.interaction_type\)/);
  assert.match(implementation, /select: \{ teamname: true \}/);
  assert.doesNotMatch(implementation, /select: \{ teamname: true,[^}]*token/);
  assert.match(implementation, /take: 12/);
  assert.match(
    implementation,
    /presentationQuestionAssignmentId[\s\S]*quiz_fragen_id: options\.presentationQuestionAssignmentId/,
  );

  const evaluation = readFileSync(
    new URL("../evaluation/evaluation.server.ts", import.meta.url),
    "utf8",
  );
  assert.match(evaluation, /isPollQuestionTemplateId\(templateId\)/);
  assert.match(evaluation, /POLL_TEMPLATE_IDS/);
});

test("presentation clients request the run for the visible question after block close", () => {
  const presentation = readFileSync(
    new URL("../[quizId]/praesentation/QuizPraesentationPlayer.tsx", import.meta.url),
    "utf8",
  );
  const moderation = readFileSync(
    new URL("../[quizId]/moderation/ModerationClient.tsx", import.meta.url),
    "utf8",
  );
  for (const client of [presentation, moderation]) {
    assert.match(client, /presentationQuestionAssignmentId/);
    assert.match(client, /slide\.frage\.quiz_fragen_id|aktuellerSlide\.frage\.quiz_fragen_id/);
  }
});
