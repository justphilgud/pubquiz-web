import {readFileSync,writeFileSync,appendFileSync} from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

type Run = {
  id?:number;
  run_attempt?:number;
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

export function verifyPreviewCheckout(value:unknown,sha:string,runId:number,runAttempt:number){
  const v=value as {version?:number;repository?:string;runId?:number;runAttempt?:number;sha?:string}|null;
  if(!v||v.version!==1||v.repository!=='justphilgud/pubquiz-web'||v.sha!==sha||v.runId!==runId||v.runAttempt!==runAttempt||!Number.isSafeInteger(runId)||!Number.isSafeInteger(runAttempt)||runId<1||runAttempt<1)throw new Error('Exact tested Preview checkout unverified');
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
  const eligible=(body.workflow_runs??[]).filter(run=>hasSuccessfulPreviewCi([run],sha,branch)).sort((a,b)=>(b.id??0)-(a.id??0));
  const selected=eligible[0];
  if(!selected||typeof selected.id!=='number'||typeof selected.run_attempt!=='number'||!Number.isSafeInteger(selected.id)||!Number.isSafeInteger(selected.run_attempt)||selected.id<1||selected.run_attempt<1)throw new Error('Preview CI run identity unavailable');
  if(process.argv[2]==='resolve'){
    writeFileSync('.preview-ci-selection.json',JSON.stringify({id:selected.id,attempt:selected.run_attempt,event:selected.event}));
    if(!process.env.GITHUB_OUTPUT)throw new Error('Preview output context missing');
    appendFileSync(process.env.GITHUB_OUTPUT,`run_id=${selected.id}\nevent=${selected.event}\n`);
    return;
  }
  if(selected.event==='pull_request'){
    const selection=JSON.parse(readFileSync('.preview-ci-selection.json','utf8')) as {id:number;attempt:number};
    if(selection.id!==selected.id||selection.attempt!==selected.run_attempt)throw new Error('Preview CI selection changed');
    verifyPreviewCheckout(JSON.parse(readFileSync('.ci-tested-revision/ci-tested-revision.json','utf8')),sha,selected.id,selected.run_attempt);
  }
  console.log("Erfolgreiche vertrauenswürdige CI und genauer getesteter Checkout bestätigt.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(() => {
    console.error("Preview-CI-Prüfung fehlgeschlagen; Deployment gesperrt.");
    process.exitCode = 1;
  });
}
