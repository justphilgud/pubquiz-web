import assert from "node:assert/strict";
import test from "node:test";
import {
  assertTeamAnswerAuthorized,
  TeamAnswerAuthorizationError,
  type TeamAnswerAuthorizationFacts,
} from "./teamAnswerPolicy";

const validFacts: TeamAnswerAuthorizationFacts = {
  requestedQuizId: 1,
  requestedSectionId: 2,
  requestedQuizQuestionId: 3,
  sessionQuizId: 1,
  assignmentQuizId: 1,
  assignmentSectionId: 2,
  releasedSectionId: 2,
  blockIsReleased: true,
  blockIsClosed: false,
  visibleQuizQuestionIds: [3],
  requestedAnswerId: 4,
  allowedAnswerIds: [4, 5],
  requestedAnswerFieldIds: [6],
  allowedAnswerFieldIds: [6, 7],
};

function expectCode(changes: Partial<TeamAnswerAuthorizationFacts>, code: string) {
  assert.throws(
    () => assertTeamAnswerAuthorized({ ...validFacts, ...changes }),
    (error) =>
      error instanceof TeamAnswerAuthorizationError && error.code === code,
  );
}

test("a fully matching team answer is authorized", () => {
  assert.doesNotThrow(() => assertTeamAnswerAuthorized(validFacts));
});

test("cross-object identifiers are rejected", () => {
  expectCode({ sessionQuizId: 9 }, "SESSION_QUIZ_MISMATCH");
  expectCode({ assignmentQuizId: 9 }, "QUESTION_QUIZ_MISMATCH");
  expectCode({ assignmentSectionId: 9 }, "QUESTION_SECTION_MISMATCH");
  expectCode({ requestedAnswerId: 99 }, "ANSWER_NOT_OWNED_BY_QUESTION");
  expectCode({ requestedAnswerFieldIds: [99] }, "ANSWER_FIELD_NOT_OWNED_BY_QUESTION");
});

test("closed and unreleased state is rejected", () => {
  expectCode({ blockIsReleased: false }, "BLOCK_NOT_OPEN");
  expectCode({ blockIsClosed: true }, "BLOCK_NOT_OPEN");
  expectCode({ visibleQuizQuestionIds: [] }, "QUESTION_NOT_RELEASED");
});

test("duplicate answer fields are rejected", () => {
  expectCode({ requestedAnswerFieldIds: [6, 6] }, "DUPLICATE_ANSWER_FIELD");
});
