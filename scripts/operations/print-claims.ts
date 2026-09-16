import { decodeJwt } from "jose";
import { requestGithubToken } from "./bridge-client";
import { verifyGithub } from "./bridge/lib/identity";
async function main() {
  const token = await requestGithubToken(process.env);
  await verifyGithub(token, { repositoryId: process.env.GITHUB_REPOSITORY_ID ?? "", ownerId: process.env.GITHUB_REPOSITORY_OWNER_ID ?? "" });
  const p = decodeJwt(token);
  // Explicit allowlist. No raw JWT, signature, jti, actor, email or arbitrary claims.
  return Object.fromEntries(["iss", "aud", "sub", "repository", "repository_id", "repository_owner", "repository_owner_id", "ref", "environment",
    "workflow_ref", "sha", "event_name", "run_id", "run_attempt"].map(k => [k, p[k]]));
}
main().then(p => console.log(JSON.stringify(p))).catch(() => { console.error("OIDC_CLAIMS_REJECTED_DETAILS_WITHHELD"); process.exitCode = 1; });
