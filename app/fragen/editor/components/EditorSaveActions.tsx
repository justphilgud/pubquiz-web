"use client";

import { useEffect, useRef, useState } from "react";
import type { QuestionEditorCapabilities } from "@/app/lib/permissions";
import type {
  PendingQuestionSaveAction,
  QuestionEditorContext,
} from "../types";
import { useQuestionEditorMessages } from "./QuestionEditorMessagesProvider";

type SaveMessage = {
  tone: "success" | "error";
  text: string;
};

type EditorSaveActionsProps = {
  capabilities: QuestionEditorCapabilities;
  editorContext: QuestionEditorContext;
  pendingAction: PendingQuestionSaveAction | null;
  message: SaveMessage | null;
  showDraftActions?: boolean;
  allowStartNewQuestion?: boolean;
  workflowIdleLabel?: string;
  onSaveDraft: (startNewQuestion: boolean) => void;
  onRunWorkflow: () => void;
  onRequestChanges?: () => void;
};

export function EditorSaveActions({
  capabilities,
  editorContext,
  pendingAction,
  message,
  showDraftActions = true,
  allowStartNewQuestion = true,
  workflowIdleLabel,
  onSaveDraft,
  onRunWorkflow,
  onRequestChanges,
}: EditorSaveActionsProps) {
  const { messages } = useQuestionEditorMessages();
  const [isDraftMenuOpen, setIsDraftMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isPending = pendingAction !== null;

  useEffect(() => {
    if (!isDraftMenuOpen) {
      return;
    }

    function closeOnOutsideClick(event: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node)
      ) {
        setIsDraftMenuOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsDraftMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isDraftMenuOpen]);

  const workflowLabel = capabilities.canApproveQuestion
    ? pendingAction === "APPROVE"
      ? editorContext === "create"
        ? messages.save.saving
        : messages.save.approving
      : workflowIdleLabel ??
        (editorContext === "create" ? messages.save.saveQuestion : messages.save.approve)
    : pendingAction === "SUBMIT_FOR_REVIEW"
      ? messages.save.submitting
      : workflowIdleLabel ?? messages.save.submit;

  const draftLabel =
    pendingAction === "SAVE_DRAFT_AND_NEW"
      ? messages.save.saveAndNewPending
      : pendingAction === "SAVE_DRAFT"
        ? messages.save.saving
        : messages.save.saveDraft;

  function saveDraft(startNewQuestion: boolean) {
    setIsDraftMenuOpen(false);
    onSaveDraft(startNewQuestion);
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur">
      <div className="mx-auto max-w-4xl">
        {message && (
          <p
            role={message.tone === "error" ? "alert" : "status"}
            className={[
              "mb-2 rounded-lg px-3 py-2 text-sm font-medium",
              message.tone === "error"
                ? "bg-red-50 text-red-800"
                : "bg-emerald-50 text-emerald-800",
            ].join(" ")}
          >
            {message.text}
          </p>
        )}

        <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
          {showDraftActions && capabilities.canSaveDraft && (
            <div ref={menuRef} className="relative flex min-w-0 flex-1">
              {allowStartNewQuestion && isDraftMenuOpen && (
                <div
                  role="menu"
                  className="absolute inset-x-0 bottom-full z-50 mb-2 overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-xl"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => saveDraft(false)}
                    disabled={isPending}
                    className="min-h-11 w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-900 hover:bg-slate-100"
                  >
                    {messages.save.saveDraft}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => saveDraft(true)}
                    disabled={isPending}
                    className="min-h-11 w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-900 hover:bg-slate-100"
                  >
                    {messages.save.saveDraftAndNew}
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => saveDraft(false)}
                disabled={isPending}
                className={`min-w-0 flex-1 border border-slate-300 px-3 py-3 font-medium disabled:cursor-wait disabled:opacity-60 ${
                  allowStartNewQuestion
                    ? "rounded-l-xl border-r-0"
                    : "rounded-xl"
                }`}
              >
                {draftLabel}
              </button>
              {allowStartNewQuestion && (
                <button
                  type="button"
                  aria-label={messages.save.openDraftActions}
                  aria-haspopup="menu"
                  aria-expanded={isDraftMenuOpen}
                  onClick={() => setIsDraftMenuOpen((current) => !current)}
                  disabled={isPending}
                  className="min-h-12 min-w-12 rounded-r-xl border border-slate-300 px-3 text-lg disabled:cursor-wait disabled:opacity-60"
                >
                  <span aria-hidden="true">▾</span>
                </button>
              )}
            </div>
          )}

          {(capabilities.canApproveQuestion ||
            capabilities.canSubmitForReview) && (
            <button
              type="button"
              onClick={onRunWorkflow}
              disabled={isPending}
              className="flex-1 rounded-xl bg-slate-950 px-4 py-3 font-medium text-white disabled:cursor-wait disabled:opacity-60"
            >
              {workflowLabel}
            </button>
          )}

          {capabilities.canRequestQuestionChanges && onRequestChanges && (
            <button
              type="button"
              onClick={onRequestChanges}
              disabled={isPending}
              className="flex-1 rounded-xl border border-red-300 bg-white px-4 py-3 font-medium text-red-800 disabled:cursor-wait disabled:opacity-60"
            >
              {pendingAction === "REQUEST_CHANGES"
                ? messages.review.returning
                : messages.save.requestChanges}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
