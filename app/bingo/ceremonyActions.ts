'use server';
import {requireActor} from '@/app/lib/permissions';
import {writeCeremony,type CeremonyCommand} from './ceremonyRepository.server';
export async function saveCeremony(gameId:string,revision:number,command:CeremonyCommand){
  const {actor}=await requireActor();
  try{return {success:true as const,state:await writeCeremony(actor.userId,gameId,revision,command)};}
  catch(error){return {success:false as const,message:({REVISION_CONFLICT:'Ein anderes Fenster hat die Folien geändert. Bitte neu laden.',RAFFLE_OVER_CAPACITY:'Mehr als 90 Lose: alternative Ziehungsmethode fachlich abstimmen.',INVALID_RAFFLE_NUMBER:'Diese Losnummer ist nicht gültig.',RAFFLE_REVIEW_REQUIRED:'Gewinne müssen vor der Abschlussverlosung nachgeprüft werden.',RAFFLE_NOT_READY:'Zuerst Abend abschließen, Abschlussziehung ankündigen und gültige Losnummer eingeben.'} as Record<string,string>)[error instanceof Error?error.message:'']??'Nicht gespeichert. Bitte Angaben, Rechte und Datenbankmigration prüfen.'};}
}
