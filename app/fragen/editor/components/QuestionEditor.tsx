"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { QuestionEditorCapabilities } from "@/app/lib/permissions";
import type { BlobEnvironmentPrefix } from "@/app/lib/blobPath";
import { saveQuestion } from "../actions";
import {
  findQuestionTemplate,
  questionTemplateIds,
  resolveCanonicalQuestionTemplateId,
} from "../templates/questionTemplateRegistry";
import {
  analyzeQuestionTemplateChange,
  applyQuestionTemplateToDraft,
  clearQuestionTemplateFromDraft,
  getActiveQuestionMediaSlots,
} from "../questionTemplateDraft";
import { AdditionalDetailsSection } from "./AdditionalDetailsSection";
import { AnswersSection } from "./AnswersSection";
import { EditorSaveActions } from "./EditorSaveActions";
import { QuestionReviewPanel } from "./QuestionReviewPanel";
import { QuestionMediaSlot } from "./QuestionMediaSlot";
import { ReviewFeedbackDialog } from "./ReviewFeedbackDialog";
import { QuestionSection } from "./QuestionSection";
import { QuestionMediaSection } from "./QuestionMediaSection";
import { QuestionGenerators } from "./QuestionGenerators";
import { QuestionManagementActions } from "./QuestionManagementActions";
import { TemplateSelector } from "./TemplateSelector";
import { evaluateQuestionQuality } from "../questionQuality";
import type {
  QuestionAnswerDraft,
  QuestionCategory,
  QuestionEditorContext,
  QuestionEditorDraft,
  QuestionEditorRecord,
  QuestionMediaDraft,
  QuestionSaveIntent,
  QuestionTemplate,
  QuestionValidationTarget,
  PendingQuestionSaveAction,
  ReviewReasonCode,
} from "../types";
import type { AppLocale } from "@/app/i18n/locale";
import type { QuestionEditorMessages } from "@/app/i18n/messageTypes";
import { formatMessage } from "@/app/i18n/formatMessage";
import {
  formatQuestionEditorError,
  formatQuestionEditorSuccess,
  formatQuestionQualityIssue,
} from "../questionEditorLocalization";
import { QuestionEditorMessagesProvider } from "./QuestionEditorMessagesProvider";
import {
  DEFAULT_PIXEL_TEMPLATE_CONFIG,
  NEW_FACE_MORPH_PIXEL_QUESTION_OPTIONS,
  getFaceMorphPixelQuestionOptionsForTemplate,
  updateFaceMorphPixelQuestionOption,
  withFaceMorphPixelQuestionOptions,
  withoutFaceMorphPixelQuestionOptions,
} from "../pixelTemplateConfig";
import { PixelStageTimingFields } from "./PixelStageTimingFields";
import { getGeneratorDefinition } from "../generators/registry";
import {
  applySavedAnswerState,
  getQuestionDraftFingerprint,
  removeAnswerById,
} from "../questionDraftState";
import { findSimilarQuestions, type SimilarQuestion } from "../duplicateActions";

function createId(): string {
  return crypto.randomUUID();
}

function getLocalDateInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function createAnswer(
  answer?: QuestionTemplate["initialAnswers"][number],
  id: string = createId(),
): QuestionAnswerDraft {
  return {
    id,
    fieldGroupId: answer?.fieldLabel ? id : undefined,
    fieldLabel: answer?.fieldLabel,
    isRequired: answer?.fieldLabel ? true : undefined,
    text: answer?.text ?? "",
    isCorrect: answer?.isCorrect ?? false,
    additionalInfo: "",
    media: null,
  };
}

function createInitialDraft(): QuestionEditorDraft {
  return {
    templateId: null,
    questionText: "",
    questionMedia: [],
    generatorRuns: [],
    generatorParameters: {},
    templateConfig: DEFAULT_PIXEL_TEMPLATE_CONFIG,
    answers: [createAnswer({ isCorrect: true }, "initial-answer")],

    categoryIds: [],

    sourceOrRemark: "",
    moderationNotes: "",
    categoryRequest: "",
    approvalRemark: "",

    isIncomplete: true,
    validUntil: null,
    status: "DRAFT",
  };
}

type QuestionEditorProps = {
  capabilities: QuestionEditorCapabilities;
  categories: QuestionCategory[];
  editorContext: QuestionEditorContext;
  initialDraft?: QuestionEditorDraft;
  questionRecord?: QuestionEditorRecord;
  mediaUploadPathnamePrefix: BlobEnvironmentPrefix;
  locale: AppLocale;
  messages: QuestionEditorMessages;
  templates: QuestionTemplate[];
};

export function QuestionEditor({
  capabilities,
  categories,
  editorContext,
  initialDraft,
  questionRecord,
  mediaUploadPathnamePrefix,
  locale,
  messages,
  templates,
}: QuestionEditorProps) {
  const specialQuestionTemplates = templates.filter(
    (template) => template.selectable,
  );
  const router = useRouter();
  const [draft, setDraft] = useState<QuestionEditorDraft>(() =>
    initialDraft ?? createInitialDraft(),
  );
  const retainedFaceMorphPixelOptionsRef = useRef(
    initialDraft?.templateConfig.createPixelQuestionByAnswer ??
      NEW_FACE_MORPH_PIXEL_QUESTION_OPTIONS,
  );
  const [savedDraftFingerprint, setSavedDraftFingerprint] = useState(() =>
    getQuestionDraftFingerprint(initialDraft ?? createInitialDraft()),
  );
  const [savedQuestionId, setSavedQuestionId] = useState<number | null>(
    questionRecord?.questionId ?? null,
  );
  const [isReviewFeedbackOpen, setIsReviewFeedbackOpen] = useState(false);
  const [reviewFeedbackError, setReviewFeedbackError] = useState<string | null>(
    null,
  );
  const [pendingAction, setPendingAction] =
    useState<PendingQuestionSaveAction | null>(null);
  const [questionMediaUploadStatuses, setQuestionMediaUploadStatuses] = useState<
    Record<string, "IDLE" | "UPLOADING" | "ERROR">
  >({});
  const [answerMediaUploadStatuses, setAnswerMediaUploadStatuses] = useState<
    Record<string, "IDLE" | "UPLOADING" | "ERROR">
  >({});
  const [saveMessage, setSaveMessage] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);
  const [pixelQuestionSync, setPixelQuestionSync] = useState<
    import("../types").FaceMorphPixelQuestionSyncResult | null
  >(null);
  const [similarQuestions, setSimilarQuestions] = useState<SimilarQuestion[]>([]);
  const [fieldError, setFieldError] = useState<{
    target: QuestionValidationTarget;
    text: string;
  } | null>(null);
  const saveInProgressRef = useRef(false);
  const allowNavigationRef = useRef(false);
  const questionTextRef = useRef<HTMLTextAreaElement>(null);

  const selectedTemplate = useMemo(
    () => draft.templateId === null
      ? null
      : findQuestionTemplate(templates, draft.templateId),
    [draft.templateId, templates],
  );
  const quality = useMemo(() => evaluateQuestionQuality(draft), [draft]);
  const currentDraftFingerprint = useMemo(
    () => getQuestionDraftFingerprint(draft),
    [draft],
  );
  const hasUnsavedChanges = currentDraftFingerprint !== savedDraftFingerprint;
  const isReadOnly = editorContext === "readOnly";
  const isEditorDisabled = isReadOnly || pendingAction !== null;
  const mediaTemplate = selectedTemplate ?? findQuestionTemplate(templates, questionTemplateIds.standard);
  const activeMediaSlots = useMemo(
    () => getActiveQuestionMediaSlots(mediaTemplate, draft.questionMedia, messages),
    [draft.questionMedia, mediaTemplate, messages],
  );

  useEffect(() => {
    let active = true;
    const questionText = draft.questionText.trim();
    const timer = window.setTimeout(() => {
      if (questionText.length < 12) {
        setSimilarQuestions([]);
        return;
      }
      void findSimilarQuestions(questionText, savedQuestionId ?? undefined)
        .then((result) => {
          if (active) setSimilarQuestions(result);
        })
        .catch(() => {
          if (active) setSimilarQuestions([]);
        });
    }, 500);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [draft.questionText, savedQuestionId]);

  useEffect(() => {
    if (!hasUnsavedChanges || isReadOnly) return;

    const confirmNavigation = () => {
      if (allowNavigationRef.current) return true;
      const confirmed = window.confirm(messages.editor.unsavedChanges);
      if (confirmed) allowNavigationRef.current = true;
      return confirmed;
    };
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (allowNavigationRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    const handleDocumentClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const target = new URL(anchor.href, window.location.href);
      if (target.origin !== window.location.origin || target.href === window.location.href) return;
      if (!confirmNavigation()) event.preventDefault();
    };
    const handlePopState = () => {
      if (!confirmNavigation()) window.history.forward();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("popstate", handlePopState);
    document.addEventListener("click", handleDocumentClick, true);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("popstate", handlePopState);
      document.removeEventListener("click", handleDocumentClick, true);
    };
  }, [hasUnsavedChanges, isReadOnly, messages.editor.unsavedChanges]);

  function applyTemplate(template: QuestionTemplate): boolean {
    if (
      template.id === resolveCanonicalQuestionTemplateId(draft.templateId)
    ) {
      return true;
    }

    const impact = analyzeQuestionTemplateChange(draft, template);
    const warningParts = [];

    if (impact.overwritesContent) {
      warningParts.push(messages.editor.templateChangeContent);
    }

    if (impact.retainsQuestionMedia) {
      warningParts.push(messages.editor.templateChangeMediaRetained);
    }

    if (impact.hasRequiredMediaTypeConflict) {
      warningParts.push(
        messages.editor.templateChangeMediaConflict,
      );
    }

    if (
      warningParts.length > 0 &&
      !window.confirm(
        formatMessage(messages.editor.templateChangeConfirm, {
          details: warningParts.join(" "),
        }),
      )
    ) {
      return false;
    }

    setDraft((current) => {
      if (
        resolveCanonicalQuestionTemplateId(current.templateId) ===
        questionTemplateIds.faceMorph
      ) {
        retainedFaceMorphPixelOptionsRef.current =
          current.templateConfig.createPixelQuestionByAnswer;
      }

      const changedDraft = applyQuestionTemplateToDraft(
        current,
        template,
        createId,
      );

      return {
        ...changedDraft,
        templateConfig:
          template.id === questionTemplateIds.faceMorph
            ? withFaceMorphPixelQuestionOptions(
                changedDraft.templateConfig,
                retainedFaceMorphPixelOptionsRef.current,
              )
            : withoutFaceMorphPixelQuestionOptions(
                changedDraft.templateConfig,
              ),
      };
    });

    return true;
  }

  function clearTemplateSelection() {
    setDraft((current) => {
      if (
        resolveCanonicalQuestionTemplateId(current.templateId) ===
        questionTemplateIds.faceMorph
      ) {
        retainedFaceMorphPixelOptionsRef.current =
          current.templateConfig.createPixelQuestionByAnswer;
      }

      const changedDraft = clearQuestionTemplateFromDraft(current);
      return {
        ...changedDraft,
        templateConfig: withoutFaceMorphPixelQuestionOptions(
          changedDraft.templateConfig,
        ),
      };
    });
  }

  function updateAnswer(
    answerId: string,
    changes: Partial<QuestionAnswerDraft>,
  ) {
    if (fieldError?.target === "answers") setFieldError(null);
    setDraft((current) => ({
      ...current,
      answers: current.answers.map((answer) =>
        answer.id === answerId ? { ...answer, ...changes } : answer,
      ),
    }));
  }

  function addAnswer() {
    if (fieldError?.target === "answers") setFieldError(null);
    setDraft((current) => ({
      ...current,
      answers: [...current.answers, createAnswer()],
    }));
  }

  function removeAnswer(answerId: string) {
    const answer = draft.answers.find((candidate) => candidate.id === answerId);
    const containsRelevantData = Boolean(
      answer &&
        (answer.answerId ||
          answer.answerFieldId ||
          answer.solutionId ||
          answer.text.trim() ||
          answer.additionalInfo.trim() ||
          answer.media),
    );
    if (containsRelevantData && !window.confirm(messages.answers.removeConfirm)) {
      return;
    }
    if (fieldError?.target === "answers") setFieldError(null);
    setDraft((current) => {
      if (current.answers.length <= 1) {
        return current;
      }

      return {
        ...current,
        answers: removeAnswerById(current.answers, answerId),
      };
    });
  }

  function updateAnswerMedia(
    answerId: string,
    media: QuestionMediaDraft | null,
  ) {
    if (fieldError?.target === "answers") setFieldError(null);
    setDraft((current) => {
      const source = current.answers.find((answer) => answer.id === answerId);

      if (!source) {
        return current;
      }

      return {
        ...current,
        answers: current.answers.map((answer) =>
          answer.id === answerId ||
          (source.fieldGroupId && answer.fieldGroupId === source.fieldGroupId)
            ? { ...answer, media }
            : answer,
        ),
      };
    });
  }

  function changeCategories(categoryIds: number[]) {
    setDraft((current) => ({
      ...current,
      categoryIds,
    }));
  }

  function focusValidationTarget(target?: QuestionValidationTarget) {
    if (target === "questionText") {
      questionTextRef.current?.focus();
      return;
    }

    if (target === "answers") {
      document
        .querySelector<HTMLInputElement>("[data-editor-answer-input]")
        ?.focus();
      return;
    }

    if (target === "questionMedia") {
      const mediaSection = document.querySelector<HTMLElement>(
        "[data-editor-question-media]",
      );
      mediaSection?.scrollIntoView({ behavior: "smooth", block: "center" });
      mediaSection?.querySelector<HTMLInputElement>('input[type="file"]')?.focus();
      return;
    }

    if (target === "validUntil") {
      document
        .querySelector<HTMLInputElement>("[data-editor-valid-until]")
        ?.focus();
    }
  }

  async function handleSave(
    intent: QuestionSaveIntent,
    action: PendingQuestionSaveAction,
    options?: {
      resetAfterSuccess?: boolean;
      reviewReasonCodes?: ReviewReasonCode[];
      reviewComment?: string;
    },
  ) {
    if (selectedTemplate?.requiresAnswerImages) {
      const faceMorphBlocker = quality.blockers.find(
        (issue) =>
          issue.code === "ANSWER_MEDIA_REQUIRED" ||
          issue.code === "MEDIA_SLOT_REQUIRED",
      );
      if (faceMorphBlocker) {
        const text = formatQuestionQualityIssue(faceMorphBlocker, messages);
        const target = faceMorphBlocker.field ?? "answers";
        setSaveMessage({ tone: "error", text });
        setFieldError({ target, text });
        focusValidationTarget(target);
        return;
      }
    }
    const isAnswerMediaUploading = Object.values(
      answerMediaUploadStatuses,
    ).includes("UPLOADING");

    if (
      Object.values(questionMediaUploadStatuses).includes("UPLOADING") ||
      isAnswerMediaUploading
    ) {
      setSaveMessage({
        tone: "error",
        text: messages.editor.uploadPending,
      });
      focusValidationTarget(
        isAnswerMediaUploading ? "answers" : "questionMedia",
      );
      return;
    }

    if (saveInProgressRef.current) {
      return;
    }

    saveInProgressRef.current = true;
    setPendingAction(action);
    setSaveMessage(null);
    setPixelQuestionSync(null);
    setFieldError(null);
    if (intent === "REQUEST_CHANGES") {
      setReviewFeedbackError(null);
    }

    try {
      const submittedDraft = draft;
      const result = await saveQuestion({
        questionId: savedQuestionId ?? undefined,
        intent,
        questionText: draft.questionText,
        questionMedia: draft.questionMedia,
        answers: draft.answers.map((answer) => ({
          clientId: answer.id,
          answerId: answer.answerId,
          answerFieldId: answer.answerFieldId,
          solutionId: answer.solutionId,
          fieldGroupId: answer.fieldGroupId,
          fieldLabel: answer.fieldLabel,
          isRequired: answer.isRequired,
          text: answer.text,
          isCorrect: answer.isCorrect,
          additionalInfo: answer.additionalInfo,
          media: answer.media,
        })),
        categoryIds: draft.categoryIds,
        sourceOrRemark: draft.sourceOrRemark,
        moderationNotes: draft.moderationNotes,
        categoryRequest: draft.categoryRequest,
        validUntil: draft.validUntil,
        templateId: draft.templateId,
        generatorParameters: draft.generatorParameters,
        templateConfig: draft.templateConfig,
        reviewReasonCodes: options?.reviewReasonCodes,
        reviewComment: options?.reviewComment,
      });

      setSaveMessage({
        tone: result.success ? "success" : "error",
        text: result.success
          ? formatQuestionEditorSuccess(
              result.messageCode,
              messages,
              result.messageParams,
            )
          : formatQuestionEditorError(
              result.errorCode,
              messages,
              result.fallbackMessage,
              result.errorParams,
            ),
      });

      if (result.success) {
        setPixelQuestionSync(result.pixelQuestionSync ?? null);
        const pixelSyncFailed = Boolean(
          result.pixelQuestionSync?.errorCode ||
            result.pixelQuestionSync?.children.some(
              (child) => child.status === "FAILED",
            ),
        );
        if (intent !== "DRAFT" && !pixelSyncFailed) {
          allowNavigationRef.current = true;
          setIsReviewFeedbackOpen(false);
          router.push("/fragen");
          router.refresh();
        } else if (options?.resetAfterSuccess) {
          const resetDraft = createInitialDraft();
          retainedFaceMorphPixelOptionsRef.current = {
            ...NEW_FACE_MORPH_PIXEL_QUESTION_OPTIONS,
          };
          setDraft(resetDraft);
          setSavedDraftFingerprint(getQuestionDraftFingerprint(resetDraft));
          setSavedQuestionId(null);
          requestAnimationFrame(() => questionTextRef.current?.focus());
        } else {
          setSavedQuestionId(result.questionId);
          const savedDraft = {
            ...submittedDraft,
            questionMedia: result.questionMedia,
            answers: applySavedAnswerState(submittedDraft.answers, result),
          };
          setSavedDraftFingerprint(getQuestionDraftFingerprint(savedDraft));
          setDraft((current) => ({
            ...current,
            questionMedia: result.questionMedia,
            answers: applySavedAnswerState(current.answers, result),
          }));
          setQuestionMediaUploadStatuses({});
          setAnswerMediaUploadStatuses({});
        }
      } else {
        if (result.validationTarget) {
          setFieldError({
            target: result.validationTarget,
            text: formatQuestionEditorError(
              result.errorCode,
              messages,
              result.fallbackMessage,
              result.errorParams,
            ),
          });
        }
        if (intent === "REQUEST_CHANGES") {
          setReviewFeedbackError(
            formatQuestionEditorError(
              result.errorCode,
              messages,
              result.fallbackMessage,
              result.errorParams,
            ),
          );
        }
        focusValidationTarget(result.validationTarget);
      }
    } catch (error) {
      console.error("Frage speichern fehlgeschlagen", error);
      setSaveMessage({
        tone: "error",
        text: messages.editor.saveUnexpected,
      });
      if (intent === "REQUEST_CHANGES") {
        setReviewFeedbackError(
          messages.editor.requestChangesUnexpected,
        );
      }
    } finally {
      saveInProgressRef.current = false;
      setPendingAction(null);
    }
  }

  function handleWorkflowSave() {
    const firstBlocker = quality.blockers[0];
    if (firstBlocker) {
      const text = formatQuestionQualityIssue(firstBlocker, messages);
      setSaveMessage({ tone: "error", text });
      if (firstBlocker.field) {
        setFieldError({ target: firstBlocker.field, text });
        focusValidationTarget(firstBlocker.field);
      }
      return;
    }
    const requiredMediaSlot = selectedTemplate?.mediaSlots.find((slot) => slot.required);
    const requiredMedia = requiredMediaSlot
      ? draft.questionMedia.find((media) => media.slotKey === requiredMediaSlot.key)
      : null;

    const isLegacyReverseOutput =
      selectedTemplate?.id === questionTemplateIds.musicReverse &&
      (draft.generatorRuns ?? []).length === 0 &&
      !draft.questionMedia.some((media) => media.slotKey === "music_original_audio" && media.operation !== "REMOVE" && media.url) &&
      draft.questionMedia.some((media) => media.slotKey === "music_reverse_audio" && media.operation !== "REMOVE" && media.url);

    if (
      !isLegacyReverseOutput &&
      requiredMediaSlot?.required &&
      (!requiredMedia ||
        requiredMedia.operation === "REMOVE" ||
        !requiredMedia.url ||
        requiredMedia.mediaType !== requiredMediaSlot.allowedMediaType ||
        (requiredMedia.blockedReason || requiredMedia.blockedReasonCode))
    ) {
      setSaveMessage({
        tone: "error",
        text: formatMessage(messages.editor.requiredTemplateMedia, {
          label: requiredMediaSlot.label,
        }),
      });
      focusValidationTarget("questionMedia");
      return;
    }

    const generatorBlocker = quality.blockers.find((issue) => issue.code.startsWith("GENERATOR_"));
    if (generatorBlocker) {
      setSaveMessage({ tone: "error", text: formatQuestionQualityIssue(generatorBlocker, messages) });
      focusValidationTarget("questionMedia");
      return;
    }

    if (capabilities.canApproveQuestion) {
      if (editorContext === "review" && quality.blockers.length > 0) {
        setSaveMessage({
          tone: "error",
          text: formatMessage(messages.editor.approvalBlocked, {
            issues: quality.blockers
              .map((issue) => formatQuestionQualityIssue(issue, messages))
              .join("; "),
          }),
        });
        return;
      }

      void handleSave("APPROVE", "APPROVE");
      return;
    }

    if (capabilities.canSubmitForReview) {
      void handleSave("SUBMIT_FOR_REVIEW", "SUBMIT_FOR_REVIEW");
    }
  }

  function requestChanges(
    reviewReasonCodes: ReviewReasonCode[],
    reviewComment: string,
  ) {
    void handleSave("REQUEST_CHANGES", "REQUEST_CHANGES", {
      reviewReasonCodes,
      reviewComment,
    });
  }

  const pageTitle = messages.editor.titles[editorContext];
  const workflowIdleLabel =
    questionRecord?.reviewStatus === "CHANGES_REQUESTED" &&
    capabilities.canSubmitForReview
      ? messages.editor.resubmit
      : undefined;
  const showSaveActions =
    !isReadOnly &&
    (capabilities.canSaveDraft ||
      capabilities.canSubmitForReview ||
      capabilities.canApproveQuestion ||
      capabilities.canRequestQuestionChanges);

  return (
    <QuestionEditorMessagesProvider locale={locale} messages={messages}>
    <main
      className={`mx-auto flex w-full max-w-4xl flex-col gap-6 overflow-x-clip px-3 py-4 sm:px-4 sm:py-6 ${
        showSaveActions ? "pb-64 sm:pb-28" : "pb-8"
      }`}
    >
      <header>
        <p className="text-sm text-slate-500">{messages.editor.eyebrow}</p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold text-slate-950">{pageTitle}</h1>
          {editorContext !== "create" && (
            <Link
              href="/fragen"
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
            >
              {messages.editor.back}
            </Link>
          )}
        </div>
      </header>

      {questionRecord && (
        <QuestionReviewPanel
          record={questionRecord}
          editorContext={editorContext}
          quality={quality}
        />
      )}

      {questionRecord && (
        <QuestionManagementActions
          capabilities={capabilities}
          record={questionRecord}
        />
      )}

      {questionRecord?.isArchived && (
        <div role="status" className="rounded-2xl border border-slate-300 bg-slate-100 p-4 text-sm text-slate-800">
          <p className="font-semibold">{messages.editor.archivedTitle}</p>
        </div>
      )}

      {draft.validUntil && draft.validUntil < getLocalDateInputValue() && (
        <div role="alert" className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-semibold">{messages.editor.expiredTitle}</p>
          <p className="mt-1">{messages.editor.expiredHelp}</p>
        </div>
      )}

      <fieldset
        disabled={isEditorDisabled}
        aria-busy={pendingAction !== null}
        className="min-w-0 space-y-6 border-0 p-0 disabled:opacity-90"
      >
        <TemplateSelector
          templates={specialQuestionTemplates}
          selectedTemplateId={draft.templateId}
          selectedTemplate={selectedTemplate}
          onSelectTemplate={applyTemplate}
          onClearSelection={clearTemplateSelection}
        />

        <QuestionSection
          questionText={draft.questionText}
          questionTextRef={questionTextRef}
          onQuestionTextChange={(questionText) => {
            if (fieldError?.target === "questionText") setFieldError(null);
            setDraft((current) => ({
              ...current,
              questionText,
            }));
          }}
          validationError={fieldError?.target === "questionText" ? fieldError.text : null}
          mediaContent={
            <QuestionMediaSection
              slots={activeMediaSlots}
              media={draft.questionMedia}
              uploadStatuses={questionMediaUploadStatuses}
              generatorRuns={draft.generatorRuns ?? []}
              validationError={fieldError?.target === "questionMedia" ? fieldError.text : null}
            >
              {activeMediaSlots.map((slot) => {
                const media = draft.questionMedia.find((candidate) => candidate.slotKey === slot.key) ?? null;
                return <QuestionMediaSlot
                  key={slot.key}
                  slot={slot}
                  media={media}
                  questionId={savedQuestionId}
                  templateId={draft.templateId}
                  pathnamePrefix={mediaUploadPathnamePrefix}
                  disabled={isEditorDisabled}
                  onUploadStatusChange={(status) => setQuestionMediaUploadStatuses((current) => ({ ...current, [slot.key]: status }))}
                  onChange={(changedMedia) => setDraft((current) => ({
                    ...current,
                    questionMedia: changedMedia
                      ? [...current.questionMedia.filter((candidate) => candidate.slotKey !== slot.key), changedMedia]
                      : current.questionMedia.filter((candidate) => candidate.slotKey !== slot.key),
                    generatorRuns: (current.generatorRuns ?? []).map((run) => {
                      const definition = getGeneratorDefinition(run.generatorId);
                      return run.status === "SUCCEEDED" && definition &&
                        [...definition.inputSlots, ...definition.outputSlots].includes(slot.key as never)
                        ? { ...run, status: "STALE" }
                        : run;
                    }),
                  }))}
                />;
              })}
              {mediaTemplate && (
                <QuestionGenerators
                  generatorIds={mediaTemplate.generators}
                  questionId={savedQuestionId}
                  media={draft.questionMedia}
                  runs={draft.generatorRuns ?? []}
                  parameters={draft.generatorParameters ?? {}}
                  disabled={isEditorDisabled}
                  onStateChange={(state) => setDraft((current) => ({
                    ...current,
                    questionMedia: state.questionMedia,
                    generatorRuns: state.generatorRuns,
                  }))}
                />
              )}
              {mediaTemplate?.id === questionTemplateIds.pixelImage && (
                <PixelStageTimingFields
                  value={draft.templateConfig.stageDurationsSeconds}
                  disabled={isEditorDisabled}
                  onChange={(stageDurationsSeconds) => setDraft((current) => ({
                    ...current,
                    templateConfig: {
                      ...current.templateConfig,
                      stageDurationsSeconds,
                    },
                  }))}
                />
              )}
            </QuestionMediaSection>
          }
        />

        {similarQuestions.length > 0 && (
          <aside className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
            <h2 className="font-semibold">{messages.editor.duplicateTitle}</h2>
            <p className="mt-1">{messages.editor.duplicateHelp}</p>
            <ul className="mt-3 space-y-2">
              {similarQuestions.map((question) => (
                <li key={question.questionId}>
                  <Link
                    href={`/fragen/editor/${question.questionId}`}
                    target="_blank"
                    className="font-medium underline"
                  >
                    #{question.questionId}: {question.questionText}
                  </Link>
                </li>
              ))}
            </ul>
          </aside>
        )}

        <AnswersSection
          answers={draft.answers}
          questionId={savedQuestionId}
          pathnamePrefix={mediaUploadPathnamePrefix}
          disabled={isEditorDisabled}
          validationError={fieldError?.target === "answers" ? fieldError.text : null}
          requireAnswerImages={selectedTemplate?.requiresAnswerImages ?? false}
          faceMorphPixelQuestionOptions={
            getFaceMorphPixelQuestionOptionsForTemplate(
              draft.templateConfig,
              selectedTemplate?.id ?? null,
            )
          }
          onFaceMorphPixelQuestionOptionChange={(option, checked) => {
            retainedFaceMorphPixelOptionsRef.current = {
              ...retainedFaceMorphPixelOptionsRef.current,
              [option]: checked,
            };
            setDraft((current) => ({
              ...current,
              templateConfig: updateFaceMorphPixelQuestionOption(
                current.templateConfig,
                option,
                checked,
              ),
            }));
          }}
          onAnswerChange={updateAnswer}
          onAddAnswer={addAnswer}
          onRemoveAnswer={removeAnswer}
          onAnswerMediaChange={updateAnswerMedia}
          onAnswerMediaUploadStatusChange={(answerId, status) =>
            setAnswerMediaUploadStatuses((current) => ({
              ...current,
              [answerId]: status,
            }))
          }
        />

        <AdditionalDetailsSection
          categories={categories}
          selectedCategoryIds={draft.categoryIds}
          sourceOrRemark={draft.sourceOrRemark}
          moderationNotes={draft.moderationNotes}
          categoryRequest={draft.categoryRequest}
          validUntil={draft.validUntil}
          initiallyOpen={editorContext === "review" || isReadOnly}
          onChangeCategories={changeCategories}
          onSourceOrRemarkChange={(sourceOrRemark) =>
            setDraft((current) => ({
              ...current,
              sourceOrRemark,
            }))
          }
          onModerationNotesChange={(moderationNotes) =>
            setDraft((current) => ({
              ...current,
              moderationNotes,
            }))
          }
          onCategoryRequestChange={(categoryRequest) =>
            setDraft((current) => ({
              ...current,
              categoryRequest,
            }))
          }
          onValidUntilChange={(validUntil) =>
            setDraft((current) => ({
              ...current,
              validUntil,
            }))
          }
          canManageCategories={capabilities.canManageCategories}
        />
      </fieldset>

      {pixelQuestionSync &&
        (pixelQuestionSync.errorCode ||
          pixelQuestionSync.children.some((child) => child.status === "FAILED")) && (
          <div
            role="alert"
            className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"
          >
            <p className="font-semibold">{messages.editor.pixelQuestionSyncFailed}</p>
            {pixelQuestionSync.children
              .filter((child) => child.status === "FAILED")
              .map((child) => (
                <Link
                  key={child.questionId}
                  href={`/fragen/editor/${child.questionId}`}
                  className="mt-2 block font-semibold underline"
                >
                  {formatMessage(messages.editor.openPixelQuestion, {
                    position: child.answerPosition,
                    id: child.questionId,
                  })}
                </Link>
              ))}
          </div>
        )}

      {showSaveActions && (
        <EditorSaveActions
          capabilities={capabilities}
          pendingAction={pendingAction}
          message={saveMessage}
          showDraftActions={editorContext !== "review"}
          allowStartNewQuestion={editorContext === "create"}
          workflowIdleLabel={workflowIdleLabel}
          onSaveDraft={(startNewQuestion) =>
            void handleSave(
              "DRAFT",
              startNewQuestion ? "SAVE_DRAFT_AND_NEW" : "SAVE_DRAFT",
              { resetAfterSuccess: startNewQuestion },
            )
          }
          onRunWorkflow={handleWorkflowSave}
          onRequestChanges={() => {
            setReviewFeedbackError(null);
            setIsReviewFeedbackOpen(true);
          }}
        />
      )}

      <ReviewFeedbackDialog
        open={isReviewFeedbackOpen}
        isPending={pendingAction === "REQUEST_CHANGES"}
        submissionError={reviewFeedbackError}
        onClose={() => setIsReviewFeedbackOpen(false)}
        onConfirm={requestChanges}
      />
    </main>
    </QuestionEditorMessagesProvider>
  );
}
