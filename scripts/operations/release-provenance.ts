export const REPOSITORY='justphilgud/pubquiz-web';
const sha=(value:string)=>/^[a-f0-9]{40}$/.test(value);
export type CiRun={id:number;head_sha:string;head_branch:string;event:string;path:string;status:string;conclusion:string;head_repository:{full_name:string}};
export type MergedPull={merge_commit_sha:string;merged_at:string|null;base:{ref:string;repo:{full_name:string}};head:{repo:{full_name:string}}};
export function verifiedReleaseCi(candidate:string,runs:readonly CiRun[],pulls:readonly MergedPull[]){
 if(!sha(candidate)||!pulls.some(p=>p.merge_commit_sha===candidate&&p.merged_at&&p.base.ref==='main'&&p.base.repo.full_name===REPOSITORY&&p.head.repo.full_name===REPOSITORY))throw Error('MERGED_RELEASE_PR_UNVERIFIED');
 const latest=runs.filter(r=>r.head_sha===candidate&&r.head_branch==='main'&&r.event==='push'&&r.path==='.github/workflows/ci.yml'&&r.head_repository.full_name===REPOSITORY).sort((a,b)=>b.id-a.id)[0];
 if(!latest||latest.status!=='completed'||latest.conclusion!=='success')throw Error('RELEASE_MAIN_CI_UNVERIFIED');
 return latest.id;
}
export async function githubRead(path:string){
 const token=process.env.GH_TOKEN;
 if(!token||!path.startsWith(`/repos/${REPOSITORY}/`))throw Error('RELEASE_METADATA_CONTEXT');
 const response=await fetch('https://api.github.com'+path,{redirect:'error',headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json'}});
 if(!response.ok)throw Error('RELEASE_METADATA_UNAVAILABLE');
 return response.json() as Promise<unknown>;
}
export async function releaseCi(candidate:string){
 if(!sha(candidate))throw Error('INVALID_SHA');
 const [runs,pulls]=await Promise.all([githubRead(`/repos/${REPOSITORY}/actions/workflows/ci.yml/runs?head_sha=${candidate}&event=push&per_page=100`),githubRead(`/repos/${REPOSITORY}/commits/${candidate}/pulls?per_page=100`)]);
 return verifiedReleaseCi(candidate,(runs as {workflow_runs:CiRun[]}).workflow_runs,pulls as MergedPull[]);
}
