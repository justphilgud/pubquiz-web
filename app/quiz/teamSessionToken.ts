import { createHmac, timingSafeEqual } from "node:crypto";

export const TEAM_SESSION_TOKEN_VERSION = 1;
export const TEAM_SESSION_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;

export type TeamSessionTokenPayload = {
  version: typeof TEAM_SESSION_TOKEN_VERSION;
  quizId: number;
  sessionId: number;
  expiresAt: number;
};

function encode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function sign(encodedPayload: string, secret: string) {
  return createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}

export function issueTeamSessionToken(
  data: { quizId: number; sessionId: number },
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
) {
  if (!secret) {
    throw new Error("AUTH_SECRET fehlt.");
  }

  const payload: TeamSessionTokenPayload = {
    version: TEAM_SESSION_TOKEN_VERSION,
    quizId: data.quizId,
    sessionId: data.sessionId,
    expiresAt: nowSeconds + TEAM_SESSION_TOKEN_TTL_SECONDS,
  };
  const encodedPayload = encode(JSON.stringify(payload));
  return `${encodedPayload}.${sign(encodedPayload, secret)}`;
}

export function verifyTeamSessionToken(
  token: string,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): TeamSessionTokenPayload | null {
  if (!token || !secret) return null;

  const [encodedPayload, suppliedSignature, extra] = token.split(".");
  if (!encodedPayload || !suppliedSignature || extra !== undefined) return null;

  const expectedSignature = sign(encodedPayload, secret);
  const suppliedBuffer = Buffer.from(suppliedSignature, "utf8");
  const expectedBuffer = Buffer.from(expectedSignature, "utf8");
  if (
    suppliedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(suppliedBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as Partial<TeamSessionTokenPayload>;

    if (
      payload.version !== TEAM_SESSION_TOKEN_VERSION ||
      !Number.isInteger(payload.quizId) ||
      !Number.isInteger(payload.sessionId) ||
      !Number.isInteger(payload.expiresAt) ||
      Number(payload.quizId) <= 0 ||
      Number(payload.sessionId) <= 0 ||
      Number(payload.expiresAt) <= nowSeconds
    ) {
      return null;
    }

    return payload as TeamSessionTokenPayload;
  } catch {
    return null;
  }
}
