"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  archiveQuiz,
  createQuiz,
  deleteQuiz,
  restoreQuiz,
  updateQuiz,
  type QuizResult,
} from "./actions";
import type { EventSeriesOption } from "@/app/eventreihen/actions";
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
} from "@heroicons/react/24/outline";
import type { RenderingMessages } from "@/app/i18n/renderingMessages";
import { TemplatePreview } from "@/app/rendering/TemplatePreview";
import { templateRegistry } from "@/app/rendering/templateRegistry";
import {
  resolveAnswerFormTemplate,
  resolvePresentationTemplate,
} from "@/app/rendering/templateResolver";
import type { AssignablePresentationTemplate } from "@/app/rendering/presentationTemplates/presentationTemplateRepository.server";
import {
  toRuntimeAnswerFormTemplate,
  toRuntimePresentationTemplate,
} from "@/app/rendering/presentationTemplates/presentationTemplate";

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
  presentationTemplateId: string;
  answerFormTemplateId: string;
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
    presentationTemplateId: "",
    answerFormTemplateId: "",
  };
}

export default function QuizForm({
  quizze,
  eventSeries,
  initialEventSeriesId,
  messages,
  presentationTemplates,
  canAssignPresentationTemplates,
}: {
  quizze: QuizResult[];
  eventSeries: EventSeriesOption[];
  initialEventSeriesId?: number;
  messages: RenderingMessages;
  presentationTemplates: AssignablePresentationTemplate[];
  canAssignPresentationTemplates: boolean;
}) {
  const [editingQuizId, setEditingQuizId] = useState<number | null>(null);
  const [form, setForm] = useState(() => emptyForm(initialEventSeriesId));
  const [message, setMessage] = useState("");
  const [eventSeriesFilter, setEventSeriesFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const customPresentationTemplates = presentationTemplates
    .filter((template) => !templateRegistry.presentation.some(({ id }) => id === template.id))
    .map(toRuntimePresentationTemplate);
  const customAnswerFormTemplates = presentationTemplates
    .filter((template) => !templateRegistry.answerForm.some(({ id }) => id === template.id))
    .map(toRuntimeAnswerFormTemplate);

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
  }

  function startEdit(quiz: QuizResult) {
    setEditingQuizId(quiz.quiz_id);
    setForm({
      eventSeriesId: String(quiz.eventreihe_id),
      title: quiz.titel ?? "",
      date: quiz.quiz_datum ?? "",
      time: quiz.veranstaltungszeit ?? "",
      venueName: quiz.veranstaltungsname ?? "",
      mapUrl: quiz.karten_url ?? "",
      publicUrl: quiz.oeffentliche_url ?? "",
      internalNote: quiz.bemerkung ?? "",
      presentationTemplateId: quiz.presentation_template_id ?? "",
      answerFormTemplateId: quiz.answer_form_template_id ?? "",
    });
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
      presentationTemplateId: form.presentationTemplateId || null,
      answerFormTemplateId: form.answerFormTemplateId || null,
    };
    const result = editingQuizId === null
      ? await createQuiz(data)
      : await updateQuiz({ quizId: editingQuizId, ...data });
    setMessage(result.message);
    if (!result.success) return;
    if ("quizId" in result && result.quizId) {
      window.location.href = `/quiz/${result.quizId}`;
      return;
    }
    window.location.reload();
  }

  async function handleArchive(quizId: number) {
    const reason = window.prompt("Warum soll dieses Quiz archiviert werden?", "Quiz wurde durchgeführt");
    if (reason === null) return;
    await archiveQuiz({ quizId, archivierungsgrund: reason });
    window.location.reload();
  }

  const selectedEventSeries = eventSeries.find(
    (entry) => entry.id === Number(form.eventSeriesId),
  );
  const effectivePresentation = resolvePresentationTemplate({
    quizTemplateId: form.presentationTemplateId || null,
    eventSeriesTemplateId: selectedEventSeries?.defaultPresentationTemplateId,
    additionalPresentationTemplates: customPresentationTemplates,
  });
  const effectiveAnswerForm = resolveAnswerFormTemplate({
    quizTemplateId: form.answerFormTemplateId || null,
    eventSeriesTemplateId: selectedEventSeries?.defaultAnswerFormTemplateId,
    additionalAnswerFormTemplates: customAnswerFormTemplates,
  });

  return (
    <div className="space-y-6 text-slate-900">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <div className="mb-5">
          <h2 className="text-xl font-semibold">
            {editingQuizId === null ? "Neues Quiz anlegen" : "Quiz bearbeiten"}
          </h2>
          <p className="mt-1 text-sm text-slate-500">Pflichtfelder sind mit * gekennzeichnet.</p>
        </div>
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
              <span className="mb-1 block text-sm font-semibold">Veranstaltungsname</span>
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
          <div className="grid gap-4 md:grid-cols-2">
            <label className="min-w-0">
              <span className="mb-1 block text-sm font-semibold">{messages.fields.presentationTemplate}</span>
              <select value={form.presentationTemplateId} onChange={(event) => updateField("presentationTemplateId", event.target.value)} className={inputClass}>
                <option value="">{messages.fields.eventSeriesDefault}</option>
                {templateRegistry.presentation.filter(({ selectable }) => selectable).map((template) => <option key={template.id} value={template.id}>{messages.templates[template.labelKey].label}</option>)}
                {customPresentationTemplates.map((template) => <option key={template.id} value={template.id} disabled={!canAssignPresentationTemplates}>{template.displayName}</option>)}
              </select>
              <p className="mt-2 break-words text-sm text-slate-600">{messages.fields.effectiveTemplate}: <strong>{effectivePresentation.template.displayName ?? messages.templates[effectivePresentation.template.labelKey].label}</strong> · {messages.fields.templateSource}: {messages.sources[effectivePresentation.source]}</p>
              {effectivePresentation.usedFallback && <p role="status" className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">{messages.validation.fallback}</p>}
              <div className="mt-3"><TemplatePreview template={effectivePresentation.template} messages={messages} /></div>
            </label>
            <label className="min-w-0">
              <span className="mb-1 block text-sm font-semibold">{messages.fields.answerFormTemplate}</span>
              <select value={form.answerFormTemplateId} onChange={(event) => updateField("answerFormTemplateId", event.target.value)} className={inputClass}>
                <option value="">{messages.fields.eventSeriesDefault}</option>
                {templateRegistry.answerForm.filter(({ selectable }) => selectable).map((template) => <option key={template.id} value={template.id}>{messages.templates[template.labelKey].label}</option>)}
                {customAnswerFormTemplates.map((template) => <option key={template.id} value={template.id} disabled={!canAssignPresentationTemplates}>{template.displayName}</option>)}
              </select>
              <p className="mt-2 break-words text-sm text-slate-600">{messages.fields.effectiveTemplate}: <strong>{effectiveAnswerForm.template.displayName ?? messages.templates[effectiveAnswerForm.template.labelKey].label}</strong> · {messages.fields.templateSource}: {messages.sources[effectiveAnswerForm.source]}</p>
              {effectiveAnswerForm.usedFallback && <p role="status" className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">{messages.validation.fallback}</p>}
              <div className="mt-3"><TemplatePreview template={effectiveAnswerForm.template} messages={messages} /></div>
            </label>
          </div>
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
      </section>

      {message && <div role="status" className="rounded-2xl border border-slate-200 bg-white p-4 text-sm font-medium shadow-sm">{message}</div>}

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <h2 className="text-xl font-semibold">Bestehende Quizze</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block"><span className="mb-1 block text-sm font-semibold">Eventreihe filtern</span><select value={eventSeriesFilter} onChange={(event) => setEventSeriesFilter(event.target.value)} className={inputClass}><option value="">Alle Eventreihen</option>{eventSeries.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label>
          <label className="block"><span className="mb-1 block text-sm font-semibold">Status filtern</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className={inputClass}><option value="">Alle Status</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {filteredQuizzes.map((quiz) => (
            <article key={quiz.quiz_id} className={`min-w-0 rounded-2xl border p-4 ${quiz.temporal_status === "TODAY" ? "border-sky-300 bg-sky-50" : quiz.temporal_status === "MISSING_DATE" ? "border-amber-300 bg-amber-50" : "border-slate-200"}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-words text-xs font-semibold uppercase tracking-wide text-slate-500">{quiz.eventreihe_name}</p>
                  <Link href={`/quiz/${quiz.quiz_id}`} className="mt-1 block break-words text-lg font-bold underline decoration-slate-300 underline-offset-4">{quiz.titel ?? `Quiz ${quiz.quiz_id}`}</Link>
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-700 ring-1 ring-slate-200">{statusLabels[quiz.temporal_status]}</span>
              </div>
              <dl className="mt-3 grid gap-1 text-sm text-slate-600 sm:grid-cols-2">
                <div><dt className="inline font-semibold">Datum: </dt><dd className="inline">{quiz.quiz_datum ?? "Datum fehlt"}{quiz.veranstaltungszeit ? `, ${quiz.veranstaltungszeit}` : ""}</dd></div>
                <div><dt className="inline font-semibold">Ort: </dt><dd className="inline">{quiz.veranstaltungsname ?? "–"}</dd></div>
                <div><dt className="inline font-semibold">Teams: </dt><dd className="inline">{quiz.team_anzahl ?? "–"}</dd></div>
                <div><dt className="inline font-semibold">Teilnehmer: </dt><dd className="inline">{quiz.teilnehmer_anzahl ?? "–"}</dd></div>
              </dl>
              {quiz.temporal_status === "MISSING_DATE" && <p className="mt-3 text-sm font-semibold text-amber-900">Bestandsdatensatz: Vor dem nächsten Speichern muss ein Datum ergänzt werden.</p>}
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" onClick={() => startEdit(quiz)} className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold">Bearbeiten</button>
                <QuizCopyDialog quizId={quiz.quiz_id} quizTitle={quiz.titel ?? `Quiz ${quiz.quiz_id}`} />
                {quiz.ist_archiviert ? (
                  <button type="button" title="Wiederherstellen" onClick={async () => { await restoreQuiz(quiz.quiz_id); window.location.reload(); }} className="min-h-11 min-w-11 rounded-xl border border-green-300 bg-green-50 p-2 text-green-700"><LockOpenIcon className="mx-auto h-5 w-5" /></button>
                ) : quiz.fragen_anzahl === 0 ? (
                  <button type="button" title="Löschen" onClick={async () => { if (!window.confirm("Dieses Quiz wirklich löschen?")) return; const result = await deleteQuiz(quiz.quiz_id); setMessage(result.message); if (result.success) window.location.reload(); }} className="min-h-11 min-w-11 rounded-xl border border-red-300 bg-red-50 p-2 text-red-700"><TrashIcon className="mx-auto h-5 w-5" /></button>
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
