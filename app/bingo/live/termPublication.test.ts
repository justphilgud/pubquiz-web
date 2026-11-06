import test from 'node:test';
import assert from 'node:assert/strict';
import { initialEventRun,applyEventRunEvent,currentEventRound } from './eventRun';
import { parseRoundSnapshot } from './roundSnapshot';
import { parseTermSet,publishedTerm } from '../preparation/termSet';
const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
test('hidden terms freeze with the round, reveal is explicit and historical correction conceals the replacement again',()=>{
 const terms=parseTermSet({version:1,name:'Musik',publication:'HIDDEN',entries:Array.from({length:75},(_,i)=>({number:i+1,text:`Interpret ${i+1}`}))});
 const frozen=parseRoundSnapshot({id:id(3),label:'Musik',target:30,issued:null,seriesIds:[id(4)],terms});
 let state=initialEventRun(id(1),id(2),frozen,1000),at=1001,n=10;
 const send=(command:Parameters<typeof applyEventRunEvent>[1]['command'])=>{state=applyEventRunEvent(state,{id:id(n++),actorId:1,at:at++,command},[]);};
 send({kind:'draw',number:1});const draw=currentEventRound(state).draws[0];
 assert.equal(publishedTerm(frozen.terms!,1,true,state.revealed?.includes(draw.id)??false),null);
 send({kind:'reveal',drawId:draw.id});assert.equal(publishedTerm(frozen.terms!,1,true,state.revealed!.includes(draw.id)),'Interpret 1');
 assert.throws(()=>send({kind:'reveal',drawId:draw.id}),/ALREADY_REVEALED/);
 send({kind:'correct',drawId:draw.id,number:2,reason:'Falsche Kugel'});
 assert.equal(state.revealed!.includes(draw.id),false);
 assert.equal(publishedTerm(frozen.terms!,2,true,false),null);
 send({kind:'reveal',drawId:draw.id});send({kind:'closeRound'});
 assert.throws(()=>send({kind:'reveal',drawId:draw.id}),/ROUND_NOT_OPEN/);
});
test('old numeric round snapshots remain exactly compatible, unknown extra fields and malformed term sets fail',()=>{
 const numeric={id:id(3),label:'Runde',target:30,issued:null,seriesIds:[id(4)]};
 assert.deepEqual(parseRoundSnapshot(numeric),numeric);
 assert.throws(()=>parseRoundSnapshot({...numeric,terms:{version:1}}));
 assert.throws(()=>parseRoundSnapshot({...numeric,unexpected:true}));
});
