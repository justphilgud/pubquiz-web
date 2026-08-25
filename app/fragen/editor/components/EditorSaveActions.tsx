"use client";

import ContentEditorActionBar from "@/app/components/content/ContentEditorActionBar";
import type { ReactNode } from "react";
import type { QuestionEditorCapabilities } from "@/app/lib/permissions";
import type { PendingQuestionSaveAction } from "../types";
import { useQuestionEditorMessages } from "./QuestionEditorMessagesProvider";

type SaveMessage = { tone: "success" | "error"; text: string };

export function EditorSaveActions({ capabilities, pendingAction, message, showDraftActions = true, workflowIdleLabel, secondaryOption, onCancel, onSaveDraft, onRunWorkflow, onRequestChanges }: {
  capabilities: QuestionEditorCapabilities;
  pendingAction: PendingQuestionSaveAction | null;
  message: SaveMessage | null;
  showDraftActions?: boolean;
  allowStartNewQuestion?: boolean;
  workflowIdleLabel?: string;
  secondaryOption?: ReactNode;
  onCancel: () => void;
  onSaveDraft: (startNewQuestion: boolean) => void;
  onRunWorkflow: () => void;
  onRequestChanges?: () => void;
}) {
  const { messages } = useQuestionEditorMessages();
  const workflowLabel = capabilities.canApproveQuestion
    ? pendingAction === "APPROVE" ? messages.save.approving : workflowIdleLabel ?? messages.save.saveAndApprove
    : pendingAction === "SUBMIT_FOR_REVIEW" ? messages.save.submitting : workflowIdleLabel ?? messages.save.submit;
  const showRequestChanges = capabilities.canRequestQuestionChanges && onRequestChanges;
  const draftLabel = showRequestChanges
    ? pendingAction === "REQUEST_CHANGES" ? messages.review.returning : messages.save.requestChanges
    : pendingAction === "SAVE_DRAFT" ? messages.save.saving : messages.save.saveDraft;
  return <ContentEditorActionBar
    pending={pendingAction !== null}
    onCancel={onCancel}
    onSaveDraft={showRequestChanges ? onRequestChanges : showDraftActions && capabilities.canSaveDraft ? () => onSaveDraft(false) : undefined}
    onPublish={capabilities.canApproveQuestion || capabilities.canSubmitForReview ? onRunWorkflow : undefined}
    draftLabel={draftLabel}
    publishLabel={workflowLabel}
    secondaryOption={secondaryOption}
    message={message ? <p role={message.tone === "error" ? "alert" : "status"} className={`mb-2 rounded-lg px-3 py-2 text-sm font-medium ${message.tone === "error" ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-800"}`}>{message.text}</p> : undefined}
  />;
}
