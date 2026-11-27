export type Gate = { status: "PASS" | "BLOCKED" | "FAIL"; code: string };
export const gate = (status: Gate["status"], code: string): Gate => ({ status, code });

export const APPROVED_ROLLBACK = Object.freeze({
  project:'prj_9Nnwer6B43P0nfrOZPIEygFWg666',team:'team_BE4XNxNRwsaEnSb9N8FFvWEH',alias:'pubquiz-web.vercel.app',
  publicId:'dpl_Hr5Dji8br1THcwJdf79rLaLrz3SD',publicSha:'2258c182e68c40a54fbdc4f0a855c9a7306d1a10',
  targetId:'dpl_9CkTLdWXqJLcM3cdcT2S8UDZw54o',targetSha:'e6faf92eee0465808bfbcaa5ddfe08cc1b45a066',
  rollbackFrom:'dpl_9fTFdUSaL253rDDhQPfDJ6uzRPaV',rollbackAt:1791153618367,aliasAssignedAt:1791278176618,
});
type Json = Record<string, unknown>;
const object = (value: unknown): Json => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Json : {};
export async function readProductionDeployment(input: { token: string; project: string; team: string; alias: string; expectedSha: string }, request: typeof fetch = fetch) {
  const gates: Gate[] = [];
  const finish = () => ({ gate: gates.find(g=>g.status==='FAIL') ?? gates.find(g=>g.status==='BLOCKED') ?? gate('PASS','PRODUCTION_SHA_ALIAS_CONFIRMED'), gates });
  const check = (code:string, value:unknown, expected:unknown, valid:(value:unknown)=>boolean) => {
    gates.push(gate(!valid(value) ? 'BLOCKED' : value===expected ? 'PASS' : 'FAIL', !valid(value) ? `${code}_MISSING` : value===expected ? `${code}_CONFIRMED` : `${code}_MISMATCH`));
  };
  const string = (v:unknown)=>typeof v==='string' && v.length>0;
  const deploymentId = (v:unknown)=>typeof v==='string' && /^dpl_[a-zA-Z0-9]+$/.test(v);
  const shaValue = (v:unknown)=>typeof v==='string' && /^[a-f0-9]{40}$/.test(v);
  if (!input.token || !/^prj_[a-zA-Z0-9]+$/.test(input.project) || !/^team_[a-zA-Z0-9]+$/.test(input.team) ||
      !/^[a-zA-Z0-9.-]+$/.test(input.alias) || !shaValue(input.expectedSha)) return { gate: gate('BLOCKED','DEPLOYMENT_INPUT_UNVERIFIED'), gates:[gate('BLOCKED','DEPLOYMENT_INPUT_UNVERIFIED')] };
  const get = async (path:string, endpoint:string):Promise<Json> => {
    let response:Response;
    try { response=await request(`https://api.vercel.com${path}${path.includes('?')?'&':'?'}teamId=${encodeURIComponent(input.team)}`, {
      method:'GET',redirect:'error',headers:{Authorization:`Bearer ${input.token}`},signal:AbortSignal.timeout(30000) }); }
    catch { gates.push(gate('BLOCKED',`${endpoint}_API_NETWORK_ERROR`));throw new Error('SAFE_API_ERROR'); }
    if (!response.ok) { gates.push(gate('BLOCKED',`${endpoint}_API_${response.status===401||response.status===403?'PERMISSION_DENIED':response.status===404?'NOT_FOUND':'HTTP_ERROR'}`));throw new Error('SAFE_API_ERROR'); }
    try { const json:unknown=await response.json();if (json===null || typeof json!=='object' || Array.isArray(json)) throw new Error('INVALID');
      gates.push(gate('PASS',`${endpoint}_API_CONFIRMED`));return json as Json; }
    catch { gates.push(gate('BLOCKED',`${endpoint}_API_RESPONSE_INVALID`));throw new Error('SAFE_API_ERROR'); }
  };
  try {
    const alias=await get(`/v4/aliases/${encodeURIComponent(input.alias)}`,'ALIAS');
    const id=object(alias.deployment).id ?? alias.deploymentId;
    check('ALIAS_HOST',alias.alias,input.alias,string);
    check('ALIAS_PROJECT',alias.projectId,input.project,string);
    gates.push(gate(deploymentId(id)?'PASS':'BLOCKED',deploymentId(id)?'ALIAS_DEPLOYMENT_ID_CONFIRMED':'ALIAS_DEPLOYMENT_ID_MISSING'));
    if (alias.deploymentId!==undefined && object(alias.deployment).id!==undefined) check('ALIAS_DEPLOYMENT_IDS',alias.deploymentId,object(alias.deployment).id,deploymentId);
    gates.push(gate(alias.redirect || alias.deletedAt ? 'FAIL':'PASS',alias.redirect || alias.deletedAt?'ALIAS_REDIRECT_OR_DELETED':'ALIAS_ACTIVE_CONFIRMED'));
    if (!deploymentId(id)) return finish();
    const project=await get(`/v9/projects/${input.project}`,'PROJECT');
    const deployment=await get(`/v13/deployments/${id}`,'DEPLOYMENT');
    check('PROJECT_ID',project.id,input.project,string);
    const targetId=object(object(project.targets).production).id;
    if (!deploymentId(targetId)) { gates.push(gate('BLOCKED','PROJECT_PRODUCTION_DEPLOYMENT_ID_MISSING'));return finish(); }
    const rollbackMismatch=targetId!==id;
    if (!rollbackMismatch) check('PROJECT_PRODUCTION_DEPLOYMENT_ID',targetId,id,deploymentId);
    check('DEPLOYMENT_ID',deployment.id,id,deploymentId);
    // Alias and project response establish project ownership; optional deployment projectId must never contradict them.
    if (deployment.projectId!==undefined) check('DEPLOYMENT_PROJECT',deployment.projectId,input.project,string);
    check('DEPLOYMENT_ENVIRONMENT',deployment.target,'production',string);
    check('DEPLOYMENT_STATE',deployment.readyState,'READY',string);
    const meta=object(deployment.meta),source=object(deployment.gitSource);
    const sha=meta.githubCommitSha ?? source.sha;
    check('DEPLOYMENT_SHA',sha,input.expectedSha,shaValue);
    if (meta.githubCommitSha!==undefined && source.sha!==undefined) check('DEPLOYMENT_SHA_SOURCES',source.sha,meta.githubCommitSha,shaValue);
    if (rollbackMismatch) {
      const approved=APPROVED_ROLLBACK;
      const exact=id===approved.publicId && targetId===approved.targetId && sha===approved.publicSha &&
        input.expectedSha===approved.publicSha && input.project===approved.project && input.team===approved.team && input.alias===approved.alias;
      if (!exact) { gates.push(gate('FAIL','UNAPPROVED_PRODUCTION_TARGET_DRIFT'));return finish(); }
      gates.push(gate('PASS','APPROVED_ROLLBACK_PAIR_CONFIRMED'));
      check('ROLLBACK_PUBLIC_PROJECT',deployment.projectId,approved.project,string);
      check('ROLLBACK_AUTO_ASSIGN',project.autoAssignCustomDomains,false,v=>typeof v==='boolean');
      const target=await get(`/v13/deployments/${approved.targetId}`,'ROLLBACK_TARGET');
      check('ROLLBACK_TARGET_ID',target.id,approved.targetId,deploymentId);
      check('ROLLBACK_TARGET_PROJECT',target.projectId,approved.project,string);
      check('ROLLBACK_TARGET_ENVIRONMENT',target.target,'production',string);
      check('ROLLBACK_TARGET_STATE',target.readyState,'READY',string);
      const targetMeta=object(target.meta),targetSource=object(target.gitSource),targetSha=targetMeta.githubCommitSha ?? targetSource.sha;
      check('ROLLBACK_TARGET_SHA',targetSha,approved.targetSha,shaValue);
      if (targetMeta.githubCommitSha!==undefined && targetSource.sha!==undefined) check('ROLLBACK_TARGET_SHA_SOURCES',targetSource.sha,targetMeta.githubCommitSha,shaValue);
      const history=await get(`/v3/events?projectIds=${approved.project}&since=2026-10-04T22%3A39%3A00.000Z&until=2026-10-06T09%3A17%3A00.000Z&limit=100&withPayload=true`,'ROLLBACK_HISTORY');
      const events=Array.isArray(history.events)?history.events.map(object):[];
      const rollback=events.some(event=>event.type==='instant-rollback-created' && event.createdAt===approved.rollbackAt &&
        object(event.payload).projectId===approved.project && object(event.payload).fromDeploymentId===approved.rollbackFrom && object(event.payload).toDeploymentId===approved.targetId);
      const assignment=events.some(event=>event.type==='aliases-assigned' && event.createdAt===approved.aliasAssignedAt &&
        object(event.payload).projectId===approved.project && object(object(event.payload).deployment).id===approved.publicId);
      gates.push(gate(rollback?'PASS':'BLOCKED',rollback?'ROLLBACK_EVENT_CONFIRMED':'ROLLBACK_EVENT_MISSING'));
      gates.push(gate(assignment?'PASS':'BLOCKED',assignment?'ROLLBACK_ALIAS_HISTORY_CONFIRMED':'ROLLBACK_ALIAS_HISTORY_MISSING'));
      const projectRecheck=await get(`/v9/projects/${input.project}`,'ROLLBACK_PROJECT_RECHECK');
      check('ROLLBACK_PROJECT_RECHECK_ID',projectRecheck.id,approved.project,string);
      check('ROLLBACK_PROJECT_RECHECK_TARGET',object(object(projectRecheck.targets).production).id,approved.targetId,deploymentId);
      check('ROLLBACK_PROJECT_RECHECK_AUTO_ASSIGN',projectRecheck.autoAssignCustomDomains,false,v=>typeof v==='boolean');
    }
    const recheck=await get(`/v4/aliases/${encodeURIComponent(input.alias)}`,'ALIAS_RECHECK');
    check('ALIAS_RECHECK_HOST',recheck.alias,input.alias,string);
    check('ALIAS_RECHECK_PROJECT',recheck.projectId,input.project,string);
    check('ALIAS_RECHECK_DEPLOYMENT_ID',object(recheck.deployment).id ?? recheck.deploymentId,id,deploymentId);
    gates.push(gate(recheck.redirect || recheck.deletedAt?'FAIL':'PASS',recheck.redirect || recheck.deletedAt?'ALIAS_RECHECK_REDIRECT_OR_DELETED':'ALIAS_RECHECK_ACTIVE_CONFIRMED'));
    // Only validated identifiers enter the public artifact; never raw API fields or arbitrary strings.
    return { ...finish(), deploymentId: deploymentId(id)?id:undefined, sha:shaValue(sha)?sha:undefined, alias:input.alias,
      state:deployment.readyState==='READY'?'READY':undefined };
  } catch {
    if (!gates.some(g=>g.status==='BLOCKED'||g.status==='FAIL')) gates.push(gate('BLOCKED','DEPLOYMENT_DIAGNOSTIC_UNAVAILABLE'));
    return finish();
  }
}
