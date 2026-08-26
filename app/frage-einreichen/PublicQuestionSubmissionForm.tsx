"use client";

import { useActionState } from "react";
import { submitPublicQuestionAction } from "./actions";
import {
  INITIAL_PUBLIC_QUESTION_SUBMISSION_STATE,
  PUBLIC_QUESTION_LIMITS,
} from "./publicQuestionSubmission";

const inputClass =
  "mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-950 outline-none transition focus:border-slate-700 focus:ring-2 focus:ring-slate-200";

function FieldError({ message }: { message?: string }) {
  return message ? <p className="mt-2 text-sm font-medium text-red-700">{message}</p> : null;
}

export function PublicQuestionSubmissionForm() {
  const [state, action, pending] = useActionState(
    submitPublicQuestionAction,
    INITIAL_PUBLIC_QUESTION_SUBMISSION_STATE,
  );

  if (state.status === "SUCCESS") {
    return (
      <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-950 sm:p-8">
        <p className="text-sm font-bold uppercase tracking-[0.16em]">Eingereicht</p>
        <h2 className="mt-3 text-2xl font-bold">Danke für deine Frage.</h2>
        <p className="mt-3 leading-7">{state.message}</p>
        <a
          href="/frage-einreichen"
          className="mt-6 inline-flex min-h-12 items-center rounded-xl bg-slate-950 px-5 py-3 font-semibold text-white"
        >
          Noch eine Frage einreichen
        </a>
      </section>
    );
  }

  return (
    <form action={action} className="space-y-6" noValidate>
      <div>
        <label htmlFor="question" className="text-base font-semibold text-slate-950">
          Deine Quizfrage <span aria-hidden="true">*</span>
        </label>
        <textarea
          id="question"
          name="question"
          rows={4}
          required
          maxLength={PUBLIC_QUESTION_LIMITS.question}
          aria-invalid={Boolean(state.fieldErrors.question)}
          className={inputClass}
          placeholder="Was wolltest du schon immer einmal in einem Pubquiz fragen?"
        />
        <FieldError message={state.fieldErrors.question} />
      </div>

      <div>
        <label htmlFor="answer" className="text-base font-semibold text-slate-950">
          Richtige Antwort <span aria-hidden="true">*</span>
        </label>
        <input
          id="answer"
          name="answer"
          required
          maxLength={PUBLIC_QUESTION_LIMITS.answer}
          aria-invalid={Boolean(state.fieldErrors.answer)}
          className={inputClass}
        />
        <FieldError message={state.fieldErrors.answer} />
      </div>

      <div>
        <label htmlFor="explanation" className="text-base font-semibold text-slate-950">
          Erklärung <span className="font-normal text-slate-500">(optional)</span>
        </label>
        <textarea
          id="explanation"
          name="explanation"
          rows={3}
          maxLength={PUBLIC_QUESTION_LIMITS.explanation}
          aria-invalid={Boolean(state.fieldErrors.explanation)}
          className={inputClass}
          placeholder="Was macht die Lösung besonders oder überraschend?"
        />
        <FieldError message={state.fieldErrors.explanation} />
      </div>

      <div>
        <label htmlFor="sourceUrl" className="text-base font-semibold text-slate-950">
          Quellenlink <span className="font-normal text-slate-500">(optional)</span>
        </label>
        <input
          id="sourceUrl"
          name="sourceUrl"
          type="url"
          inputMode="url"
          maxLength={PUBLIC_QUESTION_LIMITS.sourceUrl}
          aria-invalid={Boolean(state.fieldErrors.sourceUrl)}
          className={inputClass}
          placeholder="https://…"
        />
        <FieldError message={state.fieldErrors.sourceUrl} />
      </div>

      <fieldset className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
        <legend className="px-1 font-semibold text-slate-950">Rückfrage ermöglichen (optional)</legend>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          Name und E-Mail werden getrennt von der Frage gespeichert, nur dem berechtigten Redaktionsteam gezeigt und niemals veröffentlicht.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="submitterName" className="text-sm font-semibold text-slate-900">Name</label>
            <input
              id="submitterName"
              name="submitterName"
              autoComplete="name"
              maxLength={PUBLIC_QUESTION_LIMITS.submitterName}
              aria-invalid={Boolean(state.fieldErrors.submitterName)}
              className={inputClass}
            />
            <FieldError message={state.fieldErrors.submitterName} />
          </div>
          <div>
            <label htmlFor="submitterEmail" className="text-sm font-semibold text-slate-900">E-Mail</label>
            <input
              id="submitterEmail"
              name="submitterEmail"
              type="email"
              inputMode="email"
              autoComplete="email"
              maxLength={PUBLIC_QUESTION_LIMITS.submitterEmail}
              aria-invalid={Boolean(state.fieldErrors.submitterEmail)}
              className={inputClass}
            />
            <FieldError message={state.fieldErrors.submitterEmail} />
          </div>
        </div>
      </fieldset>

      <div className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      {state.status === "ERROR" && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="min-h-12 w-full rounded-xl bg-slate-950 px-5 py-3 text-base font-bold text-white transition hover:bg-slate-800 disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? "Frage wird eingereicht …" : "Frage einreichen"}
      </button>
    </form>
  );
}
