import 'server-only';
import type {Prisma} from '@/app/generated/prisma/client';
import {prisma} from '@/app/lib/prisma';
import {preparationContext} from './preparation/access.server';
import {ceremonyAt,parseCeremony,parseCeremonyConfig,CEREMONY_SLIDES,type CeremonyState,type CeremonySlideId} from '@/app/rendering/ceremony/ceremony';
import {raffleForCeremony} from './live/eventRepository.server';
import {selectRaffleWinner} from './live/raffle';

export async function readCeremony(tx:Prisma.TransactionClient,gameId:string):Promise<CeremonyState>{
  const [available]=await tx.$queryRaw<{present:string|null}[]>`SELECT to_regclass('pubquiz.game_ceremonies')::text present`;
  if(!available.present)return parseCeremony(null);
  const [row]=await tx.$queryRaw<{state:unknown}[]>`SELECT state FROM pubquiz.game_ceremonies WHERE game_id=${gameId}::uuid`;
  return parseCeremony(row?.state);
}
export type CeremonyCommand={kind:'configure';config:unknown}|{kind:'show';slide:CeremonySlideId|null;placement?:string}|{kind:'reveal'}|{kind:'draw';number:number;runId:string}|{kind:'media';action:'play'|'pause'|'stop'};
export async function writeCeremony(userId:number,gameId:string,revision:number,command:CeremonyCommand){
  if(!Number.isSafeInteger(revision)||revision<0)throw Error('INVALID_REVISION');
  return prisma.$transaction(async tx=>{
    await preparationContext(tx,userId,gameId,true);
    const previous=await readCeremony(tx,gameId);
    if(previous.revision!==revision)throw Error('REVISION_CONFLICT');
    const active=ceremonyAt(previous);
    let next={...previous,revision:revision+1};
    if(command.kind==='configure'){
      next={...next,placement:undefined,config:parseCeremonyConfig(command.config),slide:null,revealCount:0,media:{action:'stop',commandId:next.revision}};
    }else if(command.kind==='show'){
      const selection={...previous,placement:command.placement};
      if(command.placement&&!previous.config.insertions?.[command.placement])throw Error('INVALID_CEREMONY');
      if(command.slide!==null&&!ceremonyAt(selection).config.enabled.includes(command.slide))throw Error('CEREMONY_DISABLED');
      if(command.slide!==null&&!CEREMONY_SLIDES.some(s=>s.id===command.slide))throw Error('INVALID_CEREMONY');
      const [run]=await tx.$queryRaw<{status:string}[]>`SELECT status FROM pubquiz.bingo_live_runs WHERE game_id=${gameId}::uuid ORDER BY started_at DESC,id DESC LIMIT 1`;
      if(command.slide==='raffle'&&run?.status!=='ENDED')throw Error('RAFFLE_NOT_READY');
      next={...next,placement:command.placement,slide:command.slide,revealCount:command.slide==='raffle'?previous.raffleRevealCount??0:0,media:{action:'stop',commandId:next.revision}};
    }else if(command.kind==='media'){
      if(!['play','pause','stop'].includes(command.action))throw Error('INVALID_CEREMONY');
      if(previous.slide!=='countdown'&&previous.slide!=='announcements')throw Error('INVALID_CEREMONY');
      next={...next,media:{action:command.action,commandId:next.revision}};
    }else if(command.kind==='draw'){
      if(previous.slide!=='raffle'||previous.revealCount!==1||previous.raffleNumber!==null)throw Error('RAFFLE_NOT_READY');
      const entries=await raffleForCeremony(tx,gameId,command.runId);
      selectRaffleWinner(entries,command.number);
      next={...next,raffleNumber:command.number,runId:command.runId};
    }else if(command.kind==='reveal'){
      const maximum=previous.slide==='prizes'?active.config.prizes.filter(p=>p.trim()).length:previous.slide==='raffle'?3:0;
      if(previous.revealCount>=maximum)throw Error('CEREMONY_COMPLETE');
      if(previous.slide==='raffle'&&previous.revealCount>=1){
        if(!previous.runId||previous.raffleNumber===null)throw Error('RAFFLE_NOT_READY');
        selectRaffleWinner(await raffleForCeremony(tx,gameId,previous.runId),previous.raffleNumber);
      }
      next={...next,revealCount:previous.revealCount+1,...(previous.slide==='raffle'?{raffleRevealCount:previous.revealCount+1}:{})};
    }else throw Error('INVALID_CEREMONY');
    if(next.placement===undefined)delete next.placement;
    next=parseCeremony(next);
    await tx.$executeRaw`INSERT INTO pubquiz.game_ceremonies(game_id,state) VALUES(${gameId}::uuid,${JSON.stringify(next)}::jsonb) ON CONFLICT(game_id) DO UPDATE SET state=EXCLUDED.state,updated_at=clock_timestamp()`;
    // The existing conditional polling already incorporates the event timestamp.
    await tx.$executeRaw`UPDATE pubquiz.game_drafts SET updated_at=greatest(clock_timestamp(),updated_at+interval '1 millisecond') WHERE id=${gameId}::uuid`;
    return next;
  },{timeout:30000});
}
