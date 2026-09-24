import Link from "next/link";
import AppHeader from "@/app/components/AppHeader";
import { requireAdmin } from "@/app/lib/permissions";
import { loadOpenTdbImportOverview } from "@/app/fragen/import/external/externalQuestionImport.server";
import {
  approveExternalQuestionAction,
  rejectExternalQuestionAction,
  saveExternalQuestionAction,
  startOpenTdbPilotAction,
} from "./actions";

export const maxDuration = 60;

const issueLabels: Record<string, string> = {
  AMBIGUOUS_QUESTION: "Frage möglicherweise mehrdeutig",
  CATEGORY_UNMAPPED: "Keine bestehende Kategorie zugeordnet",
  DUPLICATE_ANSWER: "Antworten nicht eindeutig",
  LANGUAGE_DEPENDENT: "Sprachabhängige Frage",
  LOCALE_SPECIFIC: "Stark lokaler Kontext",
  MALFORMED_CONTENT: "Strukturell ungültiger Inhalt",
  MISSING_FACT_SOURCE: "Fachquelle fehlt",
  MISSING_TRANSLATION: "Deutsche Lokalisierung fehlt",
  POOR_DISTRACTOR: "Schwacher Distraktor",
  POTENTIAL_EXACT_DUPLICATE: "Exakte Dublette möglich",
  POTENTIAL_SEMANTIC_DUPLICATE: "Semantische Dublette möglich",
  TIME_SENSITIVE: "Zeitabhängige Frage",
  UNSUPPORTED_TYPE: "Nicht unterstützter Fragetyp",
};

const statusLabels: Record<string, string> = {
  IMPORTED: "Importiert",
  AUTO_REJECTED: "Automatisch ausgesondert",
  REVIEW_REQUIRED: "Prüfung erforderlich",
  APPROVED: "In Freigabe übernommen",
  REJECTED: "Abgelehnt",
};

const blockingIssues = new Set([
  "DUPLICATE_ANSWER",
  "MALFORMED_CONTENT",
  "MISSING_FACT_SOURCE",
  "MISSING_TRANSLATION",
  "POTENTIAL_EXACT_DUPLICATE",
  "UNSUPPORTED_TYPE",
]);

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
  const overview = await loadOpenTdbImportOverview({ batchId, page });
  const totalPages = Math.max(1, Math.ceil(overview.total / overview.pageSize));

  return (
    <>
      <AppHeader />
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
              <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {[
                  ["Abgerufen", overview.batch?.fetched_count ?? 0],
                  ["Automatisch ausgesondert", overview.counts.AUTO_REJECTED ?? 0],
                  ["Prüfung erforderlich", overview.counts.REVIEW_REQUIRED ?? 0],
                  ["Übernommen", overview.counts.APPROVED ?? 0],
                  ["Abgelehnt", overview.counts.REJECTED ?? 0],
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
                  <span>{overview.total} Datensätze</span>
                </div>
              </section>

              {overview.summary && (
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="text-lg font-semibold">Pilot-Auswertung</h2>
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full min-w-[34rem] text-left text-sm">
                      <tbody className="divide-y divide-slate-100">
                        {[
                          ["Von OpenTDB abgerufen", overview.summary.fetched],
                          ["Automatisch verworfen", overview.summary.autoRejected],
                          ["Übersetzt", overview.summary.translated],
                          ["Faktencheck bestanden", overview.summary.verified],
                          ["Faktencheck fehlgeschlagen", overview.summary.factCheckFailed],
                          ["Mögliche Dubletten", overview.summary.possibleDuplicates],
                          ["Review erforderlich", overview.summary.reviewRequired],
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
                    <article key={item.import_item_id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap gap-2 text-xs font-semibold">
                          <span className="rounded-full bg-slate-100 px-3 py-1">#{item.import_item_id}</span>
                          <span className="rounded-full bg-sky-100 px-3 py-1 text-sky-900">{statusLabels[item.status] ?? item.status}</span>
                          <span className="rounded-full bg-slate-100 px-3 py-1">{item.original_category}</span>
                          <span className="rounded-full bg-slate-100 px-3 py-1">{item.original_difficulty}</span>
                        </div>
                        <code className="text-xs text-slate-500">{item.external_reference.slice(0, 24)}…</code>
                      </div>

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
                          <form action={approveExternalQuestionAction}>
                            <input type="hidden" name="itemId" value={item.import_item_id} />
                            <input type="hidden" name="batchId" value={overview.batch!.import_batch_id} />
                            <input type="hidden" name="page" value={overview.page} />
                            <button disabled={cannotApprove} title={cannotApprove ? "Blockierende Qualitätsmängel zuerst beheben" : undefined} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300">
                              Freigeben (in Prüfqueue)
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
                    </article>
                  );
                })}
              </div>

              <nav className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 text-sm">
                {overview.page > 1 ? <Link className="font-semibold underline" href={`/admin/question-import?batch=${overview.batch!.import_batch_id}&page=${overview.page - 1}`}>← Zurück</Link> : <span />}
                <span>Seite {overview.page} von {totalPages}</span>
                {overview.page < totalPages ? <Link className="font-semibold underline" href={`/admin/question-import?batch=${overview.batch!.import_batch_id}&page=${overview.page + 1}`}>Weiter →</Link> : <span />}
              </nav>
            </>
          )}
        </div>
      </main>
    </>
  );
}
