"use client";

import { useState } from "react";
import type { GeneratorErrorCode } from "../generators/types";
import { getGeneratorDefinition } from "../generators/registry";
import type { GeneratorId, GeneratorRunDraft, QuestionMediaDraft } from "../types";
import type { GeneratorParametersDraft } from "../types";
import { getDefaultGeneratorParameters } from "../generators/parameters";
import { useQuestionEditorMessages } from "./QuestionEditorMessagesProvider";

type GeneratorResponse =
  | { ok: true; reused: boolean; questionMedia: QuestionMediaDraft[]; generatorRuns: GeneratorRunDraft[] }
  | { ok: false; code: GeneratorErrorCode };

type QuestionGeneratorsProps = {
  generatorIds: readonly GeneratorId[];
  questionId: number | null;
  media: readonly QuestionMediaDraft[];
  runs: readonly GeneratorRunDraft[];
  parameters: GeneratorParametersDraft;
  disabled?: boolean;
  onStateChange: (state: { questionMedia: QuestionMediaDraft[]; generatorRuns: GeneratorRunDraft[] }) => void;
};

export function QuestionGenerators({ generatorIds, questionId, media, runs, parameters, disabled, onStateChange }: QuestionGeneratorsProps) {
  const { messages } = useQuestionEditorMessages();
  const [runningId, setRunningId] = useState<GeneratorId | null>(null);
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const active = generatorIds
    .map((id) => getGeneratorDefinition(id))
    .filter((definition) => definition?.active);
  if (active.length === 0) return null;

  return (
    <div className="space-y-3 border-t border-slate-200 pt-3">
      {active.map((definition) => {
        if (!definition) return null;
        const input = media.find((medium) => definition.inputSlots.includes(medium.slotKey as never));
        const latest = runs.find((run) => run.generatorId === definition.id);
        const selectedParameters = parameters[definition.id] ?? latest?.parameters ?? getDefaultGeneratorParameters(definition.id);
        const copy = messages.generators.definitions[definition.labelKey];
        const mustSave = questionId === null || !input?.url || input.operation !== "UNCHANGED" || Boolean(input.blockedReasonCode);
        const busy = runningId === definition.id || latest?.status === "PENDING" || latest?.status === "PROCESSING";
        const stale = latest?.status === "STALE";
        return (
          <div key={definition.id} className="rounded-xl bg-slate-50 p-3">
            <p className="font-medium text-slate-900">{copy.label}</p>
            <p className="mt-1 text-sm text-slate-600">{copy.description}</p>
            {mustSave && <p className="mt-2 text-sm text-amber-800">{messages.generators.saveFirst}</p>}
            {stale && <p className="mt-2 text-sm text-amber-800">{copy.stale}</p>}
            {latest?.status === "FAILED" && <p className="mt-2 text-sm text-red-700">{copy.failed}</p>}
            <button
              type="button"
              disabled={disabled || mustSave || busy}
              onClick={async () => {
                setRunningId(definition.id);
                setFeedback(null);
                try {
                  const response = await fetch("/api/question-generator", {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ questionId, generatorId: definition.id, parameters: selectedParameters }),
                  });
                  const result = await response.json() as GeneratorResponse;
                  if (result.ok) {
                    onStateChange({ questionMedia: result.questionMedia, generatorRuns: result.generatorRuns });
                    setFeedback({ tone: "success", text: result.reused ? messages.generators.reused : copy.succeeded });
                  } else {
                    setFeedback({ tone: "error", text: messages.generators.errors[result.code] ?? messages.generators.failed });
                  }
                } catch {
                  setFeedback({ tone: "error", text: messages.generators.failed });
                } finally {
                  setRunningId(null);
                }
              }}
              className="mt-3 min-h-11 w-full rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              {busy ? copy.running : latest?.status === "SUCCEEDED" || latest?.status === "FAILED" || stale ? copy.regenerate : copy.start}
            </button>
            {feedback && <p role={feedback.tone === "error" ? "alert" : "status"} className={`mt-2 text-sm ${feedback.tone === "error" ? "text-red-700" : "text-emerald-700"}`}>{feedback.text}</p>}
          </div>
        );
      })}
    </div>
  );
}
