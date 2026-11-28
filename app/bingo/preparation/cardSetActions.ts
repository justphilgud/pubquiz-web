'use server';
import {requireActor} from '@/app/lib/permissions';
import {revalidatePath} from 'next/cache';
import {writeCardSet} from './cardSetRepository.server';
import {BingoPreparationError} from './policy';
export async function saveCardSet(input:unknown){
 const {actor}=await requireActor();
 try{const result=await writeCardSet(actor.userId,input);const id=(input as {gameId:string}).gameId;for(const path of [`/bingo/${id}`,`/bingo/${id}/karten`,`/bingo/${id}/vorbereitung`])revalidatePath(path);return {success:true as const,...result};}
 catch(error){return {success:false as const,message:error instanceof BingoPreparationError?error.message:'Kartensatz konnte nicht gespeichert werden. Eingaben bleiben erhalten; dieselbe Anfrage erneut versuchen.'};}
}
