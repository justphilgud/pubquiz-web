import Link from "next/link";

import AppHeader from "@/app/components/AppHeader";
import { requireAdmin } from "@/app/lib/permissions";
import { PresentationTemplateGenerator } from "@/app/rendering/presentationTemplates/PresentationTemplateGenerator";
import {
  defaultPresentationTemplateConfig,
  type ManagedPresentationTemplate,
} from "@/app/rendering/presentationTemplates/presentationTemplate";
import { listManagedPresentationTemplates } from "@/app/rendering/presentationTemplates/presentationTemplateRepository.server";
import { getPresentationTemplateUploadContext } from "@/app/rendering/presentationTemplates/presentationTemplateUpload.server";

export default async function NewPresentationTemplatePage() {
  await requireAdmin();
  const { persistenceAvailable, templates } = await listManagedPresentationTemplates();
  const uploadContext = getPresentationTemplateUploadContext();
  const initialTemplate: ManagedPresentationTemplate = {
    id: "new-template",
    name: "Mein Template",
    description: "",
    status: "DRAFT",
    source: "USER",
    isSystem: false,
    contractVersion: 1,
    config: defaultPresentationTemplateConfig,
    tags: [],
    sourceTemplateId: null,
    creatorName: null,
    updatedAt: null,
    usageCount: 0,
  };
  const availableTags = Array.from(
    new Set(templates.flatMap((template) => template.tags).filter((tag) => tag !== "System")),
  );

  return (
    <>
      <AppHeader />
      <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 md:px-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <header>
            <Link href="/templates" className="text-sm font-semibold text-slate-600">← Zur Übersicht</Link>
            <h1 className="mt-3 text-3xl font-bold">Template-Generator</h1>
            <p className="mt-2 text-slate-600">Gestalte ein wiederverwendbares Design aus Stil, Bildern und Branding. Aufbau und Bedienlogik werden automatisch passend gewählt.</p>
          </header>
          {!persistenceAvailable && <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950">Speichern ist deaktiviert, solange die lokale Template-Migration nicht kontrolliert angewendet wurde.</p>}
          <PresentationTemplateGenerator
            initialTemplate={initialTemplate}
            originalId={null}
            pageMode="DRAFT_EDIT"
            persistenceAvailable={persistenceAvailable}
            mediaUploadPathnamePrefix={uploadContext.environmentPrefix}
            templateUploadsEnabled={uploadContext.enabled}
            templateUploadDisabledReason={uploadContext.disabledReason}
            availableTags={availableTags}
          />
        </div>
      </main>
    </>
  );
}
