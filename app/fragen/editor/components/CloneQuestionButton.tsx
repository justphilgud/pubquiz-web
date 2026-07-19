"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  cloneQuestion,
  type QuestionManagementErrorCode,
} from "../managementActions";

type CloneQuestionButtonProps = {
  questionId: number;
  label: string;
  pendingLabel: string;
  errorMessages: Record<QuestionManagementErrorCode, string>;
  className: string;
  disabled?: boolean;
  onPendingChange?: (pending: boolean) => void;
};

export function CloneQuestionButton({
  questionId,
  label,
  pendingLabel,
  errorMessages,
  className,
  disabled = false,
  onPendingChange,
}: CloneQuestionButtonProps) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClone() {
    setIsPending(true);
    onPendingChange?.(true);
    setError(null);
    try {
      const result = await cloneQuestion(questionId);
      if (result.ok) {
        router.push(`/fragen/editor/${result.questionId}`);
        router.refresh();
        return;
      }
      setError(errorMessages[result.code]);
    } catch {
      setError(errorMessages.UNEXPECTED_ERROR);
    } finally {
      setIsPending(false);
      onPendingChange?.(false);
    }
  }

  return (
    <div className="min-w-0">
      <button
        type="button"
        onClick={() => void handleClone()}
        disabled={disabled || isPending}
        className={className}
      >
        {isPending ? pendingLabel : label}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-sm font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
