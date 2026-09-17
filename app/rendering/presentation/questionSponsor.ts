import { isSafeTemplateAssetReference } from "../presentationTemplates/presentationTemplateAssets";
import type { TemplateAssetReference } from "../templateRegistry";

/** Optional presentation metadata; never an answer or evaluation contract. */
export type QuestionSponsor = {
  logo: TemplateAssetReference;
  line: string;
};

export function parseQuestionSponsor(value: unknown): QuestionSponsor | null | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (!isSafeTemplateAssetReference(input.logo)) return null;
  if (input.line !== undefined && typeof input.line !== "string") return null;
  const line = typeof input.line === "string" ? input.line.trim() : "Präsentiert von";
  if (line.length > 80 || /[\r\n\u0000-\u001f]/u.test(line)) return null;
  return { logo: input.logo, line };
}
