import Link from "next/link";
import { requireAdmin } from "@/app/lib/permissions";
import { loadOpenTdbImportOverview } from "@/app/fragen/import/external/externalQuestionImport.server";
import {
  approveExternalQuestionAction,
  processOpenTdbPhaseTwoAction,
  rejectExternalQuestionAction,
  saveExternalQuestionAction,
  startExternalQuestionReviewAction,
  startOpenTdbPilotAction,
} from "./actions";

export const maxDuration = 300;

const issueLabels: Record<string, string> = {
  AMBIGUOUS_QUESTION: "Frage möglicherweise mehrdeutig",
  AUTOMATION_FAILED: "Automatische Aufbereitung fehlgeschlagen",
  CATEGORY_UNMAPPED: "Keine bestehende Kategorie zugeordnet",
  DUPLICATE_ANSWER: "Antworten nicht eindeutig",
  FACT_AMBIGUOUS: "Faktenlage mehrdeutig",
  FACT_CONTRADICTED: "Ausgangsantwort fachlich widerlegt",
  LANGUAGE_DEPENDENT: "Sprachabhängige Frage",
  LOCALIZATION_UNCERTAIN: "Lokalisierung benötigt Prüfung",
  LOCALE_SPECIFIC: "Stark lokaler Kontext",
  MALFORMED_CONTENT: "Strukturell ungültiger Inhalt",
  MISSING_FACT_SOURCE: "Fachquelle fehlt",
  MISSING_TRANSLATION: "Deutsche Lokalisierung fehlt",
  POOR_DISTRACTOR: "Schwacher Distraktor",
  POTENTIAL_EXACT_DUPLICATE: "Exakte Dublette möglich",
  POTENTIAL_SEMANTIC_DUPLICATE: "Semantische Dublette möglich",
  SOURCE_QUALITY_LOW: "Quellenqualität benötigt Prüfung",
  TIME_SENSITIVE: "Zeitabhängige Frage",
  UNSUPPORTED_TYPE: "Nicht unterstützter Fragetyp",
};

const statusLabels: Record<string, string> = {
  IMPORTED: "Importiert",
  AUTO_REJECTED: "Automatisch ausgesondert",
  READY_FOR_REVIEW: "Bereit zur Endkontrolle",
  REVIEW_REQUIRED: "Prüfung erforderlich",
  REJECT_RECOMMENDED: "Ablehnung empfohlen",
  APPROVED: "In Freigabe übernommen",
  REJECTED: "Abgelehnt",
};

const blockingIssues = new Set([
  "DUPLICATE_ANSWER",
  "MALFORMED_CONTENT",
  "MISSING_FACT_SOURCE",
  "MISSING_TRANSLATION",
  "FACT_AMBIGUOUS",
  "FACT_CONTRADICTED",
  "POTENTIAL_EXACT_DUPLICATE",
  "UNSUPPORTED_TYPE",
]);

const qualityStatuses = [
  "READY_FOR_REVIEW",
  "REVIEW_REQUIRED",
  "REJECT_RECOMMENDED",
] as const;

function qualityStatusParam(value: string | string[] | undefined) {
  const candidate = Array.isArray(value) ? value[0] : value;
  return qualityStatuses.find((status) => status === candidate);
}

function numberParam(value: string | string[] | undefined, fallback: number) {
  const parsed = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export default async function ExternalQuestionImportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const batchId = numberParam(params.batch, 0) || undefined;
  const page = numberParam(params.page, 1);
  const qualityStatus = qualityStatusParam(params.status);
  const overview = await loadOpenTdbImportOverview({ batchId, page, qualityStatus });
  const totalPages = Math.max(1, Math.ceil(overview.total / overview.pageSize));

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-950 md:px-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">
                Externe Fragen · Preview-Pilot
              </p>
              <h1 className="mt-2 text-3xl font-bold">OpenTDB-Importprüfung</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-600">
                Original, Lokalisierung, Fachquelle und Dubletten werden vor der
                Übernahme in den regulären Fragen-Lifecycle getrennt geprüft.
                Eine Übernahme veröffentlicht keine Frage automatisch.
              </p>
            </div>
            <Link href="/fragen" className="text-sm font-semibold text-slate-700 underline">
              Zur Fragenredaktion
            </Link>
          </header>

          {overview.batches.length === 0 || overview.batch?.status === "FAILED" ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold">Technischer Pilot</h2>
              <p className="mt-2 text-sm text-slate-600">
                Der Lauf ruft exakt 100 verifizierte Multiple-Choice-Fragen ab,
                verteilt sie auf drei Schwierigkeitsgrade und legt ausschließlich
                Reviewkandidaten an. Fehlende Übersetzung oder Fachquelle blockiert
                die Übernahme.
              </p>
              {overview.batch?.status === "FAILED" && (
                <p className="mt-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-900">
                  Der vorige Lauf wurde sicher abgebrochen. Bereits gespeicherte
                  Providerreferenzen werden beim neuen Lauf ausgeschlossen.
                </p>
              )}
              <form action={startOpenTdbPilotAction} className="mt-5">
                <button className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white">
                  100-Fragen-Pilot starten
                </button>
              </form>
            </section>
          ) : (
            <>
              <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                {[
                  ["Abgerufen", overview.batch?.fetched_count ?? 0],
                  ["Aufbereitet", overview.summary?.processed ?? 0],
                  ["Bereit", overview.counts.READY_FOR_REVIEW ?? 0],
                  ["Prüfung erforderlich", overview.counts.REVIEW_REQUIRED ?? 0],
                  ["Ablehnung empfohlen", overview.counts.REJECT_RECOMMENDED ?? 0],
                  ["Automationsfehler", overview.summary?.automationFailed ?? 0],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-2xl font-bold">{value}</p>
                    <p className="mt-1 text-xs text-slate-500">{label}</p>
                  </div>
                ))}
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <strong>Batch #{overview.batch?.import_batch_id}</strong>
                  <span>Status: {overview.batch?.status}</span>
                  <span>Lizenz: CC BY-SA 4.0</span>
                  <span>{overview.batchTotal} Datensätze</span>
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  <form action={processOpenTdbPhaseTwoAction}>
                    <input type="hidden" name="batchId" value={overview.batch!.import_batch_id} />
                    <button
                      disabled={(overview.summary?.processed ?? 0) >= overview.batchTotal}
                      className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      Nächste 5 Kandidaten automatisch aufbereiten
                    </button>
                  </form>
                  {(overview.summary?.automationFailed ?? 0) > 0 && (
                    <form action={processOpenTdbPhaseTwoAction}>
                      <input type="hidden" name="batchId" value={overview.batch!.import_batch_id} />
                      <input type="hidden" name="mode" value="retry" />
                      <button className="rounded-xl border border-rose-300 px-4 py-2.5 text-sm font-semibold text-rose-800">
                        Bis zu 5 Fehler erneut versuchen
                      </button>
                    </form>
                  )}
                  {(overview.summary?.verificationCounts.NO_RELIABLE_SOURCE ?? 0) > 0 && (
                    <form action={processOpenTdbPhaseTwoAction}>
                      <input type="hidden" name="batchId" value={overview.batch!.import_batch_id} />
                      <input type="hidden" name="mode" value="retry-sources" />
                      <button className="rounded-xl border border-amber-300 px-4 py-2.5 text-sm font-semibold text-amber-900">
                        Bis zu 5 fehlende Quellen erneut prüfen
                      </button>
                    </form>
                  )}
                </div>
                <p className="mt-3 text-xs text-slate-500">
                  Jeder Lauf verarbeitet ausschließlich fünf bereits vorhandene Datensätze aus Batch #1. Es werden keine weiteren OpenTDB-Fragen abgerufen.
                </p>
              </section>

              <nav className="flex flex-wrap gap-2 text-sm">
                <Link href={`/admin/question-import?batch=${overview.batch!.import_batch_id}`} className={`rounded-full px-3 py-1.5 font-semibold ${!overview.qualityStatus ? "bg-slate-950 text-white" : "bg-white text-slate-700"}`}>Alle</Link>
                {qualityStatuses.map((status) => (
                  <Link key={status} href={`/admin/question-import?batch=${overview.batch!.import_batch_id}&status=${status}`} className={`rounded-full px-3 py-1.5 font-semibold ${overview.qualityStatus === status ? "bg-slate-950 text-white" : "bg-white text-slate-700"}`}>
                    {statusLabels[status]} ({overview.counts[status] ?? 0})
                  </Link>
                ))}
              </nav>

              {overview.summary && (
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="text-lg font-semibold">Pilot-Auswertung</h2>
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full min-w-[34rem] text-left text-sm">
                      <tbody className="divide-y divide-slate-100">
                        {[
                          ["Von OpenTDB abgerufen", overview.summary.fetched],
                          ["Automatisch verworfen", overview.summary.autoRejected],
                          ["Automatisch verarbeitet", overview.summary.processed],
                          ["Erfolgreich lokalisiert", overview.summary.localized],
                          ["Lokalisierung problematisch", overview.summary.localizationProblematic],
                          ["Faktencheck VERIFIED", overview.summary.verificationCounts.VERIFIED ?? 0],
                          ["Faktencheck CONTRADICTED", overview.summary.verificationCounts.CONTRADICTED ?? 0],
                          ["Faktencheck AMBIGUOUS", overview.summary.verificationCounts.AMBIGUOUS ?? 0],
                          ["Faktencheck NO_RELIABLE_SOURCE", overview.summary.verificationCounts.NO_RELIABLE_SOURCE ?? 0],
                          ["Mögliche Dubletten", overview.summary.possibleDuplicates],
                          ["READY_FOR_REVIEW", overview.summary.readyForReview],
                          ["Review erforderlich", overview.summary.reviewRequired],
                          ["REJECT_RECOMMENDED", overview.summary.rejectRecommended],
                          ["Automatisch vollständig aufbereitet", overview.summary.fullyPrepared],
                          ["Manuell freigegeben", overview.summary.approved],
                          ["Manuell abgelehnt", overview.summary.rejected],
                        ].map(([label, value]) => (
                          <tr key={label}>
                            <th className="py-2 pr-6 font-medium text-slate-600">{label}</th>
                            <td className="py-2 font-semibold">{value}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-4 text-sm text-slate-700">
                    Übernahmequote: {Math.round(overview.summary.acceptanceRate * 100)} %
                    {overview.summary.averageReviewMinutes !== null
                      ? ` · Ø Prüfzeit ${overview.summary.averageReviewMinutes.toFixed(1)} Minuten`
                      : " · Noch keine abgeschlossene manuelle Prüfung"}
                  </p>
                  {Object.keys(overview.summary.issueCounts).length > 0 && (
                    <div className="mt-4">
                      <h3 className="text-sm font-semibold">Häufigste Prüfhinweise</h3>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {Object.entries(overview.summary.issueCounts)
                          .sort((left, right) => right[1] - left[1])
                          .map(([issue, count]) => (
                            <span key={issue} className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-950">
                              {issueLabels[issue] ?? issue}: {count}
                            </span>
                          ))}
                      </div>
                    </div>
                  )}
                </section>
              )}

              <div className="space-y-5">
                {overview.items.map((item) => {
                  const isReviewed = item.status === "APPROVED" || item.status === "REJECTED";
                  const cannotApprove = item.issues.some((issue) => blockingIssues.has(issue));
                  return (
                    <article id={`item-${item.import_item_id}`} key={item.import_item_id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap gap-2 text-xs font-semibold">
                          <span className="rounded-full bg-slate-100 px-3 py-1">#{item.import_item_id}</span>
                          <span className="rounded-full bg-sky-100 px-3 py-1 text-sky-900">{statusLabels[item.status] ?? item.status}</span>
                          <span className="rounded-full bg-violet-100 px-3 py-1 text-violet-900">Lokalisierung: {item.localization_status}</span>
                          <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-900">Faktencheck: {item.verification_status}</span>
                          <span className="rounded-full bg-slate-100 px-3 py-1">{item.original_category}</span>
                          <span className="rounded-full bg-slate-100 px-3 py-1">{item.original_difficulty}</span>
                        </div>
                        <code className="text-xs text-slate-500">{item.external_reference.slice(0, 24)}…</code>
                      </div>

                      {item.automation_error && (
                        <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-900">
                          Automatische Aufbereitung fehlgeschlagen: <code>{item.automation_error}</code>
                        </p>
                      )}

                      <div className="mt-5 grid gap-5 lg:grid-cols-2">
                        <section className="rounded-xl bg-slate-50 p-4">
                          <h2 className="font-semibold">Original (Englisch)</h2>
                          <p className="mt-3 text-sm font-medium">{item.original_question}</p>
                          <ul className="mt-3 space-y-1 text-sm text-slate-700">
                            <li className="font-semibold text-emerald-800">✓ {item.original_correct_answer}</li>
                            {item.originalIncorrectAnswers.map((answer) => <li key={answer}>– {answer}</li>)}
                          </ul>
                        </section>

                        <form action={saveExternalQuestionAction} className="space-y-3">
                          <input type="hidden" name="itemId" value={item.import_item_id} />
                          <input type="hidden" name="batchId" value={overview.batch!.import_batch_id} />
                          <input type="hidden" name="page" value={overview.page} />
                          <h2 className="font-semibold">Aufbereitete Version</h2>
                          <label className="block text-xs font-semibold text-slate-700">
                            Deutsche Frage
                            <textarea name="question" maxLength={300} required defaultValue={item.prepared_question ?? ""} className="mt-1 min-h-20 w-full rounded-xl border border-slate-300 p-3 text-sm font-normal" />
                          </label>
                          <label className="block text-xs font-semibold text-slate-700">
                            Richtige Antwort
                            <input name="correctAnswer" maxLength={200} required defaultValue={item.prepared_correct_answer ?? ""} className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-sm font-normal" />
                          </label>
                          {[0, 1, 2].map((index) => (
                            <label key={index} className="block text-xs font-semibold text-slate-700">
                              Falsche Antwort {index + 1}
                              <input name={`incorrectAnswer${index}`} maxLength={200} required defaultValue={item.preparedIncorrectAnswers[index] ?? ""} className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-sm font-normal" />
                            </label>
                          ))}
                          <div className="grid gap-3 sm:grid-cols-2">
                            <label className="block text-xs font-semibold text-slate-700">
                              Fachquelle – Titel
                              <input name="verificationSourceTitle" maxLength={300} defaultValue={item.verification_source_title ?? ""} className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-sm font-normal" />
                            </label>
                            <label className="block text-xs font-semibold text-slate-700">
                              Fachquelle – HTTPS-URL
                              <input name="verificationSourceUrl" type="url" defaultValue={item.verification_source_url ?? ""} className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-sm font-normal" />
                            </label>
                          </div>
                          <label className="block text-xs font-semibold text-slate-700">
                            Erklärung / Zusatzinformation
                            <textarea name="explanation" maxLength={500} defaultValue={item.explanation ?? ""} className="mt-1 min-h-16 w-full rounded-xl border border-slate-300 p-3 text-sm font-normal" />
                          </label>
                          <label className="block text-xs font-semibold text-slate-700">
                            Bestehende Kategorie
                            <select name="categoryId" defaultValue={item.suggested_category_id ?? ""} className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-sm font-normal">
                              <option value="">Keine – Vorschlag dokumentieren</option>
                              {overview.categories.map((category) => <option key={category.fragenkategorie_id} value={category.fragenkategorie_id}>{category.kategorie}</option>)}
                            </select>
                          </label>
                          <label className="block text-xs font-semibold text-slate-700">
                            Kategorievorschlag
                            <input name="suggestedCategoryName" maxLength={100} defaultValue={item.suggested_category_name ?? ""} className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-sm font-normal" />
                          </label>
                          {!isReviewed && <button className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold">Bearbeitung speichern</button>}
                        </form>
                      </div>

                      {(item.verification_note || item.verificationSources.length > 0 || item.automationChanges.length > 0) && (
                        <section className="mt-5 grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-2">
                          <div>
                            <h3 className="text-sm font-semibold">Faktenprüfung</h3>
                            <p className="mt-2 text-sm text-slate-700">{item.verification_note || "Keine Verifikationsnotiz."}</p>
                            {item.verificationSources.length > 0 && (
                              <ul className="mt-2 space-y-1 text-sm">
                                {item.verificationSources.map((source) => (
                                  <li key={source.url}>
                                    <a href={source.url} target="_blank" rel="noreferrer" className="font-semibold underline">{source.title}</a>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                          <div>
                            <h3 className="text-sm font-semibold">Automatische Änderungen</h3>
                            {item.automationChanges.length > 0 ? (
                              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                                {item.automationChanges.map((change, index) => <li key={`${index}-${change}`}>{change}</li>)}
                              </ul>
                            ) : <p className="mt-2 text-sm text-slate-500">Keine dokumentierten Änderungen.</p>}
                          </div>
                        </section>
                      )}

                      <div className="mt-5 flex flex-wrap gap-2">
                        {item.issues.map((issue) => (
                          <span key={issue} className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-950">{issueLabels[issue] ?? issue}</span>
                        ))}
                      </div>
                      {item.duplicates.length > 0 && (
                        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">
                          <strong>Mögliche Dubletten</strong>
                          <ul className="mt-2 space-y-1">
                            {item.duplicates.map((duplicate) => (
                              <li key={duplicate.questionId}>
                                <Link className="underline" href={`/fragen/editor/${duplicate.questionId}`}>Frage #{duplicate.questionId}</Link>
                                {` · ${Math.round(duplicate.similarity * 100)} % · ${duplicate.question}`}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {!isReviewed && (
                        <div className="mt-5 grid gap-3 md:grid-cols-[auto_1fr]">
                          {!item.review_started_at && (
                            <form action={startExternalQuestionReviewAction} className="md:col-span-2">
                              <input type="hidden" name="itemId" value={item.import_item_id} />
                              <input type="hidden" name="batchId" value={overview.batch!.import_batch_id} />
                              <input type="hidden" name="page" value={overview.page} />
                              <button className="rounded-xl border border-sky-300 px-4 py-2 text-sm font-semibold text-sky-900">Endkontrolle starten</button>
                            </form>
                          )}
                          <form action={approveExternalQuestionAction}>
                            <input type="hidden" name="itemId" value={item.import_item_id} />
                            <input type="hidden" name="batchId" value={overview.batch!.import_batch_id} />
                            <input type="hidden" name="page" value={overview.page} />
                            <button disabled={cannotApprove} title={cannotApprove ? "Blockierende Qualitätsmängel zuerst beheben" : undefined} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300">
                              Übernehmen / zur Freigabe geben
                            </button>
                          </form>
                          <form action={rejectExternalQuestionAction} className="flex flex-col gap-2 sm:flex-row">
                            <input type="hidden" name="itemId" value={item.import_item_id} />
                            <input type="hidden" name="batchId" value={overview.batch!.import_batch_id} />
                            <input type="hidden" name="page" value={overview.page} />
                            <input name="reason" required maxLength={1000} placeholder="Ablehnungsgrund" className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                            <button className="rounded-xl bg-rose-700 px-4 py-2 text-sm font-semibold text-white">Ablehnen</button>
                          </form>
                        </div>
                      )}
                      {item.question && (
                        <p className="mt-4 text-sm text-emerald-800">
                          Als Frage #{item.question.fragen_id} in die reguläre Freigabe übernommen. <Link className="font-semibold underline" href={`/fragen/editor/${item.question.fragen_id}`}>Öffnen</Link>
                        </p>
                      )}
                      <p className="mt-3 text-xs text-slate-500">
                        {item.review_started_at ? `Review gestartet: ${item.review_started_at.toLocaleString("de-DE")}` : "Review noch nicht gestartet"}
                        {` · manuelle Bearbeitungen: ${item.review_edit_count}`}
                      </p>
                    </article>
                  );
                })}
              </div>

              <nav className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 text-sm">
                {overview.page > 1 ? <Link className="font-semibold underline" href={`/admin/question-import?batch=${overview.batch!.import_batch_id}&page=${overview.page - 1}${overview.qualityStatus ? `&status=${overview.qualityStatus}` : ""}`}>← Zurück</Link> : <span />}
                <span>Seite {overview.page} von {totalPages}</span>
                {overview.page < totalPages ? <Link className="font-semibold underline" href={`/admin/question-import?batch=${overview.batch!.import_batch_id}&page=${overview.page + 1}${overview.qualityStatus ? `&status=${overview.qualityStatus}` : ""}`}>Weiter →</Link> : <span />}
              </nav>
            </>
          )}
        </div>
    </main>
  );
}
