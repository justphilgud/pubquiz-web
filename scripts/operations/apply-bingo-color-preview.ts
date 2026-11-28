import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {Client} from 'pg';
import {validateDeploymentEnvironment,BINGO_COLOR_REVIEW_BRANCH} from '../validate-deployment-environment';
import {migrationFiles,assessMigrations,type Applied,type Migration} from './production-preflight';
import {verifySyntheticRoundShape,ROUND_SHAPE_SQL} from './bingo-color-preview-shape';
import {verifyBingoColorPlan,COLOR_SQL,COLOR_MIGRATION} from './bingo-color-release-plan';

/** Explicitly authorized synthetic Preview only; never a general migration entry point. */
export function verifyColorPreviewMigrations(after:Migration[],rows:Applied[]){
 const before=after.filter(f=>f.name!==COLOR_MIGRATION);
 assert.equal(before.length,81);assert.equal(after.length,82);
 const result=assessMigrations(after,before,rows);
 assert.equal(result.gate.status,'PASS');
 assert.equal(new Set(result.applied).size,result.applied.length);
 assert.ok(before.every(f=>result.applied.includes(f.name)));
 const pending=result.pending;
 assert.ok(pending.length===0&&result.applied.length===82||pending.length===1&&pending[0]===COLOR_MIGRATION&&result.applied.length===81);
 return pending;
}
async function main(){
 assert.equal(process.env.GITHUB_ACTIONS,'true');
 assert.equal(process.env.DEPLOYMENT_BRANCH,BINGO_COLOR_REVIEW_BRANCH);
 assert.equal(process.env.DEPLOYMENT_ENV,'preview');
 validateDeploymentEnvironment({deploymentEnvironment:'preview',deploymentEvent:process.env.DEPLOYMENT_EVENT,deploymentRef:process.env.DEPLOYMENT_REF,deploymentRepository:process.env.DEPLOYMENT_REPOSITORY,databaseUrl:process.env.DATABASE_URL,expectedDatabaseHost:process.env.EXPECTED_DATABASE_HOST,expectedDatabaseName:process.env.EXPECTED_DATABASE_NAME,expectedDatabaseBranch:process.env.EXPECTED_DATABASE_BRANCH});
 const candidate=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
 assert.equal(candidate,process.env.DEPLOYMENT_SHA);
 const plan=JSON.parse(readFileSync('release/plan.json','utf8')),after=migrationFiles(candidate),before=after.filter(f=>f.name!==COLOR_MIGRATION);
 const schema=readFileSync('prisma/schema.prisma','utf8').replaceAll('\r\n','\n');
 verifyBingoColorPlan(plan,plan.baselineSha,process.env.DEPLOYMENT_SHA??'',before,after,schema.replace('  presentation_color String? @db.VarChar(7)\n',''),schema);
 console.log('Exact committed color manifest and schema verified.');
 const client=new Client({connectionString:process.env.DATABASE_URL});
 await client.connect();
 try{
  await client.query('BEGIN');
  await client.query("SET LOCAL lock_timeout='2s';SET LOCAL statement_timeout='30s'");
  const identity=(await client.query("SELECT current_database() AS name,to_regclass('public._prisma_migrations')::text AS public_history,to_regclass('pubquiz._prisma_migrations')::text AS schema_history")).rows[0];
  assert.equal(identity.name,'bingo_evening_review');
  // This pre-existing synthetic DB was imported schema-only, with no Prisma history.
  // Never invent a baseline or replay historical migrations into it.
  assert.equal(identity.public_history,null);assert.equal(identity.schema_history,null);
  await client.query('LOCK TABLE pubquiz.bingo_rounds IN ACCESS EXCLUSIVE MODE');
  const pending=verifySyntheticRoundShape((await client.query(ROUND_SHAPE_SQL)).rows[0].shape);
  const rows=async()=> (await client.query("SELECT md5(coalesce(jsonb_agg(to_jsonb(r)-'presentation_color' ORDER BY id)::text,'null')) AS digest FROM pubquiz.bingo_rounds r")).rows[0].digest;
  const beforeRows=await rows();
  if(pending)await client.query(COLOR_SQL);
  assert.equal(verifySyntheticRoundShape((await client.query(ROUND_SHAPE_SQL)).rows[0].shape),false);
  assert.equal(await rows(),beforeRows);
  if(pending)assert.equal((await client.query('SELECT count(*)::int AS count FROM pubquiz.bingo_rounds WHERE presentation_color IS NOT NULL')).rows[0].count,0);
  await client.query('COMMIT');
 }catch(error){await client.query('ROLLBACK').catch(()=>undefined);throw error;}finally{await client.end();}
 console.log('Exact approved synthetic Bingo color Preview migration verified; Production inaccessible by this entry point.');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)void main().catch(()=>{console.error('BLOCKED: synthetic Bingo color Preview migration not fully verifiable');process.exitCode=1;});
