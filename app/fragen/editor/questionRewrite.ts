export const QUESTION_REWRITE_MAX_LENGTH = 300;

export type QuestionRewriteTokenUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

export type QuestionRewriteCost = {
  amountUsd: number;
  kind: "CONFIGURED_ESTIMATE";
};

export type QuestionRewriteResult = {
  proposal: string;
  usage: QuestionRewriteTokenUsage | null;
  cost: QuestionRewriteCost | null;
};

export type QuestionRewriteHistoryEntry = QuestionRewriteResult & {
  id: string;
  original: string;
};

export type QuestionRewriteSessionState = {
  active: QuestionRewriteHistoryEntry | null;
  history: QuestionRewriteHistoryEntry[];
  cumulativeUsage: QuestionRewriteTokenUsage;
};

export type QuestionRewriteErrorCode =
  | "FEATURE_DISABLED"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "INVALID_INPUT"
  | "TOO_MANY_REQUESTS"
  | "NOT_CONFIGURED"
  | "PROVIDER_TIMEOUT"
  | "PROVIDER_RATE_LIMIT"
  | "PROVIDER_RESPONSE_INVALID"
  | "PROVIDER_UNAVAILABLE";

const questionRewriteErrorCodes = new Set<QuestionRewriteErrorCode>([
  "FEATURE_DISABLED",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "INVALID_INPUT",
  "TOO_MANY_REQUESTS",
  "NOT_CONFIGURED",
  "PROVIDER_TIMEOUT",
  "PROVIDER_RATE_LIMIT",
  "PROVIDER_RESPONSE_INVALID",
  "PROVIDER_UNAVAILABLE",
]);

export type QuestionRewriteApiResponse =
  | ({ ok: true } & QuestionRewriteResult)
  | { ok: false; code: QuestionRewriteErrorCode };

export function isQuestionRewriteErrorCode(
  value: unknown,
): value is QuestionRewriteErrorCode {
  return typeof value === "string" &&
    questionRewriteErrorCodes.has(value as QuestionRewriteErrorCode);
}

function isTokenUsage(value: unknown): value is QuestionRewriteTokenUsage {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const usage = value as Record<string, unknown>;
  return [usage.promptTokens, usage.completionTokens, usage.totalTokens].every(
    (tokenCount) =>
      typeof tokenCount === "number" &&
      Number.isSafeInteger(tokenCount) &&
      tokenCount >= 0,
  );
}

export function isQuestionRewriteSuccessResponse(
  value: unknown,
): value is Extract<QuestionRewriteApiResponse, { ok: true }> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const response = value as Record<string, unknown>;
  const cost = response.cost;
  const validCost = cost === null || (
    Boolean(cost) && typeof cost === "object" && !Array.isArray(cost) &&
    (cost as Record<string, unknown>).kind === "CONFIGURED_ESTIMATE" &&
    typeof (cost as Record<string, unknown>).amountUsd === "number" &&
    Number.isFinite((cost as Record<string, unknown>).amountUsd) &&
    Number((cost as Record<string, unknown>).amountUsd) >= 0
  );
  return response.ok === true &&
    typeof response.proposal === "string" &&
    response.proposal.trim().length > 0 &&
    response.proposal.trim().length <= QUESTION_REWRITE_MAX_LENGTH &&
    (response.usage === null || isTokenUsage(response.usage)) &&
    validCost;
}

export function parseQuestionRewriteInput(value: unknown):
  | { ok: true; questionText: string }
  | { ok: false } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false };
  }
  const questionText = (value as Record<string, unknown>).questionText;
  if (typeof questionText !== "string") return { ok: false };
  const trimmed = questionText.trim();
  if (!trimmed || trimmed.length > QUESTION_REWRITE_MAX_LENGTH) {
    return { ok: false };
  }
  return { ok: true, questionText: trimmed };
}

export function addQuestionRewriteUsage(
  current: QuestionRewriteTokenUsage,
  next: QuestionRewriteTokenUsage | null,
): QuestionRewriteTokenUsage {
  if (!next) return current;
  return {
    promptTokens: current.promptTokens + next.promptTokens,
    completionTokens: current.completionTokens + next.completionTokens,
    totalTokens: current.totalTokens + next.totalTokens,
  };
}

export function createQuestionRewriteSessionState(): QuestionRewriteSessionState {
  return {
    active: null,
    history: [],
    cumulativeUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
  };
}

export function recordQuestionRewriteResult(
  current: QuestionRewriteSessionState,
  entry: QuestionRewriteHistoryEntry,
): QuestionRewriteSessionState {
  return {
    active: entry,
    history: [entry, ...current.history].slice(0, 10),
    cumulativeUsage: addQuestionRewriteUsage(current.cumulativeUsage, entry.usage),
  };
}

export function editQuestionRewriteProposal(
  current: QuestionRewriteSessionState,
  proposal: string,
): QuestionRewriteSessionState {
  return current.active
    ? { ...current, active: { ...current.active, proposal } }
    : current;
}

export function discardQuestionRewriteProposal(
  current: QuestionRewriteSessionState,
): QuestionRewriteSessionState {
  return { ...current, active: null };
}
