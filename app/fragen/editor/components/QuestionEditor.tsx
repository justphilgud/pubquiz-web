"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { QuestionEditorCapabilities } from "@/app/lib/permissions";
import { saveQuestion } from "../actions";
import { questionTemplates } from "../templates/questionTemplates";
import { AdditionalDetailsSection } from "./AdditionalDetailsSection";
import { AnswersSection } from "./AnswersSection";
import { EditorSaveActions } from "./EditorSaveActions";
import { QuestionReviewPanel } from "./QuestionReviewPanel";
import { ReviewFeedbackDialog } from "./ReviewFeedbackDialog";
import { QuestionSection } from "./QuestionSection";
import { TemplateSelector } from "./TemplateSelector";
import { evaluateQuestionQuality } from "../questionQuality";
import type {
  QuestionAnswerDraft,
  QuestionCategory,
  QuestionEditorContext,
  QuestionEditorDraft,
  QuestionEditorRecord,
  QuestionSaveIntent,
  QuestionTemplate,
  QuestionValidationTarget,
  PendingQuestionSaveAction,
  ReviewReasonCode,
} from "../types";

function createId(): string {
  return crypto.randomUUID();
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
  };
}

function createInitialDraft(): QuestionEditorDraft {
  return {
    templateId: null,
    questionText: "",
    answers: [createAnswer({ isCorrect: true }, "initial-answer")],

    categoryIds: [],

    sourceOrRemark: "",
    moderationNotes: "",
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
};

const visibleSpecialQuestionTemplateIds = new Set([
  "facemorph",
  "music-reverse",
]);

const specialQuestionTemplates = questionTemplates.filter((template) =>
  visibleSpecialQuestionTemplateIds.has(template.id),
);

export function QuestionEditor({
  capabilities,
  categories,
  editorContext,
  initialDraft,
  questionRecord,
}: QuestionEditorProps) {
  const router = useRouter();
  const [draft, setDraft] = useState<QuestionEditorDraft>(() =>
    initialDraft ?? createInitialDraft(),
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
  const [saveMessage, setSaveMessage] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);
  const saveInProgressRef = useRef(false);
  const questionTextRef = useRef<HTMLTextAreaElement>(null);

  const selectedTemplate = useMemo(
    () =>
      questionTemplates.find((template) => template.id === draft.templateId) ??
      null,
    [draft.templateId],
  );
  const quality = useMemo(() => evaluateQuestionQuality(draft), [draft]);
  const isReadOnly = editorContext === "readOnly";

  function applyTemplate(template: QuestionTemplate): boolean {
    if (template.id === draft.templateId) {
      return true;
    }

    const wouldOverwriteContent =
      draft.templateId !== null ||
      draft.questionText.trim().length > 0 ||
      draft.answers.length !== 1 ||
      draft.answers.some(
        (answer) =>
          answer.text.trim().length > 0 ||
          answer.additionalInfo.trim().length > 0,
      );

    if (
      wouldOverwriteContent &&
      !window.confirm(
        "Beim Wechsel der Spezialfrage werden Fragetext und Antworten ersetzt. Möchtest du fortfahren?",
      )
    ) {
      return false;
    }

    setDraft((current) => ({
      ...current,
      templateId: template.id,
      questionText: template.defaultQuestionText,
      answers: template.initialAnswers.map((answer) => createAnswer(answer)),
    }));

    return true;
  }

  function updateAnswer(
    answerId: string,
    changes: Partial<QuestionAnswerDraft>,
  ) {
    setDraft((current) => ({
      ...current,
      answers: current.answers.map((answer) =>
        answer.id === answerId ? { ...answer, ...changes } : answer,
      ),
    }));
  }

  function addAnswer() {
    setDraft((current) => ({
      ...current,
      answers: [...current.answers, createAnswer()],
    }));
  }

  function removeAnswer(answerId: string) {
    setDraft((current) => {
      if (current.answers.length <= 1) {
        return current;
      }

      return {
        ...current,
        answers: current.answers.filter((answer) => answer.id !== answerId),
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
    if (saveInProgressRef.current) {
      return;
    }

    saveInProgressRef.current = true;
    setPendingAction(action);
    setSaveMessage(null);
    if (intent === "REQUEST_CHANGES") {
      setReviewFeedbackError(null);
    }

    try {
      const result = await saveQuestion({
        questionId: savedQuestionId ?? undefined,
        intent,
        questionText: draft.questionText,
        answers: draft.answers.map((answer) => ({
          fieldGroupId: answer.fieldGroupId,
          fieldLabel: answer.fieldLabel,
          isRequired: answer.isRequired,
          text: answer.text,
          isCorrect: answer.isCorrect,
          additionalInfo: answer.additionalInfo,
        })),
        categoryIds: draft.categoryIds,
        sourceOrRemark: draft.sourceOrRemark,
        moderationNotes: draft.moderationNotes,
        validUntil: draft.validUntil,
        templateId: draft.templateId,
        reviewReasonCodes: options?.reviewReasonCodes,
        reviewComment: options?.reviewComment,
      });

      setSaveMessage({
        tone: result.success ? "success" : "error",
        text: result.message,
      });

      if (result.success) {
        if (intent !== "DRAFT") {
          setIsReviewFeedbackOpen(false);
          router.push("/fragen");
          router.refresh();
        } else if (options?.resetAfterSuccess) {
          setDraft(createInitialDraft());
          setSavedQuestionId(null);
          requestAnimationFrame(() => questionTextRef.current?.focus());
        } else {
          setSavedQuestionId(result.questionId);
        }
      } else {
        if (intent === "REQUEST_CHANGES") {
          setReviewFeedbackError(result.message);
        }
        focusValidationTarget(result.validationTarget);
      }
    } catch (error) {
      console.error("Frage speichern fehlgeschlagen", error);
      setSaveMessage({
        tone: "error",
        text: "Die Frage konnte nicht gespeichert werden. Bitte versuche es erneut.",
      });
      if (intent === "REQUEST_CHANGES") {
        setReviewFeedbackError(
          "Die Frage konnte nicht zurückgegeben werden. Bitte versuche es erneut.",
        );
      }
    } finally {
      saveInProgressRef.current = false;
      setPendingAction(null);
    }
  }

  function handleWorkflowSave() {
    if (capabilities.canApproveQuestion) {
      if (editorContext === "review" && quality.blockers.length > 0) {
        setSaveMessage({
          tone: "error",
          text: `Die Frage kann noch nicht freigegeben werden: ${quality.blockers.join("; ")}.`,
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

  const pageTitle = {
    create: "Neue Frage",
    edit: "Frage bearbeiten",
    review: "Frage prüfen",
    readOnly: "Eingereichte Frage",
  }[editorContext];
  const workflowIdleLabel =
    questionRecord?.reviewStatus === "CHANGES_REQUESTED" &&
    capabilities.canSubmitForReview
      ? "Erneut zur Prüfung einreichen"
      : undefined;
  const showSaveActions =
    !isReadOnly &&
    (capabilities.canSaveDraft ||
      capabilities.canSubmitForReview ||
      capabilities.canApproveQuestion ||
      capabilities.canRequestQuestionChanges);

  return (
    <main
      className={`mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 ${
        showSaveActions ? "pb-28" : "pb-8"
      }`}
    >
      <header>
        <p className="text-sm text-slate-500">Fragenverwaltung</p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold text-slate-950">{pageTitle}</h1>
          {editorContext !== "create" && (
            <Link
              href="/fragen"
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
            >
              Zurück zu Fragen
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

      <fieldset
        disabled={isReadOnly}
        className="min-w-0 space-y-6 border-0 p-0 disabled:opacity-90"
      >
        <TemplateSelector
          templates={specialQuestionTemplates}
          selectedTemplateId={draft.templateId}
          selectedTemplate={selectedTemplate}
          onSelectTemplate={applyTemplate}
          onClearSelection={() =>
            setDraft((current) => ({
              ...current,
              templateId: null,
            }))
          }
        />

        <QuestionSection
          questionText={draft.questionText}
          questionTextRef={questionTextRef}
          onQuestionTextChange={(questionText) =>
            setDraft((current) => ({
              ...current,
              questionText,
            }))
          }
        />

        <AnswersSection
          answers={draft.answers}
          onAnswerChange={updateAnswer}
          onAddAnswer={addAnswer}
          onRemoveAnswer={removeAnswer}
        />

        <AdditionalDetailsSection
          categories={categories}
          selectedCategoryIds={draft.categoryIds}
          sourceOrRemark={draft.sourceOrRemark}
          moderationNotes={draft.moderationNotes}
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
          onValidUntilChange={(validUntil) =>
            setDraft((current) => ({
              ...current,
              validUntil,
            }))
          }
        />
      </fieldset>

      {showSaveActions && (
        <EditorSaveActions
          capabilities={capabilities}
          editorContext={editorContext}
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
  );
}
