import test from 'node:test';import assert from 'node:assert/strict';
import {bingoCollectionHref,validBingoCollectionHref,bingoTemporalStatus,summarizeBingoRounds} from './bingoOverviewPolicy';
import {gameReturnHref} from './gameDraft';
test('local Bingo filters retain validated return context without redirects or new runtime status',()=>{
 const path=bingoCollectionHref(3,'PAST');assert.equal(path,'/bingo?series=3&status=PAST');assert.ok(validBingoCollectionHref(path));assert.equal(gameReturnHref('BINGO',path),path);
 for(const value of ['//evil.invalid/bingo','https://evil.invalid/bingo','/bingo?series=3&series=4','/bingo?status=RUNNING','/bingo?status=PAST#x','/bingo?returnTo=/admin','/bingo?series=9007199254740992'])assert.equal(validBingoCollectionHref(value),false,value);
 assert.equal(bingoTemporalStatus('',false),'MISSING_DATE');assert.equal(bingoTemporalStatus('2026-01-01',true),'ARCHIVED');
});
test('physical cards reused in rounds are distinct from recorded round issuance; unknown is not zero',()=>{
 const s={series_id:'shared',series:{card_count:100}};
 assert.deepEqual(summarizeBingoRounds([{issued_count:null,series:[s]},{issued_count:null,series:[s]}]),{rounds:2,cards:100,issued:null,issuedRounds:0});
 assert.deepEqual(summarizeBingoRounds([{issued_count:0,series:[s]},{issued_count:null,series:[s]}]),{rounds:2,cards:100,issued:0,issuedRounds:1});
 assert.deepEqual(summarizeBingoRounds([{issued_count:50,series:[s]},{issued_count:60,series:[s]}]),{rounds:2,cards:100,issued:110,issuedRounds:2});
});
