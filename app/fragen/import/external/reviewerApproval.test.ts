import assert from "node:assert/strict";
import test from "node:test";

import {
  VerifiedExternalImportReviewerApproval,
  externalImportApprovalComment,
  externalImportCandidateDigest,
  fetchVerifiedExternalImportReviewerApproval,
} from "./reviewerApproval";

const base = {
  repository: "justphilgud/pubquiz-web",
  runId: "123",
  runAttempt: "1",
  planDigest: "a".repeat(64),
  candidateIds: ["2", "4", "6"],
  backupId: "production/acceptance/run-99-1",
};

function response(comment = externalImportApprovalComment(base)) {
  return [{
    state: "approved",
    comment,
    environments: [{ name: "operations-content-import" }],
    user: { id: 7, login: "reviewer" },
  }];
}

test("reviewer approval is bound to exact plan, candidates and backup", () => {
  const approval = VerifiedExternalImportReviewerApproval.fromGithubReviewHistory({
    ...base,
    response: response(),
  });
  assert.equal(approval.planDigest, base.planDigest);
  assert.deepEqual(approval.candidateIds, base.candidateIds);
  assert.equal(approval.backupId, base.backupId);
  assert.equal(
    externalImportCandidateDigest(base.candidateIds),
    "11ffdbe0bae57f33786b81de3b9516fdb8dda522ec19f201e4e18b7f4f7d886c",
  );
});

test("a generic environment approval without the exact comment is rejected", () => {
  assert.throws(
    () => VerifiedExternalImportReviewerApproval.fromGithubReviewHistory({
      ...base,
      response: response("approved"),
    }),
    /EXTERNAL_IMPORT_REVIEWER_APPROVAL_MISSING/,
  );
});

test("wrong environment and wrong repository are rejected", () => {
  assert.throws(
    () => VerifiedExternalImportReviewerApproval.fromGithubReviewHistory({
      ...base,
      response: [{ ...response()[0], environments: [{ name: "operations-backup" }] }],
    }),
    /EXTERNAL_IMPORT_REVIEWER_APPROVAL_MISSING/,
  );
  assert.throws(
    () => VerifiedExternalImportReviewerApproval.fromGithubReviewHistory({
      ...base,
      repository: "someone/fork",
      response: response(),
    }),
    /EXTERNAL_IMPORT_REVIEWER_APPROVAL_INVALID/,
  );
});

test("GitHub review history is fetched from the exact run", async () => {
  let requested = "";
  const approval = await fetchVerifiedExternalImportReviewerApproval({
    ...base,
    token: "test-token",
    request: async (url) => {
      requested = String(url);
      return new Response(JSON.stringify(response()), { status: 200 });
    },
  });
  assert.match(requested, /\/actions\/runs\/123\/approvals$/);
  assert.equal(approval.reviewerLogin, "reviewer");
});
