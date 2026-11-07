import 'server-only';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/app/lib/prisma';
import { Prisma } from '@/app/generated/prisma/client';
import { preparationContext } from './access.server';
import { BingoPreparationError, denied } from './policy';
import { parseTermSet } from './termSet';
import { isGameId } from '@/app/games/gameDraft';
import { writeMatching } from '../matching/repository.server';
/** Each save creates a named revision. No issued snapshot follows mutable library data. */
export async function writeRoundTerms(userId:number,input:unknown){
  if(!input||typeof input!=='object'||Array.isArray(input))throw denied();
  const value=input as Record<string,unknown>;
  if(Object.keys(value).sort().join()!=='config,gameId,revision,roundId'||!isGameId(value.gameId)||!isGameId(value.roundId)||!Number.isSafeInteger(value.revision))throw denied();
  const config=value.config===null?null:parseTermSet(value.config);
  if(config?.version===2)return writeMatching(userId,{gameId:value.gameId as string,roundId:value.roundId as string,revision:Number(value.revision),config});
  return prisma.$transaction(async tx=>{
    const {game}=await preparationContext(tx,userId,value.gameId as string,true);
    const prep=await tx.bingo_preparations.findUnique({where:{game_id:game.id}});
    if(!prep||prep.revision!==value.revision)throw new BingoPreparationError('Die Vorbereitung wurde inzwischen geändert. Bitte neu laden; deine Eingaben bleiben erhalten.');
    const round=await tx.bingo_rounds.findFirst({where:{id:value.roundId as string,game_id:game.id},include:{series:true}});
    if(!round)throw denied();
    if(round.series.length||await tx.bingo_card_series.count({where:{origin_round_id:round.id}}))throw new BingoPreparationError('Diese Runde hat bereits Karten. Ihre Zuordnung bleibt erhalten. Bitte für ein anderes Begriffsset eine neue Runde anlegen.');
    if((await tx.$queryRaw<{id:string}[]>`SELECT f.round_id id FROM pubquiz.bingo_event_rounds f JOIN pubquiz.bingo_live_runs r ON r.id=f.run_id WHERE f.round_id=${round.id}::uuid AND r.status IN ('RUNNING','PAUSED') LIMIT 1`).length)throw new BingoPreparationError('Die gestartete Runde bleibt unverändert.');
    if(config)await tx.bingo_term_sets.create({data:{id:randomUUID(),game_id:game.id,config:config as unknown as Prisma.InputJsonValue},select:{id:true}});
    await tx.bingo_rounds.update({where:{id:round.id},data:{term_snapshot:config?config as unknown as Prisma.InputJsonValue:Prisma.DbNull}});
    await tx.bingo_preparations.update({where:{game_id:game.id},data:{revision:{increment:1}}});
    return {success:true as const};
  });
}
