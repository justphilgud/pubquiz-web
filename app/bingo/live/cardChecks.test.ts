import test from 'node:test';
import assert from 'node:assert/strict';
import {generateCard,evaluateCard} from '../core/cards';
import {applyEventRunEvent,initialEventRun,currentEventRound,callContextData,blockingCalls} from './eventRun';
import {checkEvaluation,checkResult,groupChecks} from './cardChecks';
import {bingoNumber,parseNumberInput} from './numberDisplay';
const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
test('all number/letter boundaries and strict input validation',()=>{
  for(const [n,label] of [[1,'B 1'],[15,'B 15'],[16,'I 16'],[30,'I 30'],[31,'N 31'],[45,'N 45'],[46,'G 46'],[60,'G 60'],[61,'O 61'],[75,'O 75']] as const){assert.equal(bingoNumber(n),label);assert.equal(parseNumberInput(String(n)),n);}
  for(const invalid of ['','0','76','-1','2.5','2.0','1e1','B 2',' 2','+2','02'])assert.equal(parseNumberInput(invalid),null);
  assert.equal(bingoNumber(null),'–');assert.throws(()=>bingoNumber(76));
});
test('auto result uses existing geometrical rules for zero/single/double/triple',()=>{
  const card=generateCard(id(1),()=>0);
  for(let rows=0;rows<=3;rows++){
    const numbers=card.cells.slice(0,rows).flat().filter((n):n is number=>n!==null);
    assert.equal(checkResult(evaluateCard(card.cells,numbers)).level,rows);
  }
});
test('checks append immutable evidence, group repeated cards, never confirm or block, corrections stay separate',()=>{
  const card=generateCard(id(9),()=>0);
  let state=initialEventRun(id(1),id(2),{id:id(3),label:'R1',target:30,issued:null,seriesIds:[id(4)]},1000),n=20;
  const send=(command:Parameters<typeof applyEventRunEvent>[1]['command'])=>{state=applyEventRunEvent(state,{id:id(n++),actorId:1,at:2000+n,command},[card]);};
  for(const number of card.cells[0])send({kind:'draw',number:number!});
  const context=callContextData(state);send({kind:'check',cardId:card.id,context:'a'.repeat(64)});
  assert.deepEqual(callContextData(state),context);assert.equal(blockingCalls(state),false);
  assert.equal(state.run.rounds[0].claims.length,0);
  const first=structuredClone(state.checks![0]);
  send({kind:'decideCheck',checkId:first.id,action:'CONFIRM',reason:'Geometrisch geprüft'});
  assert.equal(currentEventRound(state).claims[0].decisions.at(-1)?.action,'CONFIRM');
  assert.equal(blockingCalls(state),false);
  send({kind:'draw',number:75});send({kind:'check',cardId:card.id,context:'a'.repeat(64)});
  assert.equal(groupChecks(state.checks!).length,1);assert.equal(groupChecks(state.checks!)[0].length,2);
  assert.deepEqual(state.checks![0],first);
  const draw=currentEventRound(state).draws[0];send({kind:'correct',drawId:draw.id,number:74,reason:'Korrektur'});
  assert.equal(checkResult(checkEvaluation(first,card,currentEventRound(state).draws)).level,0);
  assert.equal(checkResult(first.original).level,1);assert.deepEqual(state.checks![0],first);
  assert.equal(currentEventRound(state).claims[0].needsReview,true);
  send({kind:'decideCheck',checkId:first.id,action:'REVOKE',reason:'Nach Korrektur nicht gedeckt'});
  assert.equal(blockingCalls(state),false);
  assert.throws(()=>send({kind:'check',cardId:id(999),context:'a'.repeat(64)}),/CARD_OR_CALL_NOT_FOUND/);
});
