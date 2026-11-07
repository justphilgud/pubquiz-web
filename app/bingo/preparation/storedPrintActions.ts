"use server";
import { createReferenceCardsPdf } from './pdfReference.server';

import { requireActor } from '@/app/lib/permissions';
import { readExport } from './readExport.server';
import { geometry } from './printFormats';
import { createModernCardsPdf } from './pdfModern.server';
import { createCardsPdf } from './pdf.server';
import { BingoPreparationError } from './policy';
const failure=(error:unknown)=>({success:false as const,message:error instanceof BingoPreparationError?error.message:'Der gespeicherte Druckstand konnte nicht gelesen werden. Bitte Angaben und Berechtigung prüfen.'});
export async function getStoredPrintPreview(input:{gameId:string;seriesId:string;version:number;ordinal:number}){
 const {actor}=await requireActor();try{
  if(!input||Object.keys(input).sort().join()!=='gameId,ordinal,seriesId,version')throw new BingoPreparationError('Ungültige Druckvorschau.');
  const first=await readExport(actor.userId,input.gameId,input.seriesId,input.ordinal,input.ordinal,input.version);
  const capacity=(first.snapshot.version===3||first.snapshot.version===4)?geometry(first.snapshot.settings.layout!.format).capacity:4;
  const range=await readExport(actor.userId,input.gameId,input.seriesId,input.ordinal,Math.min(first.count,input.ordinal+capacity-1),input.version);
  const front=first.snapshot.version===4?await createReferenceCardsPdf(first.snapshot,first.cards,'front',true):first.snapshot.version===3?await createModernCardsPdf(first.snapshot,first.cards,'front',true):await createCardsPdf(first.snapshot,first.cards,'front');
  const back=first.snapshot.version===1?undefined:first.snapshot.version===4?await createReferenceCardsPdf(first.snapshot,first.cards,'back',true):first.snapshot.version===3?await createModernCardsPdf(first.snapshot,first.cards,'back',true):await createCardsPdf(first.snapshot,first.cards,'back');
  const sheet=await createCardsPdf(range.snapshot,range.cards,range.snapshot.version===1?'front':'duplex');
  return {success:true as const,hash:`stored-${input.seriesId}-${input.version}-${input.ordinal}`,front:Buffer.from(front).toString('base64'),...(back?{back:Buffer.from(back).toString('base64')}:{ }),sheet:Buffer.from(sheet).toString('base64')};
 }catch(error){return failure(error);}
}
