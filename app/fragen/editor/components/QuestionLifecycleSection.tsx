import { useId } from "react";
import {
  getQuestionLifecycleMode,
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
    if (nextMode === "TIMELESS") {
      onChange({ validUntil: null, reviewFrom: null });
    } else if (nextMode === "OUTDATED_FROM") {
      onChange({ validUntil: "", reviewFrom: null });
    } else {
      onChange({ validUntil: null, reviewFrom: "" });
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 p-4">
      <h3 className="font-medium text-slate-950">{messages.details.lifecycleTitle}</h3>
      <p className="mt-1 text-sm text-slate-600">{messages.details.lifecycleDescription}</p>
      <label className="mt-4 block" htmlFor={modeId}>
        <span className="text-sm font-medium text-slate-900">{messages.details.lifecycleTitle}</span>
        <select
          id={modeId}
          value={mode}
          onChange={(event) => changeMode(event.target.value as QuestionLifecycleMode)}
          className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-4"
        >
          <option value="TIMELESS">{messages.details.lifecycleTimeless}</option>
          <option value="OUTDATED_FROM">{messages.details.lifecycleOutdated}</option>
          <option value="REVIEW_FROM">{messages.details.lifecycleReview}</option>
        </select>
      </label>
      {mode !== "TIMELESS" && (
        <div className="mt-4">
          <label htmlFor={dateId} className="text-sm font-medium text-slate-900">
            {mode === "OUTDATED_FROM"
              ? messages.details.lifecycleOutdated
              : messages.details.lifecycleReview}
          </label>
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
            className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"
          />
          <p className="mt-2 text-sm text-slate-600">
            {mode === "OUTDATED_FROM"
              ? messages.details.expiryAfterHelp
              : messages.details.reviewHelp}
          </p>
        </div>
      )}
    </section>
  );
}
