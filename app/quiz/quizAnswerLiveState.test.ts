import assert from "node:assert/strict";
import test from "node:test";

import {
  resolvePresentationAudienceState,
  type PresentationAudienceState,
} from "@/app/rendering/presentation/presentationLiveState";
import {
  canSaveQuizAnswerForPresentation,
  selectQuizAnswerAssignments,
} from "./quizAnswerLiveState";

const productiveQuestionKinds = [
  { templateId: null, label: "offene Frage" },
  { templateId: "multiple_choice", label: "Multiple Choice" },
  { templateId: "wahr_falsch", label: "Wahr/Falsch" },
  { templateId: "schaetzfrage", label: "Schätzfrage" },
  { templateId: "reihenfolge", label: "Reihenfolge" },
  { templateId: "musik_rueckwaerts", label: "Audiofrage" },
  { templateId: null, label: "Bildfrage", hasImage: true },
  { templateId: "pixelbild", label: "Pixel-Reveal" },
  { templateId: null, label: "strukturierte Antwort", hasFields: true },
] as const;

test("stable live state selects every productive question kind by assignment id", () => {
  for (const [index, fixture] of productiveQuestionKinds.entries()) {
    const assignment = {
      quiz_fragen_id: index + 100,
      fragen_id: index + 1,
      templateId: fixture.templateId,
      hasImage: "hasImage" in fixture && fixture.hasImage,
      hasFields: "hasFields" in fixture && fixture.hasFields,
      label: fixture.label,
    };
    const audienceState = resolvePresentationAudienceState(
      { slideKey: `question:${assignment.quiz_fragen_id}:question` },
      [{
        questionAssignmentId: assignment.quiz_fragen_id,
        questionId: assignment.fragen_id,
        sectionId: 10,
      }],
    );

    assert.deepEqual(
      selectQuizAnswerAssignments(audienceState, [
        { ...assignment, quiz_fragen_id: 999 },
        assignment,
      ]),
      [assignment],
      fixture.label,
    );
  }
});

test("solution and non-question phases never expose an editable assignment", () => {
  const assignment = { quiz_fragen_id: 12 };
  const identities = [
    resolvePresentationAudienceState(
      { slideKey: "question:12:solution" },
      [{ questionAssignmentId: 12, questionId: 2, sectionId: 4 }],
    ),
    resolvePresentationAudienceState(
      { slideKey: "flow:7:BREAK" },
      [{ questionAssignmentId: 12, questionId: 2, sectionId: 4 }],
    ),
    resolvePresentationAudienceState(
      { slideKey: "question:999:question" },
      [{ questionAssignmentId: 12, questionId: 2, sectionId: 4 }],
    ),
  ];

  for (const state of identities) {
    assert.deepEqual(selectQuizAnswerAssignments(state, [assignment]), []);
    assert.equal(canSaveQuizAnswerForPresentation(state, 12), false);
  }
});

test("only the currently keyed question can be saved", () => {
  const state = resolvePresentationAudienceState(
    { slideKey: "question:22:question" },
    [{ questionAssignmentId: 22, questionId: 2, sectionId: 4 }],
  );
  assert.equal(canSaveQuizAnswerForPresentation(state, 22), true);
  assert.equal(canSaveQuizAnswerForPresentation(state, 21), false);
});

test("reload and sequence changes preserve the keyed question", () => {
  const resolve = () => resolvePresentationAudienceState(
    { slideKey: "question:22:question" },
    [
      { questionAssignmentId: 21, questionId: 1, sectionId: 4 },
      { questionAssignmentId: 22, questionId: 2, sectionId: 4 },
    ],
  );
  const beforeReload = resolve();
  const afterReload = resolve();
  assert.deepEqual(afterReload, beforeReload);
  assert.equal(
    (afterReload as Extract<PresentationAudienceState, { kind: "QUESTION" }>)
      .questionAssignmentId,
    22,
  );
});

test("legacy quizzes retain their released-question list", () => {
  const state = resolvePresentationAudienceState({ slideKey: null }, []);
  const assignments = [
    { quiz_fragen_id: 1 },
    { quiz_fragen_id: 2 },
    { quiz_fragen_id: 3 },
  ];
  assert.deepEqual(
    selectQuizAnswerAssignments(state, assignments, [1, 2]),
    assignments.slice(0, 2),
  );
});
