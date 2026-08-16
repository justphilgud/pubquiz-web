import assert from "node:assert/strict";
import test from "node:test";

import "./interaction/interactionArchitecture.test";
import "./interaction/interactionPayload.test";
import "./interaction/interactionSubmissionPolicy.test";
import "./interaction/interactionStateMachine.test";

import {
  resolvePresentationAudienceState,
  type PresentationAudienceState,
} from "@/app/rendering/presentation/presentationLiveState";
import {
  canSaveQuizAnswerForPresentation,
  selectQuizAnswerAssignments,
  selectParticipantQuestionMedia,
  selectReleasedQuizAnswerAssignmentIds,
} from "./quizAnswerLiveState";
import {
  isQuizQuestionBlockOpen,
  parseQuizBlockPreviewSectionId,
  serializeQuizParticipantLiveRevision,
  serializeQuizBlockReleaseRevision,
} from "./quizBlockLiveState";

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

test("an open keyed block accumulates every released question", () => {
  const state = resolvePresentationAudienceState(
    { slideKey: "question:3:question" },
    [
      { questionAssignmentId: 1, questionId: 11, sectionId: 4 },
      { questionAssignmentId: 2, questionId: 12, sectionId: 4 },
      { questionAssignmentId: 3, questionId: 13, sectionId: 4 },
    ],
  );
  const assignments = [
    { quiz_fragen_id: 1 },
    { quiz_fragen_id: 2 },
    { quiz_fragen_id: 3 },
    { quiz_fragen_id: 4 },
  ];

  assert.deepEqual(
    selectQuizAnswerAssignments(state, assignments, [1, 2, 3]),
    assignments.slice(0, 3),
  );
});

test("released questions follow opened runs instead of editorial sort order", () => {
  const releasedAt = new Date("2026-08-15T12:00:00.000Z");
  assert.deepEqual(
    selectReleasedQuizAnswerAssignmentIds(
      [1, 2, 3, 4],
      [
        {
          quiz_fragen_id: 3,
          opened_at: new Date("2026-08-15T12:00:03.000Z"),
          is_current: true,
        },
        {
          quiz_fragen_id: 1,
          opened_at: new Date("2026-08-15T11:59:59.000Z"),
          is_current: false,
        },
      ],
      releasedAt,
    ),
    [3],
  );
});

test("released question ids accumulate in stable block order", () => {
  const releasedAt = new Date("2026-08-15T12:00:00.000Z");
  assert.deepEqual(
    selectReleasedQuizAnswerAssignmentIds(
      [1, 2, 3],
      [
        {
          quiz_fragen_id: 3,
          opened_at: new Date("2026-08-15T12:00:03.000Z"),
          is_current: false,
        },
        {
          quiz_fragen_id: 1,
          opened_at: new Date("2026-08-15T12:00:01.000Z"),
          is_current: false,
        },
      ],
      releasedAt,
    ),
    [1, 3],
  );
});

test("a released block remains visible during solution and editorial slides", () => {
  const assignments = [
    { quiz_fragen_id: 1 },
    { quiz_fragen_id: 2 },
    { quiz_fragen_id: 3 },
  ];
  const solution = resolvePresentationAudienceState(
    { slideKey: "question:2:solution" },
    [{ questionAssignmentId: 2, questionId: 12, sectionId: 4 }],
  );
  const editorial = resolvePresentationAudienceState(
    { slideKey: "flow:7:CUSTOM_MESSAGE" },
    [],
  );

  assert.deepEqual(
    selectQuizAnswerAssignments(solution, assignments, [1, 2]),
    assignments.slice(0, 2),
  );
  assert.deepEqual(
    selectQuizAnswerAssignments(editorial, assignments, [1, 2]),
    assignments.slice(0, 2),
  );
});

test("block live revision changes for preview, question release and close", () => {
  const base = {
    quiz_block_freigabe_id: 9,
    quiz_abschnitt_id: 4,
    freigegeben_ab: new Date("2026-08-15T12:00:00.000Z"),
    geschlossen_ab: null,
  };
  const preview = serializeQuizBlockReleaseRevision({
    ...base,
    ist_freigegeben: true,
    ist_geschlossen: false,
    aktuelle_quiz_fragen_id: null,
  });
  const firstQuestion = serializeQuizBlockReleaseRevision({
    ...base,
    ist_freigegeben: true,
    ist_geschlossen: false,
    aktuelle_quiz_fragen_id: 21,
  });
  const closed = serializeQuizBlockReleaseRevision({
    ...base,
    ist_freigegeben: false,
    ist_geschlossen: true,
    aktuelle_quiz_fragen_id: 21,
    geschlossen_ab: new Date("2026-08-15T12:10:00.000Z"),
  });

  assert.notEqual(preview, firstQuestion);
  assert.notEqual(firstQuestion, closed);
});

test("only a question-block intro key opens its section preview", () => {
  assert.equal(parseQuizBlockPreviewSectionId("section:77:intro"), 77);
  assert.equal(parseQuizBlockPreviewSectionId("section:77:break"), null);
  assert.equal(parseQuizBlockPreviewSectionId("question:77:question"), null);
  assert.equal(parseQuizBlockPreviewSectionId("section:0:intro"), null);
});

test("a manual question-block lock stays authoritative", () => {
  assert.equal(isQuizQuestionBlockOpen(undefined), false);
  assert.equal(isQuizQuestionBlockOpen({
    ist_freigegeben: false,
    ist_geschlossen: true,
  }), false);
  assert.equal(isQuizQuestionBlockOpen({
    ist_freigegeben: true,
    ist_geschlossen: true,
  }), false);
  assert.equal(isQuizQuestionBlockOpen({
    ist_freigegeben: true,
    ist_geschlossen: false,
  }), true);
});

test("pixel solution media is withheld until the run is revealed", () => {
  const media = [
    { slot_key: "pixel_original_image", id: 1 },
    { slot_key: "pixel_stage_1_image", id: 2 },
    { slot_key: "pixel_stage_2_image", id: 3 },
    { slot_key: "pixel_stage_3_image", id: 4 },
  ];
  for (const state of ["OPEN", "COUNTDOWN", "CLOSED"]) {
    assert.deepEqual(
      selectParticipantQuestionMedia("pixelbild", state, media)
        .map((medium) => medium.id),
      [2, 3, 4],
      state,
    );
  }
  assert.deepEqual(
    selectParticipantQuestionMedia("pixelbild", "REVEALED", media),
    media,
  );
  assert.deepEqual(
    selectParticipantQuestionMedia("multiple_choice", "OPEN", media),
    media,
  );
});

test("participant revision changes when the same question run changes", () => {
  const release = {
    quiz_block_freigabe_id: 9,
    quiz_abschnitt_id: 4,
    ist_freigegeben: true,
    ist_geschlossen: false,
    aktuelle_quiz_fragen_id: 21,
    freigegeben_ab: new Date("2026-08-15T12:00:00.000Z"),
    geschlossen_ab: null,
  };
  const open = serializeQuizParticipantLiveRevision(release, {
    interaction_run_id: 31,
    state: "OPEN",
    revision: 1,
  });
  const revealed = serializeQuizParticipantLiveRevision(release, {
    interaction_run_id: 31,
    state: "REVEALED",
    revision: 2,
  });
  const reopened = serializeQuizParticipantLiveRevision(release, {
    interaction_run_id: 32,
    state: "OPEN",
    revision: 1,
  });
  assert.notEqual(open, revealed);
  assert.notEqual(revealed, reopened);
});
