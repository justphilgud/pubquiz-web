"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { savePresentationTemplate, type PresentationTemplateActionState } from "./actions";
import { presentationTemplateOptions, validatePresentationTemplateDraft, type ManagedPresentationTemplate, type PresentationTemplateDraft } from "./presentationTemplate";
import { PresentationTemplatePreview, presentationPreviewScenarios, type PresentationPreviewScenario } from "./PresentationTemplatePreview";
import { applyPresentationStylePreset, compatibleLayoutPresets, presentationStylePresets } from "./presentationTemplatePresets";
import type { PresentationDesignStyle, RepositoryAssetPath } from "@/app/rendering/templateRegistry";

type Props = { initialTemplate: ManagedPresentationTemplate; originalId: string | null; readOnly?: boolean; persistenceAvailable: boolean };
const colorLabels = { primary: "Primärfarbe", secondary: "Sekundärfarbe", accent: "Akzentfarbe", background: "Hintergrund", surface: "Fläche", surfaceStrong: "Starke Fläche", text: "Text", textMuted: "Sekundärtext", border: "Rahmen", success: "Erfolg", warning: "Warnung", danger: "Fehler" } as const;
const layoutLabels = { CLASSIC: "Klassisch", IMAGE_FOCUS: "Bildbetont", SPLIT: "Geteilte Fläche", MAGAZINE: "Magazinartig", COLLAGE: "Persönliche Collage" } as const;
const navigation = [["style", "Stil"], ["layout", "Aufbau"], ["imagery", "Bilder & Dekoration"], ["personalization", "Personalisierung"], ["branding", "Branding"], ["surfaces", "Oberflächen"], ["preview", "Vorschau"], ["status", "Status & Verwendung"]] as const;

function toDraft(template: ManagedPresentationTemplate): PresentationTemplateDraft {
  return { id: template.id, name: template.name, description: template.description ?? "", status: template.status === "SYSTEM" ? "DRAFT" : template.status, tags: [...template.tags.filter((tag) => tag !== "System")], sourceTemplateId: template.sourceTemplateId, config: structuredClone(template.config) };
}

function EditorSection({ id, title, summary, open = false, children }: { id: string; title: string; summary: string; open?: boolean; children: React.ReactNode }) {
  return <details id={id} open={open} className="scroll-mt-4 rounded-2xl border border-slate-200 bg-white shadow-sm"><summary className="cursor-pointer list-none p-5"><span className="text-lg font-bold">{title}</span><span className="mt-1 block text-sm text-slate-600">{summary}</span></summary><div className="border-t border-slate-100 p-5">{children}</div></details>;
}

function splitAssets(value: string): RepositoryAssetPath[] {
  return value.split(/[\n,]/).map((item) => item.trim()).filter(Boolean) as RepositoryAssetPath[];
}

export function PresentationTemplateGenerator({ initialTemplate, originalId, readOnly = false, persistenceAvailable }: Props) {
  const [draft, setDraft] = useState(() => toDraft(initialTemplate));
  const [scenario, setScenario] = useState<PresentationPreviewScenario>("TEXT");
  const [focusPreview, setFocusPreview] = useState(false);
  const [result, setResult] = useState<PresentationTemplateActionState | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState(() => JSON.stringify(toDraft(initialTemplate)));
  const [savedUpdatedAt, setSavedUpdatedAt] = useState(initialTemplate.updatedAt?.toISOString() ?? null);
  const skipLeaveWarning = useRef(false);
  const [isPending, startTransition] = useTransition();
  const validation = useMemo(() => validatePresentationTemplateDraft(draft), [draft]);

  useEffect(() => {
    const dirty = () => !skipLeaveWarning.current && JSON.stringify(draft) !== savedSnapshot;
    const beforeUnload = (event: BeforeUnloadEvent) => { if (dirty()) event.preventDefault(); };
    const warnBeforeClientNavigation = (event: MouseEvent) => {
      if (!dirty() || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest<HTMLAnchorElement>("a[href]");
      if (!link || link.target || link.download || link.href === window.location.href) return;
      if (!window.confirm("Es gibt ungespeicherte Änderungen. Seite trotzdem verlassen?")) { event.preventDefault(); event.stopPropagation(); }
    };
    window.addEventListener("beforeunload", beforeUnload); document.addEventListener("click", warnBeforeClientNavigation, true);
    return () => { window.removeEventListener("beforeunload", beforeUnload); document.removeEventListener("click", warnBeforeClientNavigation, true); };
  }, [draft, savedSnapshot]);

  useEffect(() => {
    if (!focusPreview) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setFocusPreview(false); };
    window.addEventListener("keydown", close); return () => window.removeEventListener("keydown", close);
  }, [focusPreview]);

  function updateConfig(mutator: (config: PresentationTemplateDraft["config"]) => void) {
    setDraft((current) => { const config = structuredClone(current.config); mutator(config); return { ...current, config }; });
  }

  function applyStyle(style: PresentationDesignStyle) {
    if (style === draft.config.design.stylePreset) return;
    if (!window.confirm("Das Stil-Preset ersetzt Aufbau, Farben und Oberflächen. Bilder und Personalisierung bleiben erhalten. Fortfahren?")) return;
    updateConfig((config) => Object.assign(config, applyPresentationStylePreset(config, style)));
  }

  function save() {
    startTransition(async () => {
      const actionResult = await savePresentationTemplate(originalId, savedUpdatedAt, draft);
      setResult(actionResult);
      if (actionResult.success) {
        skipLeaveWarning.current = true; setSavedSnapshot(JSON.stringify(draft)); setSavedUpdatedAt(actionResult.updatedAt ?? null);
        if (originalId === null && actionResult.templateId) window.location.href = `/templates/${actionResult.templateId}`;
        else if (draft.status === "ACTIVE") window.location.reload();
      }
    });
  }

  const preview = <PresentationTemplatePreview config={draft.config} templateId={draft.id || "preview-template"} templateName={draft.name || "Template-Vorschau"} scenario={scenario} />;

  return <div className="min-w-0 space-y-4">
    <nav aria-label="Generatorbereiche" className="sticky top-0 z-30 flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-sm backdrop-blur">{navigation.map(([id, label]) => <a key={id} href={`#${id}`} className="shrink-0 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">{label}</a>)}</nav>
    <div className="grid min-w-0 gap-6 2xl:grid-cols-[minmax(360px,0.62fr)_minmax(640px,1.38fr)]">
      <section className="min-w-0 space-y-4">
        <fieldset disabled={readOnly} className="space-y-4 disabled:opacity-75">
          <EditorSection id="style" title="1. Stil" summary="Wähle eine visuelle Designwelt als anpassbare Grundlage." open>
            <div className="grid gap-3">{presentationStylePresets.map((preset) => <article key={preset.id} data-style-card={preset.id} className={`rounded-2xl border-2 p-4 ${draft.config.design.stylePreset === preset.id ? "border-slate-900" : "border-slate-200"}`}><div className="mb-3 flex h-20 overflow-hidden rounded-xl">{preset.swatches.map((color) => <span key={color} className="flex-1" style={{ background: color }} />)}</div><h3 className="font-black">{preset.name}</h3><p className="mt-1 text-sm text-slate-600">{preset.description}</p><p className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{preset.useCase}</p><button type="button" onClick={() => applyStyle(preset.id)} className="mt-3 min-h-11 rounded-xl border border-slate-300 px-4 font-bold">Als Grundlage verwenden</button></article>)}</div>
          </EditorSection>
          <EditorSection id="layout" title="2. Aufbau" summary="Kontrollierte Kompositionen passend zum gewählten Stil.">
            <div className="grid grid-cols-2 gap-3">{compatibleLayoutPresets[draft.config.design.stylePreset].map((layout) => <button type="button" key={layout} onClick={() => updateConfig((config) => { config.design.composition.layoutPreset = layout; })} className={`min-h-28 rounded-xl border-2 p-3 text-left ${draft.config.design.composition.layoutPreset === layout ? "border-slate-900 bg-slate-50" : "border-slate-200"}`}><span className="mb-3 grid h-10 grid-cols-3 gap-1" aria-hidden="true"><i className="col-span-1 rounded bg-slate-300" /><i className="col-span-2 rounded bg-slate-200" /></span><strong>{layoutLabels[layout]}</strong></button>)}</div>
          </EditorSection>
          <EditorSection id="imagery" title="3. Bilder und Dekoration" summary="Sichere Repository-Assets; ein neuer Uploadpfad ist bewusst nicht enthalten.">
            <div className="grid gap-4"><label className="text-sm font-semibold">Logo<input value={draft.config.tokens.assets.logo} onChange={(event) => updateConfig((config) => { config.tokens.assets.logo = event.target.value as RepositoryAssetPath; })} className="mt-1 min-h-11 w-full rounded-xl border px-3 font-mono" /></label><label className="text-sm font-semibold">Hintergrundbild<input value={draft.config.tokens.assets.backgroundImage ?? ""} onChange={(event) => updateConfig((config) => { config.tokens.assets.backgroundImage = event.target.value ? event.target.value as RepositoryAssetPath : null; })} className="mt-1 min-h-11 w-full rounded-xl border px-3 font-mono" /></label><label className="text-sm font-semibold">Hauptbild<input value={draft.config.design.imagery.heroImage ?? ""} onChange={(event) => updateConfig((config) => { config.design.imagery.heroImage = event.target.value ? event.target.value as RepositoryAssetPath : null; })} className="mt-1 min-h-11 w-full rounded-xl border px-3 font-mono" /></label><label className="text-sm font-semibold">Persönlicher Bilderpool<textarea value={draft.config.design.imagery.personalImagePool.join("\n")} onChange={(event) => updateConfig((config) => { config.design.imagery.personalImagePool = splitAssets(event.target.value); })} rows={4} className="mt-1 w-full rounded-xl border p-3 font-mono text-xs" /></label><div className="grid grid-cols-2 gap-3"><label className="text-sm font-semibold">Bildplatzierung<select value={draft.config.design.imagery.placement} onChange={(event) => updateConfig((config) => { config.design.imagery.placement = event.target.value as typeof config.design.imagery.placement; })} className="mt-1 min-h-11 w-full rounded-xl border px-3"><option value="BACKGROUND">Hintergrund</option><option value="SIDE">Seitenbild</option><option value="COLLAGE">Collage</option></select></label><label className="text-sm font-semibold">Overlay<select value={draft.config.design.imagery.overlay} onChange={(event) => updateConfig((config) => { config.design.imagery.overlay = event.target.value as typeof config.design.imagery.overlay; })} className="mt-1 min-h-11 w-full rounded-xl border px-3"><option value="NONE">Keins</option><option value="SOFT">Dezent</option><option value="STRONG">Stark</option></select></label></div><p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900">Uploads sind nicht verfügbar, bis eine eindeutig environment-isolierte zentrale Uploadarchitektur besteht.</p></div>
          </EditorSection>
          <EditorSection id="personalization" title="4. Personalisierung" summary="Persönliche Identität, Anlass und Zusatztext.">
            <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-semibold">Name / Unternehmen<input value={draft.config.design.occasion.personName} onChange={(event) => updateConfig((config) => { config.design.occasion.personName = event.target.value; })} className="mt-1 min-h-11 w-full rounded-xl border px-3" /></label><label className="text-sm font-semibold">Alter (optional)<input value={draft.config.design.occasion.age} onChange={(event) => updateConfig((config) => { config.design.occasion.age = event.target.value; })} className="mt-1 min-h-11 w-full rounded-xl border px-3" /></label><label className="text-sm font-semibold sm:col-span-2">Veranstaltungstitel<input value={draft.config.design.occasion.eventTitle} onChange={(event) => updateConfig((config) => { config.design.occasion.eventTitle = event.target.value; })} className="mt-1 min-h-11 w-full rounded-xl border px-3" /></label><label className="text-sm font-semibold sm:col-span-2">Untertitel / Motto<input value={draft.config.design.occasion.subtitle} onChange={(event) => updateConfig((config) => { config.design.occasion.subtitle = event.target.value; })} className="mt-1 min-h-11 w-full rounded-xl border px-3" /></label><label className="text-sm font-semibold sm:col-span-2">Persönlicher Zusatztext<textarea value={draft.config.design.occasion.extraText} onChange={(event) => updateConfig((config) => { config.design.occasion.extraText = event.target.value; })} rows={2} className="mt-1 w-full rounded-xl border p-3" /></label><label className="text-sm font-semibold sm:col-span-2">Identität anzeigen<select value={draft.config.design.occasion.identityPlacement} onChange={(event) => updateConfig((config) => { config.design.occasion.identityPlacement = event.target.value as typeof config.design.occasion.identityPlacement; })} className="mt-1 min-h-11 w-full rounded-xl border px-3"><option value="HEADER">Im Kopf</option><option value="SIDE">Seitlich</option><option value="FOOTER">Im Fuß</option></select></label></div>
          </EditorSection>
          <EditorSection id="branding" title="5. Branding" summary="Farben, Schrift, Ecken und Dichte als Feinanpassung.">
            <div className="grid gap-3 sm:grid-cols-2">{(Object.keys(colorLabels) as (keyof typeof colorLabels)[]).map((key) => <label key={key} className="grid grid-cols-[2.75rem_1fr] items-center gap-2 text-sm font-semibold"><input type="color" value={draft.config.tokens.colors[key]} onChange={(event) => updateConfig((config) => { config.tokens.colors[key] = event.target.value as `#${string}`; })} className="h-11 w-11 rounded-lg border p-1" aria-label={colorLabels[key]} /><span>{colorLabels[key]}<input value={draft.config.tokens.colors[key]} onChange={(event) => updateConfig((config) => { config.tokens.colors[key] = event.target.value as `#${string}`; })} className="mt-1 min-h-9 w-full rounded-lg border px-2 font-mono text-xs" /></span></label>)}</div><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-sm font-semibold">Schrift<select value={draft.config.tokens.typography.family} onChange={(event) => updateConfig((config) => { config.tokens.typography.family = event.target.value as typeof config.tokens.typography.family; })} className="mt-1 min-h-11 w-full rounded-xl border px-3">{presentationTemplateOptions.fonts.map((font) => <option key={font}>{font}</option>)}</select></label><label className="text-sm font-semibold">Ecken<select value={draft.config.tokens.radii.large === "2rem" ? "ROUNDED" : "COMPACT"} onChange={(event) => updateConfig((config) => { config.tokens.radii = { ...presentationTemplateOptions.radiusPresets[event.target.value as keyof typeof presentationTemplateOptions.radiusPresets] }; })} className="mt-1 min-h-11 w-full rounded-xl border px-3"><option value="COMPACT">Leicht gerundet</option><option value="ROUNDED">Deutlich gerundet</option></select></label></div>
          </EditorSection>
          <EditorSection id="surfaces" title="6. Oberflächen" summary="Gemeinsamer Markenkern mit geeigneten Varianten pro Ausgabe."><div className="grid gap-3 sm:grid-cols-3"><label className="text-sm font-semibold">Präsentation<select value={draft.config.surfaces.presentation} onChange={(event) => updateConfig((config) => { config.surfaces.presentation = event.target.value as typeof config.surfaces.presentation; })} className="mt-1 min-h-11 w-full rounded-xl border px-3"><option value="NEON">Ausdrucksstark</option><option value="DARK">Ruhig</option></select></label><label className="text-sm font-semibold">Moderation<select value={draft.config.surfaces.moderation} onChange={(event) => updateConfig((config) => { config.surfaces.moderation = event.target.value as typeof config.surfaces.moderation; })} className="mt-1 min-h-11 w-full rounded-xl border px-3"><option value="BRANDED">Gebrandet</option><option value="QUIET">Ruhig</option></select></label><label className="text-sm font-semibold">Antwortformular<select value={draft.config.surfaces.answerForm} onChange={(event) => updateConfig((config) => { config.surfaces.answerForm = event.target.value as typeof config.surfaces.answerForm; })} className="mt-1 min-h-11 w-full rounded-xl border px-3"><option value="BRANDED">Gebrandet</option><option value="MINIMAL">Minimal</option></select></label></div></EditorSection>
          <EditorSection id="status" title="8. Status und Verwendung" summary="Metadaten, Lebenszyklus und Herkunft des Templates."><div className="grid gap-3"><label className="text-sm font-semibold">Name<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} className="mt-1 min-h-11 w-full rounded-xl border px-3" /></label><label className="text-sm font-semibold">Stabile ID<input value={draft.id} disabled={originalId !== null} onChange={(event) => setDraft({ ...draft, id: event.target.value })} className="mt-1 min-h-11 w-full rounded-xl border px-3 disabled:bg-slate-100" /></label><label className="text-sm font-semibold">Beschreibung<textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} rows={3} className="mt-1 w-full rounded-xl border p-3" /></label><div className="grid grid-cols-2 gap-3"><label className="text-sm font-semibold">Status<select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as PresentationTemplateDraft["status"] })} className="mt-1 min-h-11 w-full rounded-xl border px-3"><option value="DRAFT">Entwurf</option><option value="ACTIVE">Aktivieren</option>{draft.status === "ARCHIVED" && <option value="ARCHIVED" disabled>Archiviert</option>}</select></label><label className="text-sm font-semibold">Tags<input value={draft.tags.join(", ")} onChange={(event) => setDraft({ ...draft, tags: event.target.value.split(",") })} className="mt-1 min-h-11 w-full rounded-xl border px-3" /></label></div>{draft.sourceTemplateId && <p className="rounded-xl bg-slate-100 p-3 text-sm">Ausgangstemplate: <span className="font-mono">{draft.sourceTemplateId}</span></p>}</div></EditorSection>
        </fieldset>
        {!validation.ok && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{validation.errors.map((issue) => <p key={`${issue.field}-${issue.message}`}>{issue.message}</p>)}</div>}
        {validation.warnings.length > 0 && <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{validation.warnings.map((issue) => <p key={`${issue.field}-${issue.message}`}>{issue.message}</p>)}</div>}
        {result && <p className={`rounded-xl p-3 text-sm ${result.success ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>{result.message}</p>}
        {!readOnly && <button type="button" onClick={save} disabled={!persistenceAvailable || isPending || !validation.ok} className="min-h-12 w-full rounded-xl bg-slate-900 px-5 font-bold text-white disabled:opacity-50">{isPending ? "Speichert …" : "Template speichern"}</button>}
      </section>
      <section id="preview" className="order-first min-w-0 scroll-mt-4 2xl:order-none"><div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm 2xl:sticky 2xl:top-20"><div className="mb-3 flex items-center justify-between gap-3"><div><h2 className="font-bold">7. Vorschau</h2><p className="text-xs text-slate-500">Produktiver Renderer · vollständig 16:9 · Medien stumm</p></div><button type="button" onClick={() => setFocusPreview(true)} className="min-h-11 rounded-xl border px-3 font-semibold">Vorschau vergrößern</button></div><div className="mb-4 flex max-h-24 flex-wrap gap-2 overflow-y-auto" role="tablist" aria-label="Vorschauvarianten">{presentationPreviewScenarios.map(([id, label]) => <button key={id} type="button" onClick={() => setScenario(id)} className={`min-h-10 rounded-xl border px-3 text-sm font-semibold ${scenario === id ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300"}`}>{label}</button>)}</div>{preview}</div></section>
    </div>
    {focusPreview && <div role="dialog" aria-modal="true" aria-label="Vergrößerte Designvorschau" className="fixed inset-0 z-50 grid place-items-center bg-slate-950/90 p-4"><div className="w-full max-w-[1500px]"><div className="mb-3 flex justify-end"><button type="button" autoFocus onClick={() => setFocusPreview(false)} className="min-h-11 rounded-xl bg-white px-4 font-bold">Schließen</button></div>{preview}<p className="mt-2 text-center text-sm text-white/70">Escape schließt die Vorschau.</p></div></div>}
  </div>;
}
