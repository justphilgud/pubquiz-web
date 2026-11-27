import {evaluateClaim,isConfirmed,type BingoRound} from '../core/round';
import type {BingoCard,LineId} from '../core/cards';

export type RaffleTicket = {number:number;roundId:string;cardId:string;line:LineId;claimIds:string[]};
export type RaffleEntry = RaffleTicket & {valid:boolean;needsReview:boolean;blocksDraw?:boolean};
const stageSize={BINGO:1,DOUBLE:2,TRIPLE:3} as const;
/** Stable allocation order follows confirmed journal events, never ball numbers. */
export function registerTickets(tickets:readonly RaffleTicket[],round:BingoRound,claimId:string,card:BingoCard):RaffleTicket[] {
  const claim=round.claims.find(c=>c.id===claimId);
  if(!claim||!isConfirmed(claim))return [...tickets];
  const achieved=evaluateClaim(round,claim,card).lines;
  const prior=tickets.filter(t=>t.roundId===round.id&&t.cardId===card.id&&achieved.includes(t.line)).map(t=>t.line);
  const lines=[...new Set([...prior,...achieved])].slice(0,stageSize[claim.stage]);
  const next=tickets.map(t=>({...t,claimIds:[...t.claimIds]}));
  for(const line of lines){
    const existing=next.find(t=>t.roundId===round.id&&t.cardId===card.id&&t.line===line);
    if(existing){if(!existing.claimIds.includes(claimId))existing.claimIds.push(claimId);}
    else next.push({number:next.length+1,roundId:round.id,cardId:card.id,line,claimIds:[claimId]});
  }
  return next;
}
export function raffleEntries(tickets:readonly RaffleTicket[],rounds:readonly BingoRound[],cards:readonly BingoCard[],reviewableClaimIds?:readonly string[]):RaffleEntry[]{
  return tickets.map(ticket=>{
    const round=rounds.find(r=>r.id===ticket.roundId),card=cards.find(c=>c.id===ticket.cardId);
    const claims=round?.claims.filter(c=>ticket.claimIds.includes(c.id)&&isConfirmed(c))??[];
    const direct=reviewableClaimIds?claims.filter(c=>reviewableClaimIds.includes(c.id)):[];
    // An explicit current confirmation may support an existing ticket without
    // rewriting its old manual evidence. Legacy-only uncertain tickets stay void.
    const relevant=direct.length?direct:claims;
    const needsReview=relevant.some(c=>c.needsReview);
    return {...ticket,needsReview,valid:!!round&&!!card&&!needsReview&&relevant.some(c=>evaluateClaim(round,c,card).lines.includes(ticket.line)),...(reviewableClaimIds?{blocksDraw:direct.some(c=>c.needsReview)}:{})};
  });
}
export function raffleSummary(entries:readonly RaffleEntry[]){
  const valid=entries.filter(e=>e.valid),max=valid.at(-1)?.number??0;
  return {count:valid.length,max,overCapacity:max>90,needsReview:entries.some(e=>e.needsReview&&e.blocksDraw!==false),voidNumbers:entries.filter(e=>!e.valid).map(e=>e.number)};
}
export function selectRaffleWinner(entries:readonly RaffleEntry[],number:number){
  const summary=raffleSummary(entries);
  if(summary.overCapacity)throw Error('RAFFLE_OVER_CAPACITY');
  if(summary.needsReview)throw Error('RAFFLE_REVIEW_REQUIRED');
  const winner=entries.find(e=>e.number===number&&e.valid);
  if(!Number.isInteger(number)||!winner)throw Error('INVALID_RAFFLE_NUMBER');
  return winner;
}
