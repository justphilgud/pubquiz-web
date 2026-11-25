import { notFound } from 'next/navigation';
import { requireActor } from '@/app/lib/permissions';
import { readEventModeration } from '../../../live/eventRepository.server';
import {readCheckedCardContent} from '../../../live/readCheckedCard.server';
import CardCheckView from '../../../live/CardCheckView';

export default async function Page({params,searchParams}:{params:Promise<{gameId:string;checkId:string}>;searchParams:Promise<{run?:string}>}) {
  const {actor}=await requireActor(),{gameId,checkId}=await params,{run}=await searchParams;
  const data=await readEventModeration(actor.userId,gameId,run).catch(()=>notFound());
  const check=data.live?.state.checks?.find(c=>c.id===checkId);
  const card=data.live?.checkCards.find(c=>c.id===check?.cardId);
  const round=data.live?.state.run.rounds.find(r=>r.id===check?.roundId);
  if(!check||!card||!round)notFound();
  const terms=await readCheckedCardContent(actor.userId,gameId,card.id).catch(()=>notFound());
  return <main style={{maxWidth:900,margin:'32px auto',padding:24}}><p>{data.title}</p><CardCheckView card={{...card,terms}} check={check} correctedDraws={round.draws}/></main>;
}
