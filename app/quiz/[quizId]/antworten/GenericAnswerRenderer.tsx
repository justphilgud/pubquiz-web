"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { SortableTemplateList } from "@/app/fragen/editor/components/SortableTemplateList";
import type { ResolvedQuizAnswerInteraction } from "@/app/quiz/answerInteraction";
import { MemeRenderer } from "@/app/rendering/meme/MemeRenderer";
import {
  parseStoredMemeCaptionValues,
  serializeMemeCaptionPayload,
} from "@/app/quiz/memeCaption";
import {
  analyzeMemeCaptionLayout,
  isMemeCaptionPayloadReadable,
  MEME_CAPTION_TOO_LONG_MESSAGE,
} from "@/app/quiz/memeCaptionLayout";
import { resolveMemeCaptionLayout } from "@/app/quiz/memeCaptionZones";

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
  deadlineAt?: string | null;
  now: number;
  onChange: (value: TeamAnswerDraft) => void;
  onValidationChange?: (message: string | null) => void;
};

type MemeFitState = {
  text: string;
  fits: boolean;
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

function resolveMemeImageUrl(imageUrl: string) {
  return imageUrl.startsWith("http://") ||
    imageUrl.startsWith("https://") ||
    imageUrl.startsWith("/")
    ? imageUrl
    : `/medien/${imageUrl}`;
}

function MemeCaptionAnswer({
  interaction,
  value,
  disabled,
  deadlineAt,
  now,
  onChange,
  onValidationChange,
}: Omit<Props, "questionAssignmentId"> & {
  interaction: Extract<ResolvedQuizAnswerInteraction, { type: "MEME_CAPTION" }>;
}) {
  const layout = resolveMemeCaptionLayout(interaction.layout);
  const storedValues = parseStoredMemeCaptionValues(value?.antwortText ?? null).captions;
  const values = Object.fromEntries(
    layout.zones.map((zone) => [zone.id, storedValues[zone.id] ?? ""]),
  );
  const validationCallbackRef = useRef(onValidationChange);
  const [measuredFit, setMeasuredFit] = useState<Record<string, MemeFitState>>({});
  const remainingSeconds = deadlineAt
    ? Math.max(0, Math.ceil((Date.parse(deadlineAt) - now) / 1_000))
    : null;
  const zoneFit = Object.fromEntries(layout.zones.map((zone) => {
    const text = values[zone.id] ?? "";
    const deterministic = analyzeMemeCaptionLayout(text, zone).fits;
    const measured = measuredFit[zone.id];
    return [zone.id, deterministic && !(measured?.text === text && !measured.fits)];
  }));
  const missingRequired = layout.zones.some(
    (zone) => zone.required && !(values[zone.id] ?? "").trim(),
  );
  const validationError = missingRequired
    ? "Bitte fülle alle erforderlichen Caption-Zonen aus."
    : isMemeCaptionPayloadReadable({ captions: values }, layout) && Object.values(zoneFit).every(Boolean)
      ? null
      : MEME_CAPTION_TOO_LONG_MESSAGE;

  useEffect(() => {
    validationCallbackRef.current = onValidationChange;
  }, [onValidationChange]);

  useEffect(() => {
    validationCallbackRef.current?.(validationError);
  }, [validationError]);

  useEffect(() => () => {
    validationCallbackRef.current?.(null);
  }, []);

  const handleFitChange = useCallback((
    zoneId: string,
    text: string,
    fits: boolean,
  ) => {
    setMeasuredFit((current) => {
      const previous = current[zoneId];
      if (previous?.text === text && previous.fits === fits) return current;
      return { ...current, [zoneId]: { text, fits } };
    });
  }, [setMeasuredFit]);

  const update = (next: Record<string, string>) => onChange({
    antwortText: serializeMemeCaptionPayload(
      layout.mode === "STANDARD"
        ? { topText: next.top ?? "", bottomText: next.bottom ?? "" }
        : { captions: next },
    ),
    antwortId: null,
    antwortfelder: {},
  });

  return (
    <section data-answer-interaction="MEME_CAPTION" className="mt-4 space-y-4">
      <div className="overflow-hidden rounded-2xl border border-slate-300 bg-slate-950 p-2">
        <MemeRenderer
          imageUrl={resolveMemeImageUrl(interaction.imageUrl)}
          captions={values}
          layout={layout}
          alt="Meme-Vorschau"
          onCaptionFitChange={handleFitChange}
        />
      </div>
      <div className="flex items-center justify-between gap-4 rounded-xl bg-fuchsia-50 px-4 py-3 text-sm font-semibold text-fuchsia-950">
        <span>Lokale Vorschau</span>
        {remainingSeconds === null ? (
          <span>Einreichungen geöffnet</span>
        ) : (
          <span className="tabular-nums">{remainingSeconds} s</span>
        )}
      </div>
      {layout.zones.map((zone) => {
        const text = values[zone.id] ?? "";
        return (
          <label key={zone.id} className="block">
            <span className="mb-2 flex justify-between gap-3 text-sm font-semibold text-slate-700">
              <span>{zone.label}{zone.required ? " *" : ""}</span>
              <span>{text.length}/{interaction.maxLength}</span>
            </span>
            <input
              type="text"
              maxLength={interaction.maxLength}
              required={zone.required}
              disabled={disabled}
              aria-invalid={!zoneFit[zone.id] || (zone.required && !text.trim())}
              value={text}
              onChange={(event) => update({ ...values, [zone.id]: event.target.value })}
              className="min-h-11 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-100"
              placeholder={zone.label}
            />
          </label>
        );
      })}
      {validationError ? (
        <p
          role="alert"
          data-meme-caption-validation="overflow"
          className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-950"
        >
          {validationError}
        </p>
      ) : (
        <p className="text-xs text-slate-500">Mindestens eine Caption muss ausgefüllt sein.</p>
      )}
    </section>
  );
}

export default function GenericAnswerRenderer({
  questionAssignmentId,
  interaction,
  value,
  disabled,
  deadlineAt = null,
  now,
  onChange,
  onValidationChange,
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

  if (interaction.type === "MEME_CAPTION") {
    return (
      <MemeCaptionAnswer
        interaction={interaction}
        value={value}
        disabled={disabled}
        deadlineAt={deadlineAt}
        now={now}
        onChange={onChange}
        onValidationChange={onValidationChange}
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
    interaction.type === "MULTI_CHOICE" ||
    interaction.type === "POLL_SINGLE" ||
    interaction.type === "POLL_MULTI"
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
              {!interaction.type.startsWith("POLL_") && <span className="mr-2 font-bold">
                {String.fromCharCode(65 + optionIndex)}.
              </span>}
              {option.label}
            </span>
          </label>
        ))}
      </div>
    );
  }

  if (interaction.type === "POLL_SCALE") {
    return (
      <fieldset data-answer-interaction="POLL_SCALE" className="mt-4">
        <legend className="sr-only">Skalenwert auswählen</legend>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {interaction.values.map((scaleValue) => {
            const checked = value?.antwortText === String(scaleValue);
            return (
              <label
                key={scaleValue}
                className={`flex min-h-12 cursor-pointer items-center justify-center rounded-xl border-2 px-3 py-2 font-bold ${checked ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-900"}`}
              >
                <input
                  className="sr-only"
                  type="radio"
                  name={`frage-${questionAssignmentId}`}
                  value={scaleValue}
                  checked={checked}
                  disabled={disabled}
                  onChange={() => onChange(textDraft(String(scaleValue)))}
                />
                {scaleValue.toLocaleString("de-DE")}
              </label>
            );
          })}
        </div>
        <div className="mt-2 flex justify-between gap-4 text-xs font-medium text-slate-600">
          <span>{interaction.minLabel}</span>
          <span className="text-right">{interaction.maxLabel}</span>
        </div>
      </fieldset>
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
            <div className="answer-option answer-order-row flex items-center gap-2 rounded-xl border p-3">
              {dragHandle}
              <span className="flex-1">{item.text}</span>
              <button
                type="button"
                aria-label={`${item.text} nach oben`}
                disabled={disabled || index === 0}
                onClick={() => move(index, -1)}
                className="answer-order-control min-h-11 min-w-11 rounded-lg border disabled:opacity-40"
              >
                ↑
              </button>
              <button
                type="button"
                aria-label={`${item.text} nach unten`}
                disabled={disabled || index === order.length - 1}
                onClick={() => move(index, 1)}
                className="answer-order-control min-h-11 min-w-11 rounded-lg border disabled:opacity-40"
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
