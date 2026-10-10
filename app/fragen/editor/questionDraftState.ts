import type {
  QuestionAnswerDraft,
  QuestionEditorDraft,
  SaveQuestionResult,
} from "./types";

export function getQuestionDraftFingerprint(draft: QuestionEditorDraft): string {
  return JSON.stringify(draft);
}

export function applySavedAnswerState(
  answers: QuestionAnswerDraft[],
  result: Extract<SaveQuestionResult, { success: true }>,
): QuestionAnswerDraft[] {
  return answers.map((answer) => {
    const savedAnswer = result.answers.find(
      (candidate) => candidate.clientId === answer.id,
    );

    return savedAnswer
      ? {
          ...answer,
          answerId: savedAnswer.answerId,
          answerFieldId: savedAnswer.answerFieldId,
          solutionId: savedAnswer.solutionId,
          media: savedAnswer.media,
        }
      : answer;
  });
}

export function removeAnswerById(
  answers: QuestionAnswerDraft[],
  answerId: string,
): QuestionAnswerDraft[] {
  return answers.filter((answer) => answer.id !== answerId);
}
