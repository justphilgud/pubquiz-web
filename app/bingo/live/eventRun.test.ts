import assert from "node:assert/strict";
import test from "node:test";
import {generateCard} from "../core/cards";
import {activeElapsedMs} from "../core/run";
import {applyEventRunEvent,blockingCalls,callContextData,currentEventRound,initialEventRun,parseEventCommand,type EventCommand} from "./eventRun";
const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
const card=generateCard(id(9),()=>0),frozen={id:id(3),label:"Runde 1",target:30,issued:null,seriesIds:[id(4)]};
function fixture(){let state=initialEventRun(id(1),id(2),frozen,1000),n=20;return {get state(){return state},send(command:EventCommand,at=2000,next?:typeof frozen){const event={id:id(n++),at,actorId:1,command,...(next?{frozen:next}:{})};state=applyEventRunEvent(state,event,[card]);return event.id}}}
test("independent calls keep identity, boundary, original card evidence; pending and review block draws",()=>{
 const f=fixture();for(const number of card.cells[0])f.send({kind:"draw",number:number!});
 const before=callContextData(f.state),a=f.send({kind:"call",stage:"BINGO",context:"a".repeat(64)}),b=f.send({kind:"call",stage:"DOUBLE",context:"a".repeat(64)});
 assert.notEqual(a,b);assert.deepEqual(callContextData(f.state),before);assert.equal(f.state.calls[0].throughPosition,5);assert.equal(f.state.calls[1].throughPosition,5);
 assert.throws(()=>f.send({kind:"draw",number:75}),/OPEN_CLAIMS/);assert.throws(()=>f.send({kind:"end"}),/OPEN_CLAIMS/);
 f.send({kind:"identify",callId:a,cardId:card.id});f.send({kind:"identify",callId:b,cardId:card.id});
 f.send({kind:"decide",callId:a,action:"CONFIRM",reason:"Linie"});f.send({kind:"decide",callId:b,action:"REJECT",reason:"Nur eine Linie"});
 assert.equal(blockingCalls(f.state),false);const first=currentEventRound(f.state).draws[0];
 f.send({kind:"correct",drawId:first.id,number:75,reason:"Frühere Ziehung"});
 assert.equal(currentEventRound(f.state).draws[0].id,first.id);assert.equal(currentEventRound(f.state).draws.at(-1)?.number,card.cells[0].at(-1));
 assert.equal(currentEventRound(f.state).claims[0].decisions.at(-1)?.action,"CONFIRM");assert.equal(currentEventRound(f.state).claims[0].needsReview,true);
 assert.equal(blockingCalls(f.state),true);assert.throws(()=>f.send({kind:"draw",number:74}),/OPEN_CLAIMS/);
 f.send({kind:"call",stage:"TRIPLE",context:"b".repeat(64)});assert.equal(f.state.calls.length,3);
});
test("three rounds and an extra use empty independent draws; closed history and pause time remain stable",()=>{
 const f=fixture();f.send({kind:"draw",number:3},2000);f.send({kind:"closeRound"},3000);
 const historic=structuredClone(f.state.run.rounds[0]);assert.equal(activeElapsedMs(f.state.run,9000),2000);
 assert.throws(()=>f.send({kind:"correct",drawId:historic.draws[0].id,number:4,reason:"geschlossen"},9000),/ROUND_NOT_OPEN/);
 for(let i=2;i<=4;i++){
  const r={...frozen,id:id(i+100),label:`Runde ${i}`};f.send({kind:"startRound",roundId:r.id},i*10000,r);
  assert.equal(currentEventRound(f.state).draws.length,0);assert.deepEqual(f.state.run.rounds[0],historic);
  f.send({kind:"draw",number:i},i*10000+1000);f.send({kind:"closeRound"},i*10000+2000);
 }
 f.send({kind:"end"},50000);assert.equal(f.state.run.rounds.length,4);assert.equal(f.state.run.status,"ENDED");assert.equal(activeElapsedMs(f.state.run,99999),8000);
 assert.throws(()=>f.send({kind:"call",stage:"BINGO",context:"a".repeat(64)},99999),/RUN_ENDED/);
});
test("V2 rejects forged context, round identifiers and legacy last-draw correction syntax",()=>{
 for(const value of [{kind:"call",stage:"BINGO"},{kind:"call",stage:"BINGO",context:"a"},{kind:"startRound",roundId:"../31"},{kind:"closeRound",now:1},{kind:"correct",number:3,reason:"x"}])assert.throws(()=>parseEventCommand(value));
});
