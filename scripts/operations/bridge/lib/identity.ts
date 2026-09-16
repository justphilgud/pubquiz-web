import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey, type JWTPayload } from "jose";
import { AUDIENCE, check, ISSUER, REPOSITORY, REPOSITORY_ID, OWNER_ID, WORKFLOW } from "./contract.js";

const githubKeys = createRemoteJWKSet(new URL(`${ISSUER}/.well-known/jwks`), { timeoutDuration: 5000 });
export type Identity = { environment: "operations-backup" | "operations-restore"; run: string; attempt: string; expiresAt: number };
export type IdentityPins = { repositoryId: string; ownerId: string };
export function claimsIdentity(p: JWTPayload, pins: IdentityPins, now: number): Identity {
  check(pins.repositoryId === REPOSITORY_ID && pins.ownerId === OWNER_ID, "CONFIG_REJECTED");
  check(p.repository === REPOSITORY && p.repository_owner === "justphilgud" &&
    p.repository_id === pins.repositoryId && p.repository_owner_id === pins.ownerId &&
    p.ref === "refs/heads/main" && p.workflow_ref === WORKFLOW && p.event_name === "workflow_dispatch" &&
    (p.environment === "operations-backup" || p.environment === "operations-restore"), "IDENTITY_REJECTED");
  check(p.sub === `repo:${REPOSITORY}:environment:${p.environment}` && typeof p.sha === "string" && /^[a-f0-9]{40}$/.test(p.sha) &&
    typeof p.run_id === "string" && /^[1-9][0-9]{0,19}$/.test(p.run_id) &&
    typeof p.run_attempt === "string" && /^[1-9][0-9]{0,5}$/.test(p.run_attempt) &&
    typeof p.exp === "number" && p.exp * 1000 > now &&
    typeof p.iat === "number" && p.iat * 1000 <= now + 5000 && now - p.iat * 1000 < 5 * 60 * 1000 &&
    typeof p.nbf === "number" && p.nbf * 1000 <= now, "IDENTITY_REJECTED");
  return { environment: p.environment, run: p.run_id, attempt: p.run_attempt, expiresAt: p.exp * 1000 };
}
export async function verifyGithub(token: string, pins: IdentityPins, now = Date.now(), keys: JWTVerifyGetKey = githubKeys): Promise<Identity> {
  check(token.length > 0 && token.length <= 16000, "IDENTITY_REJECTED");
  try {
    const { payload } = await jwtVerify(token, keys, { issuer: ISSUER, audience: AUDIENCE, algorithms: ["RS256"],
      requiredClaims: ["exp", "iat", "nbf", "sub"], maxTokenAge: "5m", currentDate: new Date(now), clockTolerance: 0 });
    return claimsIdentity(payload, pins, now);
  } catch { check(false, "IDENTITY_REJECTED"); }
}
