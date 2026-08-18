import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/permissions";
import { parseDynamicQuestionTemplateSnapshot } from "@/app/fragen/editor/templates/dynamicQuestionTemplate";
import {
  DynamicQuestionTemplateManager,
  type DynamicQuestionTemplateAdminRow,
} from "./DynamicQuestionTemplateManager";

const roleLabel = {
  FIXED: "fest",
  REQUIRED_NEW: "neu erforderlich",
  EXCLUDED: "nicht enthalten",
} as const;

export default async function DynamicQuestionTemplatesAdminPage() {
  await requireAdmin();
  const templates = await prisma.frage_vorlagen.findMany({
    where: { art: "DYNAMIC" },
    orderBy: [{ status: "asc" }, { created_at: "desc" }],
    select: {
      vorlage_id: true,
      name: true,
      beschreibung: true,
      status: true,
      basis_code: true,
      konfiguration_json: true,
      source_fragen_id: true,
      created_at: true,
      review_feedback: true,
      created_by: { select: { name: true, email: true } },
    },
  });
  const rows: DynamicQuestionTemplateAdminRow[] = templates.flatMap((template) => {
    const snapshot = parseDynamicQuestionTemplateSnapshot(template.konfiguration_json);
    if (!snapshot || !template.basis_code) return [];
    return [{
      id: template.vorlage_id,
      name: template.name,
      description: template.beschreibung,
      status: template.status,
      baseCode: template.basis_code,
      sourceQuestionId: template.source_fragen_id,
      createdBy: template.created_by?.name?.trim() || template.created_by?.email || "Unbekannt",
      createdAt: template.created_at.toLocaleDateString("de-DE"),
      questionTextRole: roleLabel[snapshot.questionText.role],
      mediaRules: snapshot.media.map((medium) => `${medium.mediaType}: ${roleLabel[medium.role]}`),
      answerRules: snapshot.answers.map((answer, index) => `${answer.fieldLabel || `Antwort ${index + 1}`}: ${roleLabel[answer.role]}`),
      feedback: template.review_feedback,
    }];
  });

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6">
          <h1 className="text-3xl font-bold">Spezialfragenvorlagen</h1>
          <p className="mt-2 text-slate-600">Vorgeschlagene, aktive und abgelehnte dynamische Vorlagen prüfen.</p>
        </header>
        <DynamicQuestionTemplateManager templates={rows} />
      </div>
    </main>
  );
}
