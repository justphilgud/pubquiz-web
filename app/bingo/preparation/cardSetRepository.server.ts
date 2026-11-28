import {parseManifest,type CardSetManifest} from './cardSetManifest';
import 'server-only';
import type {Prisma} from '@/app/generated/prisma/client';
import {prisma} from '@/app/lib/prisma';
import {preparationContext} from './access.server';
import {generateRound,generationSnapshot} from './repository.server';
import {canonical,parsePrintSnapshot,sha256} from './printSnapshot';
import {BingoPreparationError,denied} from './policy';
import {parseCardSetConfig,cardQuantity,cardSetSummary,type CardSetConfig} from './cardSet';
import {assertUuid} from '../live/live';

import {roundsFor,stock,normalized} from './cardSetRead.server';
type WriteInput={gameId:string;expectedSeriesId:number;revision:number;requestId:string;operation:'save'|'prepare'|'extra';config:CardSetConfig;roundId?:string;wildcard?:boolean;count?:number};
function parseWrite(input:unknown):WriteInput{
 if(!input||typeof input!=='object'||Array.isArray(input))throw denied();
 const c=input as WriteInput;
 const allowed=c.operation==='extra'?'config,count,expectedSeriesId,gameId,operation,requestId,revision,roundId,wildcard':'config,expectedSeriesId,gameId,operation,requestId,revision';
 if(Object.keys(c).sort().join()!==allowed||!['save','prepare','extra'].includes(c.operation)||!Number.isSafeInteger(c.revision)||c.revision<0||!Number.isSafeInteger(c.expectedSeriesId))throw denied();
 assertUuid(c.gameId);assertUuid(c.requestId);if(c.operation==='extra'){assertUuid(c.roundId);cardQuantity(c.count);if(typeof c.wildcard!=='boolean')throw denied();}
 return {...c,config:parseCardSetConfig(c.config)};
}
/** All writes share the existing game lock/CAS and generator. Downloads never call this. */
export async function writeCardSet(userId:number,input:unknown){
 const c=parseWrite(input),hash=sha256(canonical(c));
 return prisma.$transaction(async tx=>{
  const {game,series}=await preparationContext(tx,userId,c.gameId,true);
  if(game.eventreihe_id!==c.expectedSeriesId)throw denied();
  if(c.operation==='prepare'){
   const old=await tx.bingo_evening_card_sets.findFirst({where:{id:c.requestId,game_id:game.id}});
   if(old){if(old.request_hash!==hash)throw new BingoPreparationError('Diese Anfrage wurde bereits mit anderen Angaben verwendet.');return {setId:old.id};}
  }
  if(c.operation==='extra'){
   const old=await tx.bingo_card_series.findUnique({where:{game_id_request_id:{game_id:game.id,request_id:c.requestId}}});
   if(old){if(old.request_hash!==hash)throw new BingoPreparationError('Diese Anfrage wurde bereits mit anderen Angaben verwendet.');return {};}
  }
  const prep=await tx.bingo_preparations.upsert({where:{game_id:game.id},create:{game_id:game.id},update:{}});
  if(prep.revision!==c.revision)throw new BingoPreparationError('Vorbereitung wurde geändert. Bitte neu laden; deine Eingaben bleiben erhalten.');
  const rounds=await roundsFor(tx,game.id),config=normalized(c.config,rounds),last=rounds.at(-1);
  if(config.wildcards&&!last)throw new BingoPreparationError('Wildcards benötigen eine letzte Runde. Bitte zuerst eine Runde anlegen.');
  const live=await tx.bingo_live_runs.count({where:{game_id:game.id,status:{in:['RUNNING','PAUSED']}}});
  const generate=async (round:typeof rounds[number],count:number,wildcard:boolean,requestId:string)=>{
   if(live)throw new BingoPreparationError('Während eines laufenden Abends keine neuen Karten. Gespeicherte Sätze bleiben druckbar.');
   // Ended/frozen decks are immutable, even though the evening is no longer active.
   if(await tx.bingo_event_round_cards.count({where:{game_id:game.id,round_id:round.id}})||await tx.bingo_live_runs.count({where:{game_id:game.id,round_id:round.id}}))throw new BingoPreparationError('Diese Runde wurde bereits verwendet. Keine weiteren Karten für ihren Bestand.');
   const before=new Set((await tx.bingo_card_series.findMany({where:{game_id:game.id},select:{id:true}})).map(s=>s.id));
   await generateRound(tx,userId,game,series,wildcard?{...round,strategy:'NEW'}:round,{operation:'generate',gameId:game.id,expectedSeriesId:game.eventreihe_id,revision:c.revision,roundId:round.id,count,requestId,printLayout:{format:'SRA3_TWELVE',cardProfile:'A4_FOUR'}},hash,wildcard);
   if(wildcard){
    const chunks=await tx.bingo_card_series.findMany({where:{game_id:game.id,origin_round_id:round.id,request_hash:hash},select:{id:true}});
    await tx.bingo_wildcard_series.createMany({data:chunks.filter(s=>!before.has(s.id)).map(s=>({series_id:s.id,game_id:game.id,round_id:round.id}))});
   }
  };
  if(c.operation==='extra'){
   const round=rounds.find(r=>r.id===c.roundId);if(!round)throw denied();
   if(c.wildcard&&last?.id!==round.id)throw new BingoPreparationError('Wildcards sind nur für die tatsächliche letzte Runde vorgesehen.');
   const current=await stock(tx,game.id,round.id,c.wildcard!);
   if(current.length+c.count!>1000)throw new BingoPreparationError('Höchstens 1000 Karten je Bestand im neuen Kartensatz.');
   await generate(round,c.count!,c.wildcard!,c.requestId);
  }
  let setId:string|undefined;
  if(c.operation==='prepare'){
   const summary=cardSetSummary(config);if(!summary.cards)throw new BingoPreparationError('Bitte mindestens eine Runde oder Wildcards auswählen.');
   const manifest:CardSetManifest={version:1,title:game.titel,sections:[]};
   const sections=[...summary.sections.map(s=>({...s,wildcard:false})),...(config.wildcards?[{id:last!.id,count:config.wildcards,wildcard:true}]:[])];
   // Validate every section before saving any result; the transaction rolls back on any failure.
   for(const [index,section] of sections.entries()){
    const round=rounds.find(r=>r.id===section.id)!;
    const snapshot=await generationSnapshot(tx,game,series,round,{format:'SRA3_TWELVE',cardProfile:'A4_FOUR'},section.wildcard);
    let existing=await stock(tx,game.id,round.id,section.wildcard);
    if(!existing.length){
     const unassigned=await tx.bingo_card_series.count({where:{game_id:game.id,origin_round_id:round.id,wildcard:section.wildcard?{is:{round_id:round.id}}:{is:null}}});
     if(unassigned)throw new BingoPreparationError(`${section.wildcard?'Wildcards':round.label}: Karten wurden bereits angelegt. Bitte die vorhandene Serie wieder zuordnen oder ausdrücklich Zusatzkarten erzeugen.`);
     const key=sha256(c.requestId+':'+index);const requestId=`${key.slice(0,8)}-${key.slice(8,12)}-4${key.slice(13,16)}-a${key.slice(17,20)}-${key.slice(20,32)}`;await generate(round,section.count,section.wildcard,requestId);existing=await stock(tx,game.id,round.id,section.wildcard);
    }
    if(existing.length<section.count)throw new BingoPreparationError(`${section.wildcard?'Wildcards':round.label}: ${existing.length} vorhanden, ${section.count} geplant. Bitte ausdrücklich „Zusatzkarten erzeugen“ verwenden.`);
    const chosen=existing.slice(0,section.count),seriesIds=[...new Set(chosen.map(x=>x.series_id))];
    const originals=await tx.bingo_card_series.findMany({where:{id:{in:seriesIds},game_id:game.id},select:{print_snapshot:true}});
    for(const original of originals){const p=parsePrintSnapshot(original.print_snapshot);if(canonical((p.version===3||p.version===4)?p.terms:null)!==canonical(round.term_snapshot))throw new BingoPreparationError(`${round.label}: Gespeicherte Karten und heutiger Rundeninhalt unterscheiden sich. Keine Umdeutung vorhandener Karten.`);}
    manifest.sections.push({roundId:round.id,label:section.wildcard?`Wildcards · letzte Runde ${rounds.length}`:`Runde ${rounds.findIndex(r=>r.id===round.id)+1}: ${round.label}`,wildcard:section.wildcard,cardIds:chosen.map(x=>x.id),snapshot});
   }
   await tx.bingo_evening_card_sets.create({data:{id:c.requestId,game_id:game.id,request_hash:hash,manifest:parseManifest(manifest) as unknown as Prisma.InputJsonValue,created_by:userId}});setId=c.requestId;
  }
  await tx.bingo_card_set_settings.upsert({where:{game_id:game.id},create:{game_id:game.id,config:config as unknown as Prisma.InputJsonValue},update:{config:config as unknown as Prisma.InputJsonValue}});
  await tx.bingo_preparations.update({where:{game_id:game.id},data:{revision:{increment:1}}});
  return {setId};
 },{timeout:60000});
}
