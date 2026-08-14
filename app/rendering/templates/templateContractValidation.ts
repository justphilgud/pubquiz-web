import {
  isInteractionEvaluationCompatible,
  type TemplateDataSourceDefinition,
  type TemplateDefinition,
  type TemplateLifecycleStatus,
  type TemplateOverrideLevel,
} from "./templateContract";
import type { QuestionTemplateDefinition } from "@/app/fragen/editor/types";
import {
  getMediaSlotDefinition,
  isMediaSlotKey,
} from "@/app/fragen/editor/mediaSlots";
import { resolveTemplateContract } from "./templateContractResolver";

export type TemplateContractValidationIssueCode =
  | "DUPLICATE_TEMPLATE_VERSION"
  | "DUPLICATE_RESOLUTION_ID"
  | "INVALID_TEMPLATE_ID"
  | "INVALID_VERSION"
  | "INVALID_LIFECYCLE"
  | "MISSING_EDITOR_RENDERER"
  | "MISSING_RUNTIME_RENDERER"
  | "DEFAULT_INTERACTION_NOT_ALLOWED"
  | "DUPLICATE_ANSWER_FORM"
  | "MISSING_ANSWER_FORM"
  | "ANSWER_FORM_NOT_ALLOWED"
  | "DEFAULT_EVALUATION_NOT_ALLOWED"
  | "INCOMPATIBLE_INTERACTION_EVALUATION"
  | "INVALID_NONE_EVALUATION"
  | "INVALID_REVEAL_CONTRACT"
  | "DUPLICATE_DATA_SOURCE_ID"
  | "MISSING_DATA_SOURCE"
  | "INVALID_GENERATED_SOURCE_PERSISTENCE"
  | "INVALID_RUNTIME_SOURCE_PERSISTENCE"
  | "INVALID_SNAPSHOT_SOURCE"
  | "INVALID_DATA_SOURCE_FALLBACK"
  | "INVALID_RUNTIME_COMPONENT_SOURCE"
  | "INVALID_OVERRIDE_LEVEL"
  | "DUPLICATE_SLOT_ID"
  | "DUPLICATE_MEDIA_SLOT_REFERENCE"
  | "UNKNOWN_MEDIA_SLOT"
  | "MEDIA_SLOT_COMPONENT_MISMATCH"
  | "INVALID_SLOT_CARDINALITY"
  | "INVALID_LEGACY_MAPPING"
  | "DUPLICATE_LEGACY_MAPPING"
  | "MIGRATION_VERSION_MISMATCH"
  | "TEMPLATE_CONTRACT_COVERAGE_MISSING";

export type TemplateContractValidationIssue = {
  code: TemplateContractValidationIssueCode;
  path: string;
  message: string;
};

const lifecycleStatuses = new Set<TemplateLifecycleStatus>([
  "DRAFT",
  "EXPERIMENTAL",
  "ACTIVE",
  "DEPRECATED",
  "ARCHIVED",
]);

const overrideLevels = new Set<TemplateOverrideLevel>([
  "LOCKED",
  "QUIZ",
  "SECTION",
  "SLIDE",
  "RUNTIME",
]);

const dataSourceFallbacks = new Set<TemplateDataSourceDefinition["fallback"]>([
  "NONE",
  "LAST_KNOWN",
  "HIDE_COMPONENT",
  "BLOCK_RUNTIME",
]);

function issue(
  code: TemplateContractValidationIssueCode,
  path: string,
  message: string,
): TemplateContractValidationIssue {
  return { code, path, message };
}

export function validateTemplateContract(
  template: TemplateDefinition,
): TemplateContractValidationIssue[] {
  const issues: TemplateContractValidationIssue[] = [];

  if (!template.identity.templateId.trim()) {
    issues.push(
      issue("INVALID_TEMPLATE_ID", "identity.templateId", "Template-ID fehlt."),
    );
  }
  if (
    !Number.isInteger(template.identity.version) ||
    template.identity.version <= 0
  ) {
    issues.push(
      issue(
        "INVALID_VERSION",
        "identity.version",
        "Die Vertragsversion muss eine positive Ganzzahl sein.",
      ),
    );
  }
  if (!lifecycleStatuses.has(template.lifecycle.status)) {
    issues.push(
      issue(
        "INVALID_LIFECYCLE",
        "lifecycle.status",
        "Der Lifecycle-Status ist unbekannt.",
      ),
    );
  }
  if (template.lifecycle.availability.create && !template.renderer.editor) {
    issues.push(
      issue(
        "MISSING_EDITOR_RENDERER",
        "renderer.editor",
        "Ein erstellbares Template benötigt einen Editor-Renderer.",
      ),
    );
  }
  if (
    template.lifecycle.availability.runtime &&
    (!template.renderer.presentation ||
      !template.renderer.moderationPreview)
  ) {
    issues.push(
      issue(
        "MISSING_RUNTIME_RENDERER",
        "renderer",
        "Ein Runtime-Template benötigt Präsentations- und Moderationsrenderer.",
      ),
    );
  }
  if (
    !template.interaction.allowedTypes.includes(
      template.interaction.defaultType,
    )
  ) {
    issues.push(
      issue(
        "DEFAULT_INTERACTION_NOT_ALLOWED",
        "interaction.defaultType",
        "Die Default-Interaktion ist nicht erlaubt.",
      ),
    );
  }
  const answerFormTypes = new Set<
    TemplateDefinition["interaction"]["allowedTypes"][number]
  >(
    template.interaction.answerForms.map((answerForm) => answerForm.type),
  );
  if (answerFormTypes.size !== template.interaction.answerForms.length) {
    issues.push(
      issue(
        "DUPLICATE_ANSWER_FORM",
        "interaction.answerForms",
        "Jede Antwortinteraktion darf nur eine Formulardefinition besitzen.",
      ),
    );
  }
  template.interaction.allowedTypes.forEach((interaction, index) => {
    if (!answerFormTypes.has(interaction)) {
      issues.push(
        issue(
          "MISSING_ANSWER_FORM",
          `interaction.allowedTypes.${index}`,
          `Für ${interaction} fehlt eine ausführbare Formulardefinition.`,
        ),
      );
    }
  });
  template.interaction.answerForms.forEach((answerForm, index) => {
    if (!template.interaction.allowedTypes.includes(answerForm.type)) {
      issues.push(
        issue(
          "ANSWER_FORM_NOT_ALLOWED",
          `interaction.answerForms.${index}`,
          `Die Formulardefinition ${answerForm.type} ist nicht als Interaktion erlaubt.`,
        ),
      );
    }
  });
  if (
    !template.evaluation.allowedTypes.includes(template.evaluation.defaultType)
  ) {
    issues.push(
      issue(
        "DEFAULT_EVALUATION_NOT_ALLOWED",
        "evaluation.defaultType",
        "Die Default-Bewertung ist nicht erlaubt.",
      ),
    );
  }
  if (
    !isInteractionEvaluationCompatible(
      template.interaction.defaultType,
      template.evaluation.defaultType,
    )
  ) {
    issues.push(
      issue(
        "INCOMPATIBLE_INTERACTION_EVALUATION",
        "evaluation.defaultType",
        "Default-Interaktion und Default-Bewertung sind nicht kompatibel.",
      ),
    );
  }
  template.interaction.allowedTypes.forEach((interaction, index) => {
    if (
      !template.evaluation.allowedTypes.some((evaluation) =>
        isInteractionEvaluationCompatible(interaction, evaluation),
      )
    ) {
      issues.push(
        issue(
          "INCOMPATIBLE_INTERACTION_EVALUATION",
          `interaction.allowedTypes.${index}`,
          `Für ${interaction} ist keine kompatible Bewertung erlaubt.`,
        ),
      );
    }
  });
  template.evaluation.allowedTypes.forEach((evaluation, index) => {
    if (
      !template.interaction.allowedTypes.some((interaction) =>
        isInteractionEvaluationCompatible(interaction, evaluation),
      )
    ) {
      issues.push(
        issue(
          "INCOMPATIBLE_INTERACTION_EVALUATION",
          `evaluation.allowedTypes.${index}`,
          `Die Bewertung ${evaluation} passt zu keiner erlaubten Interaktion.`,
        ),
      );
    }
  });
  const hasNonScoringDefault = [
    "NO_ANSWER",
    "POLL_SINGLE",
    "POLL_MULTI",
    "POLL_SCALE",
  ].includes(template.interaction.defaultType);
  if (hasNonScoringDefault !== (template.evaluation.defaultType === "NONE")) {
    issues.push(
      issue(
        "INVALID_NONE_EVALUATION",
        "evaluation.defaultType",
        "NONE-Interaktion und NONE-Bewertung müssen gemeinsam verwendet werden.",
      ),
    );
  }
  if (
    template.reveal.required &&
    (!template.reveal.supported ||
      template.reveal.defaultStrategy === "NONE")
  ) {
    issues.push(
      issue(
        "INVALID_REVEAL_CONTRACT",
        "reveal",
        "Ein verpflichtendes Reveal benötigt Unterstützung und eine Strategie.",
      ),
    );
  }

  const dataSourceIds = new Set<string>();
  template.dataSources.forEach((source, index) => {
    const path = `dataSources.${index}`;
    if (dataSourceIds.has(source.sourceId)) {
      issues.push(
        issue(
          "DUPLICATE_DATA_SOURCE_ID",
          `${path}.sourceId`,
          `Doppelte DataSource-ID: ${source.sourceId}`,
        ),
      );
    }
    dataSourceIds.add(source.sourceId);

    if (
      (source.type === "GENERATED" ||
        source.type === "USER_OR_GENERATED") &&
      !["CONTENT_ITEM", "QUIZ_SLIDE", "SNAPSHOT"].includes(source.persistence)
    ) {
      issues.push(
        issue(
          "INVALID_GENERATED_SOURCE_PERSISTENCE",
          `${path}.persistence`,
          "Generierte Daten müssen vor der Runtime geeignet persistiert sein.",
        ),
      );
    }
    if (
      source.type === "RUNTIME" &&
      source.persistence === "CONTENT_ITEM"
    ) {
      issues.push(
        issue(
          "INVALID_RUNTIME_SOURCE_PERSISTENCE",
          `${path}.persistence`,
          "Runtime-Daten dürfen nicht als ContentItem persistiert werden.",
        ),
      );
    }
    if (
      source.persistence === "SNAPSHOT" &&
      !["RUNTIME", "DERIVED", "EXTERNAL_TRANSIENT"].includes(source.type)
    ) {
      issues.push(
        issue(
          "INVALID_SNAPSHOT_SOURCE",
          `${path}.persistence`,
          "Snapshots sind nur für dynamisch aufgelöste Datenquellen zulässig.",
        ),
      );
    }
    if (!dataSourceFallbacks.has(source.fallback)) {
      issues.push(
        issue(
          "INVALID_DATA_SOURCE_FALLBACK",
          `${path}.fallback`,
          "Die DataSource-Fallbackstrategie ist unbekannt.",
        ),
      );
    }
  });

  const slotIds = new Set<string>();
  const mediaSlotReferences = new Set<string>();
  template.components.slots.forEach((slot, index) => {
    const path = `components.slots.${index}`;
    if (slotIds.has(slot.slotId)) {
      issues.push(
        issue(
          "DUPLICATE_SLOT_ID",
          `${path}.slotId`,
          `Doppelte Slot-ID: ${slot.slotId}`,
        ),
      );
    }
    slotIds.add(slot.slotId);
    if (
      !Number.isInteger(slot.minItems) ||
      !Number.isInteger(slot.maxItems) ||
      slot.minItems < 0 ||
      slot.maxItems < 1 ||
      slot.minItems > slot.maxItems
    ) {
      issues.push(
        issue(
          "INVALID_SLOT_CARDINALITY",
          path,
          "Die Slot-Cardinality ist ungültig.",
        ),
      );
    }
    if (slot.dataSourceId && !dataSourceIds.has(slot.dataSourceId)) {
      issues.push(
        issue(
          "MISSING_DATA_SOURCE",
          `${path}.dataSourceId`,
          `DataSource ${slot.dataSourceId} ist nicht definiert.`,
        ),
      );
    }
    slot.mediaSlotKeys?.forEach((mediaSlotKey, mediaSlotIndex) => {
      const mediaPath = `${path}.mediaSlotKeys.${mediaSlotIndex}`;
      if (!isMediaSlotKey(mediaSlotKey)) {
        issues.push(
          issue(
            "UNKNOWN_MEDIA_SLOT",
            mediaPath,
            `Der Medien-Slot ${mediaSlotKey} ist nicht zentral registriert.`,
          ),
        );
        return;
      }
      if (mediaSlotReferences.has(mediaSlotKey)) {
        issues.push(
          issue(
            "DUPLICATE_MEDIA_SLOT_REFERENCE",
            mediaPath,
            `Der Medien-Slot ${mediaSlotKey} wird mehrfach referenziert.`,
          ),
        );
      }
      mediaSlotReferences.add(mediaSlotKey);

      const mediaDefinition = getMediaSlotDefinition(mediaSlotKey);
      const compatibleComponentTypes =
        mediaDefinition.mediaType === "IMAGE"
          ? ["IMAGE", "IMAGE_COLLECTION"]
          : mediaDefinition.mediaType === "AUDIO"
            ? ["AUDIO"]
            : ["VIDEO"];
      if (!compatibleComponentTypes.includes(slot.componentType)) {
        issues.push(
          issue(
            "MEDIA_SLOT_COMPONENT_MISMATCH",
            mediaPath,
            `Der Medien-Slot ${mediaSlotKey} passt nicht zu ${slot.componentType}.`,
          ),
        );
      }
    });
    if (slot.componentType === "RANKING" && slot.minItems > 0) {
      const rankingSource = template.dataSources.find(
        (source) => source.sourceId === slot.dataSourceId,
      );
      if (
        rankingSource &&
        (rankingSource.type !== "RUNTIME" ||
          rankingSource.persistence !== "SNAPSHOT")
      ) {
        issues.push(
          issue(
            "INVALID_RUNTIME_COMPONENT_SOURCE",
            `${path}.dataSourceId`,
            "Eine verpflichtende Rangliste benötigt eine Runtime-DataSource mit Snapshot.",
          ),
        );
      }
    }
  });

  template.runtime.stateRequirements.forEach((requirement, index) => {
    if (
      requirement.dataSourceId &&
      !dataSourceIds.has(requirement.dataSourceId)
    ) {
      issues.push(
        issue(
          "MISSING_DATA_SOURCE",
          `runtime.stateRequirements.${index}.dataSourceId`,
          `DataSource ${requirement.dataSourceId} ist nicht definiert.`,
        ),
      );
    }
  });

  Object.entries(template.overrides.properties).forEach(([property, level]) => {
    if (!level || !overrideLevels.has(level)) {
      issues.push(
        issue(
          "INVALID_OVERRIDE_LEVEL",
          `overrides.properties.${property}`,
          "Die Override-Ebene ist unbekannt.",
        ),
      );
    }
  });

  if (template.migration.currentVersion !== template.identity.version) {
    issues.push(
      issue(
        "MIGRATION_VERSION_MISMATCH",
        "migration.currentVersion",
        "Migration und fachlicher Vertrag müssen dieselbe Zielversion haben.",
      ),
    );
  }
  const legacyMappingIds = new Set<string>();
  template.compatibility.legacyMappings.forEach((mapping, index) => {
    if (!mapping.templateId.trim()) {
      issues.push(
        issue(
          "INVALID_LEGACY_MAPPING",
          `compatibility.legacyMappings.${index}.templateId`,
          "Eine Legacy-Template-ID darf nicht leer sein.",
        ),
      );
      return;
    }
    const normalizedLegacyId = mapping.templateId.trim().toLowerCase();
    if (legacyMappingIds.has(normalizedLegacyId)) {
      issues.push(
        issue(
          "DUPLICATE_LEGACY_MAPPING",
          `compatibility.legacyMappings.${index}.templateId`,
          `Die Legacy-Template-ID ${mapping.templateId} ist doppelt eingetragen.`,
        ),
      );
    }
    legacyMappingIds.add(normalizedLegacyId);
  });

  return issues;
}

export function validateTemplateContractRegistry(
  templates: readonly TemplateDefinition[],
): TemplateContractValidationIssue[] {
  const issues = templates.flatMap(validateTemplateContract);
  const identities = new Set<string>();
  const resolutionIds = new Map<string, string>();

  templates.forEach((template, index) => {
    const identity = `${template.identity.templateId}@${template.identity.version}`;
    if (identities.has(identity)) {
      issues.push(
        issue(
          "DUPLICATE_TEMPLATE_VERSION",
          `${index}.identity`,
          `Doppelte Templateversion: ${identity}`,
        ),
      );
    }
    identities.add(identity);

    const contractKey = template.identity.templateId.toLowerCase();
    const candidateIds = [
      template.identity.templateId,
      ...template.compatibility.legacyMappings.map(
        (mapping) => mapping.templateId,
      ),
    ];
    candidateIds.forEach((candidateId) => {
      const normalizedId = candidateId.trim().toLowerCase();
      if (!normalizedId) return;
      const owner = resolutionIds.get(normalizedId);
      if (owner && owner !== contractKey) {
        issues.push(
          issue(
            "DUPLICATE_RESOLUTION_ID",
            `${index}.compatibility`,
            `Die auflösbare Template-ID ${candidateId} gehört zu mehreren Verträgen.`,
          ),
        );
      } else {
        resolutionIds.set(normalizedId, contractKey);
      }
    });
  });

  return issues;
}

export function validateQuestionTemplateContractCoverage(
  definitions: readonly QuestionTemplateDefinition[],
  templates: readonly TemplateDefinition[],
): TemplateContractValidationIssue[] {
  return definitions.flatMap((definition) => {
    const template = resolveTemplateContract(templates, definition.id);
    if (template) return [];
    return [
      issue(
        "TEMPLATE_CONTRACT_COVERAGE_MISSING",
        `questionTemplateDefinitions.${definition.id}`,
        `Für das produktive Fragen-Template ${definition.id} fehlt ein Vertrag.`,
      ),
    ];
  });
}
