'use server';
import {requireActor} from '@/app/lib/permissions';
import {revalidatePath} from 'next/cache';
import {MatchingError} from '../preparation/matching';
import {BingoPreparationError} from '../preparation/policy';
import {searchMatchingSources} from './source.server';
import {writeMatching,readRetainedAnswers} from './repository.server';
import {prisma} from '@/app/lib/prisma';
import {preparationContext} from '../preparation/access.server';
import {authorizedSource} from './source.server';
import {matchingMediaRows} from './source.server';
import {matchingMediaAvailable} from './media.server';
export async function getMatchingSource(gameId:string,questionId:number,assetId?:string){
 const retainedActor=assetId?await requireActor():null;
 if(assetId&&retainedActor){try{return {success:true as const,item:{answers:await readRetainedAnswers(retainedActor.actor.userId,gameId,assetId)}};}catch{return {success:false as const};}}
 const {actor}=await requireActor();try{const source=await prisma.$transaction(async tx=>{const {game}=await preparationContext(tx,actor.userId,gameId);return authorizedSource(tx,actor.userId,game.eventreihe_id,questionId);});
  const checked=await Promise.all(source.view.media.map(async m=>({medium:m,available:await matchingMediaAvailable(matchingMediaRows(source.row).find(r=>r.medien_id===m.id)!.datei,m.kind)})));
  const media=checked.filter(m=>m.available).map(m=>m.medium);return {success:true as const,item:{...source.view,media,browserSpeechOnly:source.view.browserSpeechOnly}};
 }catch{return {success:false as const};}
}
export async function findMatchingSources(gameId:string,input:{search:string;template:string;kind:string;page:number}){
 const {actor}=await requireActor();
 try{return {success:true as const,...await searchMatchingSources(actor.userId,gameId,input)};}catch{return {success:false as const,message:'Quellen konnten nicht geladen werden. Bitte aktuelle Rechte und Filter prüfen.'};}
}
export async function saveMatching(input:{gameId:string;roundId:string;revision:number;config:unknown}){
 const {actor}=await requireActor();try{const result=await writeMatching(actor.userId,input);revalidatePath(`/bingo/${input.gameId}`);revalidatePath(`/bingo/${input.gameId}/matching`);return result;}
 catch(e){return {success:false as const,message:e instanceof MatchingError||e instanceof BingoPreparationError?e.message:'Nicht gespeichert. Bitte aktuelle Rechte, Medien und Angaben prüfen. Deine Eingaben bleiben erhalten.'};}
}
