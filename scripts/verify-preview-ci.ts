import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

type Run = {
  head_sha?: string;
  head_branch?: string;
  event?: string;
  conclusion?: string;
  path?: string;
  pull_requests?: {number?:number;head?:{sha?:string;repo?:{full_name?:string}}}[];
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
    (run.event === "push" || run.event === "pull_request" && run.path === '.github/workflows/ci.yml' && run.pull_requests?.some(pr=>pr.head?.sha===sha&&pr.head.repo?.full_name==='justphilgud/pubquiz-web')) && run.conclusion === "success" &&
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

  url.searchParams.set("per_page", "100");
  const response = await fetch(url, {
    redirect: "error",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
  });
  if (!response.ok) throw new Error("Preview-CI-Prüfung: GitHub-Metadaten nicht verfügbar.");
  const body = await response.json() as { workflow_runs?: Run[] };
  // Actions may return an empty embedded pull_requests array even for real PR
  // runs. Resolve association through the commit API and verify actual PR heads.
  if(body.workflow_runs?.some(run=>run.event==='pull_request'&&run.head_sha===sha&&run.head_branch===branch)){
    const response=await fetch(`https://api.github.com/repos/justphilgud/pubquiz-web/commits/${sha}/pulls?per_page=100`,{redirect:'error',headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json'}});
    if(!response.ok)throw new Error('Preview PR identity unavailable');
    const pulls=await response.json() as {number:number;head:{sha:string;ref:string;repo:{full_name:string}|null}}[];
    if(!Array.isArray(pulls))throw new Error('Preview PR identity invalid');
    const verified=pulls.filter(pr=>pr.head?.ref===branch&&pr.head.repo?.full_name==='justphilgud/pubquiz-web').map(pr=>({number:pr.number,head:{sha:pr.head.sha,repo:{full_name:pr.head.repo!.full_name}}}));
    for(const run of body.workflow_runs??[])if(run.event==='pull_request')run.pull_requests=verified;
  }
  if (!hasSuccessfulPreviewCi(body.workflow_runs ?? [], sha, branch)) {
    throw new Error("Preview-CI-Prüfung: keine erfolgreiche vertrauenswürdige CI für diesen Branch und SHA.");
  }
  console.log("Erfolgreiche vertrauenswürdige CI für die genaue Preview-Revision bestätigt.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(() => {
    console.error("Preview-CI-Prüfung fehlgeschlagen; Deployment gesperrt.");
    process.exitCode = 1;
  });
}
