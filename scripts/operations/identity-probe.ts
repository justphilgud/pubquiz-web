// Synthetic-only live boundary tests. No provider URLs/JWTs enter diagnostics.
import { bridgeOrigin, limitedResponse } from "./bridge-client";
import { OperationsError, requireCondition } from "./guards";
import { AUDIENCE } from "./bridge/lib/contract";
import { GithubOidcTokenProvider } from "./oidc-token";

type Env = Readonly<Record<string, string | undefined>>;
export const identityMutations: ReadonlyArray<readonly [string, Readonly<Record<string, unknown>>]> = [
  ["repository", { repository: "justphilgud/ap94-untrusted" }],
  ["owner", { repository_owner: "ap94-untrusted" }],
  ["repository-id", { repository_id: "1" }],
  ["owner-id", { repository_owner_id: "1" }],
  ["branch", { ref: "refs/heads/ap94-untrusted" }],
  ["workflow", { workflow_ref: "justphilgud/pubquiz-web/.github/workflows/untrusted.yml@refs/heads/main" }],
  ["audience", { aud: `${AUDIENCE}:untrusted` }],
  ["environment", { environment: "ap94-untrusted" }],
  ["subject", { sub: "repo:justphilgud/pubquiz-web:environment:ap94-untrusted" }],
  ["issuer", { iss: "https://untrusted.invalid" }],
  ["event", { event_name: "pull_request" }],
];

export function mutateIdentity(token: string, delta: Readonly<Record<string, unknown>>): string {
  try {
    const parts = token.split(".");
    const original = JSON.parse(Buffer.from(parts[1], "base64url").toString()) as Record<string, unknown>;
    requireCondition(parts.length === 3 && original && typeof original === "object" && !Array.isArray(original), "IDENTITY_PROBE_TOKEN_INVALID");
    const modified = { ...original, ...delta };
    requireCondition(Object.keys(delta).some(k => original[k] !== modified[k]), "IDENTITY_PROBE_MUTATION_UNCHANGED");
    parts[1] = Buffer.from(JSON.stringify(modified)).toString("base64url");
    return parts.join("."); // Deliberately invalid signature; NOT a signed foreign identity.
  } catch { throw new OperationsError("IDENTITY_PROBE_TOKEN_INVALID"); }
}

export async function expectIdentityDenial(response: Response, number: number, layer: "edge" | "bridge") {
  requireCondition(Number.isInteger(number) && number >= 1 && number <= 99, "IDENTITY_PROBE_CASE_INVALID");
  let exactIdentityError = false;
  try {
    const raw = (await limitedResponse(response, 1024)).toString();
    exactIdentityError = raw === '{"error":"IDENTITY_REJECTED"}';
  } catch { /* HTML, oversized bodies and errors are never logged. */ }
  // A valid edge token isolates the mandatory Bridge re-verification. Edge tests
  // must not accidentally count the Bridge's rejection as Trusted Source proof.
  const passed = layer === "bridge" ? response.status === 403 && exactIdentityError
    : (response.status === 401 || response.status === 403) && !exactIdentityError;
  requireCondition(passed, `IDENTITY_PROBE_${number}_${layer.toUpperCase()}_HTTP_${response.status}_FAILED`);
}

export async function runIdentityProbe(env: Env, body: object, request: typeof fetch = fetch,
  oidc = new GithubOidcTokenProvider(env, request)) {
  requireCondition(env.AP94_TRANSPORT_MODE === "synthetic", "SYNTHETIC_CONTEXT_REQUIRED");
  const origin = bridgeOrigin(env.AP94_BRIDGE_ORIGIN);
  const valid = await oidc.token(AUDIENCE);
  const wrongAudience = await oidc.token(`${AUDIENCE}:untrusted`);
  requireCondition(wrongAudience !== valid, "IDENTITY_PROBE_AUDIENCE_UNCHANGED");
  const send = async (edge: string | undefined, bearer: string | undefined) => {
    try {
      oidc.recordBridgeCall();
      return await request(`${origin}/api/access`, { method: "POST", redirect: "manual",
        headers: { "content-type": "application/json", ...(edge ? { "x-vercel-trusted-oidc-idp-token": edge } : {}),
          ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) },
        body: JSON.stringify(body), signal: AbortSignal.timeout(30000) });
    } catch { throw new OperationsError("IDENTITY_PROBE_NETWORK_FAILED"); }
  };
  await expectIdentityDenial(await send(undefined, undefined), 1, "edge");
  await expectIdentityDenial(await send(wrongAudience, valid), 2, "edge");
  await expectIdentityDenial(await send(valid, wrongAudience), 3, "bridge");
  await expectIdentityDenial(await send(valid, undefined), 4, "bridge");
  for (const [index, [, delta]] of identityMutations.entries()) {
    await expectIdentityDenial(await send(valid, mutateIdentity(valid, delta)), 5 + index, "bridge");
  }
  return { signedWrongAudience: "rejected", missingCredentials: "rejected", tamperedClaimCases: identityMutations.length,
    semanticForeignClaims: "local-signed-regression-only" };
}
