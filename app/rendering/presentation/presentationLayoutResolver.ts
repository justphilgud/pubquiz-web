import type { QuestionTemplateData } from "@/app/fragen/editor/types";
import {
  questionTemplateIds,
  resolveCanonicalQuestionTemplateId,
} from "@/app/fragen/editor/templates/questionTemplateRegistry";
import { getQuestionTemplateContract } from "@/app/fragen/editor/templates/questionTemplates";
import type {
  TemplateDefinition,
  TemplateLayoutVariant,
} from "@/app/rendering/templates/templateContract";

export type PresentationLayoutPhase = "QUESTION" | "SOLUTION";

export type PresentationLayoutMedium = {
  fileName: string;
  mediaType: string;
  scope: "QUESTION" | "ANSWER" | "STRUCTURED_FIELD";
};

export type PresentationLayoutReason =
  | "LEGACY_COMPATIBLE"
  | "SOLUTION_PHASE"
  | "PIXEL_REVEAL"
  | "GOOGLE_REVIEW_REVEAL"
  | "TRUE_FALSE_TEMPLATE"
  | "ORDERING_TEMPLATE"
  | "MULTIPLE_CHOICE_TEMPLATE"
  | "AUDIO_TEMPLATE"
  | "FACE_MORPH_TEMPLATE"
  | "STRUCTURED_RESPONSE"
  | "AUDIO_MEDIUM"
  | "VISUAL_MEDIUM"
  | "CHOICE_OPTIONS"
  | "TEXT_ONLY"
  | "CONTRACT_FALLBACK";

export type ResolvedPresentationLayout = {
  variant: TemplateLayoutVariant;
  source: "AUTO" | "LEGACY_OVERRIDE";
  reason: PresentationLayoutReason;
};

export type ResolvePresentationLayoutInput = {
  templateId: string | null;
  phase: PresentationLayoutPhase;
  legacyLayout?: string | null;
  questionText: string;
  answerOptionCount: number;
  structuredFieldCount: number;
  media: readonly PresentationLayoutMedium[];
  templateData?: QuestionTemplateData;
  templateContract?: TemplateDefinition | null;
};

const legacyLayoutVariants: Readonly<Record<string, TemplateLayoutVariant>> = {
  bild_fokus: "MEDIA_FOCUS",
  antworten_fokus: "CHOICE_GRID",
  audio_fokus: "AUDIO_FOCUS",
  text_fokus: "CONTENT_CENTERED",
  hinweis_fokus: "CONTENT_SPLIT",
};

function isAllowed(
  contract: TemplateDefinition | null,
  variant: TemplateLayoutVariant,
) {
  return !contract || contract.layout.allowedVariants.includes(variant);
}

function resolveAllowedVariant(
  contract: TemplateDefinition | null,
  preferred: TemplateLayoutVariant,
): {
  variant: TemplateLayoutVariant;
  usedFallback: boolean;
} {
  if (isAllowed(contract, preferred)) {
    return { variant: preferred, usedFallback: false };
  }
  return {
    variant: contract?.layout.defaultVariant ?? "CONTENT_CENTERED",
    usedFallback: true,
  };
}

function mediumKind(medium: PresentationLayoutMedium) {
  const value = `${medium.mediaType} ${medium.fileName}`.toLowerCase();
  if (
    value.includes("audio") ||
    /\.(mp3|wav|ogg|m4a)(?:$|[?#])/i.test(medium.fileName)
  ) {
    return "AUDIO";
  }
  if (
    value.includes("bild") ||
    value.includes("image") ||
    value.includes("video") ||
    /\.(jpg|jpeg|png|gif|webp|svg|mp4|webm|mov)(?:$|[?#])/i.test(
      medium.fileName,
    )
  ) {
    return "VISUAL";
  }
  return "OTHER";
}

export function resolvePresentationLayout(
  input: ResolvePresentationLayoutInput,
): ResolvedPresentationLayout {
  const contract =
    input.templateContract === undefined
      ? getQuestionTemplateContract(input.templateId)
      : input.templateContract;
  const canonicalTemplateId =
    resolveCanonicalQuestionTemplateId(input.templateId) ??
    questionTemplateIds.standard;

  if (input.phase === "SOLUTION") {
    const resolved = resolveAllowedVariant(contract, "SOLUTION_FOCUS");
    return {
      variant: resolved.variant,
      source: "AUTO",
      reason: resolved.usedFallback ? "CONTRACT_FALLBACK" : "SOLUTION_PHASE",
    };
  }

  const legacyVariant =
    input.legacyLayout &&
    input.legacyLayout !== "standard" &&
    legacyLayoutVariants[input.legacyLayout];
  if (legacyVariant && isAllowed(contract, legacyVariant)) {
    return {
      variant: legacyVariant,
      source: "LEGACY_OVERRIDE",
      reason: "LEGACY_COMPATIBLE",
    };
  }

  let preferred: TemplateLayoutVariant;
  let reason: PresentationLayoutReason;
  if (canonicalTemplateId === questionTemplateIds.pixelImage) {
    preferred = "REVEAL_SEQUENCE";
    reason = "PIXEL_REVEAL";
  } else if (
    canonicalTemplateId === questionTemplateIds.googleReviews &&
    input.templateData?.kind === "GOOGLE_REVIEWS" &&
    input.templateData.sequentialReveal
  ) {
    preferred = "REVEAL_SEQUENCE";
    reason = "GOOGLE_REVIEW_REVEAL";
  } else if (canonicalTemplateId === questionTemplateIds.trueFalse) {
    preferred = "TRUE_FALSE";
    reason = "TRUE_FALSE_TEMPLATE";
  } else if (canonicalTemplateId === questionTemplateIds.ordering) {
    preferred = "ORDERING";
    reason = "ORDERING_TEMPLATE";
  } else if (canonicalTemplateId === questionTemplateIds.multipleChoice) {
    preferred = "CHOICE_GRID";
    reason = "MULTIPLE_CHOICE_TEMPLATE";
  } else if (
    canonicalTemplateId === questionTemplateIds.musicReverse ||
    canonicalTemplateId === questionTemplateIds.musicEightBit ||
    canonicalTemplateId === questionTemplateIds.translationReadAloud
  ) {
    preferred = "AUDIO_FOCUS";
    reason = "AUDIO_TEMPLATE";
  } else if (canonicalTemplateId === questionTemplateIds.faceMorph) {
    preferred = "MEDIA_FOCUS";
    reason = "FACE_MORPH_TEMPLATE";
  } else if (input.structuredFieldCount > 0) {
    preferred = "STRUCTURED_RESPONSE";
    reason = "STRUCTURED_RESPONSE";
  } else if (input.media.some((medium) => mediumKind(medium) === "AUDIO")) {
    preferred = "AUDIO_FOCUS";
    reason = "AUDIO_MEDIUM";
  } else if (input.media.some((medium) => mediumKind(medium) === "VISUAL")) {
    preferred = "MEDIA_FOCUS";
    reason = "VISUAL_MEDIUM";
  } else if (input.answerOptionCount > 1) {
    preferred = "CHOICE_GRID";
    reason = "CHOICE_OPTIONS";
  } else {
    preferred = "CONTENT_CENTERED";
    reason = "TEXT_ONLY";
  }

  const resolved = resolveAllowedVariant(contract, preferred);
  return {
    variant: resolved.variant,
    source: "AUTO",
    reason: resolved.usedFallback ? "CONTRACT_FALLBACK" : reason,
  };
}
