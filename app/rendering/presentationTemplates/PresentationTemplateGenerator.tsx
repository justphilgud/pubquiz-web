"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";

import type { BlobEnvironmentPrefix } from "@/app/lib/blobPath";
import type { PresentationDesignStyle, TemplateAssetReference } from "@/app/rendering/templateRegistry";
import { savePresentationTemplate, type PresentationTemplateActionState } from "./actions";
import { PresentationTemplateAssetEditor } from "./PresentationTemplateAssetEditor";
import { PresentationTemplateTagSelector } from "./PresentationTemplateTagSelector";
import {
  presentationTemplateOptions,
  validatePresentationTemplateDraft,
  type ManagedPresentationTemplate,
  type PresentationTemplateDraft,
} from "./presentationTemplate";
import type { PresentationTemplateAssetRole } from "./presentationTemplateAssets";
import type { PresentationTemplatePageMode } from "./presentationTemplateLifecycle";
import {
  applyPresentationStylePreset,
  createPresentationStylePreset,
  presentationStylePresets,
} from "./presentationTemplatePresets";
import {
  PresentationTemplatePreview,
  presentationPreviewScenarios,
  storybookPresentationPreviewScenarios,
  type PresentationPreviewScenario,
} from "./PresentationTemplatePreview";

type Props = {
  initialTemplate: ManagedPresentationTemplate;
  originalId: string | null;
  pageMode: PresentationTemplatePageMode;
  persistenceAvailable: boolean;
  mediaUploadPathnamePrefix: BlobEnvironmentPrefix;
  templateUploadsEnabled: boolean;
  templateUploadDisabledReason: string;
  availableTags: readonly string[];
};

const navigation = [
  ["style", "Stil"],
  ["imagery", "Bilder"],
  ["branding", "Branding"],
  ["activation", "Aktivieren"],
] as const;
type GeneratorSectionId = (typeof navigation)[number][0];

const colorLabels = {
  primary: "Primärfarbe",
  secondary: "Sekundärfarbe",
  accent: "Akzentfarbe",
  background: "Hintergrund",
  surface: "Fläche",
  surfaceStrong: "Starke Fläche",
  text: "Text",
  textMuted: "Sekundärtext",
  border: "Rahmen",
  success: "Erfolg",
  warning: "Warnung",
  danger: "Fehler",
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

function EditorSection({ id, title, summary, children }: {
  id: GeneratorSectionId;
  title: string;
  summary: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} role="tabpanel" tabIndex={-1} aria-labelledby={`${id}-tab`} className="rounded-2xl border border-slate-200 bg-white shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-slate-900">
      <header className="p-4 sm:p-5">
        <h2 id={`${id}-heading`} className="text-lg font-bold">{title}</h2>
        <p className="mt-1 text-sm text-slate-600">{summary}</p>
      </header>
      <div className="border-t border-slate-100 p-4 sm:p-5">{children}</div>
    </section>
  );
}

function StyleSilhouette({ style, swatches }: { style: PresentationDesignStyle; swatches: readonly string[] }) {
  if (style === "EDITORIAL") return <div data-style-silhouette="EDITORIAL" className="flex h-16 flex-col justify-between border p-2" style={{ borderColor: swatches[2], backgroundColor: swatches[0] }}><span className="h-3 w-10" style={{ backgroundColor: swatches[1] }} /><span className="grid gap-1"><i className="h-1.5 w-4/5" style={{ backgroundColor: swatches[1] }} /><i className="h-1 w-2/5" style={{ backgroundColor: swatches[2] }} /></span></div>;
  if (style === "CORPORATE") return <div data-style-silhouette="CORPORATE" className="grid h-16 grid-cols-[1fr_2fr] gap-2 border border-slate-300 bg-slate-100 p-2"><span className="bg-slate-400" /><span className="grid content-center gap-1.5"><i className="h-1.5 w-4/5 bg-slate-800" /><i className="h-1.5 w-full bg-slate-300" /><i className="h-1.5 w-3/5 bg-slate-300" /></span></div>;
  if (style === "BIRTHDAY") return <div data-style-silhouette="BIRTHDAY" className="grid h-16 grid-cols-[.9fr_1.1fr] overflow-hidden border border-stone-300 bg-stone-50 p-2"><span className="flex flex-col justify-between border-r border-stone-300 pr-2"><i className="h-1.5 w-4/5 bg-stone-800" /><i className="h-1 w-2/5 bg-rose-700" /></span><span className="ml-2 bg-stone-300" /></div>;
  return <div data-style-silhouette="NEON" className="relative h-16 overflow-hidden rounded-xl border-4 border-slate-400 bg-slate-950"><span className="absolute -right-4 -top-8 size-20 rounded-full border-4 border-slate-500" /><span className="absolute bottom-2 left-3 h-2 w-3/5 skew-x-[-18deg] bg-white" /><span className="absolute bottom-6 left-3 h-1.5 w-2/5 bg-slate-500" /></div>;
}

function copyBranding(target: PresentationTemplateDraft["config"], source: PresentationTemplateDraft["config"]) {
  target.tokens.colors = structuredClone(source.tokens.colors);
  target.tokens.typography = structuredClone(source.tokens.typography);
  target.tokens.radii = structuredClone(source.tokens.radii);
  target.tokens.spacing = structuredClone(source.tokens.spacing);
}

function FocusPreviewDialog({ preview, onClose }: { preview: React.ReactNode; onClose: () => void }) {
  return <div role="dialog" aria-modal="true" aria-label="Vergrößerte Designvorschau" className="fixed inset-0 z-50 grid place-items-center overflow-hidden bg-slate-950/90 p-4"><div className="w-full max-w-[min(1500px,calc((100vh-7rem)*16/9))]"><div className="mb-3 flex justify-end"><button type="button" autoFocus onClick={onClose} className="min-h-11 rounded-xl bg-white px-4 font-bold">Schließen</button></div>{preview}<p className="mt-2 text-center text-sm text-white/70">Escape schließt die Vorschau.</p></div></div>;
}

export function PresentationTemplateGenerator({
  initialTemplate,
  originalId,
  pageMode,
  persistenceAvailable,
  mediaUploadPathnamePrefix,
  templateUploadsEnabled,
  templateUploadDisabledReason,
  availableTags,
}: Props) {
  const readOnly = pageMode !== "DRAFT_EDIT";
  const initialDraft = useMemo(() => toDraft(initialTemplate), [initialTemplate]);
  const [draft, setDraft] = useState(initialDraft);
  const [savedDraft, setSavedDraft] = useState(initialDraft);
  const [activeSection, setActiveSection] = useState<GeneratorSectionId>("style");
  const [scenario, setScenario] = useState<PresentationPreviewScenario>("TEXT");
  const [highlightedAssetRole, setHighlightedAssetRole] = useState<PresentationTemplateAssetRole | null>(null);
  const [focusPreview, setFocusPreview] = useState(false);
  const [result, setResult] = useState<PresentationTemplateActionState | null>(null);
  const [activatedTemplateId, setActivatedTemplateId] = useState<string | null>(null);
  const [savedUpdatedAt, setSavedUpdatedAt] = useState(initialTemplate.updatedAt?.toISOString() ?? null);
  const skipLeaveWarning = useRef(false);
  const [isPending, startTransition] = useTransition();
  const validation = useMemo(() => validatePresentationTemplateDraft(draft), [draft]);
  const isStorybook = draft.config.design.stylePreset === "BIRTHDAY";
  const previewScenarios = isStorybook ? storybookPresentationPreviewScenarios : presentationPreviewScenarios;
  const effectiveScenario: PresentationPreviewScenario = isStorybook
    ? scenario.startsWith("STORYBOOK_") ? scenario : "STORYBOOK_COVER"
    : scenario.startsWith("STORYBOOK_") ? "TEXT" : scenario;

  useEffect(() => {
    const dirty = () => !skipLeaveWarning.current && JSON.stringify(draft) !== JSON.stringify(savedDraft);
    const beforeUnload = (event: BeforeUnloadEvent) => { if (dirty()) event.preventDefault(); };
    const warnBeforeClientNavigation = (event: MouseEvent) => {
      if (!dirty() || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest<HTMLAnchorElement>("a[href]");
      if (!link || link.target || link.download || link.href === window.location.href) return;
      if (!window.confirm("Es gibt ungespeicherte Änderungen. Seite trotzdem verlassen?")) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", warnBeforeClientNavigation, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", warnBeforeClientNavigation, true);
    };
  }, [draft, savedDraft]);

  useEffect(() => {
    if (!focusPreview) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setFocusPreview(false); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [focusPreview]);

  function selectSection(id: GeneratorSectionId) {
    setActiveSection(id);
    window.history.replaceState(null, "", `#${id}`);
    window.requestAnimationFrame(() => document.getElementById(id)?.focus({ preventScroll: true }));
  }

  function updateConfig(mutator: (config: PresentationTemplateDraft["config"]) => void) {
    setDraft((current) => {
      const config = structuredClone(current.config);
      mutator(config);
      return { ...current, config };
    });
  }

  function updateAsset(role: PresentationTemplateAssetRole, value: TemplateAssetReference | TemplateAssetReference[] | null) {
    updateConfig((config) => {
      if (role === "LOGO") config.tokens.assets.logo = typeof value === "string" ? value : null;
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
            alt: "Erinnerungsbild",
            caption: null,
            year: null,
            order: index,
          });
        }
      } else if (role === "DECORATION" && Array.isArray(value)) config.design.imagery.decorativeImages = value;
    });
  }

  function applyStyle(style: PresentationDesignStyle) {
    if (style === draft.config.design.stylePreset) return;
    updateConfig((config) => Object.assign(config, applyPresentationStylePreset(config, style)));
    setScenario(style === "BIRTHDAY" ? "STORYBOOK_COVER" : "TEXT");
    setResult(null);
  }

  function resetToSavedBranding() {
    updateConfig((config) => copyBranding(config, savedDraft.config));
    setResult({ success: true, message: "Branding wurde auf den zuletzt gespeicherten Stand zurückgesetzt." });
  }

  function resetToStyleDefaults() {
    if (!window.confirm("Branding wirklich auf den Standard des gewählten Stils zurücksetzen?")) return;
    const preset = createPresentationStylePreset(draft.config.design.stylePreset);
    updateConfig((config) => copyBranding(config, preset));
    setResult({ success: true, message: "Branding wurde auf den Stil-Standard zurückgesetzt." });
  }

  function save(status: "DRAFT" | "ACTIVE") {
    const submittedDraft = { ...draft, status } satisfies PresentationTemplateDraft;
    startTransition(async () => {
      try {
        const actionResult = await savePresentationTemplate(originalId, savedUpdatedAt, submittedDraft);
        setResult(actionResult);
        if (!actionResult.success) return;
        setDraft(submittedDraft);
        setSavedDraft(submittedDraft);
        setSavedUpdatedAt(actionResult.updatedAt ?? null);
        if (status === "ACTIVE") {
          setActivatedTemplateId(actionResult.templateId ?? originalId);
        } else if (originalId === null && actionResult.templateId) {
          skipLeaveWarning.current = true;
          window.location.assign(`/templates/${actionResult.templateId}`);
        }
      } catch {
        setResult({ success: false, message: "Speichern ist fehlgeschlagen. Bitte erneut versuchen." });
      }
    });
  }

  const preview = (
    <PresentationTemplatePreview
      config={draft.config}
      templateId={draft.id || "preview-template"}
      templateName={draft.name || "Template-Vorschau"}
      scenario={effectiveScenario}
      highlightedAssetRole={highlightedAssetRole}
    />
  );

  if (readOnly) {
    return (
      <><div className="grid gap-5 lg:grid-cols-[minmax(280px,.65fr)_minmax(0,1.35fr)]">
        <section className="rounded-2xl border border-indigo-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-indigo-700">Schreibgeschützte Vorschau</p>
          <h2 className="mt-3 text-xl font-bold">{draft.name}</h2>
          <p className="mt-2 text-sm text-slate-600">Aktive, archivierte und Systemtemplates bleiben unveränderlich. Vorschauvarianten sind weiterhin verfügbar.</p>
        </section>
        <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <PreviewToolbar scenario={effectiveScenario} scenarios={previewScenarios} onScenarioChange={setScenario} onExpand={() => setFocusPreview(true)} />
          {preview}
        </section>
      </div>{focusPreview && <FocusPreviewDialog preview={preview} onClose={() => setFocusPreview(false)} />}</>
    );
  }

  if (activatedTemplateId) {
    return (
      <section className="rounded-2xl border border-emerald-300 bg-emerald-50 p-6 text-emerald-950">
        <p className="text-sm font-black uppercase tracking-[0.18em]">Template aktiviert</p>
        <h2 className="mt-2 text-2xl font-bold">„{draft.name}“ ist jetzt einsatzbereit.</h2>
        <p className="mt-2">Die aktive Version ist schreibgeschützt. Bestehende Quiz- und Eventreihen-Zuordnungen bleiben unverändert.</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href={`/templates/${activatedTemplateId}`} className="min-h-11 rounded-xl bg-emerald-900 px-4 py-3 font-bold text-white">Template ansehen</Link>
          <Link href="/templates" className="min-h-11 rounded-xl border border-emerald-700 px-4 py-3 font-bold">Zur Übersicht</Link>
        </div>
      </section>
    );
  }

  const currentIndex = navigation.findIndex(([id]) => id === activeSection);
  return (
    <div className="min-w-0 space-y-4">
      <nav role="tablist" aria-label="Generatorbereiche" className="sticky top-0 z-30 grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-sm backdrop-blur sm:grid-cols-4">
        {navigation.map(([id, label], index) => (
          <button key={id} id={`${id}-tab`} role="tab" aria-controls={id} aria-selected={activeSection === id} type="button" onClick={() => selectSection(id)} aria-current={activeSection === id ? "step" : undefined} className={`min-h-11 rounded-xl px-3 text-sm font-semibold ${activeSection === id ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"}`}>
            {index + 1} {label}
          </button>
        ))}
      </nav>

      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(320px,.78fr)_minmax(0,1.22fr)]">
        <section className="min-w-0">
          <div data-generator-active-section={activeSection}>
            <EditorSection id="style" title="1. Stil" summary="Wähle die visuelle Sprache. Ein Klick aktualisiert die Vorschau sofort.">
              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                {presentationStylePresets.map((preset) => {
                  const selected = draft.config.design.stylePreset === preset.id;
                  return (
                    <button key={preset.id} type="button" data-style-card={preset.id} aria-pressed={selected} onClick={() => applyStyle(preset.id)} className={`rounded-2xl border-2 p-3 text-left transition ${selected ? "border-slate-900 bg-slate-50 ring-2 ring-slate-900/10" : "border-slate-200 hover:border-slate-400"}`}>
                      <StyleSilhouette style={preset.id} swatches={preset.swatches} />
                      <div className="my-2 flex h-1.5 overflow-hidden rounded-full">{preset.swatches.map((color) => <span key={color} className="flex-1" style={{ background: color }} />)}</div>
                      <strong className="text-sm">{preset.name}</strong>
                      <span className="mt-1 block text-xs text-slate-600">{preset.description}</span>
                      {selected && <span className="mt-2 block text-xs font-bold text-emerald-700">Ausgewählt</span>}
                    </button>
                  );
                })}
              </div>
            </EditorSection>

            <EditorSection id="imagery" title="2. Bilder" summary="Upload, Platzierung und Wirkung sind direkt in der Vorschau nachvollziehbar.">
              <PresentationTemplateAssetEditor
                style={draft.config.design.stylePreset}
                values={{
                  logo: draft.config.tokens.assets.logo,
                  backgroundImage: draft.config.tokens.assets.backgroundImage,
                  heroImage: draft.config.design.imagery.heroImage,
                  solutionImage: draft.config.design.imagery.solutionImage,
                  personalImagePool: draft.config.design.imagery.personalImagePool,
                  decorativeImages: draft.config.design.imagery.decorativeImages,
                }}
                templateId={originalId}
                environmentPrefix={mediaUploadPathnamePrefix}
                uploadsEnabled={templateUploadsEnabled}
                uploadDisabledReason={templateUploadDisabledReason}
                onFocusRole={setHighlightedAssetRole}
                onChange={updateAsset}
              />
            </EditorSection>

            <EditorSection id="branding" title="3. Branding" summary="Farben und Schrift prägen alle Ausgabeflächen, ohne deren Bedienlogik zu verändern.">
              <div className="grid gap-3 sm:grid-cols-2">
                {(Object.keys(colorLabels) as (keyof typeof colorLabels)[]).map((key) => (
                  <label key={key} className="grid grid-cols-[2.75rem_1fr] items-center gap-2 text-sm font-semibold">
                    <input type="color" value={draft.config.tokens.colors[key]} onChange={(event) => updateConfig((config) => { config.tokens.colors[key] = event.target.value as `#${string}`; })} className="h-11 w-11 rounded-lg border p-1" aria-label={colorLabels[key]} />
                    <span>{colorLabels[key]}<input value={draft.config.tokens.colors[key]} onChange={(event) => updateConfig((config) => { config.tokens.colors[key] = event.target.value as `#${string}`; })} className="mt-1 min-h-9 w-full rounded-lg border px-2 font-mono text-xs" /></span>
                  </label>
                ))}
              </div>
              <label className="mt-4 block text-sm font-semibold">Schrift
                <select value={draft.config.tokens.typography.family} onChange={(event) => updateConfig((config) => { config.tokens.typography.family = event.target.value as typeof config.tokens.typography.family; })} className="mt-1 min-h-12 w-full rounded-xl border px-3" style={{ fontFamily: draft.config.tokens.typography.family }}>
                  {presentationTemplateOptions.fonts.map((font) => <option key={font.value} value={font.value} style={{ fontFamily: font.value }}>{font.label} · {font.character}</option>)}
                </select>
              </label>
              <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                <button type="button" onClick={resetToSavedBranding} className="min-h-11 rounded-xl border border-slate-300 px-4 font-bold">Änderungen zurücksetzen</button>
                <button type="button" onClick={resetToStyleDefaults} className="min-h-11 rounded-xl border border-slate-300 px-4 font-bold">Auf Stil-Standard zurücksetzen</button>
              </div>
            </EditorSection>

            <EditorSection id="activation" title="4. Aktivieren" summary="Gib dem Design einen Namen und entscheide bewusst zwischen Entwurf und aktiver Version.">
              <div className="grid gap-4">
                <label className="text-sm font-semibold">Name
                  <input value={draft.name} maxLength={120} onChange={(event) => setDraft({ ...draft, name: event.target.value })} className="mt-1 min-h-11 w-full rounded-xl border px-3" />
                </label>
                <label className="text-sm font-semibold">Beschreibung
                  <textarea value={draft.description} maxLength={1000} onChange={(event) => setDraft({ ...draft, description: event.target.value })} rows={3} className="mt-1 w-full rounded-xl border p-3" />
                </label>
                <PresentationTemplateTagSelector availableTags={availableTags} value={draft.tags} onChange={(tags) => setDraft({ ...draft, tags })} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <button type="button" onClick={() => save("DRAFT")} disabled={!persistenceAvailable || isPending || !validation.ok} className="min-h-12 rounded-xl border border-slate-900 px-5 font-bold disabled:opacity-50">{isPending ? "Speichert …" : "Als Entwurf speichern"}</button>
                  <button type="button" onClick={() => save("ACTIVE")} disabled={!persistenceAvailable || isPending || !validation.ok} className="min-h-12 rounded-xl bg-slate-900 px-5 font-bold text-white disabled:opacity-50">{isPending ? "Aktiviert …" : "Aktivieren"}</button>
                </div>
              </div>
            </EditorSection>
          </div>

          {!validation.ok && <div className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">{validation.errors.map((issue) => <p key={`${issue.field}-${issue.message}`}>{issue.message}</p>)}</div>}
          {validation.warnings.length > 0 && <div className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{validation.warnings.map((issue) => <p key={`${issue.field}-${issue.message}`}>{issue.message}</p>)}</div>}
          {result && <p role="status" className={`mt-3 rounded-xl p-3 text-sm ${result.success ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>{result.message}</p>}

          <nav aria-label="Schrittnavigation" className="mt-4 flex justify-between gap-3">
            <button type="button" disabled={currentIndex === 0} onClick={() => selectSection(navigation[currentIndex - 1][0])} className="min-h-11 rounded-xl border px-4 font-bold disabled:opacity-40">← Zurück</button>
            {currentIndex < navigation.length - 1 && <button type="button" onClick={() => selectSection(navigation[currentIndex + 1][0])} className="min-h-11 rounded-xl bg-slate-900 px-4 font-bold text-white">Weiter →</button>}
          </nav>
        </section>

        <section className="order-first min-w-0 lg:order-none">
          <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm lg:sticky lg:top-20">
            <PreviewToolbar scenario={effectiveScenario} scenarios={previewScenarios} onScenarioChange={setScenario} onExpand={() => setFocusPreview(true)} />
            {preview}
          </div>
        </section>
      </div>

      {focusPreview && <FocusPreviewDialog preview={preview} onClose={() => setFocusPreview(false)} />}
    </div>
  );
}

function PreviewToolbar({ scenario, scenarios, onScenarioChange, onExpand }: {
  scenario: PresentationPreviewScenario;
  scenarios: readonly (readonly [PresentationPreviewScenario, string])[];
  onScenarioChange: (scenario: PresentationPreviewScenario) => void;
  onExpand: () => void;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <label className="text-sm font-bold">Live-Vorschau
        <select value={scenario} onChange={(event) => onScenarioChange(event.target.value as PresentationPreviewScenario)} className="ml-2 min-h-10 rounded-xl border border-slate-300 px-2 font-semibold">
          {scenarios.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
      </label>
      <button type="button" onClick={onExpand} className="min-h-10 rounded-xl border px-3 text-sm font-semibold">Vorschau vergrößern</button>
    </div>
  );
}
