import {requireActor} from '@/app/lib/permissions';
import {createCardSetPdf} from '../../../preparation/cardSetPdf.server';
export const runtime='nodejs';
export const maxDuration=60;
export async function GET(request:Request,{params}:{params:Promise<{gameId:string}>}){
 const {actor}=await requireActor(),{gameId}=await params,q=new URL(request.url).searchParams;
 try{
  if(q.getAll('set').length!==1||[...q.keys()].some(k=>k!=='set'))throw Error('Bitte einen eindeutigen Kartensatz auswählen.');
  const bytes=await createCardSetPdf(actor.userId,gameId,q.get('set')!);
  return new Response(Buffer.from(bytes),{headers:{'Content-Type':'application/pdf','Content-Disposition':`inline; filename="bingo-kartensatz-${q.get('set')}.pdf"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 }catch{return new Response('Kartensatz nicht verfügbar. Bitte Auswahl und Zugriffsrecht prüfen.',{status:400,headers:{'Cache-Control':'private, no-store'}});}
}
