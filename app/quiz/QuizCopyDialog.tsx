"use client";

import { useEffect, useRef, useState } from "react";
import { DocumentDuplicateIcon } from "@heroicons/react/24/outline";
import { copyQuiz } from "./actions";

export function QuizCopyDialog({
  quizId,
  quizTitle,
}: {
  quizId: number;
  quizTitle: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [title, setTitle] = useState(`${quizTitle} (Kopie)`);
  const [date, setDate] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    const onClose = () => setMessage("");
    dialog?.addEventListener("close", onClose);
    return () => dialog?.removeEventListener("close", onClose);
  }, []);

  async function handleCopy() {
    setPending(true);
    setMessage("");
    const result = await copyQuiz({ quizId, neuerTitel: title, quizDatum: date });
    setPending(false);
    if (!result.success || !result.quizId) {
      setMessage(result.message);
      return;
    }
    window.location.href = `/quiz/${result.quizId}`;
  }

  return (
    <>
      <button
        type="button"
        title="Quiz kopieren"
        onClick={() => dialogRef.current?.showModal()}
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-slate-300 bg-white p-2 text-slate-700 shadow-sm transition hover:bg-slate-50"
      >
        <DocumentDuplicateIcon className="h-5 w-5" />
        <span className="sr-only">Quiz kopieren</span>
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={`copy-quiz-title-${quizId}`}
        aria-describedby={`copy-quiz-description-${quizId}`}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-3xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/40"
      >
        <form method="dialog" className="space-y-5 p-6" onSubmit={(event) => { event.preventDefault(); void handleCopy(); }}>
          <div>
            <h2 id={`copy-quiz-title-${quizId}`} className="text-xl font-bold">
              Quiz kopieren
            </h2>
            <p id={`copy-quiz-description-${quizId}`} className="mt-1 text-sm text-slate-600">
              Eventreihe und geeignete Stammdaten werden übernommen. Das Datum muss bewusst neu festgelegt werden.
            </p>
          </div>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Name *</span>
            <input
              required
              maxLength={200}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="min-h-11 w-full rounded-xl border border-slate-300 px-4 py-3"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Neues Datum *</span>
            <input
              required
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="min-h-11 w-full rounded-xl border border-slate-300 px-4 py-3"
            />
          </label>
          {message && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{message}</p>}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="submit"
              onClick={() => dialogRef.current?.close()}
              className="min-h-11 rounded-xl border border-slate-300 px-4 py-2 font-semibold"
            >
              Abbrechen
            </button>
            <button
              type="button"
              disabled={pending || !title.trim() || !date}
              className="min-h-11 rounded-xl bg-slate-900 px-4 py-2 font-semibold text-white disabled:bg-slate-400"
            >
              {pending ? "Wird kopiert …" : "Kopie anlegen"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
