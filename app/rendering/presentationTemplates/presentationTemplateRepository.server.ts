import "server-only";

import { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/app/lib/prisma";
import {
  getAnswerFormTemplate,
  templateRegistry,
  type PresentationTemplate,
} from "@/app/rendering/templateRegistry";
import {
  parsePresentationTemplateConfig,
  type ManagedPresentationTemplate,
  type PresentationTemplateConfig,
  type PresentationTemplateStatus,
} from "./presentationTemplate";

function systemTemplates(): ManagedPresentationTemplate[] {
  return templateRegistry.presentation.map((template) => {
    const runtimeTemplate: PresentationTemplate = template;
    return {
    id: template.id,
    name: ({
      "ungegoogelt-default": "ungegoogelt Neon",
      "ungegoogelt-dark": "ungegoogelt Dunkel",
      "corporate-reference": "Corporate",
      "birthday-reference": "Storybook",
    } as Record<string, string>)[template.id] ?? template.id,
    description: ({
      "ungegoogelt-default": "Systemtemplate mit dem etablierten ungegoogelt Neon-Auftritt.",
      "ungegoogelt-dark": "Reduziertes dunkles Systemtemplate.",
      "corporate-reference": "Sachliches Referenzdesign für Unternehmen, Workshops und Kundenveranstaltungen.",
      "birthday-reference": "Persönliches Referenzdesign für hochwertige, redaktionelle Erinnerungsquizze.",
    } as Record<string, string>)[template.id] ?? null,
    status: "SYSTEM",
    source: "SYSTEM",
    isSystem: true,
    contractVersion: 1,
    config: {
      version: 1,
      tokens: template.tokens,
      surfaces: {
        presentation: template.variant,
        moderation: runtimeTemplate.moderationVariant ?? "BRANDED",
        answerForm: getAnswerFormTemplate(template.id)?.variant ?? "BRANDED",
      },
      design: structuredClone(template.design),
    },
    tags: ["System"],
    sourceTemplateId: null,
    creatorName: null,
    updatedAt: null,
    usageCount: 0,
    };
  });
}

function isMissingTable(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2021"
  );
}

export type PresentationTemplateRepositoryResult = {
  templates: ManagedPresentationTemplate[];
  persistenceAvailable: boolean;
};

export type AssignablePresentationTemplate = Pick<
  ManagedPresentationTemplate,
  "id" | "name" | "config"
>;

export async function listAssignablePresentationTemplates(): Promise<
  AssignablePresentationTemplate[]
> {
  const { templates } = await listManagedPresentationTemplates();
  return templates
    .filter((template) => template.status === "SYSTEM" || template.status === "ACTIVE")
    .map(({ id, name, config }) => ({ id, name, config }));
}

export async function listManagedPresentationTemplates(): Promise<PresentationTemplateRepositoryResult> {
  try {
    const [stored, eventSeries, quizzes] = await Promise.all([
      prisma.presentation_templates.findMany({
        include: { created_by: { select: { name: true, email: true } } },
        orderBy: [{ status: "asc" }, { updated_at: "desc" }],
      }),
      prisma.eventreihen.findMany({
        select: {
          default_presentation_template_id: true,
          default_answer_form_template_id: true,
        },
      }),
      prisma.quiz.findMany({
        select: {
          presentation_template_id: true,
          answer_form_template_id: true,
        },
      }),
    ]);

    const usage = new Map<string, number>();
    const count = (id: string | null) => {
      if (id) usage.set(id, (usage.get(id) ?? 0) + 1);
    };
    for (const series of eventSeries) {
      count(series.default_presentation_template_id);
      if (series.default_answer_form_template_id !== series.default_presentation_template_id) {
        count(series.default_answer_form_template_id);
      }
    }
    for (const quiz of quizzes) {
      count(quiz.presentation_template_id);
      if (quiz.answer_form_template_id !== quiz.presentation_template_id) {
        count(quiz.answer_form_template_id);
      }
    }

    const userTemplates = stored.flatMap((template) => {
      const config = parsePresentationTemplateConfig(template.theme_config_json);
      if (!config) return [];
      return [
        {
          id: template.presentation_template_id,
          name: template.name,
          description: template.beschreibung,
          status: template.status as PresentationTemplateStatus,
          source: "USER" as const,
          isSystem: template.ist_systemtemplate,
          contractVersion: template.contract_version,
          config,
          tags: template.tags,
          sourceTemplateId: template.source_template_id,
          creatorName:
            template.created_by?.name ?? template.created_by?.email ?? null,
          updatedAt: template.updated_at,
          usageCount: usage.get(template.presentation_template_id) ?? 0,
        },
      ];
    });

    return {
      templates: [
        ...systemTemplates().map((template) => ({
          ...template,
          usageCount: usage.get(template.id) ?? 0,
        })),
        ...userTemplates,
      ],
      persistenceAvailable: true,
    };
  } catch (error) {
    if (!isMissingTable(error)) throw error;
    return { templates: systemTemplates(), persistenceAvailable: false };
  }
}

export async function getManagedPresentationTemplate(id: string) {
  const system = systemTemplates().find((template) => template.id === id);
  if (system) return system;

  try {
    const template = await prisma.presentation_templates.findUnique({
      where: { presentation_template_id: id },
      include: { created_by: { select: { name: true, email: true } } },
    });
    if (!template) return null;
    const config = parsePresentationTemplateConfig(template.theme_config_json);
    if (!config) return null;
    return {
      id: template.presentation_template_id,
      name: template.name,
      description: template.beschreibung,
      status: template.status as PresentationTemplateStatus,
      source: "USER" as const,
      isSystem: template.ist_systemtemplate,
      contractVersion: template.contract_version,
      config,
      tags: template.tags,
      sourceTemplateId: template.source_template_id,
      creatorName: template.created_by?.name ?? template.created_by?.email ?? null,
      updatedAt: template.updated_at,
      usageCount: 0,
    } satisfies ManagedPresentationTemplate;
  } catch (error) {
    if (isMissingTable(error)) return null;
    throw error;
  }
}

export async function loadStoredPresentationTemplateConfigs(ids: readonly string[]) {
  const customIds = ids.filter(
    (id) => id && !templateRegistry.presentation.some((template) => template.id === id),
  );
  if (customIds.length === 0) return new Map<string, PresentationTemplateConfig>();
  try {
    const rows = await prisma.presentation_templates.findMany({
      where: { presentation_template_id: { in: [...new Set(customIds)] } },
      select: { presentation_template_id: true, theme_config_json: true },
    });
    return new Map(
      rows.flatMap((row) => {
        const config = parsePresentationTemplateConfig(row.theme_config_json);
        return config ? [[row.presentation_template_id, config] as const] : [];
      }),
    );
  } catch (error) {
    if (isMissingTable(error)) return new Map<string, PresentationTemplateConfig>();
    throw error;
  }
}
