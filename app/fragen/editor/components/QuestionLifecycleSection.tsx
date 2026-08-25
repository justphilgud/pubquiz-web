import { useId } from "react";
import {
  getQuestionLifecycleMode,
  getQuestionLifecycleModeChange,
  outdatedFromToValidUntil,
  validUntilToOutdatedFrom,
  type QuestionLifecycleMode,
} from "../questionLifecycle";
import { useQuestionEditorMessages } from "./QuestionEditorMessagesProvider";

export function QuestionLifecycleSection({
  validUntil,
  reviewFrom,
  onChange,
}: {
  validUntil: string | null;
  reviewFrom: string | null;
  onChange: (value: { validUntil: string | null; reviewFrom: string | null }) => void;
}) {
  const { messages } = useQuestionEditorMessages();
  const modeId = useId();
  const dateId = useId();
  const mode = getQuestionLifecycleMode({ validUntil, reviewFrom });
  const dateValue =
    mode === "OUTDATED_FROM"
      ? validUntilToOutdatedFrom(validUntil) ?? ""
      : mode === "REVIEW_FROM"
        ? reviewFrom ?? ""
        : "";

  function changeMode(nextMode: QuestionLifecycleMode) {
    onChange(getQuestionLifecycleModeChange(nextMode));
  }

  const options: Array<{ value: QuestionLifecycleMode; label: string }> = [
    { value: "TIMELESS", label: messages.details.lifecycleTimeless },
    { value: "OUTDATED_FROM", label: messages.details.lifecycleOutdated },
    { value: "REVIEW_FROM", label: messages.details.lifecycleReview },
  ];
  const helpText = mode === "TIMELESS"
    ? messages.details.lifecycleTimelessHelp
    : mode === "OUTDATED_FROM"
      ? messages.details.expiryAfterHelp
      : messages.details.reviewHelp;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
      <h3 className="font-medium text-slate-950">{messages.details.lifecycleTitle}</h3>
      <p className="mt-1 text-sm text-slate-600">{messages.details.lifecycleDescription}</p>
      <fieldset className="mt-3 border-0 p-0">
        <legend className="sr-only">{messages.details.lifecycleTitle}</legend>
        <div
          role="radiogroup"
          aria-label={messages.details.lifecycleTitle}
          className="grid grid-cols-1 gap-2 sm:grid-cols-3"
        >
          {options.map((option) => {
            const checked = mode === option.value;
            return (
              <label
                key={option.value}
                className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition focus-within:ring-2 focus-within:ring-slate-950 focus-within:ring-offset-2 ${
                  checked
                    ? "border-2 border-slate-950 bg-slate-950 text-white shadow-sm"
                    : "border-slate-300 bg-white text-slate-800 hover:border-slate-500"
                }`}
              >
                <input
                  id={`${modeId}-${option.value}`}
                  type="radio"
                  name={modeId}
                  value={option.value}
                  checked={checked}
                  onChange={() => changeMode(option.value)}
                  onKeyDown={(event) => {
                    const direction = event.key === "ArrowRight" || event.key === "ArrowDown"
                      ? 1
                      : event.key === "ArrowLeft" || event.key === "ArrowUp"
                        ? -1
                        : 0;
                    if (direction === 0) return;
                    event.preventDefault();
                    const currentIndex = options.findIndex(
                      (candidate) => candidate.value === option.value,
                    );
                    const nextOption = options[
                      (currentIndex + direction + options.length) % options.length
                    ];
                    changeMode(nextOption.value);
                    requestAnimationFrame(() => {
                      document.getElementById(`${modeId}-${nextOption.value}`)?.focus();
                    });
                  }}
                  className={`size-4 shrink-0 ${checked ? "accent-white" : "accent-slate-950"}`}
                />
                <span>{option.label}</span>
              </label>
            );
          })}
        </div>
      </fieldset>
      {mode !== "TIMELESS" && (
        <div className="mt-3 max-w-sm">
          <label htmlFor={dateId} className="block text-sm font-medium text-slate-900">
            {messages.details.lifecycleDate}
            <input
              id={dateId}
              data-editor-valid-until={mode === "OUTDATED_FROM" || undefined}
              data-editor-review-from={mode === "REVIEW_FROM" || undefined}
              type="date"
              value={dateValue}
              onChange={(event) =>
                mode === "OUTDATED_FROM"
                  ? onChange({
                      validUntil: outdatedFromToValidUntil(event.target.value),
                      reviewFrom: null,
                    })
                  : onChange({ validUntil: null, reviewFrom: event.target.value })
              }
              className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
            />
          </label>
        </div>
      )}
      <p className="mt-2 text-xs leading-5 text-slate-600">{helpText}</p>
    </section>
  );
}
