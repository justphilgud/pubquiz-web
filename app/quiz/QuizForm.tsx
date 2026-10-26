"use client";

import { useMemo, useState } from "react";
import { useContentNavigationGuard } from "@/app/components/content/useContentNavigationGuard";
import Link from "next/link";
import EventSeriesPicker from "@/app/workspaces/EventSeriesPicker";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import {
  archiveQuiz,
  createQuiz,
  deleteQuiz,
  restoreQuiz,
  updateQuiz,
  type QuizResult,
} from "./actions";
import type { EventSeriesOption } from "@/app/eventreihen/actions";
import { resolvePublicEventContent } from "@/app/eventreihen/publicEventContent";
import { QuizEventImageEditor } from "./QuizEventImageEditor";
import type { BlobEnvironmentPrefix } from "@/app/lib/blobPath";
import { QuizCopyDialog } from "./QuizCopyDialog";
import { isEventSeriesSelectable } from "@/app/eventreihen/eventSeriesPolicy";
import {
  ArchiveBoxIcon,
  ChartBarIcon,
  LockOpenIcon,
  MegaphoneIcon,
  PlayIcon,
  TrashIcon,
  UsersIcon,
  Cog6ToothIcon,
  PencilSquareIcon,
} from "@heroicons/react/24/outline";
import type { RenderingMessages } from "@/app/i18n/renderingMessages";
import { templateRegistry } from "@/app/rendering/templateRegistry";
import {
  resolvePresentationTemplate,
} from "@/app/rendering/templateResolver";
import type { AssignablePresentationTemplate } from "@/app/rendering/presentationTemplates/presentationTemplateRepository.server";
import {
  toRuntimePresentationTemplate,
} from "@/app/rendering/presentationTemplates/presentationTemplate";
import {
  DEFAULT_NEW_QUIZ_SOLUTION_STRATEGY,
  getQuizSolutionStrategyLabel,
  QUIZ_STANDARD_SOLUTION_STRATEGIES,
  type QuizSolutionStrategy,
} from "./flow/quizFlow";

const inputClass =
  "min-h-11 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200";

const statusLabels = {
  UPCOMING: "Bevorstehend",
  TODAY: "Heute",
  PAST: "Vergangen",
  ARCHIVED: "Archiviert",
  MISSING_DATE: "Datum fehlt",
} as const;

type FormState = {
  eventSeriesId: string;
  title: string;
  date: string;
  time: string;
  venueName: string;
  mapUrl: string;
  publicUrl: string;
  internalNote: string;
  reservationUrl: string;
  publicDescription: string;
  publicDescriptionMode: string;
  presentationTemplateId: string;
  solutionStrategy: QuizSolutionStrategy;
};

function emptyForm(initialEventSeriesId?: number): FormState {
  return {
    eventSeriesId: initialEventSeriesId ? String(initialEventSeriesId) : "",
    title: "",
    date: "",
    time: "",
    venueName: "",
    mapUrl: "",
    publicUrl: "",
    internalNote: "",
    reservationUrl: "", publicDescription: "", publicDescriptionMode: "APPEND",
    presentationTemplateId: "",
    solutionStrategy: DEFAULT_NEW_QUIZ_SOLUTION_STRATEGY,
  };
}

function formFromQuiz(quiz: QuizResult): FormState {
  return {
    eventSeriesId: String(quiz.eventreihe_id),
    title: quiz.titel ?? "",
    date: quiz.quiz_datum ?? "",
    time: quiz.veranstaltungszeit ?? "",
    venueName: quiz.veranstaltungsname ?? "",
    mapUrl: quiz.karten_url ?? "",
    publicUrl: quiz.oeffentliche_url ?? "",
    internalNote: quiz.bemerkung ?? "",
    reservationUrl: quiz.reservierungs_url ?? "",
    publicDescription: quiz.oeffentliche_beschreibung ?? "",
    publicDescriptionMode: quiz.oeffentliche_beschreibung_modus ?? "APPEND",
    presentationTemplateId: quiz.presentation_template_id ?? "",
    solutionStrategy: quiz.aufloesungsstrategie,
  };
}

export default function QuizForm({
  quizze,
  workspaceSeriesId,
  eventSeries,
  initialEventSeriesId,
  messages,
  presentationTemplates,
  canAssignPresentationTemplates,
  initialEditingQuizId,
  environmentPrefix,
}: {
  quizze: QuizResult[];
  workspaceSeriesId?: number;
  eventSeries: EventSeriesOption[];
  initialEventSeriesId?: number;
  messages: RenderingMessages;
  presentationTemplates: AssignablePresentationTemplate[];
  canAssignPresentationTemplates: boolean;
  initialEditingQuizId?: number;
  environmentPrefix: BlobEnvironmentPrefix;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const returnTo = pathname + (searchParams.size ? `?${searchParams}` : "");
  function filterHref(seriesId: number | null) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("editQuizId");
    if (seriesId === null) params.delete("series"); else params.set("series", String(seriesId));
    return pathname + (params.size ? `?${params}` : "");
  }
  function setStatusFilter(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set("status", value); else params.delete("status");
    router.push(pathname + (params.size ? `?${params}` : ""), { scroll: false });
  }
  const initialEditingQuiz = quizze.find((quiz) => quiz.quiz_id === initialEditingQuizId);
  const [editingQuizId, setEditingQuizId] = useState<number | null>(initialEditingQuiz?.quiz_id ?? null);
  const [form, setForm] = useState(() =>
    initialEditingQuiz ? formFromQuiz(initialEditingQuiz) : emptyForm(initialEventSeriesId),
  );
  const [savedForm, setSavedForm] = useState(() => JSON.stringify(form));
  const allowSavedNavigation = useContentNavigationGuard(JSON.stringify(form) !== savedForm);
  const [message, setMessage] = useState("");
  const [formOpen, setFormOpen] = useState(Boolean(initialEditingQuiz || initialEventSeriesId));
  const eventSeriesFilter = workspaceSeriesId ? String(workspaceSeriesId) : searchParams.get("series") ?? "";
  const statusFilter = searchParams.get("status") ?? "";
  const customPresentationTemplates = presentationTemplates
    .filter((template) => !templateRegistry.presentation.some(({ id }) => id === template.id))
    .map(toRuntimePresentationTemplate);

  const selectedSeries = eventSeries.find((entry) => entry.id === Number(form.eventSeriesId));
  const effectiveEvent = resolvePublicEventContent(selectedSeries ?? {}, {
    reservationUrl: form.reservationUrl, description: form.publicDescription, descriptionMode: form.publicDescriptionMode,
  });
  const activeEventSeries = eventSeries.filter((entry) => !entry.isArchived);
  const filteredQuizzes = useMemo(
    () =>
      quizze.filter(
        (quiz) =>
          (!eventSeriesFilter || quiz.eventreihe_id === Number(eventSeriesFilter)) &&
          (!statusFilter || quiz.temporal_status === statusFilter),
      ),
    [eventSeriesFilter, quizze, statusFilter],
  );

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function resetForm() {
    setEditingQuizId(null);
    setForm(emptyForm(initialEventSeriesId));
    setSavedForm(JSON.stringify(emptyForm(initialEventSeriesId)));
    setFormOpen(false);
  }

  function startEdit(quiz: QuizResult) {
    setEditingQuizId(quiz.quiz_id);
    setForm(formFromQuiz(quiz));
    setSavedForm(JSON.stringify(formFromQuiz(quiz)));
    setFormOpen(true);
    setMessage(
      quiz.quiz_datum
        ? `Quiz ${quiz.quiz_id} wird bearbeitet.`
        : "Dieses Bestandsquiz hat noch kein Datum. Vor dem Speichern muss ein Termin ergänzt werden.",
    );
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit() {
    setMessage("");
    const data = {
      eventSeriesId: Number(form.eventSeriesId),
      titel: form.title,
      quizDatum: form.date,
      veranstaltungszeit: form.time,
      veranstaltungsname: form.venueName,
      kartenUrl: form.mapUrl,
      oeffentlicheUrl: form.publicUrl,
      bemerkung: form.internalNote,
      reservationUrl: form.reservationUrl,
      publicDescription: form.publicDescription,
      publicDescriptionMode: form.publicDescriptionMode,
      presentationTemplateId: form.presentationTemplateId || null,
      solutionStrategy: form.solutionStrategy,
    };
    const result = editingQuizId === null
      ? await createQuiz(data)
      : await updateQuiz({ quizId: editingQuizId, ...data });
    setMessage(result.message);
    if (!result.success) return;
    allowSavedNavigation();
    if ("quizId" in result && result.quizId) {
      router.push(`/quiz/${result.quizId}`);
      return;
    }
    resetForm();
    router.refresh();
  }

  async function handleArchive(quizId: number) {
    const reason = window.prompt("Warum soll dieses Quiz archiviert werden?", "Quiz wurde durchgeführt");
    if (reason === null) return;
    await archiveQuiz({ quizId, archivierungsgrund: reason });
    router.refresh();
  }

  const selectedEventSeries = eventSeries.find(
    (entry) => entry.id === Number(form.eventSeriesId),
  );
  const effectivePresentation = resolvePresentationTemplate({
    quizTemplateId: form.presentationTemplateId || null,
    eventSeriesTemplateId: selectedEventSeries?.defaultPresentationTemplateId,
    additionalPresentationTemplates: customPresentationTemplates,
  });

  return (
    <div className="space-y-6 text-slate-900">
      <details
        open={formOpen}
        onToggle={(event) => setFormOpen(event.currentTarget.open)}
        className="rounded-3xl border border-slate-200 bg-white shadow-sm"
      >
        <summary className="cursor-pointer list-none px-5 py-4 text-lg font-semibold md:px-6">
          {editingQuizId === null ? "Neues Quiz anlegen" : "Quiz bearbeiten"}
          <span className="ml-2 text-sm font-normal text-slate-500">Pflichtfelder sind mit * gekennzeichnet.</span>
        </summary>
        <div className="border-t border-slate-100 p-5 md:p-6">
        <form action={handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-semibold">Eventreihe *</span>
              <select
                required
                value={form.eventSeriesId}
                onChange={(event) => updateField("eventSeriesId", event.target.value)}
                className={inputClass}
              >
                <option value="">Bitte auswählen</option>
                {(editingQuizId === null
                  ? activeEventSeries
                  : eventSeries.filter((entry) =>
                      isEventSeriesSelectable(entry, Number(form.eventSeriesId)),
                    )
                ).map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name}{entry.isArchived ? " (archiviert)" : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold">Name *</span>
              <input required maxLength={200} value={form.title} onChange={(event) => updateField("title", event.target.value)} className={inputClass} />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold">Datum *</span>
              <input required type="date" value={form.date} onChange={(event) => updateField("date", event.target.value)} className={inputClass} />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold">Uhrzeit</span>
              <input type="time" value={form.time} onChange={(event) => updateField("time", event.target.value)} className={inputClass} />
            </label>
            <label className="block md:col-span-2">
              <span className="mb-1 block text-sm font-semibold">Veranstaltungsort</span>
              <input maxLength={200} value={form.venueName} onChange={(event) => updateField("venueName", event.target.value)} className={inputClass} placeholder="z. B. Café Paule" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold">Google-Maps-/Kartenlink</span>
              <input type="url" maxLength={2048} value={form.mapUrl} onChange={(event) => updateField("mapUrl", event.target.value)} className={inputClass} placeholder="https://…" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold">Öffentliche Veranstaltungs-URL</span>
              <input type="url" maxLength={2048} value={form.publicUrl} onChange={(event) => updateField("publicUrl", event.target.value)} className={inputClass} placeholder="https://…" />
            </label>
          </div>
          <div>
            <label className="block min-w-0">
              <span className="mb-1 block text-sm font-semibold">{messages.fields.presentationTemplate}</span>
              <select value={form.presentationTemplateId} onChange={(event) => updateField("presentationTemplateId", event.target.value)} className={inputClass}>
                <option value="">{messages.fields.eventSeriesDefault}</option>
                {templateRegistry.presentation.filter(({ selectable }) => selectable).map((template) => <option key={template.id} value={template.id}>{messages.templates[template.labelKey].label}</option>)}
                {customPresentationTemplates.map((template) => <option key={template.id} value={template.id} disabled={!canAssignPresentationTemplates}>{template.displayName}</option>)}
              </select>
              <p className="mt-2 break-words text-sm text-slate-600">{messages.fields.effectiveTemplate}: <strong>{effectivePresentation.template.displayName ?? messages.templates[effectivePresentation.template.labelKey].label}</strong> · {messages.fields.templateSource}: {messages.sources[effectivePresentation.source]}</p>
              {effectivePresentation.usedFallback && <p role="status" className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">{messages.validation.fallback}</p>}
            </label>
          </div>
          <section className="space-y-4 rounded-xl border border-slate-200 p-4" aria-label="Öffentliche Veranstaltungsinformationen">
            <h3 className="font-semibold">Öffentliche Veranstaltungsinformationen</h3>
            <label className="block"><span className="mb-1 block text-sm font-semibold">Eigener Reservierungslink</span><input type="url" maxLength={2048} value={form.reservationUrl} onChange={(event) => updateField("reservationUrl", event.target.value)} className={inputClass} placeholder="Leer: aus Eventreihe übernehmen" /></label>
            <p className="break-words text-sm text-slate-600">Wirksamer Reservierungslink: {effectiveEvent.reservationUrl ?? "Keiner"} · {effectiveEvent.reservationSource === "QUIZ" ? "Eigener Link" : "Aus Eventreihe übernommen"}</p>
            <label className="block"><span className="mb-1 block text-sm font-semibold">Öffentliche Beschreibung des Termins</span><textarea maxLength={2000} value={form.publicDescription} onChange={(event) => updateField("publicDescription", event.target.value)} className={`${inputClass} min-h-28`} /></label>
            <label className="block"><span className="mb-1 block text-sm font-semibold">Beschreibung verwenden</span><select value={form.publicDescriptionMode} onChange={(event) => updateField("publicDescriptionMode", event.target.value)} className={inputClass}><option value="APPEND">Ergänzen</option><option value="REPLACE">Ersetzen</option></select></label>
            <p className="whitespace-pre-wrap break-words text-sm text-slate-600">Wirksame öffentliche Beschreibung: {effectiveEvent.description ?? "Keine"}</p>
            {editingQuizId !== null ? <QuizEventImageEditor key={editingQuizId} quizId={editingQuizId} savedUrl={quizze.find((quiz) => quiz.quiz_id === editingQuizId)?.veranstaltungsbild_url ?? null} seriesLogoUrl={selectedSeries?.logoUrl ?? null} environmentPrefix={environmentPrefix} /> : <p className="text-sm text-slate-600">Ein eigenes Veranstaltungsbild kann nach dem Anlegen in den Quiz-Einstellungen hochgeladen werden. Ohne eigenes Bild gilt das Logo der Eventreihe.</p>}
          </section>
          <label className="block max-w-xl">
            <span className="mb-1 block text-sm font-semibold">Standard für Auflösungen</span>
            <select
              value={form.solutionStrategy}
              onChange={(event) =>
                updateField(
                  "solutionStrategy",
                  event.target.value as QuizSolutionStrategy,
                )
              }
              className={inputClass}
            >
              {form.solutionStrategy === "MANUAL" && <option value="MANUAL" disabled>Legacy: Manuell im Ablauf</option>}
              {QUIZ_STANDARD_SOLUTION_STRATEGIES.map((strategy) => (
                <option key={strategy} value={strategy}>
                  {getQuizSolutionStrategyLabel(strategy)}
                </option>
              ))}
            </select>
            <p className="mt-2 text-sm text-slate-600">
              Einzelne Fragenblöcke können im redaktionellen Ablauf davon abweichen.
            </p>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Interne Bemerkung</span>
            <textarea maxLength={2000} value={form.internalNote} onChange={(event) => updateField("internalNote", event.target.value)} className={`${inputClass} min-h-28 resize-y`} />
          </label>
          <div className="flex flex-col gap-2 pt-2 sm:flex-row">
            <button type="submit" className="min-h-11 rounded-xl bg-slate-900 px-6 py-3 font-semibold text-white">
              {editingQuizId === null ? "Quiz anlegen" : "Änderungen speichern"}
            </button>
            {editingQuizId !== null && <button type="button" onClick={resetForm} className="min-h-11 rounded-xl border border-slate-300 px-4 py-2 font-semibold">Abbrechen</button>}
          </div>
        </form>
        </div>
      </details>

      {message && <div role="status" className="rounded-2xl border border-slate-200 bg-white p-4 text-sm font-medium shadow-sm">{message}</div>}

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <h2 className="text-xl font-semibold">Bestehende Quizze</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {workspaceSeriesId === undefined && <EventSeriesPicker options={eventSeries} value={eventSeriesFilter ? Number(eventSeriesFilter) : null} hrefForValue={filterHref} />}
          <label className="block"><span className="mb-1 block text-sm font-semibold">Status filtern</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className={inputClass}><option value="">Alle Status</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {filteredQuizzes.map((quiz) => (
            <article key={quiz.quiz_id} className={`min-w-0 rounded-2xl border p-4 ${quiz.temporal_status === "TODAY" ? "border-sky-300 bg-sky-50" : quiz.temporal_status === "MISSING_DATE" ? "border-amber-300 bg-amber-50" : "border-slate-200"}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-words text-xs font-semibold uppercase tracking-wide text-slate-500">{quiz.eventreihe_name}</p>
                  <Link href={`/quiz/${quiz.quiz_id}?returnTo=${encodeURIComponent(returnTo)}`} className="mt-1 block break-words text-lg font-bold underline decoration-slate-300 underline-offset-4">{quiz.titel ?? `Quiz ${quiz.quiz_id}`}</Link>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-700 ring-1 ring-slate-200">{statusLabels[quiz.temporal_status]}</span>
                  <button type="button" onClick={() => startEdit(quiz)} title="Quiz-Einstellungen" aria-label={`Einstellungen für ${quiz.titel ?? `Quiz ${quiz.quiz_id}`}`} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-slate-200 bg-white p-2 text-slate-600"><Cog6ToothIcon className="h-5 w-5" /></button>
                </div>
              </div>
              <dl className="mt-3 grid gap-1 text-sm text-slate-600 sm:grid-cols-2">
                <div><dt className="inline font-semibold">Datum: </dt><dd className="inline">{quiz.quiz_datum ?? "Datum fehlt"}{quiz.veranstaltungszeit ? `, ${quiz.veranstaltungszeit}` : ""}</dd></div>
                <div><dt className="inline font-semibold">Ort: </dt><dd className="inline">{quiz.veranstaltungsname ?? "–"}</dd></div>
                <div><dt className="inline font-semibold">Teams: </dt><dd className="inline">{quiz.team_anzahl ?? "–"}</dd></div>
                <div><dt className="inline font-semibold">Teilnehmer: </dt><dd className="inline">{quiz.teilnehmer_anzahl ?? "–"}</dd></div>
              </dl>
              {quiz.temporal_status === "MISSING_DATE" && <p className="mt-3 text-sm font-semibold text-amber-900">Bestandsdatensatz: Vor dem nächsten Speichern muss ein Datum ergänzt werden.</p>}
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href={`/quiz/${quiz.quiz_id}?returnTo=${encodeURIComponent(returnTo)}`} title="Quizinhalt bearbeiten" aria-label={`Inhalt von ${quiz.titel ?? `Quiz ${quiz.quiz_id}`} bearbeiten`} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-slate-900 p-2 text-white"><PencilSquareIcon className="h-5 w-5" /></Link>
                <QuizCopyDialog quizId={quiz.quiz_id} quizTitle={quiz.titel ?? `Quiz ${quiz.quiz_id}`} />
                {quiz.ist_archiviert ? (
                  <button type="button" title="Wiederherstellen" onClick={async () => { await restoreQuiz(quiz.quiz_id); router.refresh(); }} className="min-h-11 min-w-11 rounded-xl border border-green-300 bg-green-50 p-2 text-green-700"><LockOpenIcon className="mx-auto h-5 w-5" /></button>
                ) : quiz.fragen_anzahl === 0 ? (
                  <button type="button" title="Löschen" onClick={async () => { if (!window.confirm("Dieses Quiz wirklich löschen?")) return; const result = await deleteQuiz(quiz.quiz_id); setMessage(result.message); if (result.success) router.refresh(); }} className="min-h-11 min-w-11 rounded-xl border border-red-300 bg-red-50 p-2 text-red-700"><TrashIcon className="mx-auto h-5 w-5" /></button>
                ) : (
                  <button type="button" title="Archivieren" onClick={() => handleArchive(quiz.quiz_id)} className="min-h-11 min-w-11 rounded-xl border border-orange-300 bg-orange-50 p-2 text-orange-700"><ArchiveBoxIcon className="mx-auto h-5 w-5" /></button>
                )}
                <Link href={`/quiz/${quiz.quiz_id}/praesentation`} target="_blank" title="Präsentieren" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-cyan-300 bg-cyan-50 p-2 text-cyan-700"><PlayIcon className="h-5 w-5" /></Link>
                <Link href={`/quiz/${quiz.quiz_id}/moderation`} target="_blank" title="Moderation" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-violet-300 bg-violet-50 p-2 text-violet-700"><MegaphoneIcon className="h-5 w-5" /></Link>
                <Link href={`/quiz/${quiz.quiz_id}/antworten`} target="_blank" title="Antwortformular" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-emerald-300 bg-emerald-50 p-2 text-emerald-700"><UsersIcon className="h-5 w-5" /></Link>
                <Link href={`/quiz/${quiz.quiz_id}/auswertung`} target="_blank" title="Auswertung" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-yellow-300 bg-yellow-50 p-2 text-yellow-700"><ChartBarIcon className="h-5 w-5" /></Link>
              </div>
            </article>
          ))}
        </div>
        {filteredQuizzes.length === 0 && <p className="mt-5 text-sm text-slate-500">Keine Quizze für diesen Filter.</p>}
      </section>
    </div>
  );
}
