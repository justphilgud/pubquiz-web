"use server";

import { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/permissions";
import { templateRegistry } from "@/app/rendering/templateRegistry";
import { revalidatePath } from "next/cache";
import {
  validatePresentationTemplateDraft,
  type PresentationTemplateDraft,
} from "./presentationTemplate";
import { getManagedPresentationTemplate } from "./presentationTemplateRepository.server";

export type PresentationTemplateActionState = {
  success: boolean;
  message: string;
  errors?: Record<string, string>;
  templateId?: string;
  updatedAt?: string;
};

function errorsByField(
  issues: readonly { field: string; message: string }[],
) {
  return Object.fromEntries(issues.map((issue) => [issue.field, issue.message]));
}

function isSystemId(id: string) {
  return templateRegistry.presentation.some((template) => template.id === id);
}

function slugifyTemplateName(name: string) {
  const slug = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 56)
    .replace(/-+$/g, "");
  return /^[a-z]/.test(slug) && slug.length >= 3 ? slug : "template";
}

async function generateUniquePresentationTemplateId(name: string) {
  const base = slugifyTemplateName(name);
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const suffix = attempt === 0 ? "" : `-${attempt + 1}`;
    const id = `${base.slice(0, 64 - suffix.length).replace(/-+$/g, "")}${suffix}`;
    if (isSystemId(id)) continue;
    const exists = await prisma.presentation_templates.findUnique({
      where: { presentation_template_id: id },
      select: { presentation_template_id: true },
    });
    if (!exists) return id;
  }
  return `template-${crypto.randomUUID().slice(0, 8)}`;
}

export async function savePresentationTemplate(
  originalId: string | null,
  expectedUpdatedAt: string | null,
  draft: PresentationTemplateDraft,
): Promise<PresentationTemplateActionState> {
  const session = await requireAdmin();
  const effectiveDraft = originalId
    ? draft
    : { ...draft, id: await generateUniquePresentationTemplateId(draft.name) };
  const result = validatePresentationTemplateDraft(effectiveDraft);
  if (!result.ok) {
    return {
      success: false,
      message: result.errors[0]?.message ?? "Template ist ungültig.",
      errors: errorsByField(result.errors),
    };
  }
  if (isSystemId(result.value.id) || (originalId && isSystemId(originalId))) {
    return { success: false, message: "Systemtemplates können nicht verändert werden." };
  }
  if (originalId && originalId !== result.value.id) {
    return { success: false, message: "Die stabile Template-ID kann nach der Erstellung nicht geändert werden." };
  }

  const data = {
    name: result.value.name,
    beschreibung: result.value.description || null,
    status: result.value.status,
    contract_version: result.value.config.version,
    theme_config_json: result.value.config as unknown as Prisma.InputJsonValue,
    tags: result.value.tags,
    source_template_id: result.value.sourceTemplateId,
  };

  try {
    if (originalId) {
      const existing = await prisma.presentation_templates.findUnique({
        where: { presentation_template_id: originalId },
        select: {
          ist_systemtemplate: true,
          status: true,
          updated_at: true,
        },
      });
      if (!existing) return { success: false, message: "Template wurde nicht gefunden." };
      if (existing.ist_systemtemplate) return { success: false, message: "Systemtemplates können nicht verändert werden." };
      if (existing.status !== "DRAFT") {
        return {
          success: false,
          message: "Aktive und archivierte Templates sind schreibgeschützt. Bitte zuerst einen neuen Entwurf erzeugen.",
        };
      }
      const expectedDate = expectedUpdatedAt
        ? new Date(expectedUpdatedAt)
        : null;
      if (!expectedDate || Number.isNaN(expectedDate.getTime())) {
        return {
          success: false,
          message: "Der Bearbeitungsstand fehlt. Bitte die Seite neu laden.",
        };
      }
      const updated = await prisma.presentation_templates.updateMany({
        where: {
          presentation_template_id: originalId,
          ist_systemtemplate: false,
          status: "DRAFT",
          updated_at: expectedDate,
        },
        data,
      });
      if (updated.count !== 1) {
        return {
          success: false,
          message: "Dieses Template wurde zwischenzeitlich geändert. Bitte die Seite neu laden und die Änderungen erneut prüfen.",
        };
      }
    } else {
      await prisma.presentation_templates.create({
        data: {
          presentation_template_id: result.value.id,
          ...data,
          ist_systemtemplate: false,
          created_by_user_id: session.actor.userId,
        },
      });
    }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { success: false, message: "Diese Template-ID ist bereits vergeben.", errors: { id: "Diese Template-ID ist bereits vergeben." } };
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021") {
      return { success: false, message: "Die lokale Template-Migration ist noch nicht angewendet. Speichern ist daher bewusst deaktiviert." };
    }
    return {
      success: false,
      message: "Das Template konnte nicht gespeichert werden. Bitte erneut versuchen.",
    };
  }

  revalidatePath("/templates");
  revalidatePath(`/templates/${result.value.id}`);
  const saved = await prisma.presentation_templates.findUnique({
    where: { presentation_template_id: result.value.id },
    select: { updated_at: true },
  });
  return {
    success: true,
    message:
      result.value.status === "ACTIVE"
        ? "Template wurde aktiviert und ist jetzt schreibgeschützt."
        : "Entwurf wurde gespeichert.",
    templateId: result.value.id,
    updatedAt: saved?.updated_at.toISOString(),
  };
}

export async function duplicatePresentationTemplate(sourceId: string) {
  const session = await requireAdmin();
  const source = await getManagedPresentationTemplate(sourceId);
  if (!source) {
    return {
      success: false,
      message: "Das Ausgangstemplate wurde nicht gefunden.",
    } satisfies PresentationTemplateActionState;
  }

  const base = `${source.id}-kopie`.slice(0, 58).replace(/-+$/, "");
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const id = attempt === 0 ? base : `${base}-${attempt + 1}`.slice(0, 64);
    if (isSystemId(id)) continue;
    try {
      await prisma.presentation_templates.create({
        data: {
          presentation_template_id: id,
          name: `${source.name} – Kopie`,
          beschreibung: source.description,
          status: "DRAFT",
          ist_systemtemplate: false,
          contract_version: source.config.version,
          theme_config_json: source.config as unknown as Prisma.InputJsonValue,
          tags: [...source.tags.filter((tag) => tag !== "System")],
          source_template_id: source.id,
          created_by_user_id: session.actor.userId,
        },
      });
      revalidatePath("/templates");
      return {
        success: true,
        message: "Bearbeitbarer Entwurf wurde erstellt.",
        templateId: id,
      } satisfies PresentationTemplateActionState;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        continue;
      }
      return {
        success: false,
        message: "Der Entwurf konnte nicht erstellt werden. Bitte erneut versuchen.",
      } satisfies PresentationTemplateActionState;
    }
  }
  return {
    success: false,
    message: "Es konnte keine eindeutige Template-ID erzeugt werden.",
  } satisfies PresentationTemplateActionState;
}

export async function setPresentationTemplateArchived(id: string, archived: boolean) {
  await requireAdmin();
  if (isSystemId(id)) return;
  if (archived) {
    const [eventSeriesUsage, quizUsage] = await Promise.all([
      prisma.eventreihen.count({
        where: {
          OR: [
            { default_presentation_template_id: id },
            { default_answer_form_template_id: id },
          ],
        },
      }),
      prisma.quiz.count({
        where: {
          OR: [
            { presentation_template_id: id },
            { answer_form_template_id: id },
          ],
        },
      }),
    ]);
    if (eventSeriesUsage + quizUsage > 0) return;
  }
  await prisma.presentation_templates.update({
    where: { presentation_template_id: id, ist_systemtemplate: false },
    data: { status: archived ? "ARCHIVED" : "DRAFT" },
  });
  revalidatePath("/templates");
  revalidatePath(`/templates/${id}`);
}
