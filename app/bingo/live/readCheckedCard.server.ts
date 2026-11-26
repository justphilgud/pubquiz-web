import 'server-only';
import {prisma} from '@/app/lib/prisma';
import {preparationContext} from '../preparation/access.server';
import {parseTermSet} from '../preparation/termSet';
import {assertUuid} from './live';

/** Full card labels are loaded only when explicitly opening a proof, never in polling. */
export async function readCheckedCardContent(userId:number,gameId:string,cardId:string) {
  assertUuid(cardId);
  return prisma.$transaction(async tx=>{
    await tx.$executeRaw`SET TRANSACTION READ ONLY`;
    await preparationContext(tx,userId,gameId);
    const [row]=await tx.$queryRaw<{terms:unknown}[]>`SELECT s.print_snapshot->'terms' AS terms FROM pubquiz.bingo_cards c JOIN pubquiz.bingo_card_series s ON s.id=c.series_id WHERE c.id=${cardId}::uuid AND s.game_id=${gameId}::uuid`;
    if(!row)throw Error('CARD_OR_CALL_NOT_FOUND');
    return row.terms==null?null:parseTermSet(row.terms);
  });
}
