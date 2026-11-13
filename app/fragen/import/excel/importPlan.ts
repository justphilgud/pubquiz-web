import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { DEFAULT_PIXEL_TEMPLATE_CONFIG } from "../../editor/pixelTemplateConfig";
import { outdatedFromToValidUntil } from "../../editor/questionLifecycle";
import { validateQuestion } from "../../editor/questionValidation";
import { questionTemplateIds } from "../../editor/templates/questionTemplateRegistry";
import type { ImportQuestion, ImportTarget } from "./format";
import { contentFingerprint } from "./parseImport";

export type ResolvedQuestion = ImportQuestion & { categoryIds: number[]; resolvedCategories: string[] };
export type Plan = { actorId: number; requestId: string; digest: string; expires: number };

const planVersion = 1;
const validityMs = 30 * 60_000;

function digest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function planDigest(target: ImportTarget, questions: ResolvedQuestion[]) {
  return digest([planVersion, target, questions]);
}

export function batchContentDigest(target: ImportTarget, questions: ResolvedQuestion[]) {
  return digest([planVersion, target, questions.map(contentFingerprint).sort()]);
}

function signature(value: string, secret: string) {
  return createHmac("sha256", secret).update("pubquiz-excel-import:").update(value).digest();
}

export function signPlan(actorId: number, digestValue: string, secret: string) {
  const plan: Plan = { actorId, requestId: randomUUID(), digest: digestValue, expires: Date.now() + validityMs };
  const payload = Buffer.from(JSON.stringify(plan)).toString("base64url");
  return `${payload}.${signature(payload, secret).toString("base64url")}`;
}

export function verifyPlan(token: string, actorId: number, secret: string): Plan | null {
  if (!/^[\w-]{1,512}\.[\w-]{43}$/.test(token)) return null;
  const [payload, encodedSignature] = token.split(".");
  const candidate = Buffer.from(encodedSignature, "base64url");
  if (candidate.length !== 32 || !timingSafeEqual(candidate, signature(payload, secret))) return null;
  try {
    const plan = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Plan;
    return plan.actorId === actorId && /^[a-f\d-]{36}$/.test(plan.requestId) &&
      /^[a-f\d]{64}$/.test(plan.digest) && Number.isSafeInteger(plan.expires) ? plan : null;
  } catch {
    return null;
  }
}

export function toDraft(question: ResolvedQuestion, target: ImportTarget) {
  const pairs = question.type === "Paare bilden";
  return validateQuestion({
    intent: "DRAFT", ...target,
    sourceTemplateId: null,
    templateId: pairs ? questionTemplateIds.pairs : null,
    questionText: question.text,
    questionMedia: [],
    answers: question.answers.map(({ row, text, correct, info }) => ({
      clientId: String(row), text, isCorrect: correct, additionalInfo: info, media: null,
    })),
    templateConfig: {
      ...DEFAULT_PIXEL_TEMPLATE_CONFIG,
      ...(pairs ? { templateData: { kind: "PAIRS" as const, pairs: question.pairs.map(({ left, right }) => ({
        left, right, leftId: randomUUID(), rightId: randomUUID(),
      })) } } : {}),
    },
    categoryIds: question.categoryIds,
    sourceOrRemark: question.source,
    moderationNotes: question.notes,
    categoryRequest: question.categoryRequest,
    validUntil: outdatedFromToValidUntil(question.outdatedFrom || null),
    reviewFrom: question.reviewFrom || null,
  }, true);
}
