"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { QuestionEditorCapabilities } from "@/app/lib/permissions";
import type { QuestionEditorRecord } from "../types";
import {
  deleteQuestionPermanently,
  setQuestionArchived,
} from "../managementActions";
import { useQuestionEditorMessages } from "./QuestionEditorMessagesProvider";
import { CloneQuestionButton } from "./CloneQuestionButton";

export function QuestionManagementActions({
  capabilities,
  record,
}: {
  capabilities: QuestionEditorCapabilities;
  record: QuestionEditorRecord;
}) {
  const router = useRouter();
  const { messages } = useQuestionEditorMessages();
  const [pending, setPending] = useState<"clone" | "archive" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleArchive() {
    const nextArchived = !record.isArchived;
    if (!window.confirm(
      nextArchived
        ? messages.management.archiveConfirm
        : messages.management.restoreConfirm,
    )) return;
    setPending("archive");
    setError(null);
    const result = await setQuestionArchived(record.questionId, nextArchived);
    setPending(null);
    if (result.ok) router.refresh();
    else setError(messages.management.errors[result.code]);
  }

  async function handleDelete() {
    if (!window.confirm(messages.management.deleteConfirm)) return;
    setPending("delete");
    setError(null);
    const result = await deleteQuestionPermanently(record.questionId);
    setPending(null);
    if (result.ok) {
      router.push("/fragen");
      router.refresh();
    } else {
      setError(messages.management.errors[result.code]);
    }
  }

  if (
    !capabilities.canCloneQuestion &&
    !capabilities.canArchiveQuestion &&
    !capabilities.canDeleteQuestion
  ) return null;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <h2 className="font-semibold text-slate-950">{messages.management.title}</h2>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {capabilities.canCloneQuestion && (
          <CloneQuestionButton
            questionId={record.questionId}
            label={messages.management.clone}
            pendingLabel={messages.management.cloning}
            errorMessages={messages.management.errors}
            disabled={pending !== null}
            onPendingChange={(isPending) => setPending(isPending ? "clone" : null)}
            className="min-h-11 w-full rounded-xl border border-slate-300 px-4 py-2 font-medium disabled:opacity-60 sm:w-auto"
          />
        )}
        {capabilities.canArchiveQuestion && (
          <button
            type="button"
            onClick={() => void handleArchive()}
            disabled={pending !== null}
            className="min-h-11 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 font-medium text-amber-900 disabled:opacity-60"
          >
            {record.isArchived ? messages.management.restore : messages.management.archive}
          </button>
        )}
        {capabilities.canDeleteQuestion && record.isArchived && (
          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={pending !== null}
            className="min-h-11 rounded-xl border border-red-300 bg-red-50 px-4 py-2 font-medium text-red-800 disabled:opacity-60"
          >
            {pending === "delete" ? messages.management.deleting : messages.management.delete}
          </button>
        )}
      </div>
      {error && <p role="alert" className="mt-3 text-sm font-medium text-red-700">{error}</p>}
    </section>
  );
}
