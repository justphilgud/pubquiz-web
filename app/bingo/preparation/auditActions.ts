'use server';
import {requireActor} from '@/app/lib/permissions';
import {auditEveningCards} from './cardAudit.server';
export async function auditStoredCards(gameId:string) {
  const {actor}=await requireActor();
  try{return {success:true as const,...await auditEveningCards(actor.userId,gameId)};}
  catch{return {success:false as const,message:'Kartenprüfung konnte nicht abgeschlossen werden. Rechte und Verbindung prüfen; keine Karte wurde verändert.'};}
}
