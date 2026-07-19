export type TeamAnswerAuthorizationFacts = {
  requestedQuizId: number;
  requestedSectionId: number;
  requestedQuizQuestionId: number;
  sessionQuizId: number;
  assignmentQuizId: number;
  assignmentSectionId: number | null;
  releasedSectionId: number | null;
  blockIsReleased: boolean;
  blockIsClosed: boolean;
  visibleQuizQuestionIds: readonly number[];
  requestedAnswerId: number | null;
  allowedAnswerIds: readonly number[];
  requestedAnswerFieldIds: readonly number[];
  allowedAnswerFieldIds: readonly number[];
};

export class TeamAnswerAuthorizationError extends Error {
  constructor(public readonly code: string) {
    super("Die Teamantwort ist für diese Sitzung nicht zulässig.");
    this.name = "TeamAnswerAuthorizationError";
  }
}

export function assertTeamAnswerAuthorized(facts: TeamAnswerAuthorizationFacts) {
  if (facts.sessionQuizId !== facts.requestedQuizId) {
    throw new TeamAnswerAuthorizationError("SESSION_QUIZ_MISMATCH");
  }
  if (facts.assignmentQuizId !== facts.requestedQuizId) {
    throw new TeamAnswerAuthorizationError("QUESTION_QUIZ_MISMATCH");
  }
  if (
    facts.assignmentSectionId !== facts.requestedSectionId ||
    facts.releasedSectionId !== facts.requestedSectionId
  ) {
    throw new TeamAnswerAuthorizationError("QUESTION_SECTION_MISMATCH");
  }
  if (!facts.blockIsReleased || facts.blockIsClosed) {
    throw new TeamAnswerAuthorizationError("BLOCK_NOT_OPEN");
  }
  if (!facts.visibleQuizQuestionIds.includes(facts.requestedQuizQuestionId)) {
    throw new TeamAnswerAuthorizationError("QUESTION_NOT_RELEASED");
  }
  if (
    facts.requestedAnswerId !== null &&
    !facts.allowedAnswerIds.includes(facts.requestedAnswerId)
  ) {
    throw new TeamAnswerAuthorizationError("ANSWER_NOT_OWNED_BY_QUESTION");
  }

  const uniqueFieldIds = new Set(facts.requestedAnswerFieldIds);
  if (uniqueFieldIds.size !== facts.requestedAnswerFieldIds.length) {
    throw new TeamAnswerAuthorizationError("DUPLICATE_ANSWER_FIELD");
  }
  if (
    facts.requestedAnswerFieldIds.some(
      (fieldId) => !facts.allowedAnswerFieldIds.includes(fieldId),
    )
  ) {
    throw new TeamAnswerAuthorizationError("ANSWER_FIELD_NOT_OWNED_BY_QUESTION");
  }
}
