"use client";

import { useState } from "react";
import {
  searchFragen,
  getFrageDetails,
  getFrageForEdit,
  archiveFrage,
  restoreFrage,
  type FrageSuchResult,
  type FrageDetailsResult,
} from "./actions";
import { addFrageToQuiz } from "../quiz/actions";
import ZuQuizHinzufuegenButton from "./ZuQuizHinzufuegenButton";
import type { QuizResult } from "@/app/quiz/actions";
import QuizVerwendungPopover from "./QuizVerwendungPopover";
import type { QuizOption } from "./FragenWorkspace";

type Kategorie = {
  fragenkategorie_id: number;
  kategorie: string;
};

type FrageForEdit = Awaited<ReturnType<typeof getFrageForEdit>>;

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-200";

const buttonPrimaryClass =
  "rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-slate-700 active:scale-[0.99]";

const buttonSecondaryClass =
  "rounded-xl border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50 active:scale-[0.99]";

function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone: "green" | "orange" | "red" | "blue" | "slate";
}) {
  const classes = {
    green: "border-green-200 bg-green-50 text-green-700",
    orange: "border-orange-200 bg-orange-50 text-orange-700",
    red: "border-red-200 bg-red-50 text-red-700",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    slate: "border-slate-200 bg-white text-slate-700",
  };

  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs font-semibold ${classes[tone]}`}
    >
      {label}
    </span>
  );
}

function StatBox({
  label,
  value,
  warning,
}: {
  label: string;
  value: React.ReactNode;
  warning?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-3 ${warning
        ? "border-orange-200 bg-orange-50 text-orange-800"
        : "border-slate-200 bg-white text-slate-700"
        }`}
    >
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}

export default function FrageSuche({
  kategorien,
  quizze,
  onEditFrage,
}: {
  kategorien: Kategorie[];
  quizze: QuizOption[];
  onEditFrage: (frage: FrageForEdit) => void;
}) {
  const [suchtext, setSuchtext] = useState("");
  const [quelle, setQuelle] = useState("");
  const [kategorieId, setKategorieId] = useState<number | null>(null);
  const [nurOhneMedien, setNurOhneMedien] = useState(false);
  const [nurOhneAntworten, setNurOhneAntworten] = useState(false);

  const [ergebnisse, setErgebnisse] = useState<FrageSuchResult[]>([]);
  const [meldung, setMeldung] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const [hasMore, setHasMore] = useState(false);
  const [nextOffset, setNextOffset] = useState(0);

  const [details, setDetails] = useState<Record<number, FrageDetailsResult | null>>(
    {}
  );
  const [detailsLoadingId, setDetailsLoadingId] = useState<number | null>(null);
  const [editingFragenId, setEditingFragenId] = useState<number | null>(null);
  const [archivStatus, setArchivStatus] = useState<"alle" | "aktiv" | "archiviert">("alle");

  async function handleSearch() {
    setMeldung("");
    setIsLoading(true);

    const result = await searchFragen({
      suchtext,
      quelle,
      kategorieId,
      nurOhneMedien,
      nurOhneAntworten,
      archivStatus,
      limit: 50,
      offset: 0,
    });

    setErgebnisse(result.results);
    setHasMore(result.hasMore);
    setNextOffset(result.nextOffset);

    setDetails({});
    setDetailsLoadingId(null);
    setIsLoading(false);

    if (result.results.length === 0) {
      setMeldung("Keine passenden Fragen gefunden.");
    }
  }

  async function handleLoadMore() {
    setIsLoading(true);

    const result = await searchFragen({
      suchtext,
      quelle,
      kategorieId,
      nurOhneMedien,
      nurOhneAntworten,
      archivStatus,
      limit: 50,
      offset: nextOffset,
    });

    setErgebnisse((current) => [...current, ...result.results]);

    setHasMore(result.hasMore);
    setNextOffset(result.nextOffset);

    setIsLoading(false);
  }

  async function toggleDetails(fragenId: number) {
    if (details[fragenId]) {
      setDetails((current) => {
        const copy = { ...current };
        delete copy[fragenId];
        return copy;
      });

      return;
    }

    setDetailsLoadingId(fragenId);

    const result = await getFrageDetails(fragenId);

    setDetails((current) => ({
      ...current,
      [fragenId]: result,
    }));

    setDetailsLoadingId(null);
  }

  async function handleEdit(fragenId: number) {
    const frage = await getFrageForEdit(fragenId);

    if (!frage) {
      alert("Frage konnte nicht geladen werden.");
      return;
    }

    setEditingFragenId(frage.fragen_id);
    onEditFrage(frage);
  }

  async function handleArchive(fragenId: number) {
    const grund = window.prompt(
      "Warum soll die Frage archiviert werden?"
    );

    if (grund === null) {
      return;
    }

    await archiveFrage({
      fragenId,
      archivierungsgrund: grund,
    });

    await handleSearch();
  }

  async function handleRestore(fragenId: number) {
    await restoreFrage(fragenId);

    await handleSearch();
  }

  function resetSearch() {
    setSuchtext("");
    setQuelle("");
    setKategorieId(null);
    setNurOhneMedien(false);
    setNurOhneAntworten(false);
    setErgebnisse([]);
    setMeldung("");
    setHasMore(false);
    setNextOffset(0);
  }

   return ( 
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
      <div className="mb-5">
        <h2 className="text-xl font-semibold text-slate-900">Fragen suchen</h2>

        <p className="mt-1 text-sm text-slate-500">
          Suche bestehende Fragen nach Text, Kategorie oder Pflegezustand.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_240px]">
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-700">
            Suchtext
          </span>
          <input
            value={suchtext}
            onChange={(e) => setSuchtext(e.target.value)}
            className={inputClass}
            placeholder="Text aus der Frage..."
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-700">
            Kategorie
          </span>
          <select
            value={kategorieId ?? ""}
            onChange={(e) =>
              setKategorieId(e.target.value ? Number(e.target.value) : null)
            }
            className={inputClass}
          >
            <option value="">Alle Kategorien</option>
            {kategorien.map((kat) => (
              <option
                key={kat.fragenkategorie_id}
                value={kat.fragenkategorie_id}
              >
                {kat.kategorie}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-[1fr_220px_220px_220px]">
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-700">
            Quelle
          </span>
          <input
            value={quelle}
            onChange={(e) => setQuelle(e.target.value)}
            className={inputClass}
            placeholder="z. B. Musikrunde"
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-700">
            Archivstatus
          </span>

          <select
            value={archivStatus}
            onChange={(e) =>
              setArchivStatus(
                e.target.value as "alle" | "aktiv" | "archiviert"
              )
            }
            className={inputClass}
          >
            <option value="alle">Alle Fragen</option>
            <option value="aktiv">Nur aktive Fragen</option>
            <option value="archiviert">Nur archivierte Fragen</option>
          </select>
        </label>
        <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <input
            type="checkbox"
            checked={nurOhneMedien}
            onChange={(e) => setNurOhneMedien(e.target.checked)}
            className="h-5 w-5 accent-slate-900"
          />
          <span className="text-sm font-medium text-slate-700">
            nur ohne Medien
          </span>
        </label>

        <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <input
            type="checkbox"
            checked={nurOhneAntworten}
            onChange={(e) => setNurOhneAntworten(e.target.checked)}
            className="h-5 w-5 accent-slate-900"
          />
          <span className="text-sm font-medium text-slate-700">
            nur ohne Antworten
          </span>
        </label>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleSearch}
          className={buttonPrimaryClass}
          disabled={isLoading}
        >
          {isLoading ? "Suche läuft..." : "Suchen"}
        </button>

        <button
          type="button"
          onClick={resetSearch}
          className={buttonSecondaryClass}
        >
          Zurücksetzen
        </button>
      </div>

      {meldung && (
        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-medium text-slate-700">
          {meldung}
        </div>
      )}

      {ergebnisse.length > 0 && (
        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-slate-700">
              {ergebnisse.length} Treffer
            </div>
          </div>

          {ergebnisse.map((frage) => {
            const hatKeineMedien = frage.medien_anzahl === 0;
            const hatKeineAntworten = frage.antworten_anzahl === 0;
            const wurdeNochNieVerwendet = frage.quiz_anzahl === 0;
            const isEditing = editingFragenId === frage.fragen_id;

            return (
              <article
                key={frage.fragen_id}
                className="rounded-3xl border border-slate-200 bg-slate-50 p-4 shadow-sm transition hover:border-slate-300 hover:bg-white"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
                        ID {frage.fragen_id}
                      </span>

                      {isEditing && (
                        <StatusPill label="wird bearbeitet" tone="slate" />
                      )}

                      {frage.ist_archiviert && (
                        <StatusPill label="archiviert" tone="slate" />
                      )}

                      {hatKeineAntworten && (
                        <StatusPill label="keine Antworten" tone="red" />
                      )}

                      {hatKeineMedien && (
                        <StatusPill label="keine Medien" tone="orange" />
                      )}

                      {wurdeNochNieVerwendet && (
                        <StatusPill label="noch nie verwendet" tone="blue" />
                      )}

                      {!hatKeineAntworten &&
                        !hatKeineMedien &&
                        !wurdeNochNieVerwendet && (
                          <StatusPill label="vollständig" tone="green" />
                        )}
                    </div>

                    <h3 className="text-lg font-semibold leading-snug text-slate-900">
                      {frage.frage}
                    </h3>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {frage.kategorien.length > 0 ? (
                        frage.kategorien.map((kat) => (
                          <span
                            key={kat}
                            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700"
                          >
                            {kat}
                          </span>
                        ))
                      ) : (
                        <span className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-medium text-orange-700">
                          keine Kategorie
                        </span>
                      )}
                    </div>

                    <p className="mt-3 text-sm text-slate-500">
                      Quelle: {frage.quelle || "—"}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-5 lg:w-[620px]">
                    <StatBox
                      label="Antworten"
                      value={frage.antworten_anzahl}
                      warning={hatKeineAntworten}
                    />
                    <StatBox
                      label="Medien Frage"
                      value={frage.medien_frage_anzahl}
                      warning={frage.medien_frage_anzahl === 0}
                    />

                    <StatBox
                      label="Medien Antworten"
                      value={frage.medien_antworten_anzahl}
                      warning={frage.medien_antworten_anzahl === 0}
                    />
                    <StatBox
                      label="Quiz"
                      value=<QuizVerwendungPopover quizze={frage.quizze} />
                      warning={wurdeNochNieVerwendet}
                    />
                    <StatBox
                      label="Schwierigkeit"
                      value={frage.schwierigkeitslevel ?? "—"}
                    />
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleEdit(frage.fragen_id)}
                    className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-700"
                  >
                    Bearbeiten
                  </button>

                  {frage.ist_archiviert ? (
                    <button
                      type="button"
                      onClick={() => handleRestore(frage.fragen_id)}
                      className="rounded-xl border border-green-300 bg-green-50 px-4 py-2 text-sm font-semibold text-green-700 shadow-sm hover:bg-green-100"
                    >
                      Entsperren
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleArchive(frage.fragen_id)}
                      className="rounded-xl border border-orange-300 bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-700 shadow-sm hover:bg-orange-100"
                    >
                      Archivieren
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => toggleDetails(frage.fragen_id)}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50"
                  >
                    {details[frage.fragen_id]
                      ? "Details ausblenden"
                      : "Details"}
                  </button>
                  <ZuQuizHinzufuegenButton
                    fragenId={frage.fragen_id}
                    quizze={quizze}
                    disabled={frage.ist_archiviert}
                    verwendeteQuizIds={frage.quizze.map((quiz) => quiz.quiz_id)}
                  />
                </div>

                {detailsLoadingId === frage.fragen_id && (
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
                    Details werden geladen...
                  </div>
                )}

                {details[frage.fragen_id] && (
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="grid gap-4 md:grid-cols-3">
                      <div>
                        <div className="text-xs font-semibold uppercase text-slate-500">
                          Erstellt am
                        </div>
                        <div className="mt-1 font-medium text-slate-900">
                          {details[frage.fragen_id]?.erstellungsdatum}
                        </div>
                      </div>

                      <div>
                        <div className="text-xs font-semibold uppercase text-slate-500">
                          Quelle
                        </div>
                        <div className="mt-1 font-medium text-slate-900">
                          {details[frage.fragen_id]?.quelle || "—"}
                        </div>
                      </div>

                      <div>
                        <div className="text-xs font-semibold uppercase text-slate-500">
                          Schwierigkeit
                        </div>
                        <div className="mt-1 font-medium text-slate-900">
                          {details[frage.fragen_id]?.schwierigkeitslevel || "—"}
                        </div>
                      </div>
                    </div>

                    <div className="mt-5">
                      <h4 className="font-semibold text-slate-900">
                        Antworten
                      </h4>

                      <div className="mt-2 space-y-2">
                        {details[frage.fragen_id]?.antworten.map((antwort) => (
                          <div
                            key={antwort.antwort_id}
                            className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="font-medium text-slate-900">
                                  {antwort.antwort}
                                </div>
                                <div className="mt-1 text-xs text-slate-500">
                                  Typ: {antwort.antworttyp}
                                </div>
                              </div>

                              {antwort.ist_richtig && (
                                <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                                  richtig
                                </span>
                              )}
                            </div>

                            {antwort.medien.length > 0 && (
                              <div className="mt-3 text-xs text-slate-600">
                                Medien:{" "}
                                {antwort.medien
                                  .map(
                                    (medium) =>
                                      `${medium.medientyp}: ${medium.datei}`
                                  )
                                  .join(", ")}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mt-5">
                      <h4 className="font-semibold text-slate-900">
                        Medien zur Frage
                      </h4>

                      {details[frage.fragen_id]?.medien.length ? (
                        <div className="mt-2 space-y-2">
                          {details[frage.fragen_id]?.medien.map((medium) => (
                            <div
                              key={medium.medien_id}
                              className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm"
                            >
                              <span className="font-medium">
                                {medium.medientyp}
                              </span>
                              : {medium.datei}
                              <span className="ml-2 text-xs text-slate-500">
                                Sortierung {medium.sortierung}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-2 text-sm text-slate-500">
                          Keine Medien zur Frage hinterlegt.
                        </p>
                      )}
                    </div>

                    <div className="mt-5">
                      <h4 className="font-semibold text-slate-900">
                        Verwendet in Quiz
                      </h4>

                      {details[frage.fragen_id]?.quiz.length ? (
                        <div className="mt-2 space-y-2">
                          {details[frage.fragen_id]?.quiz.map((quiz) => (
                            <div
                              key={`${quiz.quiz_id}-${quiz.sortierung}`}
                              className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm"
                            >
                              <div className="font-medium text-slate-900">
                                {quiz.titel || `Quiz ${quiz.quiz_id}`}
                              </div>
                              <div className="mt-1 text-xs text-slate-500">
                                Datum: {quiz.quiz_datum || "—"} · Sortierung:{" "}
                                {quiz.sortierung ?? "—"} · richtig:{" "}
                                {quiz.richtigeantworten ?? "—"} · falsch:{" "}
                                {quiz.falscheantworten ?? "—"}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-2 text-sm text-slate-500">
                          Diese Frage wurde noch in keinem Quiz verwendet.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </article>
            );
          })}
          {hasMore && (
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={isLoading}
                className={buttonSecondaryClass}
              >
                {isLoading ? "Lade..." : "Weitere 50 laden"}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}