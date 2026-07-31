"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { savePresentationTemplate, type PresentationTemplateActionState } from "./actions";
import {
  presentationTemplateOptions,
  validatePresentationTemplateDraft,
  type ManagedPresentationTemplate,
  type PresentationTemplateDraft,
} from "./presentationTemplate";
import {
  PresentationTemplatePreview,
  presentationPreviewScenarios,
  type PresentationPreviewScenario,
} from "./PresentationTemplatePreview";

type Props = {
  initialTemplate: ManagedPresentationTemplate;
  originalId: string | null;
  readOnly?: boolean;
  persistenceAvailable: boolean;
};

const colorLabels = {
  primary: "Primärfarbe", secondary: "Sekundärfarbe", accent: "Akzentfarbe",
  background: "Hintergrund", surface: "Fläche", surfaceStrong: "Starke Fläche",
  text: "Text", textMuted: "Sekundärtext", border: "Rahmen",
  success: "Erfolg", warning: "Warnung", danger: "Fehler",
} as const;

function toDraft(template: ManagedPresentationTemplate): PresentationTemplateDraft {
  return {
    id: template.id,
    name: template.name,
    description: template.description ?? "",
    status: template.status === "SYSTEM" ? "DRAFT" : template.status,
    tags: [...template.tags.filter((tag) => tag !== "System")],
    sourceTemplateId: template.sourceTemplateId,
    config: structuredClone(template.config),
  };
}

export function PresentationTemplateGenerator({ initialTemplate, originalId, readOnly = false, persistenceAvailable }: Props) {
  const [draft, setDraft] = useState(() => toDraft(initialTemplate));
  const [scenario, setScenario] = useState<PresentationPreviewScenario>("TEXT");
  const [result, setResult] = useState<PresentationTemplateActionState | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState(() => JSON.stringify(toDraft(initialTemplate)));
  const [savedUpdatedAt, setSavedUpdatedAt] = useState(
    initialTemplate.updatedAt?.toISOString() ?? null,
  );
  const skipLeaveWarning = useRef(false);
  const [isPending, startTransition] = useTransition();
  const validation = useMemo(() => validatePresentationTemplateDraft(draft), [draft]);

  useEffect(() => {
    const hasUnsavedChanges = () =>
      !skipLeaveWarning.current && JSON.stringify(draft) !== savedSnapshot;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges()) return;
      event.preventDefault();
    };
    const warnBeforeClientNavigation = (event: MouseEvent) => {
      if (
        !hasUnsavedChanges() ||
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) return;
      const link = (event.target as Element | null)?.closest<HTMLAnchorElement>("a[href]");
      if (!link || link.target || link.download || link.href === window.location.href) return;
      if (!window.confirm("Es gibt ungespeicherte Änderungen. Seite trotzdem verlassen?")) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", warnBeforeLeaving);
    document.addEventListener("click", warnBeforeClientNavigation, true);
    return () => {
      window.removeEventListener("beforeunload", warnBeforeLeaving);
      document.removeEventListener("click", warnBeforeClientNavigation, true);
    };
  }, [draft, savedSnapshot]);

  function updateConfig(mutator: (config: PresentationTemplateDraft["config"]) => void) {
    setDraft((current) => {
      const config = structuredClone(current.config);
      mutator(config);
      return { ...current, config };
    });
  }

  function save() {
    startTransition(async () => {
      const actionResult = await savePresentationTemplate(
        originalId,
        savedUpdatedAt,
        draft,
      );
      setResult(actionResult);
      if (actionResult.success) {
        skipLeaveWarning.current = true;
        setSavedSnapshot(JSON.stringify(draft));
        setSavedUpdatedAt(actionResult.updatedAt ?? null);
        if (originalId === null && actionResult.templateId) {
          window.location.href = `/templates/${actionResult.templateId}`;
        } else if (draft.status === "ACTIVE") {
          window.location.reload();
        }
      }
    });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(340px,0.8fr)_minmax(560px,1.2fr)]">
      <section className="space-y-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div><h2 className="text-xl font-bold">Template-Konfiguration</h2><p className="mt-1 text-sm text-slate-600">Versionierter Designvertrag für Präsentation, Moderation und Antwortformular.</p></div>
        <fieldset disabled={readOnly} className="space-y-4 disabled:opacity-75">
          <label className="block text-sm font-semibold">Name<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3" /></label>
          <label className="block text-sm font-semibold">Stabile ID<input value={draft.id} disabled={originalId !== null} onChange={(event) => setDraft({ ...draft, id: event.target.value })} className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 disabled:bg-slate-100" /></label>
          <label className="block text-sm font-semibold">Beschreibung<textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} rows={3} className="mt-1 w-full rounded-xl border border-slate-300 p-3" /></label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold">Status<select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as PresentationTemplateDraft["status"] })} className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3"><option value="DRAFT">Entwurf</option><option value="ACTIVE">Aktivieren und veröffentlichen</option>{draft.status === "ARCHIVED" && <option value="ARCHIVED" disabled>Archiviert</option>}</select></label>
            <label className="text-sm font-semibold">Tags<input value={draft.tags.join(", ")} onChange={(event) => setDraft({ ...draft, tags: event.target.value.split(",") })} className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3" /></label>
          </div>
          {draft.sourceTemplateId && <p className="rounded-xl bg-slate-100 p-3 text-sm text-slate-700">Ausgangstemplate: <span className="font-mono">{draft.sourceTemplateId}</span></p>}
          <div><h3 className="mb-3 font-bold">Farben</h3><div className="grid gap-3 sm:grid-cols-2">
            {(Object.keys(colorLabels) as (keyof typeof colorLabels)[]).map((key) => <label key={key} className="grid grid-cols-[2.75rem_1fr] items-center gap-2 text-sm font-semibold"><input type="color" value={draft.config.tokens.colors[key]} onChange={(event) => updateConfig((config) => { config.tokens.colors[key] = event.target.value as `#${string}`; })} className="h-11 w-11 rounded-lg border border-slate-300 bg-white p-1" aria-label={colorLabels[key]} /><span>{colorLabels[key]}<input value={draft.config.tokens.colors[key]} onChange={(event) => updateConfig((config) => { config.tokens.colors[key] = event.target.value as `#${string}`; })} className="mt-1 min-h-9 w-full rounded-lg border border-slate-300 px-2 font-mono text-xs" /></span></label>)}
          </div></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold">Schrift<select value={draft.config.tokens.typography.family} onChange={(event) => updateConfig((config) => { config.tokens.typography.family = event.target.value as typeof config.tokens.typography.family; })} className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3">{presentationTemplateOptions.fonts.map((font) => <option key={font}>{font}</option>)}</select></label>
            <label className="text-sm font-semibold">Überschriftengewicht<select value={draft.config.tokens.typography.displayWeight} onChange={(event) => updateConfig((config) => { config.tokens.typography.displayWeight = Number(event.target.value) as typeof config.tokens.typography.displayWeight; })} className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3">{presentationTemplateOptions.displayWeights.map((weight) => <option key={weight}>{weight}</option>)}</select></label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold">Eckenprofil<select value={draft.config.tokens.radii.large === "2rem" ? "ROUNDED" : "COMPACT"} onChange={(event) => updateConfig((config) => { config.tokens.radii = { ...presentationTemplateOptions.radiusPresets[event.target.value as keyof typeof presentationTemplateOptions.radiusPresets] }; })} className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3"><option value="COMPACT">Leicht gerundet</option><option value="ROUNDED">Deutlich gerundet</option></select></label>
            <label className="text-sm font-semibold">Dichte<select value={draft.config.tokens.spacing.large === "2.5rem" ? "SPACIOUS" : draft.config.tokens.spacing.small === "0.5rem" ? "COMPACT" : "COMFORTABLE"} onChange={(event) => updateConfig((config) => { config.tokens.spacing = { ...presentationTemplateOptions.spacingPresets[event.target.value as keyof typeof presentationTemplateOptions.spacingPresets] }; })} className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3"><option value="COMPACT">Kompakt</option><option value="COMFORTABLE">Standard</option><option value="SPACIOUS">Großzügig</option></select></label>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="text-sm font-semibold">Präsentation<select value={draft.config.surfaces.presentation} onChange={(event) => updateConfig((config) => { config.surfaces.presentation = event.target.value as typeof config.surfaces.presentation; })} className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3"><option value="NEON">Neon</option><option value="DARK">Dunkel</option></select></label>
            <label className="text-sm font-semibold">Moderation<select value={draft.config.surfaces.moderation} onChange={(event) => updateConfig((config) => { config.surfaces.moderation = event.target.value as typeof config.surfaces.moderation; })} className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3"><option value="BRANDED">Gebrandet</option><option value="QUIET">Ruhig</option></select></label>
            <label className="text-sm font-semibold">Antwortformular<select value={draft.config.surfaces.answerForm} onChange={(event) => updateConfig((config) => { config.surfaces.answerForm = event.target.value as typeof config.surfaces.answerForm; })} className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3"><option value="BRANDED">Gebrandet</option><option value="MINIMAL">Minimal</option></select></label>
          </div>
          <label className="block text-sm font-semibold">Logo-Pfad<input value={draft.config.tokens.assets.logo} onChange={(event) => updateConfig((config) => { config.tokens.assets.logo = event.target.value as `/${string}`; })} className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 font-mono text-sm" /></label>
          <label className="block text-sm font-semibold">Hintergrundbild-Pfad<input value={draft.config.tokens.assets.backgroundImage ?? ""} onChange={(event) => updateConfig((config) => { config.tokens.assets.backgroundImage = event.target.value ? event.target.value as `/${string}` : null; })} className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 font-mono text-sm" /></label>
          <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900">Nur sichere, vorhandene repository-relative Bildpfade. Ein neuer Uploadpfad ist in dieser Ausbaustufe bewusst nicht enthalten.</p>
        </fieldset>
        {!validation.ok && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{validation.errors.map((issue) => <p key={`${issue.field}-${issue.message}`}>{issue.message}</p>)}</div>}
        {validation.warnings.length > 0 && <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{validation.warnings.map((issue) => <p key={`${issue.field}-${issue.message}`}>{issue.message}</p>)}</div>}
        {result && <p className={`rounded-xl p-3 text-sm ${result.success ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>{result.message}</p>}
        {!readOnly && <button type="button" onClick={save} disabled={!persistenceAvailable || isPending || !validation.ok} className="min-h-11 w-full rounded-xl bg-slate-900 px-5 font-bold text-white disabled:opacity-50">{isPending ? "Speichert …" : "Template speichern"}</button>}
      </section>
      <section className="xl:sticky xl:top-4 xl:self-start"><div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Vorschauvarianten">{presentationPreviewScenarios.map(([id, label]) => <button key={id} type="button" onClick={() => setScenario(id)} className={`min-h-10 rounded-xl border px-3 text-sm font-semibold ${scenario === id ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white"}`}>{label}</button>)}</div>
        <PresentationTemplatePreview config={draft.config} templateId={draft.id || "preview-template"} templateName={draft.name || "Template-Vorschau"} scenario={scenario} />
        <p className="mt-3 text-xs text-slate-500">Slide-Szenarien verwenden den produktiven PresentationSlideRenderer und die zentrale Layoutauflösung. Medien bleiben stumm.</p>
      </div></section>
    </div>
  );
}
