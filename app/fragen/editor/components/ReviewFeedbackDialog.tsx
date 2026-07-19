"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import type { ReviewReasonCode } from "../types";
import { useQuestionEditorMessages } from "./QuestionEditorMessagesProvider";

const reasons: ReviewReasonCode[] = ["SOURCE", "QUESTION_TEXT", "ANSWER", "CATEGORIES", "MEDIA", "ADDITIONAL_INFO", "OTHER"];

export function ReviewFeedbackDialog({
  open,
  isPending,
  submissionError,
  onClose,
  onConfirm,
}: {
  open: boolean;
  isPending: boolean;
  submissionError?: string | null;
  onClose: () => void;
  onConfirm: (reasonCodes: ReviewReasonCode[], comment: string) => void;
}) {
  const { messages } = useQuestionEditorMessages();
  const [selectedReasons, setSelectedReasons] = useState<ReviewReasonCode[]>([]);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);

  function close() {
    if (!isPending) {
      setSelectedReasons([]);
      setComment("");
      setError(null);
      onClose();
    }
  }

  function toggleReason(reason: ReviewReasonCode) {
    setSelectedReasons((current) =>
      current.includes(reason)
        ? current.filter((item) => item !== reason)
        : [...current, reason],
    );
    setError(null);
  }

  function confirm() {
    const normalizedComment = comment.trim();

    if (selectedReasons.length === 0 && !normalizedComment) {
      setError(messages.review.reasonRequired);
      return;
    }

    if (selectedReasons.includes("OTHER") && !normalizedComment) {
      setError(messages.review.otherRequired);
      return;
    }

    onConfirm(selectedReasons, normalizedComment);
  }

  return (
    <Modal
      open={open}
      title={messages.review.returnTitle}
      onClose={close}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={close} disabled={isPending}>
            {messages.common.cancel}
          </Button>
          <Button variant="danger" onClick={confirm} disabled={isPending}>
            {isPending ? messages.review.returning : messages.review.returnAction}
          </Button>
        </div>
      }
    >
      <p className="text-sm text-slate-600">
        {messages.review.returnDescription}
      </p>
      <div className="mt-4 space-y-2">
        {reasons.map((reason) => (
          <label
            key={reason}
            className="flex min-h-11 items-center gap-3 rounded-xl border border-slate-200 px-3 py-2"
          >
            <input
              type="checkbox"
              checked={selectedReasons.includes(reason)}
              onChange={() => toggleReason(reason)}
              className="h-5 w-5"
            />
            <span className="text-sm font-medium text-slate-800">
              {messages.review.reasons[reason]}
            </span>
          </label>
        ))}
      </div>
      <label className="mt-4 block">
        <span className="text-sm font-medium text-slate-900">
          {messages.review.additionalHint}
        </span>
        <textarea
          value={comment}
          maxLength={1000}
          onChange={(event) => {
            setComment(event.target.value);
            setError(null);
          }}
          rows={4}
          className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"
          placeholder={messages.review.hintPlaceholder}
        />
        <span className="mt-1 block text-right text-xs text-slate-500">
          {comment.length}/1000
        </span>
      </label>
      {(error || submissionError) && (
        <p role="alert" className="mt-3 text-sm font-medium text-red-700">
          {error || submissionError}
        </p>
      )}
    </Modal>
  );
}
