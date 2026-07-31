import Link from "next/link";

import AppHeader from "@/app/components/AppHeader";
import { requireAdmin } from "@/app/lib/permissions";
import {
  duplicatePresentationTemplate,
  setPresentationTemplateArchived,
} from "@/app/rendering/presentationTemplates/actions";
import {
  canArchivePresentationTemplate,
  requiresDraftRevision,
} from "@/app/rendering/presentationTemplates/presentationTemplateLifecycle";
import { listManagedPresentationTemplates } from "@/app/rendering/presentationTemplates/presentationTemplateRepository.server";
import { filterPresentationTemplates } from "@/app/rendering/presentationTemplates/templateOverviewPolicy";

type Props = { searchParams: Promise<{ q?: string; status?: string; source?: string }> };

const statusLabel = { SYSTEM: "System", DRAFT: "Entwurf", ACTIVE: "Aktiv", ARCHIVED: "Archiviert" } as const;

export default async function TemplatesPage({ searchParams }: Props) {
  await requireAdmin();
  const filters = await searchParams;
  const repository = await listManagedPresentationTemplates();
  const templates = filterPresentationTemplates(repository.templates, {
    query: filters.q,
    status: filters.status,
    source: filters.source,
  });

  return <><AppHeader /><main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 md:px-8"><div className="mx-auto max-w-7xl space-y-6">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><h1 className="text-3xl font-bold">Präsentationstemplates</h1><p className="mt-2 max-w-3xl text-slate-600">Zentrale Verwaltung für den visuellen Auftritt von Präsentation, Moderation und Antwortformular.</p></div><Link href="/templates/new" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-900 px-5 font-bold text-white">Neues Template erstellen</Link></header>
    {!repository.persistenceAvailable && <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-950"><strong>Lokale Migration nicht angewendet.</strong> Systemtemplates und Vorschau sind verfügbar; Speichern und Duplizieren bleiben bis zur kontrollierten Migration deaktiviert.</div>}
    <form className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-[1fr_180px_180px_auto]">
      <input name="q" defaultValue={filters.q} placeholder="Name, ID oder Tag suchen" className="min-h-11 rounded-xl border border-slate-300 px-3" />
      <select name="status" defaultValue={filters.status ?? "ALL"} className="min-h-11 rounded-xl border border-slate-300 px-3"><option value="ALL">Alle Status</option><option value="SYSTEM">System</option><option value="DRAFT">Entwurf</option><option value="ACTIVE">Aktiv</option><option value="ARCHIVED">Archiviert</option></select>
      <select name="source" defaultValue={filters.source ?? "ALL"} className="min-h-11 rounded-xl border border-slate-300 px-3"><option value="ALL">Alle Quellen</option><option value="SYSTEM">System</option><option value="USER">Eigene</option></select>
      <button className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 font-semibold">Filtern</button>
    </form>
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {templates.map((template) => {
        const duplicateAction = duplicatePresentationTemplate.bind(null, template.id);
        const archiveAction = setPresentationTemplateArchived.bind(null, template.id, template.status !== "ARCHIVED");
        const canArchive = canArchivePresentationTemplate(template);
        const duplicateLabel = template.isSystem
          ? "Duplizieren"
          : requiresDraftRevision(template)
            ? "Neue Version bearbeiten"
            : "Als Entwurf kopieren";
        return <article key={template.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="aspect-[16/7] p-5" style={{ background: `linear-gradient(135deg, ${template.config.tokens.colors.background}, ${template.config.tokens.colors.primary}55)`, color: template.config.tokens.colors.text }}><div className="flex h-full flex-col justify-between rounded-xl border p-4" style={{ background: template.config.tokens.colors.surface, borderColor: template.config.tokens.colors.border }}><span className="text-xs font-black uppercase tracking-[0.2em]" style={{ color: template.config.tokens.colors.primary }}>Designvorschau</span><strong className="text-2xl">{template.name}</strong><span className="h-2 w-24 rounded-full" style={{ background: template.config.tokens.colors.accent }} /></div></div>
          <div className="space-y-3 p-5"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold">{statusLabel[template.status]}</span><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold">{template.source === "SYSTEM" ? "Systemtemplate" : "Eigenes Template"}</span></div><div><h2 className="text-lg font-bold">{template.name}</h2><p className="font-mono text-xs text-slate-500">{template.id}</p></div><p className="min-h-10 text-sm text-slate-600">{template.description ?? "Keine Beschreibung"}</p><p className="text-xs text-slate-500">Verwendungen: {template.usageCount} · Vertrag v{template.contractVersion}</p><p className="text-xs text-slate-500">{template.updatedAt ? `Geändert: ${new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(template.updatedAt)}` : "Unverändertes Systemtemplate"}{template.creatorName ? ` · Verantwortlich: ${template.creatorName}` : ""}</p>
            <div className="flex flex-wrap gap-2"><Link href={`/templates/${template.id}`} className="inline-flex min-h-10 items-center rounded-xl bg-slate-900 px-3 font-semibold text-white">Öffnen</Link>{repository.persistenceAvailable && <form action={duplicateAction}><button className="min-h-10 rounded-xl border border-slate-300 px-3 font-semibold">{duplicateLabel}</button></form>}{!template.isSystem && repository.persistenceAvailable && (template.status === "ARCHIVED" || canArchive) && <form action={archiveAction}><button className="min-h-10 rounded-xl border border-slate-300 px-3 font-semibold">{template.status === "ARCHIVED" ? "Reaktivieren" : "Archivieren"}</button></form>}{!template.isSystem && template.status !== "ARCHIVED" && template.usageCount > 0 && <span className="inline-flex min-h-10 items-center rounded-xl bg-amber-50 px-3 text-xs font-semibold text-amber-900">Vor Archivierung Zuordnungen lösen</span>}</div>
          </div></article>;
      })}
    </div>
    {templates.length === 0 && <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-600">Keine Templates entsprechen den Filtern.</p>}
  </div></main></>;
}
