"use client";

import { useState } from "react";
import Link from "next/link";
import {
  archiveQuiz,
  createQuiz,
  restoreQuiz,
  updateQuiz,
  deleteQuiz,
  copyQuiz,
} from "./actions";
import type { QuizResult } from "./actions";
import {
  ArchiveBoxIcon,
  TrashIcon,
  PlayIcon,
  DocumentDuplicateIcon,
  LockOpenIcon,
  MegaphoneIcon,
  UsersIcon,
  ChartBarIcon,
} from "@heroicons/react/24/outline";

type Props = {
  quizze: QuizResult[];
};

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-200";

const buttonSecondaryClass =
  "rounded-xl border border-slate-300 bg-white px-4 py-2 font-medium text-slate-900 shadow-sm transition hover:bg-slate-50 active:scale-[0.99]";

export default function QuizForm({
  quizze,
}: Props) {
  const [editingQuizId, setEditingQuizId] = useState<number | null>(null);
  const [titel, setTitel] = useState("");
  const [quizDatum, setQuizDatum] = useState("");
  const [bemerkung, setBemerkung] = useState("");
  const [meldung, setMeldung] = useState("");

  function resetForm() {
    setEditingQuizId(null);
    setTitel("");
    setQuizDatum("");
    setBemerkung("");
  }

  function startEdit(quiz: QuizResult) {
    setEditingQuizId(quiz.quiz_id);
    setTitel(quiz.titel ?? "");
    setQuizDatum(quiz.quiz_datum ?? "");
    setBemerkung(quiz.bemerkung ?? "");
    setMeldung(`Quiz ${quiz.quiz_id} wird bearbeitet.`);
  }

  async function handleSubmit() {
    setMeldung("");

    const data = {
      titel,
      quizDatum,
      bemerkung,
    };

    if (editingQuizId === null) {
      const result = await createQuiz(data);

      if (!result.success) {
        setMeldung(result.message);
        return;
      }

      setMeldung(result.message);
    } else {
      await updateQuiz({
        quizId: editingQuizId,
        ...data,
      });

      setMeldung("Quiz wurde aktualisiert.");
    }

    resetForm();
  }

  async function handleArchive(quizId: number) {
    const grund = window.prompt(
      "Warum soll dieses Quiz archiviert werden?",
      "Quiz wurde durchgeführt"
    );

    if (grund === null) return;

    await archiveQuiz({
      quizId,
      archivierungsgrund: grund,
    });

    setMeldung("Quiz wurde archiviert.");
  }

  async function handleRestore(quizId: number) {
    await restoreQuiz(quizId);
    setMeldung("Quiz wurde entsperrt.");
  }

  return (
    <div className="space-y-6 text-slate-900">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <div className="mb-5">
          <h2 className="text-xl font-semibold">
            {editingQuizId === null ? "Neues Quiz anlegen" : "Quiz bearbeiten"}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Lege Datum, Titel und optionale Eckdaten für einen Quiz-Abend fest.
          </p>
        </div>

        <form action={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">
              Titel:
            </span>
            <input
              value={titel}
              onChange={(e) => setTitel(e.target.value)}
              className={inputClass}
              placeholder="z. B. Casual Quizness #12"
            />
          </label>

          <div className="grid gap-4 md:grid-cols-1">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">
                Quiz-Datum:
              </span>
              <input
                type="date"
                value={quizDatum}
                onChange={(e) => setQuizDatum(e.target.value)}
                className={inputClass}
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">
              Bemerkung:
            </span>
            <textarea
              value={bemerkung}
              onChange={(e) => setBemerkung(e.target.value)}
              className={`${inputClass} min-h-28 resize-y`}
              placeholder="Interne Notizen zum Quiz"
            />
          </label>

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="submit"
              className="rounded-2xl bg-slate-900 px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-slate-700 active:scale-[0.99]"
            >
              {editingQuizId === null ? "Quiz anlegen" : "Änderungen speichern"}
            </button>

            {editingQuizId !== null && (
              <button
                type="button"
                onClick={resetForm}
                className={buttonSecondaryClass}
              >
                Abbrechen
              </button>
            )}
          </div>
        </form>
      </section>

      {meldung && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm font-medium text-slate-800 shadow-sm">
          {meldung}
        </div>
      )}

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <div className="mb-5">
          <h2 className="text-xl font-semibold">Bestehende Quizze</h2>
          <p className="mt-1 text-sm text-slate-500">
            Bereits angelegte Quiz-Abende bearbeiten oder archivieren.
          </p>
        </div>

        {quizze.length === 0 ? (
          <p className="text-sm text-slate-500">Noch keine Quizze vorhanden.</p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <table className="w-full border-collapse bg-white text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Datum</th>
                  <th className="px-4 py-3">Titel</th>
                  <th className="px-4 py-3">Teams</th>
                  <th className="px-4 py-3">Teilnehmer</th>
                  <th className="px-4 py-3">Aktionen</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200">
                {quizze.map((quiz) => (
                  <tr
                    key={quiz.quiz_id}
                    className={`hover:bg-slate-50 ${quiz.ist_archiviert ? "bg-slate-50 text-slate-500" : ""
                      }`}
                  >
                    <td className="px-4 py-3">{quiz.quiz_datum ?? "-"}</td>

                    <td className="px-4 py-3 font-medium">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/quiz/${quiz.quiz_id}`}
                          className="text-slate-900 underline decoration-slate-300 underline-offset-4 hover:decoration-slate-900"
                        >
                          {quiz.titel ?? `Quiz ${quiz.quiz_id}`}
                        </Link>

                        {quiz.ist_archiviert && (
                          <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-500">
                            Archiviert
                          </span>
                        )}
                      </div>

                      {quiz.ist_archiviert && quiz.archivierungsgrund && (
                        <div className="mt-1 text-xs text-slate-500">
                          Grund: {quiz.archivierungsgrund}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3">{quiz.team_anzahl ?? "-"}</td>
                    <td className="px-4 py-3">
                      {quiz.teilnehmer_anzahl ?? "-"}
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">

                        <button
                          type="button"
                          title="Quiz kopieren"
                          onClick={async () => {
                            const neuerTitel = window.prompt(
                              "Name der Quiz-Kopie",
                              `${quiz.titel} (Kopie)`
                            );

                            if (!neuerTitel?.trim()) {
                              return;
                            }

                            const result = await copyQuiz({
                              quizId: quiz.quiz_id,
                              neuerTitel,
                            });

                            setMeldung(result.message);
                          }}
                          className="rounded-xl border border-slate-300 bg-slate-50 p-2 text-slate-700 shadow-sm transition hover:bg-slate-100"
                        >
                          <DocumentDuplicateIcon className="h-5 w-5" />
                        </button>

                        {quiz.ist_archiviert ? (
                          <button
                            type="button"
                            title="Archivierung aufheben"
                            onClick={() => handleRestore(quiz.quiz_id)}
                            className="rounded-xl border border-green-300 bg-green-50 p-2 text-green-700 shadow-sm transition hover:bg-green-100"
                          >
                            <LockOpenIcon className="h-5 w-5" />
                          </button>
                        ) : quiz.fragen_anzahl === 0 ? (
                          <button
                            type="button"
                            title="Quiz löschen"
                            onClick={async () => {
                              const ok = window.confirm(
                                "Dieses Quiz wirklich löschen?"
                              );

                              if (!ok) return;

                              const result = await deleteQuiz(quiz.quiz_id);

                              if (!result.success) {
                                setMeldung(result.message);
                                return;
                              }

                              setMeldung(result.message);
                            }}
                            className="rounded-xl border border-red-300 bg-red-50 p-2 text-red-700 shadow-sm transition hover:bg-red-100"
                          >
                            <TrashIcon className="h-5 w-5" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            title="Archivieren"
                            onClick={() => handleArchive(quiz.quiz_id)}
                            className="rounded-xl border border-orange-300 bg-orange-50 p-2 text-orange-700 shadow-sm transition hover:bg-orange-100"
                          >
                            <ArchiveBoxIcon className="h-5 w-5" />
                          </button>
                        )}

                        <Link
                          href={`/quiz/${quiz.quiz_id}/praesentation`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Präsentieren"
                          className="rounded-xl border border-cyan-300 bg-cyan-50 p-2 text-cyan-700 shadow-sm transition hover:bg-cyan-100"
                        >
                          <PlayIcon className="h-5 w-5" />
                        </Link>
                        <Link
                          href={`/quiz/${quiz.quiz_id}/moderation`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Moderation"
                          className="rounded-xl border border-violet-300 bg-violet-50 p-2 text-violet-700 shadow-sm transition hover:bg-violet-100"
                        >
                          <MegaphoneIcon className="h-5 w-5" />
                        </Link>

                        <Link
                          href={`/quiz/${quiz.quiz_id}/antworten`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Antwortformular"
                          className="rounded-xl border border-emerald-300 bg-emerald-50 p-2 text-emerald-700 shadow-sm transition hover:bg-emerald-100"
                        >
                          <UsersIcon className="h-5 w-5" />
                        </Link>

                        <Link
                          href={`/quiz/${quiz.quiz_id}/auswertung`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Auswertung"
                          className="rounded-xl border border-yellow-300 bg-yellow-50 p-2 text-yellow-700 shadow-sm transition hover:bg-yellow-100"
                        >
                          <ChartBarIcon className="h-5 w-5" />
                        </Link>

                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
