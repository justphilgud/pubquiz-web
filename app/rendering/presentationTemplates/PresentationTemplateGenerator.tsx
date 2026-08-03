"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { savePresentationTemplate, type PresentationTemplateActionState } from "./actions";
import { presentationTemplateOptions, validatePresentationTemplateDraft, type ManagedPresentationTemplate, type PresentationTemplateDraft } from "./presentationTemplate";
import { PresentationTemplatePreview, presentationPreviewScenarios, storybookPresentationPreviewScenarios, type PresentationPreviewScenario } from "./PresentationTemplatePreview";
import { applyPresentationStylePreset, compatibleLayoutPresets, presentationStylePresets } from "./presentationTemplatePresets";
import type { PresentationDesignStyle, TemplateAssetReference } from "@/app/rendering/templateRegistry";
import type { PresentationTemplatePageMode } from "./presentationTemplateLifecycle";
import type { BlobEnvironmentPrefix } from "@/app/lib/blobPath";
import { PresentationTemplateAssetEditor } from "./PresentationTemplateAssetEditor";
import type { PresentationTemplateAssetRole } from "./presentationTemplateAssets";
import { StorybookEditor } from "./StorybookEditor";

type Props = { initialTemplate: ManagedPresentationTemplate; originalId: string | null; pageMode: PresentationTemplatePageMode; persistenceAvailable: boolean; mediaUploadPathnamePrefix: BlobEnvironmentPrefix; templateUploadsEnabled: boolean; templateUploadDisabledReason: string };
const colorLabels = { primary: "Primärfarbe", secondary: "Sekundärfarbe", accent: "Akzentfarbe", background: "Hintergrund", surface: "Fläche", surfaceStrong: "Starke Fläche", text: "Text", textMuted: "Sekundärtext", border: "Rahmen", success: "Erfolg", warning: "Warnung", danger: "Fehler" } as const;
const layoutLabels = { CLASSIC: "Klassisch", IMAGE_FOCUS: "Bildbetont", SPLIT: "Geteilte Fläche", MAGAZINE: "Magazinartig", COLLAGE: "Persönliche Collage" } as const;
const navigation = [["style", "Stil"], ["layout", "Aufbau"], ["imagery", "Bilder"], ["personalization", "Personalisierung"], ["branding", "Branding"], ["surfaces", "Oberflächen"], ["preview", "Vorschau"], ["status", "Veröffentlichung"]] as const;
type GeneratorSectionId = (typeof navigation)[number][0];
const storybookNavigation: readonly (readonly [GeneratorSectionId, string])[] = [["style", "Designwelt"], ["personalization", "Geschichte"], ["preview", "Vorschau"], ["status", "Veröffentlichung"]];

function toDraft(template: ManagedPresentationTemplate): PresentationTemplateDraft {
  return { id: template.id, name: template.name, description: template.description ?? "", status: template.status === "SYSTEM" ? "DRAFT" : template.status, tags: [...template.tags.filter((tag) => tag !== "System")], sourceTemplateId: template.sourceTemplateId, config: structuredClone(template.config) };
}

function EditorSection({ id, title, summary, children }: { id: GeneratorSectionId; title: string; summary: string; active?: boolean; children: React.ReactNode }) {
  return <section id={id} tabIndex={-1} aria-labelledby={`${id}-heading`} className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-slate-900"><header className="p-5"><h2 id={`${id}-heading`} className="text-lg font-bold">{title}</h2><p className="mt-1 text-sm text-slate-600">{summary}</p></header><div className="border-t border-slate-100 p-5">{children}</div></section>;
}

function StyleSilhouette({ style }: { style: PresentationDesignStyle }) {
  if (style === "CORPORATE") {
    return <div data-style-silhouette="CORPORATE" className="mb-3 grid h-24 grid-cols-[1fr_2fr] gap-2 border border-slate-300 bg-slate-100 p-3"><span className="bg-slate-400" /><span className="grid content-center gap-2"><i className="h-2 w-4/5 bg-slate-800" /><i className="h-2 w-full bg-slate-300" /><i className="h-2 w-3/5 bg-slate-300" /></span></div>;
  }
  if (style === "BIRTHDAY") {
    return <div data-style-silhouette="BIRTHDAY" className="mb-3 grid h-24 grid-cols-[.9fr_1.1fr] overflow-hidden border border-stone-300 bg-stone-50 p-3"><span className="flex flex-col justify-between border-r border-stone-300 pr-3"><i className="h-2 w-4/5 bg-stone-800" /><i className="h-1 w-2/5 bg-rose-700" /></span><span className="ml-3 bg-stone-300" /></div>;
  }
  return <div data-style-silhouette="NEON" className="relative mb-3 h-24 overflow-hidden rounded-2xl border-4 border-slate-400 bg-slate-950"><span className="absolute -right-4 -top-8 size-24 rounded-full border-4 border-slate-500" /><span className="absolute bottom-3 left-4 h-3 w-3/5 skew-x-[-18deg] bg-white" /><span className="absolute bottom-8 left-4 h-2 w-2/5 bg-slate-500" /></div>;
}

export function PresentationTemplateGenerator({ initialTemplate, originalId, pageMode, persistenceAvailable, mediaUploadPathnamePrefix, templateUploadsEnabled, templateUploadDisabledReason }: Props) {
  const readOnly = pageMode !== "DRAFT_EDIT";
  const [draft, setDraft] = useState(() => toDraft(initialTemplate));
  const [activeSection, setActiveSection] = useState<GeneratorSectionId>(
    readOnly ? "preview" : "style",
  );
  const [scenario, setScenario] = useState<PresentationPreviewScenario>("TEXT");
  const [focusPreview, setFocusPreview] = useState(false);
  const [result, setResult] = useState<PresentationTemplateActionState | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState(() => JSON.stringify(toDraft(initialTemplate)));
  const [savedUpdatedAt, setSavedUpdatedAt] = useState(initialTemplate.updatedAt?.toISOString() ?? null);
  const skipLeaveWarning = useRef(false);
  const [isPending, startTransition] = useTransition();
  const validation = useMemo(() => validatePresentationTemplateDraft(draft), [draft]);
  const isStorybook = draft.config.design.stylePreset === "BIRTHDAY";
  const effectiveNavigation = isStorybook ? storybookNavigation : navigation;
  const previewScenarios = isStorybook ? storybookPresentationPreviewScenarios : presentationPreviewScenarios;

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

  useEffect(() => {
    const syncSectionFromHash = () => {
      const id = window.location.hash.slice(1);
      if (
        effectiveNavigation.some(([candidate]) => candidate === id) &&
        (!readOnly || id === "preview")
      ) {
        setActiveSection(id as GeneratorSectionId);
      }
    };
    syncSectionFromHash();
    window.addEventListener("popstate", syncSectionFromHash);
    window.addEventListener("hashchange", syncSectionFromHash);
    return () => {
      window.removeEventListener("popstate", syncSectionFromHash);
      window.removeEventListener("hashchange", syncSectionFromHash);
    };
  }, [effectiveNavigation, readOnly]);

  function selectSection(id: GeneratorSectionId) {
    setActiveSection(id);
    if (window.location.hash !== `#${id}`) {
      window.history.pushState(null, "", `#${id}`);
    }
    window.requestAnimationFrame(() => {
      document.getElementById(id)?.focus({ preventScroll: false });
    });
  }

  function updateConfig(mutator: (config: PresentationTemplateDraft["config"]) => void) {
    setDraft((current) => { const config = structuredClone(current.config); mutator(config); return { ...current, config }; });
  }

  function updateAsset(
    role: PresentationTemplateAssetRole,
    value: TemplateAssetReference | TemplateAssetReference[] | null,
  ) {
    updateConfig((config) => {
      if (role === "LOGO" && typeof value === "string") config.tokens.assets.logo = value;
      else if (role === "BACKGROUND") config.tokens.assets.backgroundImage = typeof value === "string" ? value : null;
      else if (role === "HERO_IMAGE") config.design.imagery.heroImage = typeof value === "string" ? value : null;
      else if (role === "SOLUTION_IMAGE") config.design.imagery.solutionImage = typeof value === "string" ? value : null;
      else if (role === "IMAGE_POOL" && Array.isArray(value)) {
        config.design.imagery.personalImagePool = value;
        if (config.design.storybook) {
          const existing = new Map(config.design.storybook.assets.map((asset) => [asset.source, asset]));
          config.design.storybook.assets = value.map((source, index) => existing.get(source) ?? {
            id: `memory-${index + 1}`,
            source,
            role: "MEMORY",
            personIds: [],
            alt: "Persönliche Erinnerung",
            caption: null,
            year: null,
            order: index,
          });
        }
      }
      else if (role === "DECORATION" && Array.isArray(value)) config.design.imagery.decorativeImages = value;
    });
  }

  function applyStyle(style: PresentationDesignStyle) {
    if (readOnly) return;
    if (style === draft.config.design.stylePreset) return;
    if (!window.confirm("Das Stil-Preset ersetzt Aufbau, Farben und Oberflächen. Bilder und Personalisierung bleiben erhalten. Fortfahren?")) return;
    try {
      updateConfig((config) => Object.assign(config, applyPresentationStylePreset(config, style)));
      setScenario(style === "BIRTHDAY" ? "STORYBOOK_COVER" : "TEXT");
      if (style === "BIRTHDAY") setActiveSection("personalization");
      setResult({ success: true, message: `${presentationStylePresets.find((preset) => preset.id === style)?.name ?? style} ist jetzt als Stil aktiv. Speichere den Entwurf, um die Änderung zu übernehmen.` });
    } catch {
      setResult({ success: false, message: "Das Stil-Preset konnte nicht angewendet werden." });
    }
  }

  function save() {
    startTransition(async () => {
      try {
        const actionResult = await savePresentationTemplate(originalId, savedUpdatedAt, draft);
        setResult(actionResult);
        if (actionResult.success) {
          skipLeaveWarning.current = true; setSavedSnapshot(JSON.stringify(draft)); setSavedUpdatedAt(actionResult.updatedAt ?? null);
          if (originalId === null && actionResult.templateId) window.location.href = `/templates/${actionResult.templateId}`;
          else if (draft.status === "ACTIVE") window.location.reload();
        }
      } catch {
        setResult({ success: false, message: "Speichern ist fehlgeschlagen. Bitte erneut versuchen." });
      }
    });
  }

  const effectiveScenario: PresentationPreviewScenario = isStorybook
    ? scenario.startsWith("STORYBOOK_") ? scenario : "STORYBOOK_COVER"
    : scenario.startsWith("STORYBOOK_") ? "TEXT" : scenario;
  const preview = <PresentationTemplatePreview config={draft.config} templateId={draft.id || "preview-template"} templateName={draft.name || "Template-Vorschau"} scenario={effectiveScenario} />;
  const visibleNavigation = readOnly
    ? effectiveNavigation.filter(([id]) => id === "preview")
    : effectiveNavigation;
  const readOnlyLabel = {
    SYSTEM_READ_ONLY: "Systemtemplate – schreibgeschützte Vorschau",
    ACTIVE_READ_ONLY: "Aktives Template – schreibgeschützt",
    ARCHIVED_READ_ONLY: "Archiviertes Template – schreibgeschützt",
    DRAFT_EDIT: "Bearbeitbarer Entwurf",
  }[pageMode];
  const readOnlyDescription = {
    SYSTEM_READ_ONLY: "Diese Systemreferenz kann angesehen, aber nicht direkt verändert werden. Vorschauvarianten und Fokusmodus bleiben verfügbar.",
    ACTIVE_READ_ONLY: "Diese aktive Version bleibt unveränderlich. Erzeuge zum Weiterarbeiten eine neue Version.",
    ARCHIVED_READ_ONLY: "Dieses archivierte Template ist unveränderlich. Reaktiviere es gemäß der bestehenden Lifecycle-Policy.",
    DRAFT_EDIT: "Dieser Entwurf ist bearbeitbar.",
  }[pageMode];

  return <div className="min-w-0 space-y-4">
    <nav aria-label="Generatorbereiche" className="sticky top-0 z-30 flex max-w-full gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-sm backdrop-blur">{visibleNavigation.map(([id, label]) => <button key={id} type="button" onClick={() => selectSection(id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); selectSection(id); } }} aria-current={activeSection === id ? "page" : undefined} className={`shrink-0 rounded-xl px-3 py-2 text-sm font-semibold ${activeSection === id ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"}`}>{label}</button>)}</nav>
    <div className="grid min-w-0 gap-6 2xl:grid-cols-[minmax(360px,0.62fr)_minmax(640px,1.38fr)]">
      <section className="min-w-0 space-y-4">
        {readOnly ? <div className="rounded-2xl border border-indigo-200 bg-white p-5 shadow-sm"><p className="text-xs font-black uppercase tracking-[0.2em] text-indigo-700">{readOnlyLabel}</p><h2 className="mt-3 text-xl font-bold">{draft.name}</h2><p className="mt-2 text-sm text-slate-600">{readOnlyDescription}</p><dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="font-semibold text-slate-500">Designstil</dt><dd className="font-bold">{presentationStylePresets.find((preset) => preset.id === draft.config.design.stylePreset)?.name}</dd></div><div><dt className="font-semibold text-slate-500">Status</dt><dd className="font-bold">{initialTemplate.status}</dd></div></dl></div> : <fieldset data-generator-active-section={activeSection} className="space-y-4">
          <EditorSection id="style" title="1. Stil" summary="Welches Quiz möchtest du gestalten? Wähle zuerst die visuelle Sprache, Farben folgen später." active={activeSection === "style"}>
            <div className="grid gap-3">{presentationStylePresets.map((preset) => <article key={preset.id} data-style-card={preset.id} className={`rounded-2xl border-2 p-4 ${draft.config.design.stylePreset === preset.id ? "border-slate-900" : "border-slate-200"}`}><StyleSilhouette style={preset.id} /><div className="mb-3 flex h-2 overflow-hidden rounded-full">{preset.swatches.map((color) => <span key={color} className="flex-1" style={{ background: color }} />)}</div><h3 className="font-black">{preset.name}</h3><p className="mt-1 text-sm text-slate-600">{preset.description}</p><p className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{preset.useCase}</p><button type="button" onClick={() => applyStyle(preset.id)} className="mt-3 min-h-11 rounded-xl border border-slate-300 px-4 font-bold">Als Grundlage verwenden</button></article>)}</div>
          </EditorSection>
          {!isStorybook && (
          <EditorSection id="layout" title="2. Aufbau" summary="Kontrollierte Kompositionen passend zum gewählten Stil." active={activeSection === "layout"}>
            <div className="grid grid-cols-2 gap-3">{compatibleLayoutPresets[draft.config.design.stylePreset].map((layout) => <button type="button" key={layout} onClick={() => updateConfig((config) => { config.design.composition.layoutPreset = layout; })} className={`min-h-28 rounded-xl border-2 p-3 text-left ${draft.config.design.composition.layoutPreset === layout ? "border-slate-900 bg-slate-50" : "border-slate-200"}`}><span className="mb-3 grid h-10 grid-cols-3 gap-1" aria-hidden="true"><i className="col-span-1 rounded bg-slate-300" /><i className="col-span-2 rounded bg-slate-200" /></span><strong>{layoutLabels[layout]}</strong></button>)}</div>
          </EditorSection>
          )}
          {!isStorybook && (
          <EditorSection id="imagery" title="3. Bilder und Dekoration" summary="Rollenbasierte Bilder statt einer universellen Medienfläche." active={activeSection === "imagery"}>
            <PresentationTemplateAssetEditor style={draft.config.design.stylePreset} values={{ logo: draft.config.tokens.assets.logo, backgroundImage: draft.config.tokens.assets.backgroundImage, heroImage: draft.config.design.imagery.heroImage, solutionImage: draft.config.design.imagery.solutionImage, personalImagePool: draft.config.design.imagery.personalImagePool, decorativeImages: draft.config.design.imagery.decorativeImages }} templateId={originalId} environmentPrefix={mediaUploadPathnamePrefix} uploadsEnabled={templateUploadsEnabled} uploadDisabledReason={templateUploadDisabledReason} onChange={updateAsset} />
            <div className="mt-4 grid grid-cols-2 gap-3"><label className="text-sm font-semibold">Bildplatzierung<select value={draft.config.design.imagery.placement} onChange={(event) => updateConfig((config) => { config.design.imagery.placement = event.target.value as typeof config.design.imagery.placement; })} className="mt-1 min-h-11 w-full rounded-xl border px-3"><option value="BACKGROUND">Hintergrund</option><option value="SIDE">Seitenbild</option><option value="COLLAGE">Collage</option></select></label><label className="text-sm font-semibold">Overlay<select value={draft.config.design.imagery.overlay} onChange={(event) => updateConfig((config) => { config.design.imagery.overlay = event.target.value as typeof config.design.imagery.overlay; })} className="mt-1 min-h-11 w-full rounded-xl border px-3"><option value="NONE">Keins</option><option value="SOFT">Dezent</option><option value="STRONG">Stark</option></select></label></div>
          </EditorSection>
          )}
          <EditorSection id="personalization" title={isStorybook ? "2. Geschichte" : "4. Personalisierung"} summary={isStorybook ? "Menschen, Bilder, Kapitel und Erinnerungen. Die sieben Buchseiten werden daraus automatisch komponiert." : "Persönliche Identität, Anlass und Zusatztext."} active={activeSection === "personalization"}>
            {draft.config.design.stylePreset === "BIRTHDAY" && draft.config.design.storybook
              ? <StorybookEditor value={draft.config.design.storybook} onChange={(storybook) => updateConfig((config) => {
                  config.design.storybook = storybook;
                  config.design.occasion.personName = storybook.people[0]?.name ?? "";
                  config.design.occasion.age = storybook.people[0]?.age ?? "";
                  config.design.occasion.eventTitle = storybook.sharedTitle;
                  config.design.occasion.subtitle = storybook.motto;
                  config.design.occasion.extraText = storybook.subtitle;
                  config.design.imagery.personalImagePool = storybook.assets.map((asset) => asset.source);
                })} />
              : <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-semibold">Name / Unternehmen<input value={draft.config.design.occasion.personName} onChange={(event) => updateConfig((config) => { config.design.occasion.personName = event.target.value; })} className="mt-1 min-h-11 w-full rounded-xl border px-3" /></label><label className="text-sm font-semibold">Alter (optional)<input value={draft.config.design.occasion.age} onChange={(event) => updateConfig((config) => { config.design.occasion.age = event.target.value; })} className="mt-1 min-h-11 w-full rounded-xl border px-3" /></label><label className="text-sm font-semibold sm:col-span-2">Veranstaltungstitel<input value={draft.config.design.occasion.eventTitle} onChange={(event) => updateConfig((config) => { config.design.occasion.eventTitle = event.target.value; })} className="mt-1 min-h-11 w-full rounded-xl border px-3" /></label><label className="text-sm font-semibold sm:col-span-2">Untertitel / Motto<input value={draft.config.design.occasion.subtitle} onChange={(event) => updateConfig((config) => { config.design.occasion.subtitle = event.target.value; })} className="mt-1 min-h-11 w-full rounded-xl border px-3" /></label><label className="text-sm font-semibold sm:col-span-2">Persönlicher Zusatztext<textarea value={draft.config.design.occasion.extraText} onChange={(event) => updateConfig((config) => { config.design.occasion.extraText = event.target.value; })} rows={2} className="mt-1 w-full rounded-xl border p-3" /></label><label className="text-sm font-semibold sm:col-span-2">Identität anzeigen<select value={draft.config.design.occasion.identityPlacement} onChange={(event) => updateConfig((config) => { config.design.occasion.identityPlacement = event.target.value as typeof config.design.occasion.identityPlacement; })} className="mt-1 min-h-11 w-full rounded-xl border px-3"><option value="HEADER">Im Kopf</option><option value="SIDE">Seitlich</option><option value="FOOTER">Im Fuß</option></select></label></div>}
          </EditorSection>
          {!isStorybook && (
          <EditorSection id="branding" title="5. Branding" summary="Farben, Schrift, Ecken und Dichte als Feinanpassung." active={activeSection === "branding"}>
            <div className="grid gap-3 sm:grid-cols-2">{(Object.keys(colorLabels) as (keyof typeof colorLabels)[]).map((key) => <label key={key} className="grid grid-cols-[2.75rem_1fr] items-center gap-2 text-sm font-semibold"><input type="color" value={draft.config.tokens.colors[key]} onChange={(event) => updateConfig((config) => { config.tokens.colors[key] = event.target.value as `#${string}`; })} className="h-11 w-11 rounded-lg border p-1" aria-label={colorLabels[key]} /><span>{colorLabels[key]}<input value={draft.config.tokens.colors[key]} onChange={(event) => updateConfig((config) => { config.tokens.colors[key] = event.target.value as `#${string}`; })} className="mt-1 min-h-9 w-full rounded-lg border px-2 font-mono text-xs" /></span></label>)}</div><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-sm font-semibold">Schrift<select value={draft.config.tokens.typography.family} onChange={(event) => updateConfig((config) => { config.tokens.typography.family = event.target.value as typeof config.tokens.typography.family; })} className="mt-1 min-h-11 w-full rounded-xl border px-3">{presentationTemplateOptions.fonts.map((font) => <option key={font}>{font}</option>)}</select></label><label className="text-sm font-semibold">Ecken<select value={draft.config.tokens.radii.large === "2rem" ? "ROUNDED" : "COMPACT"} onChange={(event) => updateConfig((config) => { config.tokens.radii = { ...presentationTemplateOptions.radiusPresets[event.target.value as keyof typeof presentationTemplateOptions.radiusPresets] }; })} className="mt-1 min-h-11 w-full rounded-xl border px-3"><option value="COMPACT">Leicht gerundet</option><option value="ROUNDED">Deutlich gerundet</option></select></label></div>
          </EditorSection>
          )}
          {!isStorybook && (
          <EditorSection id="surfaces" title="6. Oberflächen" summary="Gemeinsamer Markenkern mit geeigneten Varianten pro Ausgabe."><div className="grid gap-3 sm:grid-cols-3"><label className="text-sm font-semibold">Präsentation<select value={draft.config.surfaces.presentation} onChange={(event) => updateConfig((config) => { config.surfaces.presentation = event.target.value as typeof config.surfaces.presentation; })} className="mt-1 min-h-11 w-full rounded-xl border px-3"><option value="NEON">Ausdrucksstark</option><option value="DARK">Ruhig</option></select></label><label className="text-sm font-semibold">Moderation<select value={draft.config.surfaces.moderation} onChange={(event) => updateConfig((config) => { config.surfaces.moderation = event.target.value as typeof config.surfaces.moderation; })} className="mt-1 min-h-11 w-full rounded-xl border px-3"><option value="BRANDED">Gebrandet</option><option value="QUIET">Ruhig</option></select></label><label className="text-sm font-semibold">Antwortformular<select value={draft.config.surfaces.answerForm} onChange={(event) => updateConfig((config) => { config.surfaces.answerForm = event.target.value as typeof config.surfaces.answerForm; })} className="mt-1 min-h-11 w-full rounded-xl border px-3"><option value="BRANDED">Gebrandet</option><option value="MINIMAL">Minimal</option></select></label></div></EditorSection>
          )}
          <EditorSection id="status" title={isStorybook ? "4. Veröffentlichung" : "8. Veröffentlichung"} summary="Name, Lebenszyklus und Herkunft des fertigen Designs."><div className="grid gap-3"><label className="text-sm font-semibold">Name<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} className="mt-1 min-h-11 w-full rounded-xl border px-3" /></label><label className="text-sm font-semibold">Stabile ID<input value={draft.id} disabled={originalId !== null} onChange={(event) => setDraft({ ...draft, id: event.target.value })} className="mt-1 min-h-11 w-full rounded-xl border px-3 disabled:bg-slate-100" /></label><label className="text-sm font-semibold">Beschreibung<textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} rows={3} className="mt-1 w-full rounded-xl border p-3" /></label><div className="grid grid-cols-2 gap-3"><label className="text-sm font-semibold">Status<select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as PresentationTemplateDraft["status"] })} className="mt-1 min-h-11 w-full rounded-xl border px-3"><option value="DRAFT">Entwurf</option><option value="ACTIVE">Aktivieren</option>{draft.status === "ARCHIVED" && <option value="ARCHIVED" disabled>Archiviert</option>}</select></label><label className="text-sm font-semibold">Tags<input value={draft.tags.join(", ")} onChange={(event) => setDraft({ ...draft, tags: event.target.value.split(",") })} className="mt-1 min-h-11 w-full rounded-xl border px-3" /></label></div>{draft.sourceTemplateId && <p className="rounded-xl bg-slate-100 p-3 text-sm">Ausgangstemplate: <span className="font-mono">{draft.sourceTemplateId}</span></p>}</div></EditorSection>
        </fieldset>}
        {!validation.ok && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{validation.errors.map((issue) => <p key={`${issue.field}-${issue.message}`}>{issue.message}</p>)}</div>}
        {validation.warnings.length > 0 && <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{validation.warnings.map((issue) => <p key={`${issue.field}-${issue.message}`}>{issue.message}</p>)}</div>}
        {result && <p className={`rounded-xl p-3 text-sm ${result.success ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>{result.message}</p>}
        {!readOnly && <button type="button" onClick={save} disabled={!persistenceAvailable || isPending || !validation.ok} className="min-h-12 w-full rounded-xl bg-slate-900 px-5 font-bold text-white disabled:opacity-50">{isPending ? "Speichert …" : "Template speichern"}</button>}
      </section>
      <section id="preview" className="order-first min-w-0 scroll-mt-4 2xl:order-none"><div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm 2xl:sticky 2xl:top-20"><div className="mb-3 flex items-center justify-between gap-3"><div><h2 className="font-bold">{isStorybook ? "3. Vorschau" : "7. Vorschau"}</h2><p className="text-xs text-slate-500">Produktiver Renderer · vollständig 16:9 · Medien stumm</p></div><button type="button" onClick={() => setFocusPreview(true)} className="min-h-11 rounded-xl border px-3 font-semibold">Vorschau vergrößern</button></div><div className="mb-4 flex max-h-24 flex-wrap gap-2 overflow-y-auto" role="tablist" aria-label="Vorschauvarianten">{previewScenarios.map(([id, label]) => <button key={id} type="button" onClick={() => setScenario(id)} className={`min-h-10 rounded-xl border px-3 text-sm font-semibold ${effectiveScenario === id ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300"}`}>{label}</button>)}</div>{preview}</div></section>
    </div>
    {focusPreview && <div role="dialog" aria-modal="true" aria-label="Vergrößerte Designvorschau" className="fixed inset-0 z-50 grid place-items-center overflow-hidden bg-slate-950/90 p-4"><div className="w-full max-w-[min(1500px,calc((100vh-7rem)*16/9))]"><div className="mb-3 flex justify-end"><button type="button" autoFocus onClick={() => setFocusPreview(false)} className="min-h-11 rounded-xl bg-white px-4 font-bold">Schließen</button></div>{preview}<p className="mt-2 text-center text-sm text-white/70">Escape schließt die Vorschau.</p></div></div>}
  </div>;
}
