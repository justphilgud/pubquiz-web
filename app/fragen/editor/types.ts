export type QuestionPresentationMode = "AUTO" | "OPEN" | "CLOSED";

export type QuestionStatus = "DRAFT" | "READY" | "NOT_APPROVED" | "APPROVED";

export type QuestionAnswerDraft = {
  id: string;
  answerId?: number;
  answerFieldId?: number;
  solutionId?: number;
  fieldGroupId?: string;
  fieldLabel?: string;
  isRequired?: boolean;
  text: string;
  isCorrect: boolean;
  additionalInfo: string;
  media: QuestionMediaDraft | null;
};

export type QuestionCategory = {
  id: number;
  name: string;
};

export type QuestionMediaType = "IMAGE" | "AUDIO" | "VIDEO";

export type MediaSlotKey =
  | "question_image"
  | "question_audio"
  | "question_video"
  | "answer_image"
  | "face_morph_result"
  | "face_morph_person_a_original"
  | "face_morph_person_b_original"
  | "music_original_audio"
  | "music_reverse_audio"
  | "music_bitcrush_audio"
  | "pixel_original_image"
  | "pixel_result_image"
  | "pixel_stage_3_image"
  | "pixel_stage_2_image"
  | "pixel_stage_1_image"
  | "lyrics_tts_audio";

export type QuestionMediaOperation = "UNCHANGED" | "NEW" | "REMOVE";

export type GeneratorId =
  | "audio_reverse"
  | "audio_bitcrush"
  | "audio_chiptune"
  | "image_pixelate"
  | "image_face_morph"
  | "text_to_speech";

export type GeneratorRunStatus =
  | "PENDING"
  | "PROCESSING"
  | "SUCCEEDED"
  | "FAILED"
  | "STALE"
  | "CANCELLED";

export type GeneratorParameters =
  | { preset?: never; stagePreset?: never }
  | { preset: "classic" }
  | { stagePreset: "three_stage_default_v1" };

export type PixelStageDurationsSeconds = {
  stage3: number;
  stage2: number;
  stage1: number;
};

export type FaceMorphPixelQuestionOptionKey = "answer1" | "answer2";

export type FaceMorphPixelQuestionOptions = Record<
  FaceMorphPixelQuestionOptionKey,
  boolean
>;

export type QuestionTemplateConfig = {
  stageDurationsSeconds: PixelStageDurationsSeconds;
  createPixelQuestionByAnswer: FaceMorphPixelQuestionOptions;
};

export type GeneratorParametersDraft = Partial<
  Record<GeneratorId, GeneratorParameters>
>;

export type GeneratorRunDraft = {
  id: number;
  generatorId: GeneratorId;
  generatorVersion: number;
  status: GeneratorRunStatus;
  inputFingerprint: string | null;
  errorCode: string | null;
  parameters: GeneratorParameters;
  inputMediaIds: number[];
  outputMediaIds: number[];
};

export type QuestionMediaDraft = {
  slotKey: MediaSlotKey;
  existingMediaId: number | null;
  url: string | null;
  mediaType: QuestionMediaType | null;
  fileName?: string;
  mimeType?: string;
  operation: QuestionMediaOperation;
  existingMediaCount: number;
  blockedReason?: string;
  blockedReasonCode?:
    | "MULTIPLE_QUESTION_MEDIA"
    | "UNSUPPORTED_QUESTION_MEDIA_TYPE"
    | "UNKNOWN_MEDIA_SLOT"
    | "MEDIA_SLOT_CONFLICT"
    | "MULTIPLE_ANSWER_MEDIA"
    | "UNSUPPORTED_ANSWER_MEDIA_TYPE";
  blockedReasonParams?: Record<string, string | number>;
};

export type QuestionMediaSlotConfig = {
  key: MediaSlotKey;
  allowedMediaType: QuestionMediaType;
  required: boolean;
  label: string;
  helpText?: string;
  manualUploadAllowed: boolean;
  generatorInput: boolean;
  generatorOutput: boolean;
};

export type QuestionEditorDraft = {
  templateId: string | null;
  questionText: string;
  questionMedia: QuestionMediaDraft[];
  generatorRuns?: GeneratorRunDraft[];
  generatorParameters?: GeneratorParametersDraft;
  templateConfig: QuestionTemplateConfig;
  answers: QuestionAnswerDraft[];

  categoryIds: number[];

  sourceOrRemark: string;
  moderationNotes: string;
  categoryRequest: string;
  approvalRemark: string;

  isIncomplete: boolean;
  validUntil: string | null;
  status: QuestionStatus;
};

export type QuestionTemplate = {
  id: string;
  selectable: boolean;
  requiresAnswerImages: boolean;
  name: string;
  description: string;
  defaultQuestionText: string;

  /**
   * Describes the future general question-media capability independently from
   * a template-specific required slot. The editor intentionally does not
   * render this optional slot yet.
   */
  allowsOptionalQuestionImage: boolean;

  initialAnswers: Array<{
    fieldLabel?: string;
    text?: string;
    isCorrect?: boolean;
  }>;

  mediaSlots: QuestionMediaSlotConfig[];
  generators: GeneratorId[];
};

export type QuestionTemplateDefinition = {
  id: string;
  selectable: boolean;
  requiresAnswerImages: boolean;
  translationKey: "standard" | "multipleChoice" | "faceMorph" | "musicReverse" | "musicEightBit" | "pixelImage";
  allowsOptionalQuestionImage: boolean;
  initialAnswers: Array<{
    fieldLabelKey?: "personA" | "personB" | "artist" | "title" | "solution";
    isCorrect?: boolean;
  }>;
  mediaSlots: Array<{ slotKey: MediaSlotKey; required: boolean }>;
  generators: GeneratorId[];
};

export type QuestionSaveIntent =
  | "DRAFT"
  | "SUBMIT_FOR_REVIEW"
  | "APPROVE"
  | "REQUEST_CHANGES";

export type QuestionEditorErrorCode =
  | "INVALID_SAVE_ACTION"
  | "PERMISSION_DENIED"
  | "QUESTION_NOT_FOUND"
  | "UNKNOWN_TEMPLATE"
  | "VALIDATION_ERROR"
  | "CONFLICT"
  | "UNEXPECTED_ERROR"
  | "UNKNOWN_ERROR";

export type QuestionEditorSuccessCode =
  | "draftCreated"
  | "draftUpdated"
  | "submittedCreated"
  | "submittedUpdated"
  | "changesRequested"
  | "approvedCreated"
  | "approvedUpdated";

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
  isArchived: boolean;
};

export type QuestionValidationTarget =
  | "questionText"
  | "questionMedia"
  | "answers"
  | "categories"
  | "validUntil";

export type SaveQuestionPayload = {
  questionId?: number;
  intent: QuestionSaveIntent;
  questionText: string;
  questionMedia: QuestionMediaDraft[];
  answers: Array<
    Omit<QuestionAnswerDraft, "id"> & {
      clientId: string;
    }
  >;
  categoryIds: number[];
  sourceOrRemark: string;
  moderationNotes: string;
  categoryRequest: string;
  validUntil: string | null;
  templateId: string | null;
  generatorParameters?: GeneratorParametersDraft;
  templateConfig: QuestionTemplateConfig;
  reviewReasonCodes?: ReviewReasonCode[];
  reviewComment?: string;
};

export type FaceMorphPixelQuestionSyncResult = {
  children: Array<{
    answerPosition: 1 | 2;
    questionId: number;
    status: "SUCCEEDED" | "FAILED";
    errorCode?: string;
  }>;
  detachedQuestionIds: number[];
  errorCode?: "FACE_MORPH_PIXEL_SYNC_FAILED";
};

export type SaveQuestionResult =
  | {
      success: true;
      questionId: number;
      affectedQuestionIds: number[];
      messageCode: QuestionEditorSuccessCode;
      messageParams: Record<string, string | number>;
      fallbackMessage: string;
      questionMedia: QuestionMediaDraft[];
      answers: Array<{
        clientId: string;
        answerId?: number;
        answerFieldId?: number;
        solutionId?: number;
        media: QuestionMediaDraft | null;
      }>;
      pixelQuestionSync?: FaceMorphPixelQuestionSyncResult;
    }
  | {
      success: false;
      errorCode: QuestionEditorErrorCode;
      errorParams?: Record<string, string | number>;
      fallbackMessage: string;
      validationTarget?: QuestionValidationTarget;
    };
