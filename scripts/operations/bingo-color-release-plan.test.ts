import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {bingoColorPlanFor,verifyBingoColorPlan,COLOR_MIGRATION,COLOR_SQL,colorDeltaEvidence} from './bingo-color-release-plan';
import {migrationFiles} from './production-preflight';
import {verifyFeaturePlan} from './feature-release-plan';

test('only exact additive Bingo color delta is admitted in the feature PR plan',()=>{
 const base='ba484967f4fa3bd1295954d21393261dbf30b0c8',candidate='b'.repeat(40),before=migrationFiles(base);
 const schema=execFileSync('git',['show',`${base}:prisma/schema.prisma`],{encoding:'utf8'}),afterSchema=schema.replace('model bingo_rounds {','model bingo_rounds {\n  presentation_color String? @db.VarChar(7)');
 assert.equal(execFileSync('git',['show','6b5156f666b5a5060aa6f7847eec8f94bedb08c8:prisma/schema.prisma'],{encoding:'utf8'}),afterSchema);
 const plan=bingoColorPlanFor(base,before,schema),after=[...before,{name:COLOR_MIGRATION,checksum:createHash('sha256').update(COLOR_SQL).digest('hex')}];
 assert.equal(readFileSync(`prisma/migrations/${COLOR_MIGRATION}/migration.sql`,'utf8').replaceAll('\r\n','\n'),COLOR_SQL);
 assert.equal(verifyFeaturePlan(plan,base,candidate,before,after,schema,afterSchema).kind,'BINGO_ROUND_COLOR');
 assert.throws(()=>verifyBingoColorPlan({...plan,unknown:true},base,candidate,before,after,schema,afterSchema));
 assert.throws(()=>verifyBingoColorPlan(plan,base,candidate,before,after,schema,afterSchema+'\n'));
 assert.throws(()=>verifyBingoColorPlan(plan,base,candidate,before,[...after.slice(0,-1),{...after.at(-1)!,checksum:'0'.repeat(64)}],schema,afterSchema));
 assert.throws(()=>bingoColorPlanFor(base,before.slice(1),schema));
 assert.throws(()=>bingoColorPlanFor(base,before,schema+'\n'));
 assert.equal(colorDeltaEvidence({status:'PASS',migration:COLOR_MIGRATION}),false);
});
