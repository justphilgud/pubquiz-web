import "server-only";
import {randomUUID} from "node:crypto";
import {prisma} from "@/app/lib/prisma";
import {gameSeriesForActor} from "@/app/games/gameDraftRepository.server";
import {GameDraftError,type GameDraftView} from "@/app/games/gameDraft";
import {parseBingoCreation} from "./eventCreation";
import {canonical,sha256} from "./preparation/printSnapshot";
export async function createBingoEvent(userId:number,input:unknown):Promise<GameDraftView>{
 const parsed=parseBingoCreation(input),hash=sha256(canonical(parsed));
 return prisma.$transaction(async tx=>{
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(860012,${parsed.seriesId})::text`;
  await tx.$queryRaw`SELECT eventreihe_id FROM pubquiz.eventreihen WHERE eventreihe_id=${parsed.seriesId} FOR SHARE`;
  await tx.$queryRaw`SELECT id FROM pubquiz.users WHERE id=${userId} FOR SHARE`;
  await tx.$queryRaw`SELECT benutzer_id FROM pubquiz.benutzer_reihenrollen WHERE benutzer_id=${userId} FOR SHARE`;
  await tx.$queryRaw`SELECT rollenzuweisung_id FROM pubquiz.benutzer_rollenzuweisungen WHERE benutzer_id=${userId} FOR SHARE`;
  if(!(await gameSeriesForActor(tx,userId,"BINGO")).some(c=>c.id===parsed.seriesId&&c.canCreate))throw new GameDraftError("Keine berechtigte, aktive Reihe mit Bingo-Freischaltung.");
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${parsed.requestId},860013))::text`;
  const [old]=await tx.$queryRaw<{game_id:string;created_by:number;request_hash:string}[]>`SELECT game_id,created_by,request_hash FROM pubquiz.bingo_event_creation_requests WHERE request_id=${parsed.requestId}::uuid`;
  if(old&&(old.created_by!==userId||old.request_hash!==hash))throw new GameDraftError("Die Anlageanfrage wurde bereits mit anderen Angaben verwendet.");
  const game=old?await tx.game_drafts.findUniqueOrThrow({where:{id:old.game_id}}):await tx.game_drafts.create({data:{eventart:"BINGO",eventreihe_id:parsed.seriesId,titel:parsed.title,datum:parsed.date?new Date(parsed.date+"T00:00:00Z"):null,uhrzeit:parsed.time||null}});
  if(game.eventreihe_id!==parsed.seriesId||game.eventart!=="BINGO")throw new GameDraftError("Die Eventreihe wurde geändert. Bitte den Eventbestand neu öffnen.");
  if(!old){
   await tx.bingo_preparations.create({data:{game_id:game.id}});
   await tx.bingo_rounds.createMany({data:Array.from({length:parsed.roundCount},(_,i)=>({id:randomUUID(),game_id:game.id,position:i+1,label:`Runde ${i+1}`,planned_draws:30,strategy:"NEW",issued_count:null}))});
   await tx.$executeRaw`INSERT INTO pubquiz.bingo_event_creation_requests(request_id,game_id,created_by,request_hash) VALUES(${parsed.requestId}::uuid,${game.id}::uuid,${userId},${hash})`;
  }
  return {id:game.id,type:"BINGO",title:game.titel,seriesId:game.eventreihe_id,date:game.datum?.toISOString().slice(0,10)??"",time:game.uhrzeit??"",status:"DRAFT",createdAt:game.created_at.toISOString(),updatedAt:game.updated_at.toISOString()};
 },{timeout:30000});
}
