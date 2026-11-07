import {auth} from '@/auth';
import {prisma} from '@/app/lib/prisma';
import {preparationContext} from '@/app/bingo/preparation/access.server';
import {readMatchingEntry} from '@/app/bingo/matching/repository.server';
import {parseRoundSnapshot} from '@/app/bingo/live/roundSnapshot';
import {assertUuid} from '@/app/bingo/live/live';
export async function GET(request:Request,{params}:{params:Promise<{gameId:string}>}){
 const session=await auth();if(!session?.user?.id)return new Response(null,{status:401});
 try{const {gameId}=await params,url=new URL(request.url),runId=url.searchParams.get('run');assertUuid(runId);const number=Number(url.searchParams.get('number'));
  const entry=await prisma.$transaction(async tx=>{await preparationContext(tx,Number(session.user!.id),gameId);const [row]=await tx.$queryRaw<{round_snapshot:unknown}[]>`SELECT f.round_snapshot FROM pubquiz.bingo_event_rounds f JOIN pubquiz.bingo_live_runs r ON r.id=f.run_id WHERE f.run_id=${runId}::uuid AND f.game_id=${gameId}::uuid ORDER BY f.opened_at DESC LIMIT 1`;if(!row)throw Error('NOT_FOUND');const round=parseRoundSnapshot(row.round_snapshot);if(!round.matching)throw Error('NOT_FOUND');return readMatchingEntry(tx,gameId,round.matching,number);});return Response.json(entry,{headers:{'Cache-Control':'private, no-store'}});
 }catch{return new Response(null,{status:404});}
}
