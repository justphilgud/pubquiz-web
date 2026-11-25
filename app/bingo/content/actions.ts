'use server';
import { requireActor } from '@/app/lib/permissions';
import { revalidatePath } from 'next/cache';
import { publishRoundTemplate,saveRoundTemplate } from './repository.server';

export async function saveContent(input:Parameters<typeof saveRoundTemplate>[1]) {
  const {actor}=await requireActor();
  try {const result=await saveRoundTemplate(actor.userId,input);revalidatePath('/bingo/content');return {success:true as const,...result};}
  catch(error){return {success:false as const,message:error instanceof Error?error.message:'Content konnte nicht gespeichert werden.'};}
}
export async function publishContent(gameId:string,roundId:string,revision:number) {
  const {actor}=await requireActor();
  try {const result=await publishRoundTemplate(actor.userId,gameId,roundId,revision);revalidatePath('/bingo/content');return {success:true as const,...result};}
  catch(error){return {success:false as const,message:error instanceof Error?error.message:'Vorlage konnte nicht übernommen werden.'};}
}
