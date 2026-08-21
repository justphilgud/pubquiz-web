"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  archiveEventSeries,
  createEventSeries,
  restoreEventSeries,
  updateEventSeries,
  type EventSeriesListItem,
} from "@/app/eventreihen/actions";
import type { RenderingMessages } from "@/app/i18n/renderingMessages";
import { TemplatePreview } from "@/app/rendering/TemplatePreview";
import {
  getPresentationTemplate,
  templateRegistry,
  type PresentationTemplate,
} from "@/app/rendering/templateRegistry";
import type { AssignablePresentationTemplate } from "@/app/rendering/presentationTemplates/presentationTemplateRepository.server";
import {
  toRuntimePresentationTemplate,
} from "@/app/rendering/presentationTemplates/presentationTemplate";
import { eventSeriesInputFromFormData } from "@/app/eventreihen/eventSeriesForm";

const inputClass = "min-h-11 w-full rounded-xl border border-slate-300 px-4 py-3";

type FormState = {
  name: string;
  publicName: string;
  description: string;
  internalNote: string;
  isPublic: boolean;
  defaultPresentationTemplateId: string;
};

const emptyForm: FormState = {
  name: "",
  publicName: "",
  description: "",
  internalNote: "",
  isPublic: false,
  defaultPresentationTemplateId: "ungegoogelt-default",
};

export function EventSeriesManager({ series, canCreate, messages, presentationTemplates, canAssignPresentationTemplates }: { series: EventSeriesListItem[]; canCreate: boolean; messages: RenderingMessages; presentationTemplates: AssignablePresentationTemplate[]; canAssignPresentationTemplates: boolean }) {
  const router = useRouter();
  const [filter, setFilter] = useState<"active" | "archived" | "all">("active");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [archiveTarget, setArchiveTarget] = useState<EventSeriesListItem | null>(null);
  const customPresentationTemplates = presentationTemplates
    .filter((template) => !templateRegistry.presentation.some(({ id }) => id === template.id))
    .map(toRuntimePresentationTemplate);
  const selectedPresentation = getPresentationTemplate(form.defaultPresentationTemplateId) ?? customPresentationTemplates.find(({ id }) => id === form.defaultPresentationTemplateId);
  const presentationName = (id: string) => {
    const template: PresentationTemplate | undefined = getPresentationTemplate(id) ?? customPresentationTemplates.find((entry) => entry.id === id);
    return template?.displayName ?? messages.templates[template?.labelKey ?? "presentationDefault"].label;
  };
  const cancelArchiveRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (archiveTarget) cancelArchiveRef.current?.focus();
  }, [archiveTarget]);

  const visibleSeries = series.filter((entry) =>
    filter === "all" ? true : filter === "archived" ? entry.isArchived : !entry.isArchived,
  );

  function edit(entry: EventSeriesListItem) {
    setEditingId(entry.id);
    setForm({
      name: entry.name,
      publicName: entry.publicName ?? "",
      description: entry.description ?? "",
      internalNote: entry.internalNote ?? "",
      isPublic: entry.isPublic,
      defaultPresentationTemplateId: entry.defaultPresentationTemplateId,
    });
    setErrors({});
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit(formData: FormData) {
    const input = eventSeriesInputFromFormData(formData);
    const result = editingId === null
      ? await createEventSeries(input)
      : await updateEventSeries(editingId, input);
    setMessage(result.message);
    setErrors(result.errors ?? {});
    if (!result.success) return;
    if (result.savedValue) {
      setForm({
        name: result.savedValue.name,
        publicName: result.savedValue.publicName ?? "",
        description: result.savedValue.description ?? "",
        internalNote: result.savedValue.internalNote ?? "",
        isPublic: result.savedValue.isPublic,
        defaultPresentationTemplateId: result.savedValue.defaultPresentationTemplateId,
      });
    } else {
      setEditingId(null);
      setForm(emptyForm);
    }
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {(canCreate || editingId !== null) && <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <h2 className="text-xl font-bold">{editingId === null ? "Eventreihe anlegen" : "Eventreihe bearbeiten"}</h2>
        <p className="mt-1 text-sm text-slate-600">Der Slug wird bei der Anlage automatisch erzeugt und bleibt danach stabil.</p>
        <form action={submit} className="mt-5 grid gap-4">
          <label><span className="mb-1 block text-sm font-semibold">Interner Name *</span><input name="name" required maxLength={150} value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? "event-series-name-error" : undefined} className={inputClass} />{errors.name && <span id="event-series-name-error" className="mt-1 block text-sm text-red-700">{errors.name}</span>}</label>
          <label><span className="mb-1 block text-sm font-semibold">Öffentlicher Name</span><input name="publicName" maxLength={150} value={form.publicName} onChange={(event) => setForm((current) => ({ ...current, publicName: event.target.value }))} className={inputClass} />{errors.publicName && <span className="mt-1 block text-sm text-red-700">{errors.publicName}</span>}</label>
          <label><span className="mb-1 block text-sm font-semibold">Beschreibung</span><textarea name="description" maxLength={2000} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} className={`${inputClass} min-h-28`} />{errors.description && <span className="mt-1 block text-sm text-red-700">{errors.description}</span>}</label>
          <details className="rounded-xl border border-slate-200 p-3">
            <summary className="cursor-pointer font-semibold">Weitere Angaben</summary>
            <label className="mt-3 block"><span className="mb-1 block text-sm font-semibold">Interne Bemerkung</span><textarea name="internalNote" maxLength={2000} value={form.internalNote} onChange={(event) => setForm((current) => ({ ...current, internalNote: event.target.value }))} className={`${inputClass} min-h-24`} />{errors.internalNote && <span className="mt-1 block text-sm text-red-700">{errors.internalNote}</span>}</label>
          </details>
          <label className="flex min-h-11 items-center gap-3 rounded-xl border border-slate-200 p-3"><input name="isPublic" value="true" type="checkbox" checked={form.isPublic} onChange={(event) => setForm((current) => ({ ...current, isPublic: event.target.checked }))} /><span><span className="block font-semibold">Öffentlich sichtbar</span><span className="block text-sm text-slate-500">Nur für spätere öffentliche Funktionen vorbereitet.</span></span></label>
          <div>
            <label className="block min-w-0">
              <span className="mb-1 block text-sm font-semibold">{messages.fields.defaultPresentation}</span>
              <select name="defaultPresentationTemplateId" value={form.defaultPresentationTemplateId} onChange={(event) => setForm((current) => ({ ...current, defaultPresentationTemplateId: event.target.value }))} className={inputClass}>
                {templateRegistry.presentation.filter(({ selectable }) => selectable).map((template) => <option key={template.id} value={template.id}>{messages.templates[template.labelKey].label}</option>)}
                {customPresentationTemplates.map((template) => <option key={template.id} value={template.id} disabled={!canAssignPresentationTemplates}>{template.displayName}</option>)}
              </select>
              {errors.defaultPresentationTemplateId && <span className="mt-1 block text-sm text-red-700">{errors.defaultPresentationTemplateId}</span>}
              {selectedPresentation && <div className="mt-3"><TemplatePreview template={selectedPresentation} messages={messages} /></div>}
              {!selectedPresentation && <span role="status" className="mt-2 block rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">{messages.validation.fallback}</span>}
            </label>
          </div>
          {message && <p role="status" className="rounded-xl bg-slate-100 p-3 text-sm">{message}</p>}
          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="submit" className="min-h-11 rounded-xl bg-slate-900 px-5 py-2 font-semibold text-white">{editingId === null ? "Eventreihe anlegen" : "Änderungen speichern"}</button>
            {editingId !== null && <button type="button" onClick={() => { setEditingId(null); setForm(emptyForm); setErrors({}); }} className="min-h-11 rounded-xl border border-slate-300 px-5 py-2 font-semibold">Abbrechen</button>}
          </div>
        </form>
      </section>}

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-bold">Eventreihen</h2>
          <label><span className="sr-only">Status filtern</span><select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)} className={inputClass}><option value="active">Aktiv</option><option value="archived">Archiviert</option><option value="all">Alle</option></select></label>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {visibleSeries.map((entry) => (
            <article key={entry.id} className="min-w-0 rounded-2xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><h3 className="break-words text-lg font-bold">{entry.name}</h3><p className="break-all text-sm text-slate-500">/{entry.slug}</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold">{entry.isArchived ? "Archiviert" : "Aktiv"}</span></div>
              {entry.publicName && <p className="mt-2 break-words text-sm text-slate-700">Öffentlich: {entry.publicName}</p>}
              <p className="mt-2 text-sm text-slate-600">{entry.quizCount} {entry.quizCount === 1 ? "Quiz" : "Quizze"} · {entry.isPublic ? "öffentlich vorbereitet" : messages.fields.internalOnly}</p>
              <p className="mt-2 break-words text-xs text-slate-500">{messages.fields.defaultPresentation}: {presentationName(entry.defaultPresentationTemplateId)}</p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <Link href={`/admin/eventreihen/${entry.id}`} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 px-4 py-2 font-semibold">Öffnen</Link>
                {entry.canEdit && !entry.isArchived && <button type="button" onClick={() => edit(entry)} className="min-h-11 rounded-xl border border-slate-300 px-4 py-2 font-semibold">Bearbeiten</button>}
                {entry.canChangeArchiveState && (entry.isArchived ? <button type="button" onClick={async () => { const result = await restoreEventSeries(entry.id); setMessage(result.message); if (result.success) router.refresh(); }} className="min-h-11 rounded-xl border border-emerald-300 px-4 py-2 font-semibold text-emerald-800">Wiederherstellen</button> : <button type="button" onClick={() => setArchiveTarget(entry)} className="min-h-11 rounded-xl border border-orange-300 px-4 py-2 font-semibold text-orange-800">Archivieren</button>)}
              </div>
            </article>
          ))}
        </div>
        {visibleSeries.length === 0 && <p className="mt-5 text-sm text-slate-500">Keine Eventreihen in diesem Status.</p>}
      </section>

      {archiveTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="presentation">
          <section role="dialog" aria-modal="true" aria-labelledby="archive-series-title" aria-describedby="archive-series-description" className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <h2 id="archive-series-title" className="text-xl font-bold">Eventreihe archivieren?</h2>
            <p id="archive-series-description" className="mt-2 text-sm text-slate-600">{archiveTarget.name} wird aus Neuanlagen ausgeblendet. Bestehende Quizze bleiben vollständig erhalten und erreichbar.</p>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button ref={cancelArchiveRef} type="button" onClick={() => setArchiveTarget(null)} className="min-h-11 rounded-xl border border-slate-300 px-4 py-2 font-semibold">Abbrechen</button><button type="button" onClick={async () => { const result = await archiveEventSeries(archiveTarget.id); setMessage(result.message); setArchiveTarget(null); if (result.success) router.refresh(); }} className="min-h-11 rounded-xl bg-orange-700 px-4 py-2 font-semibold text-white">Archivieren</button></div>
          </section>
        </div>
      )}
    </div>
  );
}
