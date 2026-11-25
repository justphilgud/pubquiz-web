import {requireActor} from '@/app/lib/permissions';
import {createEveningPdf} from '../../../preparation/eveningPrint.server';
export const runtime='nodejs';
export const maxDuration=60;
export async function GET(request:Request,{params}:{params:Promise<{gameId:string}>}) {
  const {actor}=await requireActor(),{gameId}=await params,q=new URL(request.url).searchParams;
  try {
    if(q.getAll('job').length!==1||[...q.keys()].some(k=>k!=='job'))throw Error('Bitte einen eindeutigen Druckauftrag auswählen.');
    const bytes=await createEveningPdf(actor.userId,gameId,q.get('job')!);
    return new Response(Buffer.from(bytes),{headers:{'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="bingo-abend-${q.get('job')}.pdf"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
  }catch(error){return new Response(error instanceof Error?error.message:'Druckauftrag fehlgeschlagen.',{status:400,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'private, no-store'}});}
}
