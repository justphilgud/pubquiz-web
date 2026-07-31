import type { TemplateAssetReference } from "@/app/rendering/templateRegistry";
import { isSafeTemplateAssetReference } from "./presentationTemplateAssets";

export type TemplateImagePhase = "QUESTION" | "SOLUTION";

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export type DeterministicTemplateContext = {
  quizId: string | number;
  questionId: string | number;
  phase: TemplateImagePhase;
  assetRole?: string;
  slideType?: string;
  personIds?: readonly string[];
};

function deterministicKey(input: DeterministicTemplateContext) {
  return [
    input.quizId,
    input.questionId,
    input.phase,
    input.assetRole ?? "IMAGE_POOL",
    input.slideType ?? "QUESTION",
    [...(input.personIds ?? [])].sort().join(","),
  ].join(":");
}

export function selectDeterministicTemplateValue<T>(
  values: readonly T[],
  input: DeterministicTemplateContext,
  stableKey: (value: T) => string,
): T | null {
  const unique = new Map(values.map((value) => [stableKey(value), value]));
  const ordered = [...unique.entries()].sort(([left], [right]) => left.localeCompare(right));
  if (ordered.length === 0) return null;
  if (ordered.length === 1) return ordered[0][1];
  return ordered[stableHash(deterministicKey(input)) % ordered.length][1];
}

export function selectDeterministicTemplateImage(
  images: readonly string[],
  input: DeterministicTemplateContext,
): TemplateAssetReference | null {
  const safeImages = Array.from(new Set(images.filter(isSafeTemplateAssetReference))).sort();
  if (safeImages.length === 0) return null;
  if (safeImages.length === 1) return safeImages[0];
  return safeImages[stableHash(deterministicKey(input)) % safeImages.length];
}
