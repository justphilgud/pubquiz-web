export type QuestionPresentationMode = "AUTO" | "OPEN" | "CLOSED";

export type QuestionStatus = "DRAFT" | "READY" | "NOT_APPROVED" | "APPROVED";

export type QuestionAnswerDraft = {
  id: string;
  fieldGroupId?: string;
  fieldLabel?: string;
  isRequired?: boolean;
  text: string;
  isCorrect: boolean;
  additionalInfo: string;
};

export type QuestionCategory = {
  id: number;
  name: string;
};

export type QuestionEditorDraft = {
  templateId: string | null;
  questionText: string;
  answers: QuestionAnswerDraft[];

  categoryIds: number[];

  sourceOrRemark: string;
  moderationNotes: string;
  approvalRemark: string;

  isIncomplete: boolean;
  validUntil: string | null;
  status: QuestionStatus;
};

export type QuestionTemplate = {
  id: string;
  name: string;
  description: string;
  defaultQuestionText: string;

  initialAnswers: Array<{
    fieldLabel?: string;
    text?: string;
    isCorrect?: boolean;
  }>;

  requiresQuestionMedia?: boolean;
};

export type QuestionSaveIntent =
  | "DRAFT"
  | "SUBMIT_FOR_REVIEW"
  | "APPROVE"
  | "REQUEST_CHANGES";

export type QuestionEditorContext = "create" | "edit" | "review" | "readOnly";

export type PendingQuestionSaveAction =
  | "SAVE_DRAFT"
  | "SAVE_DRAFT_AND_NEW"
  | "SUBMIT_FOR_REVIEW"
  | "APPROVE"
  | "REQUEST_CHANGES";

export type ReviewReasonCode =
  | "SOURCE"
  | "QUESTION_TEXT"
  | "ANSWER"
  | "CATEGORIES"
  | "MEDIA"
  | "ADDITIONAL_INFO"
  | "OTHER";

export type QuestionEditorRecord = {
  questionId: number;
  reviewStatus: "DRAFT" | "IN_REVIEW" | "CHANGES_REQUESTED" | "APPROVED";
  reviewFeedback: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  creatorName: string;
  submittedByName: string | null;
  reviewedByName: string | null;
  approvedByName: string | null;
  lastModifiedByName: string | null;
  createdAt: string;
  updatedAt: string;
  approvedAt: string | null;
  templateName: string | null;
};

export type QuestionValidationTarget =
  | "questionText"
  | "answers"
  | "categories"
  | "validUntil";

export type SaveQuestionPayload = {
  questionId?: number;
  intent: QuestionSaveIntent;
  questionText: string;
  answers: Array<Omit<QuestionAnswerDraft, "id">>;
  categoryIds: number[];
  sourceOrRemark: string;
  moderationNotes: string;
  validUntil: string | null;
  templateId: string | null;
  reviewReasonCodes?: ReviewReasonCode[];
  reviewComment?: string;
};

export type SaveQuestionResult =
  | {
      success: true;
      questionId: number;
      message: string;
    }
  | {
      success: false;
      message: string;
      validationTarget?: QuestionValidationTarget;
    };
