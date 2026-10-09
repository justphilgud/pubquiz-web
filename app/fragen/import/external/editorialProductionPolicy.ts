import { readFileSync } from "node:fs";
import approvedIds from "../../../../editorial/paule-oktober-2026/production-allowlist.json";
import { candidateDigest, parseEditorialPool, sha256, type EditorialSource } from "./editorialImport";
import { isVerifiedExternalImportReviewerApproval, type VerifiedExternalImportReviewerApproval } from "./reviewerApproval";

export const EDITORIAL_PRODUCTION_WORKFLOW = "justphilgud/pubquiz-web/.github/workflows/external-question-import-preflight.yml@refs/heads/main";
const hashes = {
  "anagrams.json": "dc0a2511690b0e4df4cd924dc6000b4d792f03ad95f87990dee24bd5f09cd4f0",
  "estimates.json": "3fc63c06afe83c47c8192f374eeb9206628bbd03dc322e01abf6b6b99008c89f",
};
export function approvedProductionEditorialSource(): EditorialSource {
  if (approvedIds.length !== 79 || new Set(approvedIds).size !== 79) throw new Error("EDITORIAL_ALLOWLIST_INVALID");
  const candidates = Object.entries(hashes).flatMap(([name, hash]) => {
    const raw = readFileSync(`editorial/paule-oktober-2026/${name}`, "utf8");
    if (sha256(raw) !== hash) throw new Error("EDITORIAL_APPROVED_CHECKSUM_MISMATCH");
    return parseEditorialPool(name, raw);
  }).filter(row => approvedIds.includes(row.externalId));
  if (candidates.length !== 79 || new Set(candidates.map(row => row.externalId)).size !== 79 ||
      candidates.filter(row => row.templateId === "anagramm").length !== 45 ||
      candidates.filter(row => row.templateId === "schaetzfrage").length !== 34) throw new Error("EDITORIAL_ALLOWLIST_INVALID");
  return { provider: "Editorial:PR93", files: Object.entries(hashes).map(([name, sha256]) => ({ name, sha256 })), candidates };
}
export function assertProductionEditorialSource(source: EditorialSource) {
  const expected = approvedProductionEditorialSource();
  if (JSON.stringify(source.files) !== JSON.stringify(expected.files) || source.provider !== expected.provider ||
      JSON.stringify(source.candidates.map(candidateDigest)) !== JSON.stringify(expected.candidates.map(candidateDigest))) {
    throw new Error("EDITORIAL_PRODUCTION_SOURCE_MISMATCH");
  }
}
export function assertProductionEditorialContext(env: Readonly<Record<string, string | undefined>>) {
  if (env.GITHUB_ACTIONS !== "true" || env.GITHUB_REPOSITORY !== "justphilgud/pubquiz-web" ||
      env.GITHUB_REF !== "refs/heads/main" || env.GITHUB_EVENT_NAME !== "workflow_dispatch" ||
      ![EDITORIAL_PRODUCTION_WORKFLOW, EDITORIAL_WRITER_WORKFLOW].includes(env.GITHUB_WORKFLOW_REF ?? "") || env.EDITORIAL_GITHUB_ENVIRONMENT !== "operations-backup" ||
      !/^[a-f0-9]{40}$/.test(env.EDITORIAL_PRODUCTION_SHA ?? "") ||
      env.EDITORIAL_PRODUCTION_SHA !== env.PRODUCTION_RELEASE_SHA) throw new Error("EDITORIAL_PRODUCTION_CONTEXT_INVALID");
}

export const EDITORIAL_WRITER_WORKFLOW = "justphilgud/pubquiz-web/.github/workflows/external-question-import.yml@refs/heads/main";
/** Capability derived from the existing GitHub environment review; never from a boolean input. */
export class EditorialProductionWriteAuthorization {
  private available = true;
  constructor(readonly review: VerifiedExternalImportReviewerApproval) {}
  consume(digest: string | undefined, env: Readonly<Record<string, string | undefined>> = process.env) {
    if (!this.available || !isVerifiedExternalImportReviewerApproval(this.review) ||
      env.GITHUB_ACTIONS !== "true" || env.GITHUB_REPOSITORY !== "justphilgud/pubquiz-web" ||
      env.GITHUB_REF !== "refs/heads/main" || env.GITHUB_EVENT_NAME !== "workflow_dispatch" ||
      env.GITHUB_WORKFLOW_REF !== EDITORIAL_WRITER_WORKFLOW || env.EDITORIAL_GITHUB_ENVIRONMENT !== "operations-content-import" ||
      env.EDITORIAL_PRODUCTION_SHA !== env.PRODUCTION_RELEASE_SHA || !/^[a-f0-9]{40}$/.test(env.EDITORIAL_PRODUCTION_SHA ?? "") ||
      this.review.runId !== env.GITHUB_RUN_ID || this.review.runAttempt !== env.GITHUB_RUN_ATTEMPT ||
      this.review.planDigest !== digest || !/^[a-f0-9]{64}$/.test(digest ?? "") ||
      this.review.backupId !== "production/acceptance/run-37971426600-1" ||
      !this.review.candidateIds.every(id => approvedIds.includes(id))) throw new Error("EDITORIAL_PRODUCTION_WRITE_NOT_AUTHORIZED");
    this.available = false;
    return [...this.review.candidateIds];
  }
}
