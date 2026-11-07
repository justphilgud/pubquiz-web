import {auth} from '@/auth';
import {readMatchingAsset} from '@/app/bingo/matching/repository.server';
import {matchingMediaResponse} from '@/app/bingo/matching/media.server';
export async function GET(request:Request,{params}:{params:Promise<{gameId:string;assetId:string}>}){
 const session=await auth();if(!session?.user?.id)return new Response(null,{status:401});
 try{const p=await params;return matchingMediaResponse(request,await readMatchingAsset(Number(session.user.id),p.gameId,p.assetId,request.headers.get('range')));}catch{return new Response(null,{status:404});}
}
