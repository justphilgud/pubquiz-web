"use client";

import type { PixelStageDurationsSeconds } from "../types";
import { PIXEL_STAGE_DURATION_MAX_SECONDS, PIXEL_STAGE_DURATION_MIN_SECONDS } from "../pixelTemplateConfig";
import { useQuestionEditorMessages } from "./QuestionEditorMessagesProvider";

type Props = {
  value: PixelStageDurationsSeconds;
  disabled?: boolean;
  onChange: (value: PixelStageDurationsSeconds) => void;
};

export function PixelStageTimingFields({ value, disabled, onChange }: Props) {
  const { messages } = useQuestionEditorMessages();
  const stages = [
    { key: "stage3", label: messages.pixelStages.stage3 },
    { key: "stage2", label: messages.pixelStages.stage2 },
    { key: "stage1", label: messages.pixelStages.stage1 },
  ] as const;
  return (
    <fieldset className="rounded-xl border border-slate-200 p-3">
      <legend className="px-1 text-sm font-semibold text-slate-900">{messages.pixelStages.durationTitle}</legend>
      <div className="space-y-3">
        {stages.map(({ key, label }) => (
          <label key={key} className="block text-sm text-slate-700">
            <span className="mb-1 block font-medium">{label}</span>
            <span className="flex items-center gap-2">
              <input
                type="number"
                inputMode="numeric"
                min={PIXEL_STAGE_DURATION_MIN_SECONDS}
                max={PIXEL_STAGE_DURATION_MAX_SECONDS}
                step={1}
                value={value[key]}
                disabled={disabled}
                onChange={(event) => onChange({ ...value, [key]: Number(event.target.value) })}
                className="min-h-11 w-24 rounded-xl border border-slate-300 px-3"
              />
              <span>{messages.pixelStages.seconds}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
