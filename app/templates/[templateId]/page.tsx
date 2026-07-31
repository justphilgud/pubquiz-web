import Link from "next/link";
import { notFound } from "next/navigation";

import AppHeader from "@/app/components/AppHeader";
import { requireAdmin } from "@/app/lib/permissions";
import { DuplicatePresentationTemplateButton } from "@/app/rendering/presentationTemplates/DuplicatePresentationTemplateButton";
import { PresentationTemplateGenerator } from "@/app/rendering/presentationTemplates/PresentationTemplateGenerator";
import {
  getPresentationTemplatePageMode,
  requiresDraftRevision,
} from "@/app/rendering/presentationTemplates/presentationTemplateLifecycle";
import {
  getManagedPresentationTemplate,
  listManagedPresentationTemplates,
} from "@/app/rendering/presentationTemplates/presentationTemplateRepository.server";
import { getPresentationTemplateUploadContext } from "@/app/rendering/presentationTemplates/presentationTemplateUpload.server";

type Props = { params: Promise<{ templateId: string }> };

export default async function PresentationTemplateDetailPage({ params }: Props) {
  await requireAdmin();
  const { templateId } = await params;
  const [template, repository] = await Promise.all([
    getManagedPresentationTemplate(templateId),
    listManagedPresentationTemplates(),
  ]);
  if (!template) notFound();

  const pageMode = getPresentationTemplatePageMode(template);
  const uploadContext = getPresentationTemplateUploadContext();
  const needsDraftRevision = requiresDraftRevision(template);
  const duplicateLabel = template.isSystem
    ? "Als eigenes Template verwenden"
    : needsDraftRevision
      ? "Neue Version bearbeiten"
      : "Als Entwurf kopieren";

  return (
    <>
      <AppHeader />
      <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 md:px-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <Link href="/templates" className="text-sm font-semibold text-slate-600">
                ← Zur Übersicht
              </Link>
              <h1 className="mt-3 text-3xl font-bold">{template.name}</h1>
              <p className="mt-2 text-slate-600">
                {template.isSystem
                  ? "Unveränderliches Systemtemplate – zum Anpassen bitte duplizieren."
                  : `Eigenes Template · ${template.status}`}
              </p>
            </div>
            {repository.persistenceAvailable && (
              <DuplicatePresentationTemplateButton
                sourceId={template.id}
                label={duplicateLabel}
                className="min-h-11 rounded-xl border border-slate-300 bg-white px-5 font-bold disabled:cursor-wait disabled:opacity-60"
              />
            )}
          </header>

          {pageMode === "SYSTEM_READ_ONLY" && (
            <p className="rounded-xl border border-indigo-300 bg-indigo-50 p-4 text-indigo-950">
              <strong>Systemtemplate – schreibgeschützte Vorschau.</strong>{" "}
              Szenarien und Fokusansicht bleiben bedienbar. Für Änderungen
              erstellst du über „Als eigenes Template verwenden“ einen unabhängigen Entwurf.
            </p>
          )}

          {needsDraftRevision && (
            <p className="rounded-xl border border-sky-300 bg-sky-50 p-4 text-sky-950">
              <strong>Aktive Templates sind schreibgeschützt.</strong>{" "}
              Mit „Neue Version bearbeiten“ entsteht ein unabhängiger Entwurf.
              Bestehende Quiz- und Eventreihenzuordnungen bleiben unverändert
              beim aktiven Design.
            </p>
          )}
          {template.status === "ARCHIVED" && (
            <p className="rounded-xl border border-slate-300 bg-slate-100 p-4 text-slate-800">
              Archivierte Templates sind schreibgeschützt. Reaktiviere das
              Template in der Übersicht oder erzeuge eine neue Entwurfskopie.
            </p>
          )}
          {!repository.persistenceAvailable && (
            <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
              Die Template-Migration ist nicht angewendet. Die Vorschau bleibt
              verfügbar; persistierende Aktionen sind deaktiviert.
            </p>
          )}

          <PresentationTemplateGenerator
            initialTemplate={template}
            originalId={template.isSystem ? null : template.id}
            pageMode={pageMode}
            persistenceAvailable={repository.persistenceAvailable}
            mediaUploadPathnamePrefix={uploadContext.environmentPrefix}
            templateUploadsEnabled={uploadContext.enabled}
            templateUploadDisabledReason={uploadContext.disabledReason}
          />
        </div>
      </main>
    </>
  );
}
