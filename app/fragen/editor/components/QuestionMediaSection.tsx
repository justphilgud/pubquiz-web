"use client";

import { useMemo, useState, type ReactNode } from "react";
import { formatMessage } from "@/app/i18n/formatMessage";
import type { QuestionEditorMessages } from "@/app/i18n/messageTypes";
import type {
  GeneratorRunDraft,
  QuestionMediaDraft,
  QuestionMediaSlotConfig,
} from "../types";
import type { MediaUploadStatus } from "./MediaUploadSlot";
import { useQuestionEditorMessages } from "./QuestionEditorMessagesProvider";

type MediaSectionState = {
  slots: readonly QuestionMediaSlotConfig[];
  media: readonly QuestionMediaDraft[];
  uploadStatuses: Readonly<Record<string, MediaUploadStatus>>;
  generatorRuns: readonly GeneratorRunDraft[];
};

function visibleMedia(state: MediaSectionState) {
  return state.media.filter(
    (medium) => medium.operation !== "REMOVE" && Boolean(medium.url),
  );
}

export function hasQuestionMediaProblem(state: MediaSectionState) {
  const media = visibleMedia(state);
  return (
    state.slots.some(
      (slot) => slot.required && !media.some((medium) => medium.slotKey === slot.key),
    ) ||
    state.media.some((medium) => Boolean(medium.blockedReasonCode || medium.blockedReason)) ||
    Object.values(state.uploadStatuses).some((status) => status !== "IDLE") ||
    state.generatorRuns.some((run) =>
      ["PENDING", "PROCESSING", "FAILED", "STALE"].includes(run.status),
    )
  );
}

export function getQuestionMediaSummary(
  state: MediaSectionState,
  messages: QuestionEditorMessages,
) {
  const media = visibleMedia(state);
  const requiredMissing = state.slots.some(
    (slot) => slot.required && !media.some((medium) => medium.slotKey === slot.key),
  );
  if (requiredMissing) return messages.mediaSection.requiredMissing;
  if (state.media.some((medium) => medium.blockedReasonCode || medium.blockedReason)) {
    return messages.mediaSection.conflict;
  }
  if (Object.values(state.uploadStatuses).includes("UPLOADING")) {
    return messages.mediaSection.uploadRunning;
  }
  if (Object.values(state.uploadStatuses).includes("ERROR")) {
    return messages.mediaSection.uploadFailed;
  }
  if (state.generatorRuns.some((run) => run.status === "PROCESSING" || run.status === "PENDING")) {
    return messages.mediaSection.generationRunning;
  }
  if (state.generatorRuns.some((run) => run.status === "FAILED")) {
    return messages.mediaSection.generationFailed;
  }
  if (state.generatorRuns.some((run) => run.status === "STALE")) {
    return messages.mediaSection.outputStale;
  }
  const imageCount = media.filter((medium) => medium.mediaType === "IMAGE").length;
  const audioCount = media.filter((medium) => medium.mediaType === "AUDIO").length;
  if (media.length === 0) return messages.mediaSection.none;
  if (media.length === 1 && imageCount === 1) return messages.mediaSection.oneImage;
  if (media.length === 1 && audioCount === 1) return messages.mediaSection.oneAudio;
  if (media.length === 2 && imageCount === 1 && audioCount === 1) {
    return messages.mediaSection.imageAndAudio;
  }
  return formatMessage(messages.mediaSection.count, { count: media.length });
}

type QuestionMediaSectionProps = MediaSectionState & {
  children: ReactNode;
  validationError?: string | null;
};

export function QuestionMediaSection(props: QuestionMediaSectionProps) {
  const { messages } = useQuestionEditorMessages();
  const problem = useMemo(() => hasQuestionMediaProblem(props), [props]);
  const summary = useMemo(
    () => getQuestionMediaSummary(props, messages),
    [props, messages],
  );
  const [manuallyOpen, setManuallyOpen] = useState(false);
  const open = problem || manuallyOpen;

  return (
    <div data-editor-question-media className="mt-3 border-t border-slate-200 pt-2">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setManuallyOpen((current) => !current)}
        className="flex min-h-11 w-full items-center gap-2 rounded-xl px-2 py-2 text-left hover:bg-slate-50"
        title={open ? messages.mediaSection.collapse : messages.mediaSection.expand}
      >
        <span aria-hidden="true">♪</span>
        <span className="font-medium text-slate-900">{messages.mediaSection.title}</span>
        <span className={`min-w-0 flex-1 truncate text-sm ${problem ? "text-amber-800" : "text-slate-600"}`}>
          · {summary}
        </span>
        {problem && <span aria-hidden="true" className="text-amber-700">!</span>}
        <span aria-hidden="true" className="text-slate-500">{open ? "⌃" : "⌄"}</span>
      </button>
      {open && <div className="space-y-3 pb-2">{props.children}</div>}
      {props.validationError && (
        <p role="alert" className="mb-2 rounded-lg bg-red-50 p-3 text-sm font-medium text-red-800">
          {props.validationError}
        </p>
      )}
    </div>
  );
}
