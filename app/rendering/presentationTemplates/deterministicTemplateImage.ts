import type { RepositoryAssetPath } from "@/app/rendering/templateRegistry";

const safeAssetPattern = /^\/(?!\/)[a-zA-Z0-9/_-]+\.(?:png|jpe?g|webp|svg)$/i;

export type TemplateImagePhase = "QUESTION" | "SOLUTION";

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function selectDeterministicTemplateImage(
  images: readonly string[],
  input: { quizId: string | number; questionId: string | number; phase: TemplateImagePhase; slideType?: string },
): RepositoryAssetPath | null {
  const safeImages = Array.from(new Set(images.filter((image): image is RepositoryAssetPath => safeAssetPattern.test(image)))).sort();
  if (safeImages.length === 0) return null;
  if (safeImages.length === 1) return safeImages[0];
  const base = stableHash(`${input.quizId}:${input.questionId}:${input.slideType ?? "QUESTION"}`);
  const offset = input.phase === "SOLUTION" ? 1 : 0;
  return safeImages[(base + offset) % safeImages.length];
}
