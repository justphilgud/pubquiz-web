"use client";

import { SortableTemplateList } from "@/app/fragen/editor/components/SortableTemplateList";
import type { ResolvedQuizAnswerInteraction } from "@/app/quiz/answerInteraction";

export type TeamAnswerDraft = {
  antwortText: string | null;
  antwortId: number | null;
  antwortIds?: number[];
  antwortfelder: Record<number, string>;
};

type Props = {
  questionAssignmentId: number;
  interaction: ResolvedQuizAnswerInteraction;
  value: TeamAnswerDraft | undefined;
  disabled: boolean;
  onChange: (value: TeamAnswerDraft) => void;
};

function textDraft(value: string): TeamAnswerDraft {
  return {
    antwortText: value,
    antwortId: null,
    antwortfelder: {},
  };
}

function readOrderingIds(
  interaction: Extract<ResolvedQuizAnswerInteraction, { type: "ORDER" }>,
  value: TeamAnswerDraft | undefined,
) {
  const configuredIds = interaction.items.map((item) => item.id);
  if (!value?.antwortText) return configuredIds;
  try {
    const parsed: unknown = JSON.parse(value.antwortText);
    if (
      Array.isArray(parsed) &&
      parsed.length === configuredIds.length &&
      parsed.every(
        (entry) => typeof entry === "string" && configuredIds.includes(entry),
      ) &&
      new Set(parsed).size === parsed.length
    ) {
      return parsed as string[];
    }
  } catch {
    // A legacy free-text value falls back to the configured item order.
  }
  return configuredIds;
}

export default function GenericAnswerRenderer({
  questionAssignmentId,
  interaction,
  value,
  disabled,
  onChange,
}: Props) {
  if (interaction.type === "NO_ANSWER" || "supported" in interaction) {
    return null;
  }

  if (interaction.type === "TEXT") {
    return (
      <textarea
        data-answer-interaction="TEXT"
        disabled={disabled}
        value={value?.antwortText ?? ""}
        onChange={(event) => onChange(textDraft(event.target.value))}
        className="mt-4 min-h-24 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-100"
        placeholder={interaction.placeholder}
      />
    );
  }

  if (interaction.type === "STRUCTURED_TEXT") {
    return (
      <div data-answer-interaction="STRUCTURED_TEXT" className="mt-4 space-y-3">
        {interaction.fields.map((field) => (
          <label key={field.key} className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              {field.label}
              {field.required ? " *" : ""}
            </span>
            <input
              type="text"
              inputMode={interaction.inputMode}
              required={field.required}
              disabled={disabled}
              value={value?.antwortfelder[field.id] ?? ""}
              onChange={(event) =>
                onChange({
                  antwortText: null,
                  antwortId: null,
                  antwortfelder: {
                    ...(value?.antwortfelder ?? {}),
                    [field.id]: event.target.value,
                  },
                })
              }
              className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-100"
              placeholder={field.placeholder}
            />
          </label>
        ))}
      </div>
    );
  }

  if (interaction.type === "NUMBER") {
    return (
      <label
        data-answer-interaction="NUMBER"
        className="mt-4 block text-sm font-semibold text-slate-700"
      >
        Schätzwert
        <span className="mt-2 flex items-center gap-3">
          <input
            type="number"
            inputMode={interaction.inputMode}
            step={interaction.step}
            disabled={disabled}
            value={value?.antwortText ?? ""}
            onChange={(event) => onChange(textDraft(event.target.value))}
            className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-300 px-4 py-3 disabled:bg-slate-100"
          />
          {interaction.unit && <span>{interaction.unit}</span>}
        </span>
      </label>
    );
  }

  if (
    interaction.type === "SINGLE_CHOICE" ||
    interaction.type === "MULTI_CHOICE"
  ) {
    const multiple = interaction.selectionMode === "MULTIPLE";
    return (
      <div data-answer-interaction={interaction.type} className="mt-4 space-y-2">
        {interaction.options.map((option, optionIndex) => (
          <label
            key={option.id}
            className="answer-option flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-3"
          >
            <input
              type={multiple ? "checkbox" : "radio"}
              name={`frage-${questionAssignmentId}`}
              checked={
                multiple
                  ? (value?.antwortIds ?? []).includes(option.id)
                  : value?.antwortId === option.id
              }
              disabled={disabled}
              onChange={() => {
                if (!multiple) {
                  onChange({
                    antwortText: null,
                    antwortId: option.id,
                    antwortIds: [option.id],
                    antwortfelder: {},
                  });
                  return;
                }
                const selectedIds = value?.antwortIds ?? [];
                onChange({
                  antwortText: null,
                  antwortId: null,
                  antwortIds: selectedIds.includes(option.id)
                    ? selectedIds.filter((id) => id !== option.id)
                    : [...selectedIds, option.id],
                  antwortfelder: {},
                });
              }}
              className="mt-1"
            />
            <span>
              <span className="mr-2 font-bold">
                {String.fromCharCode(65 + optionIndex)}.
              </span>
              {option.label}
            </span>
          </label>
        ))}
      </div>
    );
  }

  const order = readOrderingIds(interaction, value);
  const itemMap = new Map(interaction.items.map((item) => [item.id, item]));

  function setOrder(nextOrder: string[]) {
    onChange({
      antwortText: JSON.stringify(nextOrder),
      antwortId: null,
      antwortfelder: {},
    });
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= order.length) return;
    const nextOrder = [...order];
    [nextOrder[index], nextOrder[target]] = [
      nextOrder[target],
      nextOrder[index],
    ];
    setOrder(nextOrder);
  }

  return (
    <div data-answer-interaction="ORDER" className="mt-4 space-y-2">
      <SortableTemplateList ids={order} disabled={disabled} onReorder={setOrder}>
        {(id, index, dragHandle) => {
          const item = itemMap.get(id);
          if (!item) return null;
          return (
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-3">
              {dragHandle}
              <span className="w-7 font-bold">{index + 1}.</span>
              <span className="flex-1">{item.text}</span>
              <button
                type="button"
                aria-label={`${item.text} nach oben`}
                disabled={disabled || index === 0}
                onClick={() => move(index, -1)}
                className="min-h-11 min-w-11 rounded-lg border disabled:opacity-40"
              >
                ↑
              </button>
              <button
                type="button"
                aria-label={`${item.text} nach unten`}
                disabled={disabled || index === order.length - 1}
                onClick={() => move(index, 1)}
                className="min-h-11 min-w-11 rounded-lg border disabled:opacity-40"
              >
                ↓
              </button>
            </div>
          );
        }}
      </SortableTemplateList>
    </div>
  );
}
