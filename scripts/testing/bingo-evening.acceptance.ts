import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {PDFDocument} from 'pdf-lib';
import type {Client} from 'pg';
import type * as Prep from '@/app/bingo/preparation/repository.server';
import type * as Creation from '@/app/bingo/eventCreation.server';
import type * as Event from '@/app/bingo/live/eventRepository.server';
import type * as Ceremony from '@/app/bingo/ceremonyRepository.server';
import type * as Evening from '@/app/bingo/preparation/eveningPrint.server';
import {defaultCeremony} from '@/app/rendering/ceremony/ceremony';
import {currentEventRound,type EventCommand} from '@/app/bingo/live/eventRun';
import {roundColor} from '@/app/bingo/roundColors';

export async function exerciseBingoEvening(db:Client,api:typeof Prep&{creation:typeof Creation;eventRun:typeof Event;ceremony:typeof Ceremony;live:typeof import('@/app/bingo/live/repository.server');evening:typeof Evening;createCardsPdf:typeof import('@/app/bingo/preparation/pdf.server').createCardsPdf}){
 const before=(await db.query('SELECT id,layout_hash,cells,printed_code FROM pubquiz.bingo_cards ORDER BY id')).rows;
 const ddl=readFileSync('prisma/migrations/20261126120000_event_ceremony/migration.sql','utf8');
 await db.query('BEGIN');await db.query(ddl);await db.query('ROLLBACK');assert.equal((await db.query("SELECT to_regclass('pubquiz.game_ceremonies') t")).rows[0].t,null);
 await db.query(ddl);
 const full=await api.creation.createBingoEvent(1,{seriesId:10,title:'Binglöckchen · sechs Runden',date:'2026-12-08',time:'19:30',roundCount:6,requestId:randomUUID()});
 const prep=()=>api.readPreparation(1,full.id);
 const generate={operation:'generateEvening',gameId:full.id,expectedSeriesId:10,revision:(await prep()).revision,count:100,printLayout:{format:'SRA3_TWELVE',cardProfile:'A4_FOUR'},requestId:randomUUID()};
 // Evening generation uses the configured SRA3 format via the existing per-round renderer.
 const printJob=await api.writePreparation(1,generate);
 const eveningPdf=await api.evening.createEveningPdf(1,full.id,printJob.jobId!);
 assert.equal((await PDFDocument.load(eveningPdf)).getPageCount(),120,'six independent SRA3 duplex decks, each with 100 cards and a divider pair');
 mkdirSync('output/pdf',{recursive:true});writeFileSync('output/pdf/bingo-sechs-runden-abenddruck-sra3.pdf',eveningPdf);
 assert.equal((await db.query('SELECT count(*)::int n FROM pubquiz.bingo_cards c JOIN pubquiz.bingo_card_series s ON s.id=c.series_id WHERE s.game_id=$1',[full.id])).rows[0].n,600);
 const config={...defaultCeremony().config,prizes:['Erster Preis','Zweiter Preis','Dritter Preis'],startsAt:'2026-12-08T18:30:00.000Z',introVideoUrl:'/medien/intro.mp4',introMusicUrl:'/medien/intro.mp3',outroMusicUrl:'/medien/outro.mp3'};
 await assert.rejects(api.ceremony.writeCeremony(1,full.id,0,{kind:'show',slide:'announcements',placement:'outro'}),/OUTRO_NOT_READY/);
 const configured=await api.ceremony.writeCeremony(1,full.id,0,{kind:'configure',config});assert.equal(configured.revision,1);
 await assert.rejects(api.ceremony.writeCeremony(2,full.id,1,{kind:'show',slide:'welcome'}));
 const races=await Promise.allSettled(['welcome','rules'].map(slide=>api.ceremony.writeCeremony(1,full.id,1,{kind:'show',slide:slide as 'welcome'|'rules'})));assert.equal(races.filter(r=>r.status==='fulfilled').length,1);
 await assert.rejects(api.ceremony.writeCeremony(1,full.id,1,{kind:'show',slide:'waiting'}),/REVISION_CONFLICT/);
 let mediaState=await api.ceremony.writeCeremony(1,full.id,2,{kind:'show',slide:'countdown'});
 for(const action of ['play','pause','stop'] as const){mediaState=await api.ceremony.writeCeremony(1,full.id,mediaState.revision,{kind:'media',action});assert.equal(mediaState.media?.action,action);}
 const preparedRound=(await prep()).rounds[0].id;
 mediaState=await api.ceremony.writeCeremony(1,full.id,mediaState.revision,{kind:'configure',config:{...mediaState.config,insertions:{[preparedRound]:{...defaultCeremony().config,welcome:'Unabhängige vorbereitete Einfügung'}}}});
 mediaState=await api.ceremony.writeCeremony(1,full.id,mediaState.revision,{kind:'show',slide:'welcome',placement:preparedRound});
 assert.equal((await api.live.readGameAudience(1,full.id)).ceremony?.config.welcome,'Unabhängige vorbereitete Einfügung');
 const start=await api.eventRun.startEventRun(1,{gameId:full.id,expectedSeriesId:10,preparationRevision:(await prep()).revision,requestId:randomUUID()});
 const view=()=>api.eventRun.readEventModeration(1,full.id,start.runId);
 assert.equal((await view()).ceremony.slide,null,'starting consciously leaves intro for the game board');
 const send=async(command:EventCommand)=>{const v=(await view()).live!;const input={gameId:full.id,runId:start.runId,requestId:randomUUID(),revision:v.revision,command};await api.eventRun.commandEventRun(1,input);return input;};
 // Exercise the new journal command with real CAS, frozen cards and readback.
 const firstView=await view(),firstId=firstView.live!.round.id,secondId=firstView.plan[1].round_id;
 const oldDraws=JSON.stringify(firstView.live!.state.run.rounds[0].draws);
 await send({kind:'navigateRound',roundId:secondId,preparationRevision:(await prep()).revision});
 assert.equal((await api.eventRun.readEventAudience(1,(await view()).live!.audienceKey)).roundNumber,2);
 await send({kind:'navigateRound',roundId:firstId,preparationRevision:(await prep()).revision});
 assert.equal(JSON.stringify((await view()).live!.state.run.rounds[0].draws),oldDraws);
 // Regression: selected first round differs from the most recently opened round.
 const returned=(await view()).live!;
 assert.notEqual(returned.state.run.rounds.at(-1)!.id,returned.round.id);
 await send({kind:'draw',number:1});
 assert.equal(currentEventRound((await view()).live!.state).draws[0].number,1);
 const rootState=(await view()).ceremony;
 const insertion={...defaultCeremony().config,enabled:['welcome'] as const,welcome:'Nur nach Runde 1'};
 await api.ceremony.writeCeremony(1,full.id,rootState.revision,{kind:'configure',config:{...rootState.config,insertions:{[firstId]:insertion},outro:{...defaultCeremony().config,enabled:['announcements','raffle'],announcements:'Nach allen sechs Runden'}}});
 for(let i=0;i<6;i++){
  let v=(await view()).live!;const card=v.cards[0];
  assert.equal((await api.eventRun.readEventAudience(1,v.audienceKey)).roundNumber,i+1);
  const [snapshot]=(await db.query('SELECT print_snapshot FROM pubquiz.bingo_card_series WHERE game_id=$1 AND origin_round_id=$2 LIMIT 1',[full.id,v.round.id])).rows;
  assert.equal(snapshot.print_snapshot.settings.colors.back,roundColor(i+1).background);
  if(i===0){const other=(await db.query('SELECT c.id FROM pubquiz.bingo_cards c JOIN pubquiz.bingo_card_series s ON s.id=c.series_id WHERE s.game_id=$1 AND s.origin_round_id<>$2 LIMIT 1',[full.id,v.round.id])).rows[0];await assert.rejects(send({kind:'check',cardId:other.id,context:v.callContext}),/WRONG_ROUND/);}
  const drawn=new Set(currentEventRound(v.state).draws.map(draw=>draw.number));
  for(const number of card.cells[0])if(!drawn.has(number!))await send({kind:'draw',number:number!});
  v=(await view()).live!;const call=await send({kind:'check',cardId:card.id,context:v.callContext});
  const selected=currentEventRound(v.state);assert.equal(selected.id,v.round.id);
  const nextNumber=Array.from({length:75},(_,n)=>n+1).find(n=>!selected.draws.some(d=>d.number===n));
  assert.ok(nextNumber!==undefined,'a free draw belongs to the selected round');
  if(i===0)assert.notEqual(nextNumber,1,'regression: do not reuse first-round draw after navigating back');
  await send({kind:'draw',number:nextNumber});
  await send({kind:'decideCheck',checkId:call.requestId,action:'CONFIRM',reason:'Erste Linie'});
  assert.equal((await view()).live!.raffle.count,i+1);
  // Pause remains an explicit barrier for draws; checks still work during a pause.
  await send({kind:'pause'});await assert.rejects(send({kind:'draw',number:75}),/RUN_NOT_RUNNING/);
  v=(await view()).live!;const check=await send({kind:'check',cardId:card.id,context:v.callContext});await api.eventRun.commandEventRun(1,check);
  assert.equal((await view()).live!.raffle.count,i+1);
  await send({kind:'closeRound'});
  if(i===0){const post=await api.eventRun.readEventAudience(1,(await view()).live!.audienceKey);assert.equal(post.ceremony.slide,null);await assert.rejects(api.ceremony.writeCeremony(1,full.id,(await view()).ceremony.revision,{kind:'show',slide:'announcements',placement:'outro'}),/OUTRO_NOT_READY/);}
  if(i<5){await send({kind:'navigateRound',roundId:(await view()).plan[i+1].round_id,preparationRevision:(await prep()).revision});await send({kind:'resume'});}
 }
 const completed=await api.eventRun.readEventAudience(1,(await view()).live!.audienceKey);assert.equal(completed.ceremony.slide,'announcements');assert.equal(completed.ceremony.config.announcements,'Nach allen sechs Runden');
 await assert.rejects(api.ceremony.writeCeremony(1,full.id,(await view()).ceremony.revision,{kind:'show',slide:'welcome',placement:'outro'}),/INVALID_CEREMONY/);
 await assert.rejects(api.ceremony.writeCeremony(1,full.id,(await view()).ceremony.revision,{kind:'show',slide:'raffle',placement:'outro'}),/RAFFLE_NOT_READY/);
 await api.ceremony.writeCeremony(1,full.id,(await view()).ceremony.revision,{kind:'show',slide:'announcements',placement:'outro'});
 await send({kind:'end'});let framing=(await view()).ceremony;
 framing=await api.ceremony.writeCeremony(1,full.id,framing.revision,{kind:'show',slide:'raffle'});
 framing=await api.ceremony.writeCeremony(1,full.id,framing.revision,{kind:'reveal'});
 await assert.rejects(api.ceremony.writeCeremony(1,full.id,framing.revision,{kind:'draw',number:7,runId:start.runId}),/INVALID_RAFFLE_NUMBER/);
 framing=await api.ceremony.writeCeremony(1,full.id,framing.revision,{kind:'draw',number:6,runId:start.runId});
 let audience=await api.eventRun.readEventAudience(1,(await view()).live!.audienceKey);assert.equal(audience.winner,null);assert.equal(audience.ceremony.raffleNumber,null);
 framing=await api.ceremony.writeCeremony(1,full.id,framing.revision,{kind:'reveal'});audience=await api.eventRun.readEventAudience(1,(await view()).live!.audienceKey);assert.equal(audience.winner?.number,6);
 framing=await api.ceremony.writeCeremony(1,full.id,framing.revision,{kind:'reveal'});
 framing=await api.ceremony.writeCeremony(1,full.id,framing.revision,{kind:'show',slide:'announcements'});
 framing=await api.ceremony.writeCeremony(1,full.id,framing.revision,{kind:'show',slide:'raffle'});
 assert.equal(framing.raffleNumber,6);assert.equal(framing.revealCount,3,'winner reveal survives other outro slides');
 assert.ok(!JSON.stringify(audience).includes('probability'),'moderator statistics never reach audience');
 const ten=await api.creation.createBingoEvent(1,{seriesId:10,title:'Zehn Farben',date:'',time:'',roundCount:10,requestId:randomUUID()});
 let tenPrep=await api.readPreparation(1,ten.id);await assert.rejects(api.writePreparation(1,{operation:'createRound',gameId:ten.id,expectedSeriesId:10,revision:tenPrep.revision}),/zehn/);
 await assert.rejects(api.creation.createBingoEvent(1,{seriesId:10,title:'Elf',date:'',time:'',roundCount:11,requestId:randomUUID()}));
 const sample=await PDFDocument.create();
 for(const round of tenPrep.rounds){
  const result=await api.writePreparation(1,{operation:'generate',gameId:ten.id,roundId:round.id,expectedSeriesId:10,revision:tenPrep.revision,count:12,printLayout:{format:'SRA3_TWELVE',cardProfile:'A4_FOUR'},requestId:randomUUID()});
  const batch=await api.readExport(1,ten.id,result.seriesId!,1,12);
  const bytes=await api.createCardsPdf(batch.snapshot,batch.cards,'back');const pdf=await PDFDocument.load(bytes);
  assert.ok(Math.abs(pdf.getPage(0).getWidth()-320/25.4*72)<.1);assert.ok(Math.abs(pdf.getPage(0).getHeight()-450/25.4*72)<.1);
  for(const page of await sample.copyPages(pdf,pdf.getPageIndices()))sample.addPage(page);
  tenPrep=await api.readPreparation(1,ten.id);
 }
 mkdirSync('output/pdf',{recursive:true});writeFileSync('output/pdf/bingo-zehn-runden-rueckseiten-sra3.pdf',await sample.save());
 assert.deepEqual((await db.query('SELECT id,layout_hash,cells,printed_code FROM pubquiz.bingo_cards WHERE id=ANY($1::uuid[]) ORDER BY id',[before.map(c=>c.id)])).rows,before);
 console.info('Bingo evening: six × 100 cards, ten round colours/SRA3 backs, original data integrity, claims/draw independence, paused checks, CAS and persisted raffle reveal PASS');
}
