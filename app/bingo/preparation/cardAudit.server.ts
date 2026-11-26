import 'server-only';
import {prisma} from '@/app/lib/prisma';
import {preparationContext} from './access.server';
import {storedCard} from './readExport.server';

/** Explicit, bounded read-only audit of stored cards; never a repair or regeneration. */
export async function auditEveningCards(userId:number,gameId:string) {
  return prisma.$transaction(async tx=>{
    await tx.$executeRaw`SET TRANSACTION READ ONLY`;
    await preparationContext(tx,userId,gameId);
    let after:string|null=null,total=0,invalid=0;
    const examples:string[]=[];
    for(;;) {
      const rows: {id:string;printed_code:string;ordinal:number;cells:unknown;layout_hash:string}[]=await tx.$queryRaw`SELECT c.id,c.printed_code,c.ordinal,c.cells,c.layout_hash FROM pubquiz.bingo_cards c JOIN pubquiz.bingo_card_series s ON s.id=c.series_id WHERE s.game_id=${gameId}::uuid AND (${after}::uuid IS NULL OR c.id>${after}::uuid) ORDER BY c.id LIMIT 500`;
      for(const row of rows){total++;try{storedCard(row);}catch{invalid++;if(examples.length<50)examples.push(row.printed_code);}}
      if(rows.length<500)break;after=rows.at(-1)!.id;
    }
    return {total,invalid,examples,at:new Date().toISOString()};
  },{isolationLevel:'RepeatableRead',timeout:30000});
}
