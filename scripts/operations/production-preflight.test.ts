import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MIGRATION_CATALOG_SQL, PUBLIC_MIGRATION_PRIVILEGES_SQL, APPROVED_ROLLBACK, assessMigrationPrivileges, readMigrationSession, assessMigrations, assertPreflightContext, DATABASE_READ_QUERIES, readProductionDeployment, readProductionMigrations } from "./production-preflight";
const a = { name: "a", checksum: "1" };
const b = { name: "b", checksum: "2" };
const installed = { migration_name: "a", checksum: "1", finished_at: "date", rolled_back_at: null };
test("expected pending, unexpected pending, failed and checksum drift are distinguished", () => {
  assert.deepEqual(assessMigrations([a,b],[a],[installed]).pending,["b"]);
  assert.equal(assessMigrations([a,b],[a],[installed]).gate.status,"PASS");
  assert.equal(assessMigrations([a,b],[a],[]).gate.code,"UNEXPECTED_PENDING_MIGRATION");
  assert.equal(assessMigrations([a,b],[a],[installed,{...installed,migration_name:"b",finished_at:null}]).gate.code,"FAILED_MIGRATION");
  assert.equal(assessMigrations([a],[a],[{...installed,checksum:"changed"}]).gate.code,"MIGRATION_DRIFT");
  assert.equal(assessMigrations([a],[{...a,checksum:"changed"}],[installed]).gate.status,"FAIL");
});
test("unknown connection identity blocks without connecting or printing secrets", async () => {
  const result=await readProductionMigrations("postgresql://user:SECRET@unknown.invalid/neondb",[a],[a]);
  assert.equal(result.gate.status,"BLOCKED");assert.ok(!JSON.stringify(result).includes("SECRET"));
});
test("Vercel target, alias, project and exact SHA must agree; every request is GET", async () => {
  const sha="a".repeat(40); const input={token:"SECRET",project:"prj_x",team:"team_x",alias:"quiz.example.com",expectedSha:sha};
  const responses=[{alias:input.alias,projectId:input.project,deployment:{id:"dpl_x"}},{id:input.project,targets:{production:{id:"dpl_x"}}},
    {id:"dpl_x",projectId:input.project,target:"production",readyState:"READY",meta:{githubCommitSha:sha}}, {alias:input.alias,projectId:input.project,deployment:{id:"dpl_x"}}];
  const request=(async (_url:unknown, options:RequestInit)=>{assert.equal(options.method,"GET");return new Response(JSON.stringify(responses.shift()),{status:200});}) as typeof fetch;
  assert.equal((await readProductionDeployment(input,request)).gate.status,"PASS");
  const denied=(async()=>new Response("SECRET",{status:403})) as typeof fetch;
  const result=await readProductionDeployment(input,denied);assert.equal(result.gate.status,"BLOCKED");assert.ok(!JSON.stringify(result).includes("SECRET"));
  const wrong=(async (url:unknown)=>new Response(JSON.stringify(String(url).includes("projects")?{id:input.project,targets:{production:{id:"dpl_x"}}}:String(url).includes("deployments")?
    {id:"dpl_x",projectId:input.project,target:"production",readyState:"READY",meta:{githubCommitSha:"b".repeat(40)}}:{alias:input.alias,projectId:input.project,deployment:{id:"dpl_x"}}))) as typeof fetch;
  assert.equal((await readProductionDeployment(input,wrong)).gate.code,"DEPLOYMENT_SHA_MISMATCH");
});
test("workflow is main-only, manual, separate from backup and deploy; SQL allowlist is read-only", () => {
  const workflow=readFileSync(".github/workflows/production-read-only-preflight.yml","utf8");
  assert.match(workflow,/workflow_dispatch:/);assert.match(workflow,/refs\/heads\/main/);
  assert.ok(!/db:deploy|vercel.*deploy|acceptance-cli|production-writer|workflow_run:/.test(workflow));
  assert.ok(DATABASE_READ_QUERIES.every(sql=>/^(BEGIN|SET LOCAL|SELECT)\b/.test(sql)));
  assert.throws(()=>assertPreflightContext({}),/CONTEXT_UNVERIFIED/);
});


test('unconfirmed privileges block before any migration-history read', async()=>{
  const proof={relation_exists:true,schema_usage:true,can_select:true,can_write:false,elevated_role:false,role_membership:false,owns_relation:false};
  assert.equal(assessMigrationPrivileges(proof).status,'PASS');
  for (const field of ['can_write','elevated_role','role_membership','owns_relation'] as const) assert.equal(assessMigrationPrivileges({...proof,[field]:true}).status,'BLOCKED');
  assert.equal(assessMigrationPrivileges(undefined).status,'BLOCKED');
  const queries:string[]=[];
  const client={query:async(sql:string)=>{queries.push(sql);return {rows: sql===DATABASE_READ_QUERIES[2] ? [{role:'pubquiz_backup_reader',database:'neondb',read_only:'on'}] : sql===MIGRATION_CATALOG_SQL ? [{search_path:'public',schemas:['public','pubquiz'],migration_schemas:['public']}] : sql===PUBLIC_MIGRATION_PRIVILEGES_SQL ? [proof] : sql===DATABASE_READ_QUERIES[3] ? [{...proof,can_write:true}] : []};}};
  const result=await readMigrationSession(client as Parameters<typeof readMigrationSession>[0],[a],[a]);
  assert.equal(result.gate.status,'BLOCKED');assert.ok(!queries.includes(DATABASE_READ_QUERIES[4]));assert.equal(queries.at(-1),'ROLLBACK');
});

test('each missing identity and confirmed mismatch produces an individual safe gate',async()=>{
  const sha='a'.repeat(40),input={token:'SECRET',project:'prj_x',team:'team_x',alias:'quiz.example.com',expectedSha:sha};
  const base=[{alias:input.alias,projectId:input.project,deployment:{id:'dpl_x'}},{id:input.project,targets:{production:{id:'dpl_x'}}},
    {id:'dpl_x',projectId:input.project,target:'production',readyState:'READY',meta:{githubCommitSha:sha}}];
  const cases:[number,string,unknown,string,string][]=[
    [0,'deployment',{},'BLOCKED','ALIAS_DEPLOYMENT_ID_MISSING'],[0,'alias','wrong.example.com','FAIL','ALIAS_HOST_MISMATCH'],
    [0,'projectId','prj_wrong','FAIL','ALIAS_PROJECT_MISMATCH'],[1,'targets',{},'BLOCKED','PROJECT_PRODUCTION_DEPLOYMENT_ID_MISSING'],
    [2,'meta',{},'BLOCKED','DEPLOYMENT_SHA_MISSING'],[2,'target','preview','FAIL','DEPLOYMENT_ENVIRONMENT_MISMATCH'],
    [2,'readyState','ERROR','FAIL','DEPLOYMENT_STATE_MISMATCH'],[2,'meta',{githubCommitSha:'b'.repeat(40)},'FAIL','DEPLOYMENT_SHA_MISMATCH'],
    [2,'id',undefined,'BLOCKED','DEPLOYMENT_ID_MISSING']];
  for(const [index,field,value,status,code] of cases){
    const responses=structuredClone(base) as Record<string,unknown>[];responses[index][field]=value;responses.push(base[0]);
    const request=(async(_url:unknown,opts:RequestInit)=>{assert.equal(opts.method,'GET');return new Response(JSON.stringify(responses.shift()));}) as typeof fetch;
    const result=await readProductionDeployment(input,request);assert.equal(result.gate.status,status,code);assert.ok(result.gates.some(g=>g.code===code),code);
    assert.ok(!JSON.stringify(result).includes('SECRET'));assert.ok(!JSON.stringify(result).includes('wrong.example.com'));
  }
  for(const status of [401,403,404,500]){
    const result=await readProductionDeployment(input,(async()=>new Response('SECRET',{status})) as typeof fetch);
    assert.equal(result.gate.status,'BLOCKED');assert.ok(result.gate.code.startsWith('ALIAS_API_'));assert.ok(!JSON.stringify(result).includes('SECRET'));
  }
  assert.equal((await readProductionDeployment(input,(async()=>new Response('null')) as typeof fetch)).gate.code,'ALIAS_API_RESPONSE_INVALID');
});

test('only the pinned rollback pair with live history accepts divergent Production targets',async()=>{
  const approved=APPROVED_ROLLBACK,input={token:'SECRET',project:approved.project,team:approved.team,alias:approved.alias,expectedSha:approved.publicSha};
  const base={alias:{alias:approved.alias,projectId:approved.project,deploymentId:approved.publicId},
    project:{id:approved.project,targets:{production:{id:approved.targetId}},autoAssignCustomDomains:false},
    public:{id:approved.publicId,projectId:approved.project,target:'production',readyState:'READY',meta:{githubCommitSha:approved.publicSha}},
    target:{id:approved.targetId,projectId:approved.project,target:'production',readyState:'READY',meta:{githubCommitSha:approved.targetSha}},
    history:{events:[{type:'instant-rollback-created',createdAt:approved.rollbackAt,payload:{projectId:approved.project,fromDeploymentId:approved.rollbackFrom,toDeploymentId:approved.targetId}},
      {type:'aliases-assigned',createdAt:approved.aliasAssignedAt,payload:{projectId:approved.project,deployment:{id:approved.publicId}}}]}};
  type Widen<T> = T extends string ? string : T extends number ? number : T extends boolean ? boolean : T extends Array<infer U> ? Widen<U>[] : { [K in keyof T]: Widen<T[K]> };
  type Fixture=Widen<typeof base>;
  const run=async(fixture:Fixture)=>readProductionDeployment(input,(async(url:unknown,options:RequestInit)=>{
    assert.equal(options.method,'GET');const path=new URL(String(url)).pathname;
    const value=path.startsWith('/v4/')?fixture.alias:path.startsWith('/v9/')?fixture.project:path==='/v3/events'?fixture.history:path.endsWith(approved.targetId)?fixture.target:fixture.public;
    return new Response(JSON.stringify(value));
  }) as typeof fetch);
  assert.equal((await run(base)).gate.status,'PASS');
  const cases:[(f:Fixture)=>void,string][]=[
    [f=>{f.project.targets.production.id='dpl_unknown';},'FAIL'],[f=>{f.target.meta.githubCommitSha='b'.repeat(40);},'FAIL'],
    [f=>{f.public.meta.githubCommitSha='b'.repeat(40);},'FAIL'],[f=>{f.target.projectId='prj_wrong';},'FAIL'],
    [f=>{f.alias.alias='wrong.example.com';},'FAIL'],[f=>{f.alias.deploymentId='dpl_changed';},'FAIL'],
    [f=>{f.history.events=[];},'BLOCKED'],[f=>{f.target.meta={} as Fixture['target']['meta'];},'BLOCKED'],
    [f=>{f.project.autoAssignCustomDomains=true;},'FAIL'],[f=>{f.history.events[0].payload.toDeploymentId='dpl_changed';},'BLOCKED']];
  for(const [mutate,status]of cases){const f=structuredClone(base);mutate(f);const result=await run(f);assert.equal(result.gate.status,status);assert.ok(!JSON.stringify(result).includes('SECRET'));}
});

test('catalog diagnosis reports public relation but never selects its migration contents',async()=>{
  const queries:string[]=[];
  const proof={relation_exists:true,schema_usage:true,can_select:false,can_write:false,elevated_role:false,role_membership:false,owns_relation:false};
  const client={query:async(sql:string)=>{queries.push(sql);return {rows:sql===DATABASE_READ_QUERIES[2]?[{role:'pubquiz_backup_reader',database:'neondb',read_only:'on'}]:sql===MIGRATION_CATALOG_SQL?[{search_path:'"$user", public',schemas:['public','pubquiz'],migration_schemas:['public']}]:sql===PUBLIC_MIGRATION_PRIVILEGES_SQL?[proof]:sql===DATABASE_READ_QUERIES[3]?[{...proof,relation_exists:false}]:[]};}};
  const result=await readMigrationSession(client as Parameters<typeof readMigrationSession>[0],[a],[a]);
  assert.equal(result.gate.status,'BLOCKED');assert.ok('diagnosis' in result);
  assert.deepEqual(result.diagnosis?.migrationSchemas,['public']);
  assert.equal(result.diagnosis?.publicPrivileges?.can_select,false);
  assert.ok(!queries.includes(DATABASE_READ_QUERIES[4]));
  assert.ok(queries.every(sql=>/^(BEGIN|SET LOCAL|SELECT|ROLLBACK)\b/.test(sql)));
});
