'use server';
import { requireActor } from '@/app/lib/permissions';
import { revalidatePath } from 'next/cache';
import { writeRoundTerms } from './termRepository.server';
import { BingoPreparationError } from './policy';
import { TermSetError } from './termSet';
export async function saveRoundTerms(input:unknown){
  const {actor}=await requireActor();
  try{const result=await writeRoundTerms(actor.userId,input);const gameId=(input as {gameId:string}).gameId;revalidatePath(`/bingo/${gameId}`);revalidatePath(`/bingo/${gameId}/vorbereitung`);return result;}
  catch(error){return {success:false as const,message:error instanceof BingoPreparationError||error instanceof TermSetError?error.message:'Begriffsset konnte nicht gespeichert werden. Bitte Rechte und Angaben prüfen.'};}
}
