import test from 'node:test';
import assert from 'node:assert/strict';
import {generateCard,evaluateCard} from '../core/cards';
import {applyEventRunEvent,initialEventRun,currentEventRound,callContextData,blockingCalls,assertCurrentEventCommand,parseEventCommand} from './eventRun';
import {checkEvaluation,checkResult,groupChecks} from './cardChecks';
import {bingoNumber,parseNumberInput} from './numberDisplay';
import {raffleEntries} from './raffle';
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
  assert.equal(blockingCalls(state),true);
  for(const kind of ['end','closeRound'] as const)assert.throws(()=>send({kind}),/OPEN_CLAIMS/);
  send({kind:'decideCheck',checkId:first.id,action:'REVOKE',reason:'Nach Korrektur nicht gedeckt'});
  assert.equal(blockingCalls(state),false);
  assert.throws(()=>send({kind:'check',cardId:id(999),context:'a'.repeat(64)}),/CARD_OR_CALL_NOT_FOUND/);
});


test('new manual writes are refused while their historical command parser remains compatible',()=>{
  for(const command of [
    {kind:'call',stage:'BINGO',context:'a'.repeat(64)},
    {kind:'identify',callId:id(100),cardId:id(9)},
    {kind:'decide',callId:id(100),action:'CONFIRM',reason:'Historischer Nachweis'},
  ]){
    const parsed=parseEventCommand(command);
    assert.deepEqual(parsed,command);
    assert.throws(()=>assertCurrentEventCommand(parsed),/LEGACY_CALL_READ_ONLY/);
  }
  assert.doesNotThrow(()=>assertCurrentEventCommand(parseEventCommand({kind:'correct',drawId:id(50),number:16,reason:''})));
  for(const number of [0,76,-1,2.5,NaN])assert.throws(()=>parseEventCommand({kind:'correct',drawId:id(50),number,reason:''}));
});

test('V2 reasonless correction retains identity, position and prior legacy audit; AP3 still requires a reason',async()=>{
  const {parseLiveCommand}=await import('./live');
  assert.throws(()=>parseLiveCommand({kind:'correct',number:2,reason:''}));
  const card=generateCard(id(9),()=>0);
  let state=initialEventRun(id(1),id(2),{id:id(3),label:'R1',target:30,issued:null,seriesIds:[id(4)]},1000);
  const apply=(n:number,command:Parameters<typeof applyEventRunEvent>[1]['command'])=>{state=applyEventRunEvent(state,{id:id(n),at:2000+n,actorId:7,command},[card]);};
  apply(10,{kind:'draw',number:1});const draw=currentEventRound(state).draws[0];
  apply(11,{kind:'correct',drawId:draw.id,number:2,reason:'Gespeicherter Alttext'});
  const old=structuredClone(currentEventRound(state).corrections);
  apply(12,{kind:'correct',drawId:draw.id,number:3,reason:''});
  const round=currentEventRound(state);
  assert.deepEqual(round.draws,[{id:draw.id,position:1,number:3}]);
  assert.deepEqual(round.corrections.slice(0,1),old);
  assert.deepEqual(round.corrections[1],{id:id(12),drawId:draw.id,position:1,before:2,after:3,reason:''});
});


test('legacy confirmation does not block a fresh direct decision; only direct review gates finishing',()=>{
  const card=generateCard(id(9),()=>0);let seq=30;
  let state=initialEventRun(id(1),id(2),{id:id(3),label:'R1',target:30,issued:null,seriesIds:[id(4)]},1000);
  const send=(command:Parameters<typeof applyEventRunEvent>[1]['command'])=>{const key=id(seq++);state=applyEventRunEvent(state,{id:key,at:2000+seq,actorId:1,command},[card]);return key;};
  for(const number of card.cells[0])send({kind:'draw',number:number!});
  const legacy=send({kind:'call',stage:'BINGO',context:'a'.repeat(64)});
  send({kind:'identify',callId:legacy,cardId:card.id});send({kind:'decide',callId:legacy,action:'CONFIRM',reason:'Historisch bestätigt'});
  const old=structuredClone(currentEventRound(state).claims[0]);
  const check=send({kind:'check',cardId:card.id,context:'a'.repeat(64)});
  send({kind:'decideCheck',checkId:check,action:'CONFIRM',reason:'Direkte Kartenprüfung'});
  assert.deepEqual(currentEventRound(state).claims[0],old);
  const withLegacyReview={...currentEventRound(state),claims:currentEventRound(state).claims.map(c=>c.id===legacy?{...c,needsReview:true}:c)};
  assert.ok(raffleEntries(state.tickets??[],[withLegacyReview],[card],[check]).every(e=>e.valid&&!e.needsReview));
  assert.ok(raffleEntries(state.tickets??[],[withLegacyReview],[card],[]).every(e=>!e.valid&&!e.blocksDraw));
  send({kind:'correct',drawId:currentEventRound(state).draws[0].id,number:75,reason:''});
  assert.equal(blockingCalls(state),true);
  send({kind:'decideCheck',checkId:check,action:'REVOKE',reason:'Nachprüfung der direkten Entscheidung'});
  assert.equal(currentEventRound(state).claims.find(c=>c.id===legacy)?.needsReview,true);
  assert.equal(blockingCalls(state),false);
  const claims=structuredClone(currentEventRound(state).claims);send({kind:'end'});
  assert.deepEqual(currentEventRound(state).claims,claims);
});
