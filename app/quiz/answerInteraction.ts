import type { QuestionTemplateData } from "@/app/fragen/editor/types";
import { questionTemplateContractRegistry } from "@/app/fragen/editor/templates/questionTemplates";
import { resolveTemplateContractCompatibility } from "@/app/rendering/templates/templateContractResolver";
import type {
  TemplateAnswerFormDefinition,
  TemplateInteractionType,
} from "@/app/rendering/templates/templateContract";

type AnswerOption = {
  id: number;
  label: string;
};

type StructuredTextField = {
  id: number;
  key: string;
  label: string;
  required: boolean;
  placeholder: string;
};

type OrderingItem = {
  id: string;
  text: string;
};

export type ResolvedQuizAnswerInteraction =
  | {
      type: "NO_ANSWER";
    }
  | {
      type: "TEXT";
      multiline: true;
      inputMode: "text";
      placeholder: string;
    }
  | {
      type: "STRUCTURED_TEXT";
      multiline: false;
      inputMode: "text";
      fields: StructuredTextField[];
    }
  | {
      type: "NUMBER";
      inputMode: "decimal";
      step: number | "any";
      unit: string;
    }
  | {
      type: "SINGLE_CHOICE";
      selectionMode: "SINGLE";
      options: AnswerOption[];
    }
  | {
      type: "MULTI_CHOICE";
      selectionMode: "MULTIPLE";
      options: AnswerOption[];
    }
  | {
      type: "ORDER";
      scoringPolicy: "POSITION";
      items: OrderingItem[];
    }
  | {
      type: Exclude<
        TemplateInteractionType,
        | "NO_ANSWER"
        | "TEXT"
        | "STRUCTURED_TEXT"
        | "NUMBER"
        | "SINGLE_CHOICE"
        | "MULTI_CHOICE"
        | "ORDER"
      >;
      supported: false;
    };

export type QuizAnswerInteractionInput = {
  templateId: string | null;
  originalAnswerMode: "OPEN" | "CLOSED" | "UNCLASSIFIED";
  effectiveAnswerMode: "OPEN" | "CLOSED" | "UNCLASSIFIED";
  templateData?: QuestionTemplateData;
  answerFields: readonly {
    id: number;
    label: string;
    required: boolean;
  }[];
  answerOptions: readonly AnswerOption[];
};

function getAnswerForm(
  forms: readonly TemplateAnswerFormDefinition[],
  type: TemplateInteractionType,
) {
  return forms.find((form) => form.type === type) ?? null;
}

function resolveInteractionType(
  input: QuizAnswerInteractionInput,
  mappedType: TemplateInteractionType,
  allowedTypes: readonly TemplateInteractionType[],
): TemplateInteractionType {
  const freeAnswerOverrideActive =
    input.originalAnswerMode === "CLOSED" &&
    input.effectiveAnswerMode === "OPEN";
  if (freeAnswerOverrideActive && allowedTypes.includes("TEXT")) {
    return "TEXT";
  }
  if (
    input.answerFields.length > 0 &&
    allowedTypes.includes("STRUCTURED_TEXT")
  ) {
    return "STRUCTURED_TEXT";
  }
  if (
    mappedType === "STRUCTURED_TEXT" &&
    input.answerFields.length === 0 &&
    allowedTypes.includes("TEXT")
  ) {
    return "TEXT";
  }
  if (
    mappedType === "TEXT" &&
    input.effectiveAnswerMode === "CLOSED" &&
    input.answerOptions.length > 1 &&
    allowedTypes.includes("SINGLE_CHOICE")
  ) {
    return "SINGLE_CHOICE";
  }
  return mappedType;
}

export function resolveQuizAnswerInteraction(
  input: QuizAnswerInteractionInput,
): ResolvedQuizAnswerInteraction {
  const compatibility = resolveTemplateContractCompatibility(
    questionTemplateContractRegistry,
    input.templateId,
  ) ?? resolveTemplateContractCompatibility(
    questionTemplateContractRegistry,
    null,
  );
  if (!compatibility) {
    return { type: "NO_ANSWER" };
  }

  const type = resolveInteractionType(
    input,
    compatibility.interactionType,
    compatibility.template.interaction.allowedTypes,
  );
  const answerForm = getAnswerForm(
    compatibility.template.interaction.answerForms,
    type,
  );
  if (!answerForm) {
    return { type, supported: false } as ResolvedQuizAnswerInteraction;
  }

  if (answerForm.type === "NO_ANSWER") {
    return { type: "NO_ANSWER" };
  }
  if (answerForm.type === "TEXT") {
    return {
      type: "TEXT",
      multiline: answerForm.multiline,
      inputMode: answerForm.inputMode,
      placeholder: "Antwort eintragen...",
    };
  }
  if (answerForm.type === "STRUCTURED_TEXT") {
    return {
      type: "STRUCTURED_TEXT",
      multiline: answerForm.multiline,
      inputMode: answerForm.inputMode,
      fields: input.answerFields.map((field) => ({
        ...field,
        key: String(field.id),
        placeholder: `${field.label} eintragen...`,
      })),
    };
  }
  if (answerForm.type === "NUMBER") {
    const estimateData =
      input.templateData?.kind === "ESTIMATE" ? input.templateData : null;
    return {
      type: "NUMBER",
      inputMode: answerForm.inputMode,
      step:
        estimateData &&
        ["INTEGER", "YEAR"].includes(estimateData.numberFormat)
          ? 1
          : "any",
      unit: estimateData?.unit ?? "",
    };
  }
  if (answerForm.type === "SINGLE_CHOICE") {
    return {
      type: "SINGLE_CHOICE",
      selectionMode: answerForm.selectionMode,
      options: [...input.answerOptions],
    };
  }
  if (answerForm.type === "MULTI_CHOICE") {
    return {
      type: "MULTI_CHOICE",
      selectionMode: answerForm.selectionMode,
      options: [...input.answerOptions],
    };
  }
  if (answerForm.type === "ORDER") {
    return {
      type: "ORDER",
      scoringPolicy: answerForm.scoringPolicy,
      items:
        input.templateData?.kind === "ORDERING"
          ? input.templateData.items.map((item) => ({
              id: item.id,
              text: item.text,
            }))
          : [],
    };
  }

  return { type: answerForm.type, supported: false };
}
