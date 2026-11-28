import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {cardSetPlanFor,CARD_SET_SQL,CARD_SET_MIGRATION,cardSetDeltaEvidence} from './bingo-card-set-release-plan';
import {migrationFiles} from './production-preflight';
import {verifyFeaturePlan} from './feature-release-plan';
test('card set release admits only reviewed additive bytes and exact baseline, never generic SQL',()=>{
 const base='8dd64266678841c0702d476ae8270f5450dc551a',candidate='b'.repeat(40),before=migrationFiles(base),schema=execFileSync('git',['show',`${base}:prisma/schema.prisma`],{encoding:'utf8'});
 const afterSchema=readFileSync('prisma/schema.prisma','utf8').replaceAll('\r\n','\n'),sql=readFileSync(`prisma/migrations/${CARD_SET_MIGRATION}/migration.sql`,'utf8').replaceAll('\r\n','\n');assert.equal(sql,CARD_SET_SQL);
 const plan=cardSetPlanFor(base,before,schema),after=[...before,{name:CARD_SET_MIGRATION,checksum:createHash('sha256').update(sql).digest('hex')}];
 assert.equal(verifyFeaturePlan(plan,base,candidate,before,after,schema,afterSchema).kind,'BINGO_CARD_SET');
 for(const value of [{...plan,kind:'NO_DELTA'},{...plan,unknown:true},{...plan,baselineSha:candidate}])assert.throws(()=>verifyFeaturePlan(value,base,candidate,before,after,schema,afterSchema));
 assert.throws(()=>verifyFeaturePlan(plan,base,candidate,before,after,schema,afterSchema+'\n'));
 assert.throws(()=>verifyFeaturePlan(plan,base,candidate,before,[...after.slice(0,-1),{...after.at(-1)!,checksum:'0'.repeat(64)}],schema,afterSchema));
 assert.throws(()=>cardSetPlanFor(base,before.slice(1),schema));assert.throws(()=>cardSetPlanFor(base,before,schema+'\n'));
 assert.equal(cardSetDeltaEvidence({status:'PASS',migration:CARD_SET_MIGRATION}),false);
});
