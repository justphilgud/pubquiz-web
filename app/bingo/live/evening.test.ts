import test from 'node:test';
import assert from 'node:assert/strict';
import {generateCard,evaluateCard} from '../core/cards';
import {bingoStatistics} from './statistics';
import {sortDraws} from './drawHistory';
import {ROUND_COLORS,roundColor} from '../roundColors';
import {contrastRatio} from '@/app/rendering/presentationTemplates/presentationTemplate';
import {applyEventRunEvent,currentEventRound,initialEventRun,type EventCommand} from './eventRun';
import {raffleEntries,raffleSummary,selectRaffleWinner,type RaffleEntry} from './raffle';
import {parseCeremony,defaultCeremony,parseCeremonyConfig} from '@/app/rendering/ceremony/ceremony';
import {prizeRevealOrder,visiblePrizes,isPrizeSlide} from '@/app/rendering/ceremony/prizeSequence';
const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const card=generateCard(id(900),()=>0);
const draws=(values:readonly number[])=>values.map((number,i)=>({number,id:id(i+100),position:i+1}));

test('statistics: zero, all remaining numbers win, overlaps deduplicated and completed patterns excluded',()=>{
 assert.equal(bingoStatistics([card],[]).probability,0);
 const row=card.cells[0].filter((n):n is number=>n!==null),almost=draws(row.slice(0,-1));
 const one=bingoStatistics([card],almost),two=bingoStatistics([card,{...card,id:id(901)}],almost);
 assert.equal(one.waitingCards,1);assert.equal(two.waitingCards,2);assert.equal(two.probability,one.probability);assert.equal(one.probability,1/71*100);
 const all=Array.from({length:75},(_,i)=>i+1),missing=row[0];
 assert.equal(bingoStatistics([card],draws(all.filter(n=>n!==missing))).probability,100);
 const completed=bingoStatistics([card],draws(all));assert.equal(completed.probability,0);assert.equal(completed.waitingCards,0);
 const second=card.cells[1].filter((n):n is number=>n!==null);
 assert.equal(bingoStatistics([card],draws([...row,...second.slice(0,-1)])).waitingCards,1,'new line on a winning card still counts');
 assert.equal(bingoStatistics([card],draws([...row.slice(1),...second.slice(0,-1)])).waitingCards,1,'correction recomputes from effective draws');
});
test('all four history sorts retain immutable drawing identity and position',()=>{
 const original=draws([20,1,75]),before=structuredClone(original);
 for(const [sort,expected] of [['ORDER_ASC',[20,1,75]],['ORDER_DESC',[75,1,20]],['NUMBER_ASC',[1,20,75]],['NUMBER_DESC',[75,20,1]]] as const){
  const result=sortDraws(original,sort);assert.deepEqual(result.map(d=>d.number),expected);for(const draw of result)assert.equal(draw,original[draw.position-1]);
 }assert.deepEqual(original,before);
});
test('ten print/projector schemes have at least 4.5:1 text contrast, original LOVD red first',()=>{
 assert.equal(ROUND_COLORS.length,10);assert.equal(roundColor(1).background,'#74291D');assert.equal(new Set(ROUND_COLORS.map(t=>t.background)).size,10);
 for(let i=1;i<=10;i++){const c=roundColor(i);assert.ok(contrastRatio(c.background,c.foreground)>=4.5,`${i}: ${contrastRatio(c.background,c.foreground)}`);}
 assert.throws(()=>roundColor(11));assert.throws(()=>roundColor(0));
});
test('confirmed single/double/triple register 1/2/3 tickets, checks never allocate, retries cannot duplicate; rounds accumulate',()=>{
 let state=initialEventRun(id(1),id(2),{id:id(3),label:'Runde 1',target:30,issued:null,seriesIds:[id(4)]},1000),sequence=200;
 const send=(command:EventCommand,frozen?:typeof state.frozen[number])=>{const event={id:id(sequence++),at:2000+sequence,actorId:1,command,...(frozen?{frozen}:{})};state=applyEventRunEvent(state,event,[card]);return event.id;};
 for(let row=0;row<3;row++){
  for(const number of card.cells[row])if(number!==null&&!currentEventRound(state).draws.some(d=>d.number===number))send({kind:'draw',number});
  const checkId=send({kind:'check',cardId:card.id,context:'a'.repeat(64)});
  assert.equal(state.tickets?.length??0,row);
  send({kind:'decideCheck',checkId,action:'CONFIRM',reason:'Geprüft'});assert.equal(state.tickets!.length,row+1);
  const duplicate=send({kind:'check',cardId:card.id,context:'a'.repeat(64)});
  assert.throws(()=>send({kind:'decideCheck',checkId:duplicate,action:'CONFIRM',reason:'Erneut'}),/ALREADY_CONFIRMED/);
  assert.equal(state.tickets!.length,row+1);
 }
 send({kind:'closeRound'});const frozen={...state.frozen[0],id:id(8),label:'Runde 2'};send({kind:'startRound',roundId:frozen.id,preparationRevision:0},frozen);
 for(const number of card.cells[0])send({kind:'draw',number:number!});const checkId=send({kind:'check',cardId:card.id,context:'a'.repeat(64)});send({kind:'decideCheck',checkId,action:'CONFIRM',reason:'Neue Runde'});
 assert.deepEqual(state.tickets!.map(t=>t.number),[1,2,3,4]);assert.equal(state.tickets![3].roundId,frozen.id);
 const first=currentEventRound(state).draws[0];send({kind:'correct',drawId:first.id,number:75,reason:'Kugel korrigiert'});
 assert.equal(currentEventRound(state).claims[0].needsReview,true);
 let entries=raffleEntries(state.tickets!,state.run.rounds,[card]);assert.equal(raffleSummary(entries).needsReview,true);assert.throws(()=>selectRaffleWinner(entries,1),/REVIEW/);
 send({kind:'decideCheck',checkId,action:'REVOKE',reason:'Gewinn nicht gedeckt'});entries=raffleEntries(state.tickets!,state.run.rounds,[card]);assert.equal(entries[3].valid,false);assert.deepEqual(raffleSummary(entries).voidNumbers,[4]);assert.equal(entries[0].number,1);
});
test('raffle: 90 permitted; 91 blocked early; missing/void/invalid tickets never win',()=>{
 const entries:RaffleEntry[]=Array.from({length:90},(_,i)=>({number:i+1,cardId:id(i+1),roundId:id(999),line:'ROW_1',claimIds:[],valid:true,needsReview:false}));
 assert.equal(selectRaffleWinner(entries,90).number,90);assert.equal(raffleSummary(entries).overCapacity,false);
 for(const n of [0,91,1.5,NaN])assert.throws(()=>selectRaffleWinner(entries,n));
 const overflow=[...entries,{...entries[0],number:91}];assert.equal(raffleSummary(overflow).overCapacity,true);assert.throws(()=>selectRaffleWinner(overflow,1),/OVER_CAPACITY/);
 const voided=entries.map(e=>e.number===2?{...e,valid:false}:e);assert.throws(()=>selectRaffleWinner(voided,2));assert.equal(selectRaffleWinner(voided,90).number,90);
});
test('shared prizes reveal last placement first, keep already visible prizes and support arbitrary counts',()=>{
 assert.deepEqual(prizeRevealOrder(['Gold','Silver','Bronze']).map(p=>p.place),[3,2,1]);
 assert.deepEqual(visiblePrizes(['Gold','Silver','Bronze'],0),[]);assert.deepEqual(visiblePrizes(['Gold','Silver','Bronze'],2).map(p=>p.text),['Bronze','Silver']);
 assert.deepEqual(prizeRevealOrder(['Gold','','Bronze','Fourth']).map(p=>p.place),[4,3,1]);
 for(const slide of [{typ:'fixer-slide',slideTyp:'preise'},{typ:'block',abschnitt:{abschnitt_typ:'intro_preise'}},{typ:'ablauf',element:{type:'PRIZES'}}])assert.equal(isPrizeSlide(slide),true);
 assert.equal(isPrizeSlide({typ:'frage'}),false);
 const initial=defaultCeremony();assert.deepEqual(parseCeremony(initial),initial);assert.throws(()=>parseCeremonyConfig({...initial.config,enabled:['fake']}));assert.throws(()=>parseCeremony({...initial,revision:-1}));
});
test('ceremony media keeps old configurations compatible and rejects executable references',()=>{
 const initial=defaultCeremony();
 assert.deepEqual(parseCeremony(initial),initial);
 const config={...initial.config,introVideoUrl:'/medien/intro.mp4',introMusicUrl:'https://example.invalid/intro.mp3',outroMusicUrl:''};
 assert.deepEqual(parseCeremonyConfig(config),config);
 for(const ref of ['javascript:alert(1)','//external.invalid/a.mp3','file:///tmp/a.mp3'])assert.throws(()=>parseCeremonyConfig({...config,introMusicUrl:ref}));
 assert.deepEqual(parseCeremony({...initial,media:{action:'play',commandId:3}}).media,{action:'play',commandId:3});
 assert.throws(()=>parseCeremony({...initial,media:{action:'unknown',commandId:3}}));
});
test('six and ten rounds of 100 standard/music cards use the same numeric geometry',()=>{
 let seed=1707;const random=()=>((seed=(seed*1664525+1013904223)>>>0)/2**32);
 for(const rounds of [6,10])for(let round=0;round<rounds;round++){
  const cards=Array.from({length:100},(_,i)=>generateCard(id(round*100+i+1000),random));
  const values=draws(Array.from({length:40},(_,i)=>i+1)),stats=bingoStatistics(cards,values);
  // Independent brute-force reference; overlap counts at most once per candidate ball.
  const candidates=Array.from({length:35},(_,i)=>i+41).filter(number=>cards.some(card=>evaluateCard(card.cells,[...values.map(d=>d.number),number]).lines.length>evaluateCard(card.cells,values.map(d=>d.number)).lines.length));
  assert.equal(stats.probability,candidates.length/35*100);assert.ok(stats.waitingCards<=100);
 }
});


test('historical review tickets stay invalid without blocking unrelated current raffle entries',()=>{
 const entries:RaffleEntry[]=[
  {number:1,roundId:id(3),cardId:card.id,line:'ROW_1',claimIds:[id(10)],valid:false,needsReview:true,blocksDraw:false},
  {number:2,roundId:id(3),cardId:card.id,line:'ROW_2',claimIds:[id(11)],valid:true,needsReview:false,blocksDraw:false},
 ];
 assert.equal(raffleSummary(entries).needsReview,false);
 assert.equal(selectRaffleWinner(entries,2).number,2);
 assert.throws(()=>selectRaffleWinner(entries,1),/INVALID_RAFFLE_NUMBER/);
 assert.throws(()=>selectRaffleWinner([{...entries[0],blocksDraw:true},entries[1]],2),/RAFFLE_REVIEW_REQUIRED/);
});
