import { createHash } from "node:crypto";

const EXPECTED_REPOSITORY = "justphilgud/pubquiz-web";
const EXPECTED_ENVIRONMENT = "operations-content-import";
const reviewerApprovalBrand = Symbol("verified-external-import-reviewer-approval");

type GithubReview = Readonly<{
  state?: unknown;
  comment?: unknown;
  environments?: unknown;
  user?: unknown;
}>;

export class VerifiedExternalImportReviewerApproval {
  readonly [reviewerApprovalBrand] = true;

  private constructor(
    readonly runId: string,
    readonly runAttempt: string,
    readonly environment: typeof EXPECTED_ENVIRONMENT,
    readonly reviewerId: number,
    readonly reviewerLogin: string,
    readonly planDigest: string,
    readonly candidateIds: readonly string[],
    readonly backupId: string,
  ) {}

  static fromGithubReviewHistory(input: {
    repository: string;
    runId: string;
    runAttempt: string;
    planDigest: string;
    candidateIds: readonly string[];
    backupId: string;
    response: unknown;
  }) {
    if (
      input.repository !== EXPECTED_REPOSITORY ||
      !/^[1-9][0-9]{0,19}$/.test(input.runId) ||
      !/^[1-9][0-9]{0,5}$/.test(input.runAttempt) ||
      !/^[a-f0-9]{64}$/.test(input.planDigest) ||
      !/^production\/acceptance\/run-[1-9][0-9]{0,19}-[1-9][0-9]{0,5}$/.test(input.backupId) ||
      input.candidateIds.length < 1 ||
      new Set(input.candidateIds).size !== input.candidateIds.length ||
      !input.candidateIds.every((candidateId) => /^[A-Za-z0-9._:-]{1,128}$/.test(candidateId)) ||
      !Array.isArray(input.response)
    ) {
      throw new Error("EXTERNAL_IMPORT_REVIEWER_APPROVAL_INVALID");
    }
    const expectedComment = externalImportApprovalComment({
      planDigest: input.planDigest,
      candidateIds: input.candidateIds,
      backupId: input.backupId,
    });
    const approved = input.response.find((entry): entry is GithubReview => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return false;
      const review = entry as GithubReview;
      if (
        review.state !== "approved" || !Array.isArray(review.environments) ||
        review.comment !== expectedComment
      ) return false;
      return review.environments.some((environment) =>
        environment !== null && typeof environment === "object" && !Array.isArray(environment) &&
        (environment as { name?: unknown }).name === EXPECTED_ENVIRONMENT
      );
    });
    const user = approved?.user;
    if (
      !user || typeof user !== "object" || Array.isArray(user) ||
      !Number.isInteger((user as { id?: unknown }).id) || Number((user as { id?: unknown }).id) < 1 ||
      typeof (user as { login?: unknown }).login !== "string" ||
      !/^[A-Za-z0-9-]{1,39}$/.test(String((user as { login?: unknown }).login))
    ) {
      throw new Error("EXTERNAL_IMPORT_REVIEWER_APPROVAL_MISSING");
    }
    return new VerifiedExternalImportReviewerApproval(
      input.runId,
      input.runAttempt,
      EXPECTED_ENVIRONMENT,
      Number((user as { id: number }).id),
      String((user as { login: string }).login),
      input.planDigest,
      [...input.candidateIds],
      input.backupId,
    );
  }
}
export function externalImportCandidateDigest(candidateIds: readonly string[]) {
  return createHash("sha256").update(`${candidateIds.join("\n")}\n`, "utf8").digest("hex");
}

export function externalImportApprovalComment(input: {
  planDigest: string;
  candidateIds: readonly string[];
  backupId: string;
}) {
  return `APPROVE_EXTERNAL_IMPORT plan=${input.planDigest} candidates=${externalImportCandidateDigest(input.candidateIds)} backup=${input.backupId}`;
}

export function isVerifiedExternalImportReviewerApproval(
  value: unknown,
): value is VerifiedExternalImportReviewerApproval {
  return value instanceof VerifiedExternalImportReviewerApproval &&
    value[reviewerApprovalBrand] === true;
}

async function boundedJson(response: Response, maximumBytes = 128 * 1024) {
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!response.ok || bytes.length > maximumBytes) {
    throw new Error("EXTERNAL_IMPORT_REVIEWER_API_REJECTED");
  }
  try {
    return JSON.parse(bytes.toString("utf8")) as unknown;
  } catch {
    throw new Error("EXTERNAL_IMPORT_REVIEWER_API_REJECTED");
  }
}

export async function fetchVerifiedExternalImportReviewerApproval(input: {
  repository: string;
  runId: string;
  runAttempt: string;
  planDigest: string;
  candidateIds: readonly string[];
  backupId: string;
  token: string;
  request?: typeof fetch;
}) {
  if (!input.token || input.token.length > 512) {
    throw new Error("EXTERNAL_IMPORT_GITHUB_TOKEN_INVALID");
  }
  const request = input.request ?? fetch;
  const response = await request(
    `https://api.github.com/repos/${EXPECTED_REPOSITORY}/actions/runs/${input.runId}/approvals`,
    {
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${input.token}`,
        "x-github-api-version": "2022-11-28",
      },
      redirect: "error",
      signal: AbortSignal.timeout(30_000),
    },
  );
  return VerifiedExternalImportReviewerApproval.fromGithubReviewHistory({
    repository: input.repository,
    runId: input.runId,
    runAttempt: input.runAttempt,
    planDigest: input.planDigest,
    candidateIds: input.candidateIds,
    backupId: input.backupId,
    response: await boundedJson(response),
  });
}
