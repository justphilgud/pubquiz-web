"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import type {
  PendingCategoryDecision,
  QuestionCategory,
} from "../types";
import { useQuestionEditorMessages } from "./QuestionEditorMessagesProvider";

export function PendingCategoryReviewDialog({
  categories,
  open,
  isPending,
  submissionError,
  onClose,
  onConfirm,
}: {
  categories: QuestionCategory[];
  open: boolean;
  isPending: boolean;
  submissionError?: string | null;
  onClose: () => void;
  onConfirm: (decisions: PendingCategoryDecision[]) => void;
}) {
  const { messages } = useQuestionEditorMessages();
  const [decisions, setDecisions] = useState<
    Record<number, PendingCategoryDecision["action"]>
  >({});

  useEffect(() => {
    if (!open) setDecisions({});
  }, [open]);

  const allDecided = categories.every((category) => decisions[category.id]);

  return (
    <Modal
      open={open}
      title={messages.pendingCategoryReview.title}
      onClose={() => {
        if (!isPending) onClose();
      }}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="secondary"
            disabled={isPending}
            onClick={onClose}
          >
            {messages.common.cancel}
          </Button>
          <Button
            disabled={isPending || !allDecided}
            onClick={() =>
              onConfirm(
                categories.map((category) => ({
                  categoryId: category.id,
                  action: decisions[category.id],
                })),
              )
            }
          >
            {isPending
              ? messages.pendingCategoryReview.approving
              : messages.pendingCategoryReview.confirm}
          </Button>
        </div>
      }
    >
      <p className="text-sm text-slate-600">
        {messages.pendingCategoryReview.description}
      </p>
      <div className="mt-4 space-y-3">
        {categories.map((category) => (
          <fieldset
            key={category.id}
            className="rounded-xl border border-amber-200 bg-amber-50 p-3"
          >
            <legend className="px-1 font-semibold text-slate-950">
              {category.name}
            </legend>
            <div className="mt-2 grid gap-2">
              {(["APPROVE", "DISCARD"] as const).map((action) => (
                <label
                  key={action}
                  className="flex min-h-11 items-center gap-3 rounded-lg bg-white px-3 py-2 text-sm"
                >
                  <input
                    type="radio"
                    name={`pending-category-${category.id}`}
                    checked={decisions[category.id] === action}
                    onChange={() =>
                      setDecisions((current) => ({
                        ...current,
                        [category.id]: action,
                      }))
                    }
                    className="h-5 w-5"
                  />
                  <span>
                    {action === "APPROVE"
                      ? messages.pendingCategoryReview.approveCategory
                      : messages.pendingCategoryReview.discardCategory}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </div>
      <p className="mt-3 text-xs text-slate-500">
        {messages.pendingCategoryReview.discardHint}
      </p>
      {submissionError && (
        <p role="alert" className="mt-3 text-sm font-medium text-red-700">
          {submissionError}
        </p>
      )}
    </Modal>
  );
}
