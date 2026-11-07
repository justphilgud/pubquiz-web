import 'server-only';
import {prisma} from '@/app/lib/prisma';
import {summarizeBingoRounds,type BingoOverviewStats} from './bingoOverviewPolicy';
/** Only IDs from the immediately preceding authorized game collection; never initializes anything. */
export async function readBingoOverviewStats(gameIds:readonly string[]):Promise<Record<string,BingoOverviewStats>>{
 if(!gameIds.length)return {};
 const rounds=await prisma.bingo_rounds.findMany({where:{game_id:{in:[...gameIds]}},select:{game_id:true,issued_count:true,series:{select:{series_id:true,series:{select:{card_count:true}}}}}});
 return Object.fromEntries(gameIds.map(id=>[id,summarizeBingoRounds(rounds.filter(r=>r.game_id===id))]));
}
