"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  searchFragen,
  getFrageDetails,
  archiveFrage,
  restoreFrage,
  type FrageSuchResult,
  type FrageDetailsResult,
} from "./actions";
import ZuQuizHinzufuegenButton from "./ZuQuizHinzufuegenButton";
import QuizVerwendungPopover from "./QuizVerwendungPopover";
import type { QuizOption } from "./FragenWorkspace";
import { getBerlinDate } from "@/app/lib/berlinDate";
import { CloneQuestionButton } from "./editor/components/CloneQuestionButton";
import {
  getPendingCategoryBadgeLabel,
  parseQuestionOverviewFilters,
  serializeQuestionOverviewFilters,
  type QuestionOverviewFilters,
} from "./questionOverviewFilters";
import type { QuestionFilterCategory } from "./components/CategoryFilterCombobox";
import { QuestionOverviewControls } from "./components/QuestionOverviewControls";

const cloneErrorMessages = {
  QUESTION_NOT_FOUND: "Die Frage wurde nicht gefunden.",
  PERMISSION_DENIED: "Du darfst diese Frage nicht klonen.",
  QUESTION_IN_USE: "Die Frage konnte nicht geklont werden.",
  QUESTION_HAS_RELATIONS: "Die Frage konnte nicht geklont werden.",
  QUESTION_HAS_MEDIA: "Die Frage konnte nicht geklont werden.",
  UNEXPECTED_ERROR: "Die Frage konnte nicht geklont werden.",
};

type Kategorie = QuestionFilterCategory;

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
  templates,
  statusCounts,
}: {
  kategorien: Kategorie[];
  quizze: QuizOption[];
  templates: Array<{ id: string; name: string }>;
  statusCounts: Partial<
    Record<
      "MY_DRAFTS" | "MY_SUBMITTED" | "REVIEW_QUEUE" | "CHANGES_REQUESTED",
      number
    >
  >;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();
  const filters = useMemo(
    () =>
      parseQuestionOverviewFilters(
        new URLSearchParams(queryString),
        templates.map((template) => template.id),
        kategorien.map((category) => category.fragenkategorie_id),
      ),
    [kategorien, queryString, templates],
  );
  const [ergebnisse, setErgebnisse] = useState<FrageSuchResult[]>([]);
  const [meldung, setMeldung] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const [hasMore, setHasMore] = useState(false);
  const [nextOffset, setNextOffset] = useState(0);

  const [details, setDetails] = useState<Record<number, FrageDetailsResult | null>>(
    {}
  );
  const [detailsLoadingId, setDetailsLoadingId] = useState<number | null>(null);
  function updateFilters(next: QuestionOverviewFilters) {
    const params = serializeQuestionOverviewFilters(next);
    const nextQuery = params.toString();
    router.push(nextQuery ? `${pathname}?${nextQuery}` : pathname);
  }

  function replaceFilters(next: QuestionOverviewFilters) {
    const params = serializeQuestionOverviewFilters(next);
    const nextQuery = params.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname);
  }

  async function runSearch(
    activeFilters: QuestionOverviewFilters,
    offset = 0,
  ) {
    setMeldung("");
    setIsLoading(true);
    try {
      const result = await searchFragen({
        suchtext: activeFilters.query,
        sourceState: activeFilters.sourceState,
        mediaState: activeFilters.mediaState,
        answerMode: activeFilters.answerMode,
        kategorieId: activeFilters.categoryId,
        statuses: activeFilters.statuses,
        templateIds: activeFilters.templateIds,
        limit: 50,
        offset,
      });

      setErgebnisse((current) =>
        offset === 0 ? result.results : [...current, ...result.results],
      );
      setHasMore(result.hasMore);
      setNextOffset(result.nextOffset);
      setDetails({});
      setDetailsLoadingId(null);
      if (offset === 0 && result.results.length === 0) {
        setMeldung("Keine passenden Fragen gefunden.");
      }
    } catch (error) {
      console.error("Fragensuche fehlgeschlagen", {
        errorClass: error instanceof Error ? error.name : "UnknownError",
      });
      setMeldung("Die Fragen konnten nicht geladen werden.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void runSearch(filters);
    }, 250);
    return () => window.clearTimeout(timeout);
    // `filters` is derived from this stable URL representation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryString]);

  function handleSearch() {
    void runSearch(filters);
  }

  async function handleLoadMore() {
    await runSearch(filters, nextOffset);
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
    updateFilters({
      query: filters.query,
      sourceState: null,
      statuses: [],
      templateIds: [],
      categoryId: null,
      mediaState: null,
      answerMode: null,
    });
  }

  const suchtext = filters.query;
  const setSuchtext = (query: string) =>
    replaceFilters({ ...filters, query });

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
      <QuestionOverviewControls
        filters={filters}
        categories={kategorien}
        templates={templates}
        statusCounts={statusCounts}
        query={suchtext}
        loading={isLoading}
        onQueryChange={setSuchtext}
        onApplySearch={handleSearch}
        onChange={updateFilters}
        onReset={resetSearch}
      />
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
            const pendingCategoryBadgeLabel =
              getPendingCategoryBadgeLabel(frage.pending_kategorien);
            const hatKeineMedien = frage.medien_anzahl === 0;
            const hatKeineAntworten = frage.antworten_anzahl === 0;
            const wurdeNochNieVerwendet = frage.quiz_anzahl === 0;
            const istAbgelaufen = Boolean(
              frage.gueltig_bis &&
                frage.gueltig_bis < getBerlinDate().toISOString().slice(0, 10),
            );
            const workflowStatus = {
              DRAFT: "Entwurf",
              IN_REVIEW: "Eingereicht",
              CHANGES_REQUESTED: "Feedback",
              APPROVED: "Freigegeben",
            }[frage.review_status];
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

                      {frage.ist_archiviert && (
                        <StatusPill label="archiviert" tone="slate" />
                      )}

                      <StatusPill
                        label={workflowStatus}
                        tone={frage.review_status === "APPROVED" ? "green" : "blue"}
                      />

                      {istAbgelaufen && (
                        <StatusPill label="abgelaufen" tone="orange" />
                      )}

                      {hatKeineAntworten && (
                        <StatusPill label="keine Antworten" tone="red" />
                      )}

                      {hatKeineMedien && (
                        <StatusPill label="keine Medien" tone="orange" />
                      )}

                      {pendingCategoryBadgeLabel && (
                        <span
                          title={frage.pending_kategorien.join(", ")}
                          className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-800"
                        >
                          {pendingCategoryBadgeLabel}
                        </span>
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
                    <p className="mt-1 break-words text-sm text-slate-500">
                      Geltungsbereich: {frage.geltungsbereich === "GLOBAL" ? "Global" : frage.eventreihen.join(", ") || "Keine Eventreihe"}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Antwortart:{" "}
                      {frage.answer_mode === "OPEN"
                        ? "Offen"
                        : frage.answer_mode === "CLOSED"
                          ? "Geschlossen"
                          : "Nicht eindeutig"}
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
                  <Link
                    href={`/fragen/editor/${frage.fragen_id}`}
                    className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-700"
                  >
                    Bearbeiten
                  </Link>

                  {frage.can_clone && (
                    <CloneQuestionButton
                      questionId={frage.fragen_id}
                      label="Klonen"
                      pendingLabel="Wird geklont …"
                      errorMessages={cloneErrorMessages}
                      className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50 disabled:opacity-60 sm:w-auto"
                    />
                  )}

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
