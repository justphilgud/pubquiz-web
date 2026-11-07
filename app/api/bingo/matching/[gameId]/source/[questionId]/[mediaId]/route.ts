import {auth} from '@/auth';
import {prisma} from '@/app/lib/prisma';
import {preparationContext} from '@/app/bingo/preparation/access.server';
import {authorizedSource,matchingMediaRows} from '@/app/bingo/matching/source.server';
import {captureMatchingMedia,matchingMediaResponse} from '@/app/bingo/matching/media.server';
export async function GET(request:Request,{params}:{params:Promise<{gameId:string;questionId:string;mediaId:string}>}){
 const session=await auth();if(!session?.user?.id)return new Response(null,{status:401});
 try{const p=await params,source=await prisma.$transaction(async tx=>{const {game}=await preparationContext(tx,Number(session.user!.id),p.gameId);const q=await authorizedSource(tx,Number(session.user!.id),game.eventreihe_id,Number(p.questionId));const medium=q.view.media.find(m=>m.id===Number(p.mediaId));if(!medium)throw Error('NOT_FOUND');return {url:matchingMediaRows(q.row).find(m=>m.medien_id===medium.id)!.datei,kind:medium.kind};});return matchingMediaResponse(request,await captureMatchingMedia(source.url,source.kind));}catch{return new Response(null,{status:404});}
}
