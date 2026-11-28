import {outroConfig,CEREMONY_SLIDES,ceremonyAt} from '@/app/rendering/ceremony/ceremony';
import {readCeremony} from "../ceremonyRepository.server";
import {raffleEntries,raffleSummary} from "./raffle";
import {MAX_BINGO_ROUNDS,roundColor} from "../roundColors";
import { parseTermSet, publishedTerm } from '../preparation/termSet';
import "server-only";
import {randomUUID} from "node:crypto";
import type {Prisma} from "@/app/generated/prisma/client";
import {prisma} from "@/app/lib/prisma";
import {preparationContext} from "../preparation/access.server";
import {canonical,sha256} from "../preparation/printSnapshot";
import {storedCard} from "../preparation/readExport.server";
import {isWildcardCode,shortCardCode} from "../preparation/bingoPrint";
import {resolveSharedDesign} from "@/app/rendering/sharedDesign/sharedDesignRepository.server";
import {parseSharedDesign,type SharedDesign} from "@/app/rendering/sharedDesign/sharedDesign";
import {captureLiveAssets} from "./visualAssets.server";
import {assertUuid,type FrozenRound} from "./live";
import {activeElapsedMs} from "../core/run";
import {applyEventRunEvent,assertCurrentEventCommand,blockingCalls,callContextData,currentEventRound,initialEventRun,parseEventCommand,type EventCommand} from "./eventRun";
import {parseRoundSnapshot} from "./roundSnapshot";
import {readPreparation} from "../preparation/readPreparation.server";
import {frozenMatching,readMatchingEntry,audienceMatching} from '../matching/repository.server';
type Tx=Prisma.TransactionClient;
type Row={id:string;game_id:string;round_id:string;eventreihe_id:number;status:string;revision:number;started_at:Date;round_snapshot:unknown;design_snapshot:SharedDesign;audience_key:string;start_request_hash:string};
type CardRow={round_id:string;id:string;series_id:string;cells:unknown;layout_hash:string;printed_code:string;ordinal:number;prefix:number;wildcard:boolean};
import {parseEventEnvelope,type Envelope} from "./eventEnvelope";
const integer=(v:unknown)=>{if(!Number.isSafeInteger(v)||Number(v)<0)throw Error("INVALID_REVISION");};
async function clock(tx:Tx){return (await tx.$queryRaw<{at:Date}[]>`SELECT clock_timestamp()::timestamptz(3) AS at`)[0].at.getTime();}
export async function eventStorageAvailable(){return Boolean((await prisma.$queryRaw<{present:string|null}[]>`SELECT to_regclass('pubquiz.bingo_event_runs')::text present`)[0].present);}
export async function selectedRun(gameId:string,runId?:string){
 assertUuid(gameId);if(runId)assertUuid(runId);
 return (await prisma.$queryRaw<{id:string;status:string;event_version:number|null}[]>`SELECT r.id,r.status,e.version AS event_version FROM pubquiz.bingo_live_runs r LEFT JOIN pubquiz.bingo_event_runs e ON e.run_id=r.id WHERE r.game_id=${gameId}::uuid AND (${runId??null}::uuid IS NULL OR r.id=${runId??null}::uuid) ORDER BY r.started_at DESC,r.id DESC LIMIT 1`)[0]??null;
}
async function load(tx:Tx,row:Row){
 const first=parseRoundSnapshot(row.round_snapshot,row.round_id);
 if(!parseSharedDesign(row.design_snapshot))throw Error("INVALID_PERSISTED_RUN");
 const frozenRows=await tx.$queryRaw<{round_id:string;round_snapshot:unknown;opened_at:Date}[]>`SELECT f.round_id,f.round_snapshot,f.opened_at FROM pubquiz.bingo_event_rounds f JOIN pubquiz.bingo_event_round_plan p ON p.run_id=f.run_id AND p.round_id=f.round_id WHERE f.run_id=${row.id}::uuid ORDER BY p.position`;
 const all=await tx.$queryRaw<CardRow[]>`SELECT rc.round_id,c.id,c.series_id,c.cells,c.layout_hash,c.printed_code,c.ordinal,l.prefix,EXISTS(SELECT 1 FROM pubquiz.bingo_wildcard_series w WHERE w.series_id=c.series_id) AS wildcard FROM pubquiz.bingo_event_round_cards rc JOIN pubquiz.bingo_cards c ON c.id=rc.card_id JOIN pubquiz.bingo_series_labels l ON l.series_id=c.series_id WHERE rc.run_id=${row.id}::uuid AND rc.game_id=${row.game_id}::uuid ORDER BY rc.round_id,c.id`;
 const cardsByRound=new Map(frozenRows.map(f=>{
  const snapshot=parseRoundSnapshot(f.round_snapshot,f.round_id),rows=all.filter(c=>c.round_id===f.round_id);
  if(!rows.length||(snapshot.issued!==null&&snapshot.issued>rows.length)||canonical([...new Set(rows.map(c=>c.series_id))].sort())!==canonical(snapshot.seriesIds))throw Error("INVALID_FROZEN_CARDS");
  return [f.round_id,rows.map(c=>({...storedCard(c),shortCode:shortCardCode(c.prefix,c.ordinal,c.wildcard)}))] as const;
 }));
 if(!frozenRows.length||frozenRows[0].opened_at.getTime()!==row.started_at.getTime()||canonical(frozenRows[0].round_snapshot)!==canonical(first))throw Error("INVALID_FROZEN_ROUND");
 const events=await tx.$queryRaw<{request_id:string;request_hash:string;revision:number;actor_id:number;occurred_at:Date;command:unknown;event_round_id:string}[]>`SELECT request_id,request_hash,revision,actor_id,occurred_at,command,event_round_id FROM pubquiz.bingo_live_events WHERE run_id=${row.id}::uuid ORDER BY revision`;
 const checkedIds=[...new Set(events.flatMap(e=>{const c=parseEventEnvelope(e.command).input.command;return c.kind==='check'?[c.cardId]:[];}))];
 const checkRows=checkedIds.length?await tx.$queryRaw<CardRow[]>`SELECT c.id,c.series_id,c.cells,c.layout_hash,c.printed_code,c.ordinal,l.prefix,EXISTS(SELECT 1 FROM pubquiz.bingo_wildcard_series w WHERE w.series_id=c.series_id) AS wildcard FROM pubquiz.bingo_cards c JOIN pubquiz.bingo_series_labels l ON l.series_id=c.series_id WHERE l.game_id=${row.game_id}::uuid AND c.id=ANY(${checkedIds}::uuid[])`:[];
 const checkCards=checkRows.map(c=>({...storedCard(c),shortCode:shortCardCode(c.prefix,c.ordinal,c.wildcard)}));
 if(checkCards.length!==checkedIds.length)throw Error('INVALID_FROZEN_CARDS');
 if(events.length!==row.revision)throw Error("INVALID_EVENT_HISTORY");
 let state=initialEventRun(row.id,row.game_id,first,row.started_at.getTime()),previousAt=row.started_at.getTime();
 const starts=new Map([[first.id,0]]),durations=new Map<string,number>();
 for(const [i,e] of events.entries()){
  const envelope=parseEventEnvelope(e.command),c=envelope.input.command;
  if(e.revision!==i+1||envelope.input.revision>i||(!["call","check"].includes(c.kind)&&envelope.input.revision!==i)||e.occurred_at.getTime()<previousAt)throw Error("INVALID_EVENT_HISTORY");
  if(e.request_hash!==sha256(canonical({gameId:row.game_id,runId:row.id,requestId:e.request_id,...envelope.input})))throw Error("INVALID_EVENT_HASH");
  if((c.kind==="call"||c.kind==="check")&&c.context!==sha256(canonical(callContextData(state))))throw Error("INVALID_EVENT_HISTORY");
  const previousRound=currentEventRound(state);
  if(e.event_round_id!==((c.kind==="startRound"||c.kind==="navigateRound")?c.roundId:previousRound.id))throw Error("INVALID_EVENT_HISTORY");
  if(envelope.opened){const stored=frozenRows.find(f=>f.round_id===envelope.opened!.id);if(!stored||canonical(stored.round_snapshot)!==canonical(envelope.opened)||stored.opened_at.getTime()!==e.occurred_at.getTime())throw Error("INVALID_FROZEN_ROUND");starts.set(stored.round_id,activeElapsedMs(state.run,e.occurred_at.getTime()));}
  if(['navigateRound','closeRound','end'].includes(c.kind)&&previousRound.status==='OPEN')durations.set(previousRound.id,(durations.get(previousRound.id)??0)+activeElapsedMs(state.run,e.occurred_at.getTime())-(starts.get(previousRound.id)??0));
  if(c.kind==='navigateRound')starts.set(c.roundId,activeElapsedMs(state.run,e.occurred_at.getTime()));
  state=applyEventRunEvent(state,{id:e.request_id,at:e.occurred_at.getTime(),actorId:e.actor_id,command:c,...(envelope.opened?{frozen:envelope.opened}:{})},["check","decideCheck","correct"].includes(c.kind)?[...new Map([...(cardsByRound.get(previousRound.id)??[]),...checkCards].map(card=>[card.id,card])).values()]:cardsByRound.get(previousRound.id)??[]);
  previousAt=e.occurred_at.getTime();
 }
 if(state.run.status!==row.status||state.frozen.length!==frozenRows.length)throw Error("INVALID_PERSISTED_RUN");
 return {state,cardsByRound,checkCards,events,starts,durations,previousAt};
}
async function plannedRoundNumber(tx:Tx,runId:string,roundId:string){
 return (await tx.$queryRaw<{number:number}[]>`SELECT count(*)::int AS number FROM pubquiz.bingo_event_round_plan WHERE run_id=${runId}::uuid AND position<=(SELECT position FROM pubquiz.bingo_event_round_plan WHERE run_id=${runId}::uuid AND round_id=${roundId}::uuid)`)[0].number;
}
async function freeze(tx:Tx,gameId:string,runId:string,roundId:string,at:number){
 const round=await tx.bingo_rounds.findFirst({where:{id:roundId,game_id:gameId},include:{series:true}});
 if(!round||!round.series.length)throw Error("NO_ASSIGNED_CARDS");
 const position=await plannedRoundNumber(tx,runId,roundId);
 const snapshot=parseRoundSnapshot({id:round.id,color:roundColor(position,round.presentation_color).background,label:round.label,target:round.planned_draws,issued:round.issued_count,seriesIds:round.series.map(s=>s.series_id).sort(),...await roundContent(tx,gameId,round.id,round.term_snapshot)});
 await tx.$executeRaw`INSERT INTO pubquiz.bingo_event_rounds(run_id,round_id,game_id,round_snapshot,opened_at) VALUES(${runId}::uuid,${roundId}::uuid,${gameId}::uuid,${JSON.stringify(snapshot)}::jsonb,${new Date(at)})`;
 await tx.$executeRaw`INSERT INTO pubquiz.bingo_event_round_cards(run_id,round_id,game_id,card_id,series_id) SELECT ${runId}::uuid,${roundId}::uuid,${gameId}::uuid,c.id,c.series_id FROM pubquiz.bingo_cards c JOIN pubquiz.bingo_round_series rs ON rs.series_id=c.series_id WHERE rs.round_id=${roundId}::uuid AND rs.game_id=${gameId}::uuid`;
 const count=(await tx.$queryRaw<{n:number}[]>`SELECT count(*)::int n FROM pubquiz.bingo_event_round_cards WHERE run_id=${runId}::uuid AND round_id=${roundId}::uuid`)[0].n;
 if(!count||(snapshot.issued!==null&&snapshot.issued>count))throw Error("INVALID_FROZEN_CARDS");return snapshot;
}
async function roundContent(tx:Tx,gameId:string,roundId:string,value:unknown){
 if(!value)return {};const config=parseTermSet(value);if(config.version===1)return {terms:config};
 // Compare inside PostgreSQL. Embedded fonts and full print snapshots never cross the boundary.
 const [mismatch]=await tx.$queryRaw<{n:number}[]>`SELECT count(*)::int n FROM pubquiz.bingo_round_series rs JOIN pubquiz.bingo_card_series s ON s.id=rs.series_id WHERE rs.game_id=${gameId}::uuid AND rs.round_id=${roundId}::uuid AND (s.print_snapshot->'terms') IS DISTINCT FROM ${JSON.stringify(config)}::jsonb`;
 if(mismatch.n)throw Error('MATCHING_CARDS_CONFLICT');return frozenMatching(tx,gameId,config);
}
export async function startEventRun(userId:number,input:{gameId:string;requestId:string;expectedSeriesId:number;preparationRevision:number}){
 assertUuid(input.gameId);assertUuid(input.requestId);integer(input.expectedSeriesId);integer(input.preparationRevision);const hash=sha256(canonical({...input,protocol:2}));
 return prisma.$transaction(async tx=>{
  const {game,series}=await preparationContext(tx,userId,input.gameId,true);
  if(game.eventreihe_id!==input.expectedSeriesId)throw Error("SERIES_CHANGED");
  const [old]=await tx.$queryRaw<Row[]>`SELECT * FROM pubquiz.bingo_live_runs WHERE game_id=${game.id}::uuid AND start_request_id=${input.requestId}::uuid`;
  if(old){if(old.start_request_hash!==hash)throw Error("REQUEST_REUSED");return {runId:old.id};}
  if(await tx.bingo_live_runs.count({where:{game_id:game.id,status:{in:["RUNNING","PAUSED"]}}}))throw Error("ACTIVE_RUN_EXISTS");
  if((await tx.bingo_preparations.findUnique({where:{game_id:game.id}}))?.revision!==input.preparationRevision)throw Error("PREPARATION_CHANGED");
  const plan=await tx.bingo_rounds.findMany({where:{game_id:game.id},orderBy:{position:"asc"},include:{series:true}}),first=plan[0];
  if(!first?.series.length)throw Error("NO_ASSIGNED_CARDS");
  if(plan.length>MAX_BINGO_ROUNDS)throw Error("ROUND_LIMIT");
  const snapshot=parseRoundSnapshot({id:first.id,color:roundColor(1,first.presentation_color).background,label:first.label,target:first.planned_draws,issued:first.issued_count,seriesIds:first.series.map(s=>s.series_id).sort(),...await roundContent(tx,game.id,first.id,first.term_snapshot)});
  const design=(await resolveSharedDesign(tx,game.shared_design_template_id,series)).design,assets=await captureLiveAssets(design);
  const previous=(await tx.$queryRaw<{at:Date|null}[]>`SELECT max(started_at) at FROM pubquiz.bingo_live_runs WHERE game_id=${game.id}::uuid`)[0].at;
  const at=Math.max(await clock(tx),(previous?.getTime()??-1)+1),id=randomUUID(),key=randomUUID();
  await tx.$executeRaw`INSERT INTO pubquiz.bingo_live_runs(id,game_id,round_id,eventreihe_id,status,started_at,created_by,round_snapshot,design_snapshot,visual_assets,audience_key,start_request_id,start_request_hash) VALUES(${id}::uuid,${game.id}::uuid,${first.id}::uuid,${series.eventreihe_id},'RUNNING',${new Date(at)},${userId},${JSON.stringify(snapshot)}::jsonb,${JSON.stringify(design)}::jsonb,${JSON.stringify(assets)}::jsonb,${key}::uuid,${input.requestId}::uuid,${hash})`;
  await tx.$executeRaw`INSERT INTO pubquiz.bingo_event_runs(run_id,version) VALUES(${id}::uuid,2)`;
  for(const round of plan)await tx.$executeRaw`INSERT INTO pubquiz.bingo_event_round_plan(run_id,game_id,round_id,position) VALUES(${id}::uuid,${game.id}::uuid,${round.id}::uuid,${round.position})`;
  await freeze(tx,game.id,id,first.id,at);
  const ceremony=await readCeremony(tx,game.id);if(ceremony.revision>0){const next={...ceremony,revision:ceremony.revision+1,slide:null,raffleNumber:null,runId:null,revealCount:0,raffleRevealCount:0};await tx.$executeRaw`UPDATE pubquiz.game_ceremonies SET state=${JSON.stringify(next)}::jsonb,updated_at=clock_timestamp() WHERE game_id=${game.id}::uuid`;}
  return {runId:id};
 },{timeout:30000});
}
export async function commandEventRun(userId:number,input:{gameId:string;runId:string;requestId:string;revision:number;command:EventCommand}){
 assertUuid(input.gameId);assertUuid(input.runId);assertUuid(input.requestId);integer(input.revision);const command=parseEventCommand(input.command),hash=sha256(canonical({gameId:input.gameId,runId:input.runId,requestId:input.requestId,revision:input.revision,command}));
 return prisma.$transaction(async tx=>{
  const {game}=await preparationContext(tx,userId,input.gameId,true);
  const [row]=await tx.$queryRaw<Row[]>`SELECT r.* FROM pubquiz.bingo_live_runs r JOIN pubquiz.bingo_event_runs e ON e.run_id=r.id WHERE r.id=${input.runId}::uuid AND r.game_id=${game.id}::uuid FOR UPDATE OF r`;
  if(!row||row.eventreihe_id!==game.eventreihe_id)throw Error("RUN_NOT_FOUND");
  const [old]=await tx.$queryRaw<{request_hash:string;revision:number}[]>`SELECT request_hash,revision FROM pubquiz.bingo_live_events WHERE run_id=${row.id}::uuid AND request_id=${input.requestId}::uuid`;
  if(old){if(old.request_hash!==hash)throw Error("REQUEST_REUSED");return {revision:old.revision};}
  assertCurrentEventCommand(command);
  const loaded=await load(tx,row),{state}=loaded;
  if(command.kind==="call"||command.kind==="check"){if(input.revision>row.revision||command.context!==sha256(canonical(callContextData(state))))throw Error("CALL_CONTEXT_CONFLICT");}
  else if(input.revision!==row.revision)throw Error("REVISION_CONFLICT");
  const at=Math.max(await clock(tx),loaded.previousAt),round=currentEventRound(state);let opened:FrozenRound|null=null;
  if(command.kind==='playback'){
   const ref=state.frozen.find(f=>f.id===round.id)?.matching,last=round.draws.at(-1);
   if(!ref||!last||last.id!==command.drawId)throw Error('MEDIA_CONTEXT_CHANGED');
   const entry=await readMatchingEntry(tx,game.id,ref,last.number);if(entry.keepNumber||entry.presentation.kind!=='MEDIA'||entry.presentation.source?.kind==='IMAGE')throw Error('MEDIA_NOT_PLAYABLE');
  }
  if(command.kind==="appendRound"||command.kind==="startRound"||command.kind==="navigateRound"){
   if((await tx.bingo_preparations.findUnique({where:{game_id:game.id}}))?.revision!==command.preparationRevision)throw Error("PREPARATION_CHANGED");
   if(state.run.status==="ENDED")throw Error("RUN_ENDED");
   if(command.kind==="appendRound"){
    if(await tx.bingo_rounds.count({where:{game_id:game.id}})>=MAX_BINGO_ROUNDS)throw Error("ROUND_LIMIT");
    const position=(await tx.bingo_rounds.aggregate({where:{game_id:game.id},_max:{position:true}}))._max.position??0;
    await tx.bingo_rounds.create({data:{id:input.requestId,game_id:game.id,position:position+1,label:command.label,planned_draws:command.target}});
    const [max]=await tx.$queryRaw<{n:number}[]>`SELECT coalesce(max(position),0)::int n FROM pubquiz.bingo_event_round_plan WHERE run_id=${row.id}::uuid`;
    await tx.$executeRaw`INSERT INTO pubquiz.bingo_event_round_plan(run_id,game_id,round_id,position) VALUES(${row.id}::uuid,${game.id}::uuid,${input.requestId}::uuid,${max.n+1})`;
    await tx.bingo_preparations.update({where:{game_id:game.id},data:{revision:{increment:1}}});
   }else if(command.kind==='navigateRound'){
    const plan=await tx.$queryRaw<{round_id:string}[]>`SELECT round_id FROM pubquiz.bingo_event_round_plan WHERE run_id=${row.id}::uuid ORDER BY position`;
    const from=plan.findIndex(p=>p.round_id===round.id),to=plan.findIndex(p=>p.round_id===command.roundId);
    if(to<0||Math.abs(to-from)!==1)throw Error('INVALID_NEXT_ROUND');
    if(!state.frozen.some(f=>f.id===command.roundId))opened=await freeze(tx,game.id,row.id,command.roundId,at);
   }else{
    const [next]=await tx.$queryRaw<{round_id:string}[]>`SELECT p.round_id FROM pubquiz.bingo_event_round_plan p LEFT JOIN pubquiz.bingo_event_rounds f ON f.run_id=p.run_id AND f.round_id=p.round_id WHERE p.run_id=${row.id}::uuid AND f.round_id IS NULL ORDER BY p.position LIMIT 1`;
    if(!next||next.round_id!==command.roundId)throw Error("INVALID_NEXT_ROUND");opened=await freeze(tx,game.id,row.id,command.roundId,at);
   }
  }
  const checkRows=command.kind==='check'?await tx.$queryRaw<CardRow[]>`SELECT c.id,c.series_id,c.cells,c.layout_hash,c.printed_code,c.ordinal,l.prefix,EXISTS(SELECT 1 FROM pubquiz.bingo_wildcard_series w WHERE w.series_id=c.series_id) AS wildcard FROM pubquiz.bingo_cards c JOIN pubquiz.bingo_series_labels l ON l.series_id=c.series_id WHERE l.game_id=${game.id}::uuid AND c.id=${command.cardId}::uuid`:[];
  if(command.kind==='check'&&!checkRows.length)throw Error('CARD_OR_CALL_NOT_FOUND');
  if(command.kind==='check'&&!loaded.cardsByRound.get(round.id)?.some(card=>card.id===command.cardId))throw Error('WRONG_ROUND');
  if(command.kind==='decideCheck'&&command.action==='CONFIRM'&&!loaded.cardsByRound.get(round.id)?.some(card=>card.id===state.checks?.find(check=>check.id===command.checkId)?.cardId))throw Error('WRONG_ROUND');
  const next=applyEventRunEvent(state,{id:input.requestId,at,actorId:userId,command,...(opened?{frozen:opened}:{})},["check","decideCheck","correct"].includes(command.kind)?[...new Map([...(loaded.cardsByRound.get(round.id)??[]),...loaded.checkCards,...checkRows.map(storedCard)].map(card=>[card.id,card])).values()]:loaded.cardsByRound.get(round.id)??[]);
  if(['navigateRound','startRound','closeRound','end'].includes(command.kind)&&(await tx.$queryRaw<{present:string|null}[]>`SELECT to_regclass('pubquiz.game_ceremonies')::text present`)[0].present){
   const ceremony=await readCeremony(tx,game.id),config=outroConfig(ceremony.config);
   const plan=await tx.$queryRaw<{round_id:string}[]>`SELECT round_id FROM pubquiz.bingo_event_round_plan WHERE run_id=${row.id}::uuid`;
   const finished=command.kind==='end'||plan.every(p=>next.run.rounds.some(r=>r.id===p.round_id&&r.status==='CLOSED'));
   const slide=(command.kind==='closeRound'||command.kind==='end')&&finished?CEREMONY_SLIDES.find(s=>s.phase==='OUTRO'&&s.id!=='raffle'&&config.enabled.includes(s.id))?.id??null:null;
   const framing={...ceremony,revision:ceremony.revision+1,slide,revealCount:0,media:{action:'stop',commandId:ceremony.revision+1},...(slide?{placement:'outro'}:{})};
   if(!slide)delete framing.placement;
   await tx.$executeRaw`INSERT INTO pubquiz.game_ceremonies(game_id,state) VALUES(${game.id}::uuid,${JSON.stringify(framing)}::jsonb) ON CONFLICT(game_id) DO UPDATE SET state=EXCLUDED.state,updated_at=clock_timestamp()`;
  }
  const envelope:Envelope={version:2,input:{revision:input.revision,command},opened};
  await tx.$executeRaw`INSERT INTO pubquiz.bingo_live_events(run_id,revision,request_id,request_hash,actor_id,occurred_at,command,event_round_id) VALUES(${row.id}::uuid,${row.revision+1},${input.requestId}::uuid,${hash},${userId},${new Date(at)},${JSON.stringify(envelope)}::jsonb,${(command.kind==="startRound"||command.kind==="navigateRound")?command.roundId:round.id}::uuid)`;
  await tx.$executeRaw`UPDATE pubquiz.bingo_live_runs SET revision=revision+1,status=${next.run.status} WHERE id=${row.id}::uuid AND revision=${row.revision}`;
  return {revision:row.revision+1,...(command.kind==="appendRound"?{roundId:input.requestId}:{})};
 },{timeout:30000});
}

export async function readEventModeration(userId:number,gameId:string,runId?:string,prepareNew=false){
 assertUuid(gameId);if(runId)assertUuid(runId);
 const result=await prisma.$transaction(async tx=>{
  await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
  const {game,series}=await preparationContext(tx,userId,gameId);
  const rows=await tx.$queryRaw<{id:string;status:string;started_at:Date}[]>`SELECT id,status,started_at FROM pubquiz.bingo_live_runs WHERE game_id=${gameId}::uuid ORDER BY started_at DESC,id DESC`;
  const [selected]=await tx.$queryRaw<Row[]>`SELECT id,game_id,round_id,eventreihe_id,status,revision,started_at,round_snapshot,design_snapshot,audience_key,start_request_hash FROM pubquiz.bingo_live_runs WHERE game_id=${gameId}::uuid AND (${runId??null}::uuid IS NULL OR id=${runId??null}::uuid) ORDER BY started_at DESC,id DESC LIMIT 1`;const row=prepareNew&&!runId&&selected?.status==="ENDED"?undefined:selected;if(runId&&!row)throw Error("RUN_NOT_FOUND");
  if(row&&!(await tx.$queryRaw<{run_id:string}[]>`SELECT run_id FROM pubquiz.bingo_event_runs WHERE run_id=${row.id}::uuid`).length)throw Error("LEGACY_RUN");
  const loaded=row?await load(tx,row):null,round=loaded?currentEventRound(loaded.state):null;
  const at=Math.max(await clock(tx),loaded?.previousAt??0);
  const plan=row?await tx.$queryRaw<{round_id:string;position:number}[]>`SELECT round_id,position FROM pubquiz.bingo_event_round_plan WHERE run_id=${row.id}::uuid ORDER BY position`:[];
  const rounds=await tx.bingo_rounds.findMany({where:{game_id:gameId},orderBy:{position:"asc"},select:{id:true,position:true,label:true,series:{select:{series_id:true,series:{select:{code:true,card_count:true,wildcard:{select:{series_id:true}}}}}}}});
  const frozenDecks=row?await tx.$queryRaw<{roundId:string;id:string;code:string;count:number;firstOrdinal?:number;lastOrdinal?:number;prefix?:number;wildcard?:boolean}[]>`SELECT rc.round_id AS "roundId",s.id,s.code,count(*)::int AS count,min(c.ordinal)::int AS "firstOrdinal",max(c.ordinal)::int AS "lastOrdinal",l.prefix,EXISTS(SELECT 1 FROM pubquiz.bingo_wildcard_series w WHERE w.series_id=s.id) AS wildcard FROM pubquiz.bingo_event_round_cards rc JOIN pubquiz.bingo_card_series s ON s.id=rc.series_id JOIN pubquiz.bingo_cards c ON c.id=rc.card_id JOIN pubquiz.bingo_series_labels l ON l.series_id=s.id WHERE rc.run_id=${row.id}::uuid AND rc.game_id=${gameId}::uuid GROUP BY rc.round_id,s.id,s.code,l.prefix ORDER BY rc.round_id,s.code`:[];
  const next=plan.find(p=>!loaded?.state.frozen.some(r=>r.id===p.round_id));
  const matching=round&&loaded?.state.frozen.find(f=>f.id===round.id)?.matching,last=round?.draws.at(-1);
  const matchingEntry=matching&&last?await readMatchingEntry(tx,gameId,matching,last.number):null;
  const pageRound=rounds.find(r=>r.id===next?.round_id)??rounds.find(r=>!loaded?.state.frozen.some(f=>f.id===r.id));
  const ceremony=await readCeremony(tx,gameId);
  const raffle=loaded?raffleEntries(loaded.state.tickets??[],loaded.state.run.rounds,[...loaded.cardsByRound.values()].flat(),loaded.state.checks?.map(c=>c.id)??[]):[];
  const raffleCards=[...loaded?.cardsByRound.values()??[]].flat();
  return {ceremony,protocol:2 as const,prepareNew,gameId,title:game.titel,seriesId:game.eventreihe_id,archived:series.ist_archiviert,
   preparationRevision:(await tx.bingo_preparations.findUnique({where:{game_id:gameId}}))?.revision??0,
   rounds,plan,frozenDecks,runs:rows.map(r=>({id:r.id,status:r.status,startedAt:r.started_at.toISOString()})),
   preparationPage:pageRound?Math.floor((pageRound.position-1)/25)+1:1,
   live:row&&loaded&&round?{events:loaded.events.map(e=>({id:e.request_id,at:e.occurred_at.getTime(),actorId:e.actor_id,command:parseEventEnvelope(e.command).input.command})),id:row.id,revision:row.revision,startedAt:row.started_at.getTime(),round:loaded.state.frozen.find(f=>f.id===round.id)!,state:loaded.state,
    raffle:{...raffleSummary(raffle),entries:raffle.map(e=>({...e,cardCode:raffleCards.find(c=>c.id===e.cardId)?.shortCode??e.cardId,roundLabel:loaded.state.frozen.find(r=>r.id===e.roundId)?.label??e.roundId}))},matchingEntry,checkCards:loaded.checkCards,cards:loaded.cardsByRound.get(round.id)??[],design:row.design_snapshot,audienceKey:row.audience_key,serverAt:at,elapsedMs:activeElapsedMs(loaded.state.run,at),
    roundElapsedMs:(loaded.durations.get(round.id)??0)+(round.status==="OPEN"?activeElapsedMs(loaded.state.run,at)-(loaded.starts.get(round.id)??0):0),
    blocked:blockingCalls(loaded.state),callContext:sha256(canonical(callContextData(loaded.state))),between:round.status==="CLOSED"&&loaded.state.run.status!=="ENDED",
    summary:loaded.state.run.rounds.map(r=>({id:r.id,label:loaded.state.frozen.find(f=>f.id===r.id)!.label,draws:r.draws.length,confirmed:r.claims.filter(c=>c.decisions.at(-1)?.action==="CONFIRM").length,activeMs:(loaded.durations.get(r.id)??0)+(r.id===round.id&&r.status==="OPEN"?activeElapsedMs(loaded.state.run,at)-(loaded.starts.get(r.id)??0):0)}))}:null};
 },{isolationLevel:"RepeatableRead"});
 const preparation=await readPreparation(userId,gameId,result.preparationPage,1,true);
 return {...result,preparation};
}
export type EventModerationView=Awaited<ReturnType<typeof readEventModeration>>;
export async function readEventAudience(userId:number,key:string){
 assertUuid(key);return prisma.$transaction(async tx=>{
  await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
  const [row]=await tx.$queryRaw<Row[]>`SELECT r.id,r.game_id,r.round_id,r.eventreihe_id,r.status,r.revision,r.started_at,r.round_snapshot,r.design_snapshot,r.audience_key,r.start_request_hash FROM pubquiz.bingo_live_runs r JOIN pubquiz.bingo_event_runs e ON e.run_id=r.id WHERE r.audience_key=${key}::uuid`;
  if(!row)throw Error("RUN_NOT_FOUND");await preparationContext(tx,userId,row.game_id);
  const loaded=await load(tx,row),{state}=loaded,round=currentEventRound(state);
  const framing=await readCeremony(tx,row.game_id),ceremony=framing.revision===0?{...framing,slide:null}:framing;
  const eventTitle=(await tx.game_drafts.findUniqueOrThrow({where:{id:row.game_id},select:{titel:true}})).titel;
  const ticket=ceremony.runId===row.id&&ceremony.revealCount>=2?raffleEntries(state.tickets??[],state.run.rounds,[...loaded.cardsByRound.values()].flat(),state.checks?.map(c=>c.id)??[]).find(t=>t.number===ceremony.raffleNumber&&t.valid):undefined;
  const winner=ticket?{number:ticket.number,cardCode:[...loaded.cardsByRound.values()].flat().find(c=>c.id===ticket.cardId)?.shortCode??ticket.cardId,roundLabel:state.frozen.find(r=>r.id===ticket.roundId)?.label??ticket.roundId}:null;
  const frozen=state.frozen.find(f=>f.id===round.id)!,last=round.draws.at(-1),matching=frozen.matching;
  const content=matching&&last?audienceMatching(await readMatchingEntry(tx,row.game_id,matching,last.number),state.revealed?.includes(last.id)??false,matching.publication,row.game_id):undefined;
  return {eventTitle,ceremony:{...ceremonyAt(ceremony),raffleNumber:ceremony.revealCount>=2?ceremony.raffleNumber:null},winner,roundColor:frozen.color,id:row.id,revision:row.revision,startedAt:row.started_at.getTime(),status:state.run.status,roundNumber:await plannedRoundNumber(tx,row.id,round.id),label:state.frozen.find(f=>f.id===round.id)!.label,
   termMode:Boolean(state.frozen.find(f=>f.id===round.id)?.terms),labels:Object.fromEntries(round.draws.map(draw=>{const terms=state.frozen.find(f=>f.id===round.id)?.terms;return [draw.number,terms?publishedTerm(terms,draw.number,true,state.revealed?.includes(draw.id)??false):null];}).filter(([,text])=>text!==null)),
   ...(content?{content}:{}),serverAt:Math.max(await clock(tx),state.playback?.at??0),playback:state.playback,target:round.plannedDraws,draws:round.draws,design:row.design_snapshot,assetBase:`/api/bingo/presentation/${key}/assets`,
   phase:round.status==="CLOSED"&&state.run.status!=="ENDED"?"BETWEEN" as const:undefined,
   claims:round.claims.filter(c=>state.checks?.some(check=>check.id===c.id)).map(c=>({id:c.id,stage:c.stage,action:c.decisions.at(-1)?.action??null,needsReview:c.needsReview}))};
 },{isolationLevel:"RepeatableRead"});
}

/** Only the currently authorized evening is searched; known old cards reveal no foreign metadata. */
export async function resolveEveningCard(userId:number,gameId:string,code:string) {
 assertUuid(gameId);
 if(typeof code!=='string'||code.length>64||!code.trim())throw Error('CARD_NOT_FOUND');
 const normalized=code.trim().toUpperCase(),short=isWildcardCode(normalized)?normalized.slice(3):normalized;
 return prisma.$transaction(async tx=>{
  await tx.$executeRaw`SET TRANSACTION READ ONLY`;
  const {game}=await preparationContext(tx,userId,gameId);
  const rows=await tx.$queryRaw<{id:string;game_id:string;ordinal:number;prefix:number;wildcard:boolean;printed_code:string}[]>`SELECT c.id,l.game_id,c.ordinal,l.prefix,c.printed_code,EXISTS(SELECT 1 FROM pubquiz.bingo_wildcard_series w WHERE w.series_id=c.series_id) AS wildcard FROM pubquiz.bingo_cards c JOIN pubquiz.bingo_series_labels l ON l.series_id=c.series_id JOIN pubquiz.game_drafts g ON g.id=l.game_id WHERE g.eventreihe_id=${game.eventreihe_id} AND (upper(c.printed_code)=${normalized} OR c.id::text=${normalized.toLowerCase()} OR (l.prefix=${/^([A-Z]+)-/.test(short)?shortPrefix(short.split('-')[0]):0} AND c.ordinal=${/^[A-Z]+-\d{1,3}$/.test(short)?Number(short.split('-')[1]):0}))`;
  const matches=rows.filter(c=>[c.id,c.printed_code,shortCardCode(c.prefix,c.ordinal,c.wildcard)].some(v=>v.toUpperCase()===normalized));
  const current=matches.filter(c=>c.game_id===gameId);
  if(current.length>1)throw Error('AMBIGUOUS_CARD');
  if(!current.length)throw Error(matches.length?'OLD_CARD':'CARD_NOT_FOUND');
  return current[0].id;
 });
}
function shortPrefix(letters:string) {let n=0;for(const letter of letters)n=n*26+letter.charCodeAt(0)-64;return Number.isSafeInteger(n)&&n<=2147483647?n:0;}

export async function raffleForCeremony(tx:Tx,gameId:string,runId:string){
 assertUuid(runId);const [row]=await tx.$queryRaw<Row[]>`SELECT r.* FROM pubquiz.bingo_live_runs r JOIN pubquiz.bingo_event_runs e ON e.run_id=r.id WHERE r.id=${runId}::uuid AND r.game_id=${gameId}::uuid AND r.id=(SELECT id FROM pubquiz.bingo_live_runs WHERE game_id=${gameId}::uuid ORDER BY started_at DESC,id DESC LIMIT 1) FOR UPDATE OF r`;
 if(!row||row.status!=="ENDED")throw Error("RAFFLE_NOT_READY");const loaded=await load(tx,row);return raffleEntries(loaded.state.tickets??[],loaded.state.run.rounds,[...loaded.cardsByRound.values()].flat(),loaded.state.checks?.map(c=>c.id)??[]);
}

/** Read-only lifecycle gate shared by the ceremony writer, within its existing transaction. */
export async function allEventRoundsClosed(tx:Tx,gameId:string):Promise<boolean>{
 const [row]=await tx.$queryRaw<Row[]>`SELECT r.* FROM pubquiz.bingo_live_runs r WHERE r.game_id=${gameId}::uuid ORDER BY r.started_at DESC,r.id DESC LIMIT 1`;
 if(!row)return false;if(row.status==='ENDED')return true;
 const [event]=await tx.$queryRaw<{version:number}[]>`SELECT version FROM pubquiz.bingo_event_runs WHERE run_id=${row.id}::uuid`;
 if(!event)return false;
 const {state}=await load(tx,row);
 const plan=await tx.$queryRaw<{round_id:string}[]>`SELECT round_id FROM pubquiz.bingo_event_round_plan WHERE run_id=${row.id}::uuid`;
 return plan.length>0&&plan.every(p=>state.run.rounds.some(r=>r.id===p.round_id&&r.status==='CLOSED'));
}
