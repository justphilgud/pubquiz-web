import "server-only";
import type {Prisma} from "@/app/generated/prisma/client";
/** Caller holds product advisory gate 860012. Never take game locks in reverse order. */
export async function assertBingoMayDeactivate(tx:Prisma.TransactionClient,seriesId:number) {
 const rows=await tx.$queryRaw<{title:string}[]>`SELECT g.titel AS title FROM pubquiz.bingo_live_runs r JOIN pubquiz.game_drafts g ON g.id=r.game_id WHERE r.eventreihe_id=${seriesId} AND r.status IN ('RUNNING','PAUSED') ORDER BY r.started_at LIMIT 1`;
 if(rows.length)throw Error(`Bingo „${rows[0].title}“ läuft oder ist pausiert. Bitte das Event zuerst regulär beenden.`);
}
