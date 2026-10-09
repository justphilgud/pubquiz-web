import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

type Run = {
  head_sha?: string;
  head_branch?: string;
  event?: string;
  conclusion?: string;
  head_repository?: { full_name?: string };
};

export function isTrustedPreviewBranch(branch: string, encodedBranches: string | undefined) {
  try {
    const branches: unknown = JSON.parse(encodedBranches ?? "");
    return branch !== "main" && Array.isArray(branches) &&
      branches.every((value) => typeof value === "string" && !/[?*\[\]]/.test(value)) &&
      branches.includes(branch);
  } catch {
    return false;
  }
}

export function hasSuccessfulPreviewCi(runs: Run[], sha: string, branch: string) {
  return runs.some((run) =>
    run.head_sha === sha && run.head_branch === branch &&
    run.event === "push" && run.conclusion === "success" &&
    run.head_repository?.full_name === "justphilgud/pubquiz-web");
}

async function main() {
  const sha = process.env.DEPLOYMENT_SHA ?? "";
  const branch = process.env.DEPLOYMENT_BRANCH ?? "";
  const token = process.env.GH_TOKEN;
  if (!/^[a-f0-9]{40}$/i.test(sha) || !isTrustedPreviewBranch(branch, process.env.TRUSTED_PREVIEW_BRANCHES) || !token ||
    process.env.DEPLOYMENT_REPOSITORY !== "justphilgud/pubquiz-web") {
    throw new Error("Preview-CI-Prüfung: ungültiger Ausführungskontext.");
  }
  const url = new URL("https://api.github.com/repos/justphilgud/pubquiz-web/actions/workflows/ci.yml/runs");
  url.searchParams.set("head_sha", sha);
  url.searchParams.set("branch", branch);
  url.searchParams.set("event", "push");
  url.searchParams.set("per_page", "100");
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
  });
  if (!response.ok) throw new Error("Preview-CI-Prüfung: GitHub-Metadaten nicht verfügbar.");
  const body = await response.json() as { workflow_runs?: Run[] };
  if (!hasSuccessfulPreviewCi(body.workflow_runs ?? [], sha, branch)) {
    throw new Error("Preview-CI-Prüfung: keine erfolgreiche Push-CI für diesen Branch und SHA.");
  }
  console.log("Erfolgreiche Push-CI für die genaue Preview-Revision bestätigt.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(() => {
    console.error("Preview-CI-Prüfung fehlgeschlagen; Deployment gesperrt.");
    process.exitCode = 1;
  });
}
