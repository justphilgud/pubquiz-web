import type { AuthorizationActor } from "@/app/roles/roleAssignmentPolicy";
import { canUseQuestionRewrite } from "./questionRewriteFeature.server";
import type { QuestionRewriteProvider } from "./questionRewriteProvider.server";
import { QuestionRewriteProviderError } from "./questionRewriteProvider.server";
import type { QuestionRewriteRateLimit } from "./questionRewriteRateLimit.server";
import { readQuestionRewriteJson } from "./questionRewriteJson.server";
import {
  parseQuestionRewriteInput,
  type QuestionRewriteErrorCode,
} from "./questionRewrite";

const responseHeaders = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};

type QuestionRewriteEndpointDependencies = {
  enabled: () => boolean;
  actor: () => Promise<AuthorizationActor | null>;
  provider: () => QuestionRewriteProvider;
  rateLimit: QuestionRewriteRateLimit;
};

function errorResponse(code: QuestionRewriteErrorCode, status: number) {
  return Response.json({ ok: false, code }, { status, headers: responseHeaders });
}

function providerErrorResponse(error: unknown) {
  if (!(error instanceof QuestionRewriteProviderError)) {
    return errorResponse("PROVIDER_UNAVAILABLE", 503);
  }
  switch (error.code) {
    case "NOT_CONFIGURED":
      return errorResponse("NOT_CONFIGURED", 503);
    case "TIMEOUT":
      return errorResponse("PROVIDER_TIMEOUT", 504);
    case "RATE_LIMIT":
      return errorResponse("PROVIDER_RATE_LIMIT", 429);
    case "INVALID_RESPONSE":
      return errorResponse("PROVIDER_RESPONSE_INVALID", 502);
    case "REFUSED":
      return errorResponse("PROVIDER_REFUSED", 422);
    case "UNAVAILABLE":
      return errorResponse("PROVIDER_UNAVAILABLE", 503);
  }
}

export async function questionRewriteResponse(
  request: Request,
  dependencies: QuestionRewriteEndpointDependencies,
): Promise<Response> {
  if (!dependencies.enabled()) return errorResponse("FEATURE_DISABLED", 404);
  const actor = await dependencies.actor();
  if (!actor) return errorResponse("UNAUTHORIZED", 401);
  if (!canUseQuestionRewrite(actor)) return errorResponse("FORBIDDEN", 403);
  const origin = request.headers.get("origin");
  if ((origin && origin !== new URL(request.url).origin) || request.headers.get("sec-fetch-site") === "cross-site") {
    return errorResponse("FORBIDDEN", 403);
  }
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") return errorResponse("INVALID_INPUT", 400);

  let payload: unknown;
  try {
    payload = await readQuestionRewriteJson(request.body, 2_048);
  } catch {
    return errorResponse("INVALID_INPUT", 400);
  }
  const input = parseQuestionRewriteInput(payload);
  if (!input.ok) return errorResponse("INVALID_INPUT", 400);
  if (!dependencies.rateLimit.acquire(actor.userId)) {
    return errorResponse("TOO_MANY_REQUESTS", 429);
  }

  try {
    const result = await dependencies.provider().rewrite(input.questionText);
    return Response.json(
      { ok: true, ...result },
      { status: 200, headers: responseHeaders },
    );
  } catch (error) {
    return providerErrorResponse(error);
  }
}
