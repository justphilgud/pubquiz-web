import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {migrationFiles} from './production-preflight';
import {verifyBingoColorPlan} from './bingo-color-release-plan';
import assert from 'node:assert/strict';
import {verifyColorPreviewMigrations} from './apply-bingo-color-preview';
import {COLOR_MIGRATION} from './bingo-color-release-plan';
import type {Applied} from './production-preflight';

test('synthetic Preview accepts only the single color delta or an already complete history',()=>{
 const files=Array.from({length:81},(_,i)=>({name:`baseline_${i}`,checksum:'a'.repeat(64)}));
 const after=[...files,{name:COLOR_MIGRATION,checksum:'b'.repeat(64)}];
 const rows:Applied[]=files.map(f=>({migration_name:f.name,checksum:f.checksum,finished_at:'done',rolled_back_at:null}));
 assert.deepEqual(verifyColorPreviewMigrations(after,rows),[COLOR_MIGRATION]);
 assert.deepEqual(verifyColorPreviewMigrations(after,[...rows,{migration_name:COLOR_MIGRATION,checksum:'b'.repeat(64),finished_at:'done',rolled_back_at:null}]),[]);
 for(const bad of [rows.slice(1),[...rows,rows[0]],rows.map((r,i)=>i?r:{...r,checksum:'c'.repeat(64)}),[...rows,{migration_name:COLOR_MIGRATION,checksum:'b'.repeat(64),finished_at:null,rolled_back_at:null}]])assert.throws(()=>verifyColorPreviewMigrations(after,bad));
 assert.throws(()=>verifyColorPreviewMigrations([...after,{name:'unreviewed',checksum:'d'.repeat(64)}],rows));
});

test('real committed candidate passes the exact manifest and schema proof before connecting',()=>{
 const candidate=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
 const after=migrationFiles(candidate),before=after.filter(f=>f.name!==COLOR_MIGRATION);
 const plan=JSON.parse(readFileSync('release/plan.json','utf8'));
 const schema=readFileSync('prisma/schema.prisma','utf8').replaceAll('\r\n','\n');
 assert.equal(verifyBingoColorPlan(plan,plan.baselineSha,candidate,before,after,schema.replace('  presentation_color String? @db.VarChar(7)\n',''),schema).candidateSha,candidate);
});
