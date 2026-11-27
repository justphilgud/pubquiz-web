import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {Client} from 'pg';
import {validateDeploymentEnvironment,BINGO_COLOR_REVIEW_BRANCH} from '../validate-deployment-environment';
import {migrationFiles,assessMigrations,type Applied,type Migration} from './production-preflight';
import {verifyBingoColorPlan,COLOR_MIGRATION} from './bingo-color-release-plan';

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
 await client.connect();let pending:string[];
 try{
  await client.query('BEGIN READ ONLY');
  const identity=(await client.query("SELECT current_database() AS name,current_setting('transaction_read_only') AS ro")).rows[0];
  assert.equal(identity.name,'bingo_evening_review');assert.equal(identity.ro,'on');
  const rows=(await client.query('SELECT migration_name,checksum,finished_at,rolled_back_at FROM public._prisma_migrations ORDER BY migration_name')).rows as Applied[];
  pending=verifyColorPreviewMigrations(after,rows);
  console.log('Synthetic database identity and complete baseline history verified.');
 }finally{await client.query('ROLLBACK').catch(()=>undefined);await client.end();}
 if(pending.length)execFileSync(process.execPath,['node_modules/prisma/build/index.js','migrate','deploy'],{stdio:['ignore','pipe','pipe']});
 execFileSync(process.execPath,['node_modules/prisma/build/index.js','migrate','status'],{stdio:['ignore','pipe','pipe']});
 console.log('Exact approved synthetic Bingo color Preview migration verified; Production inaccessible by this entry point.');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)void main().catch(()=>{console.error('BLOCKED: synthetic Bingo color Preview migration not fully verifiable');process.exitCode=1;});
