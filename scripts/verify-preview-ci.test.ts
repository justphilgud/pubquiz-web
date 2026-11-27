import assert from "node:assert/strict";
import test from "node:test";
import { hasSuccessfulPreviewCi, isTrustedPreviewBranch } from "./verify-preview-ci";

test("only successful push CI from the approved repository, branch and SHA permits Preview", () => {
  const sha = "a".repeat(40);
  const branch = "codex/new-preview";
  const run = { head_sha: sha, head_branch: branch, event: "push", conclusion: "success",
    head_repository: { full_name: "justphilgud/pubquiz-web" } };
  assert.equal(hasSuccessfulPreviewCi([run], sha, branch), true);
  for (const changed of [
    { head_sha: "b".repeat(40) }, { head_branch: "other" }, { event: "pull_request" },
    { conclusion: "failure" }, { head_repository: { full_name: "fork/pubquiz-web" } },
  ]) {
    assert.equal(hasSuccessfulPreviewCi([{ ...run, ...changed }], sha, branch), false);
  }
  assert.equal(hasSuccessfulPreviewCi([], sha, branch), false);
});


test("trusted branch approval is exact and cannot be inferred from CI or wildcard names", () => {
  const branch = "codex/preview-media-configuration";
  assert.equal(isTrustedPreviewBranch(branch, JSON.stringify([branch])), true);
  for (const policy of [undefined, "", "invalid", "[]", '["codex/*"]', '["other"]', '{}']) {
    assert.equal(isTrustedPreviewBranch(branch, policy), false);
  }
  assert.equal(isTrustedPreviewBranch("main", '["main"]'), false);
});

test('Preview accepts exact tested PR heads only with explicit same-repository PR identity',()=>{
 const sha='a'.repeat(40),branch='codex/review';
 const run={head_sha:sha,head_branch:branch,event:'pull_request',path:'.github/workflows/ci.yml',conclusion:'success',head_repository:{full_name:'justphilgud/pubquiz-web'},pull_requests:[{head:{sha,repo:{full_name:'justphilgud/pubquiz-web'}}}]};
 assert.equal(hasSuccessfulPreviewCi([run],sha,branch),true);
 for(const changed of [{path:'.github/workflows/other.yml'},{pull_requests:[]},{pull_requests:[{head:{sha:'b'.repeat(40),repo:{full_name:'justphilgud/pubquiz-web'}}}]},{pull_requests:[{head:{sha,repo:{full_name:'fork/pubquiz-web'}}}]}])assert.equal(hasSuccessfulPreviewCi([{...run,...changed}],sha,branch),false);
});
