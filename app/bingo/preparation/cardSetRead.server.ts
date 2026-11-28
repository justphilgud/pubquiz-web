import 'server-only';
import type {Prisma} from '@/app/generated/prisma/client';
import {prisma} from '@/app/lib/prisma';
import {preparationContext} from './access.server';
import {parseCardSetConfig,type CardSetConfig} from './cardSet';
import {BingoPreparationError} from './policy';
import {parseManifest} from './cardSetManifest';
type Tx=Prisma.TransactionClient;
const include={series:{include:{series:{select:{id:true,code:true,card_count:true,origin_round_id:true}}}}} as const;
export async function roundsFor(tx:Tx,gameId:string){return tx.bingo_rounds.findMany({where:{game_id:gameId},orderBy:{position:'asc'},include});}
export async function stock(tx:Tx,gameId:string,roundId:string,wildcard:boolean){
 return tx.bingo_cards.findMany({where:{series:{game_id:gameId,rounds:{some:{round_id:roundId}},wildcard:wildcard?{is:{round_id:roundId}}:{is:null}}},orderBy:[{series:{created_at:'asc'}},{series_id:'asc'},{ordinal:'asc'}],select:{id:true,series_id:true}});
}
export async function stockCount(tx:Tx,gameId:string,roundId:string,wildcard:boolean){
 return tx.bingo_cards.count({where:{series:{game_id:gameId,rounds:{some:{round_id:roundId}},wildcard:wildcard?{is:{round_id:roundId}}:{is:null}}}});
}
export function normalized(config:CardSetConfig,rounds:Awaited<ReturnType<typeof roundsFor>>){
 if(config.rounds.length!==rounds.length||rounds.some(r=>!config.rounds.some(c=>c.id===r.id)))throw new BingoPreparationError('Runden wurden geändert. Bitte neu laden.');
 return {...config,rounds:rounds.map(r=>config.rounds.find(c=>c.id===r.id)!)};
}
async function configFor(tx:Tx,gameId:string,rounds:Awaited<ReturnType<typeof roundsFor>>){
 const saved=await tx.bingo_card_set_settings.findUnique({where:{game_id:gameId}});
 const old=saved?parseCardSetConfig(saved.config):null;
 return {version:1 as const,defaultCount:old?.defaultCount??100,wildcards:old?.wildcards??0,rounds:rounds.map(r=>old?.rounds.find(c=>c.id===r.id)??{id:r.id,selected:true,count:null})};
}
export async function readCardSet(userId:number,gameId:string){
 return prisma.$transaction(async tx=>{
  await tx.$executeRaw`SET TRANSACTION READ ONLY`;
  const {game,series}=await preparationContext(tx,userId,gameId),rounds=await roundsFor(tx,gameId);
  const prep=await tx.bingo_preparations.findUnique({where:{game_id:gameId}});
  const config=await configFor(tx,gameId,rounds);
  const sets=await tx.bingo_evening_card_sets.findMany({where:{game_id:gameId},orderBy:[{created_at:'desc'},{id:'desc'}],take:20});
  return {gameId,seriesId:game.eventreihe_id,revision:prep?.revision??0,archived:series.ist_archiviert,config,
   rounds:await Promise.all(rounds.map(async r=>({id:r.id,label:r.label,position:r.position,special:r.term_snapshot!==null,stock:await stockCount(tx,gameId,r.id,false)}))),
   wildcardStock:rounds.length?await stockCount(tx,gameId,rounds.at(-1)!.id,true):0,
   sets:sets.map(s=>{const m=parseManifest(s.manifest);return {id:s.id,at:s.created_at.toISOString(),cards:m.sections.reduce((n,x)=>n+x.cardIds.length,0),pages:m.sections.reduce((n,x)=>n+2*Math.ceil(x.cardIds.length/12),0)};})};
 },{isolationLevel:'RepeatableRead'});
}
