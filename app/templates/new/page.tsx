import Link from "next/link";

import AppHeader from "@/app/components/AppHeader";
import { requireAdmin } from "@/app/lib/permissions";
import { PresentationTemplateGenerator } from "@/app/rendering/presentationTemplates/PresentationTemplateGenerator";
import {
  defaultPresentationTemplateConfig,
  type ManagedPresentationTemplate,
} from "@/app/rendering/presentationTemplates/presentationTemplate";
import { listManagedPresentationTemplates } from "@/app/rendering/presentationTemplates/presentationTemplateRepository.server";

export default async function NewPresentationTemplatePage() {
  await requireAdmin();
  const { persistenceAvailable } = await listManagedPresentationTemplates();
  const initialTemplate: ManagedPresentationTemplate = {
    id: "mein-template",
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

  return <><AppHeader /><main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 md:px-8"><div className="mx-auto max-w-7xl space-y-6"><header><Link href="/templates" className="text-sm font-semibold text-slate-600">← Zur Übersicht</Link><h1 className="mt-3 text-3xl font-bold">Template-Generator</h1><p className="mt-2 text-slate-600">Gestalte das visuelle Erscheinungsbild von Präsentation, Moderation und Antwortformular. Der passende Aufbau einer Frage wird weiterhin automatisch gewählt.</p></header>{!persistenceAvailable && <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950">Speichern ist deaktiviert, solange die neue lokale Migration nicht kontrolliert angewendet wurde.</p>}<PresentationTemplateGenerator initialTemplate={initialTemplate} originalId={null} persistenceAvailable={persistenceAvailable} /></div></main></>;
}
