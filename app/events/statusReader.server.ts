import "server-only";
import {parseEventEnvelope} from "@/app/bingo/live/eventEnvelope";
import type {Prisma} from "@/app/generated/prisma/client";
import {prisma} from "@/app/lib/prisma";
/** IDs originate only from an already authorized collection. Never initializes a run. */
export async function readBingoStatuses(gameIds:readonly string[],database:Pick<Prisma.TransactionClient,"bingo_live_runs">=prisma):Promise<Record<string,string>> {
 if(!gameIds.length)return {};
 const rows=await database.bingo_live_runs.findMany({where:{game_id:{in:[...gameIds]}},select:{game_id:true,status:true,started_at:true,id:true,events:{where:{event_round_id:{not:null},OR:["startRound","closeRound"].map(kind=>({command:{path:["input","command","kind"],equals:kind}}))},orderBy:{revision:"desc"},take:1,select:{command:true}}},orderBy:[{started_at:"desc"},{id:"desc"}]});
 const result:Record<string,string>={};for(const r of rows)if(!(r.game_id in result))result[r.game_id]=r.status==="ENDED"?"Beendet":r.status==="PAUSED"?(r.events[0]&&parseEventEnvelope(r.events[0].command).input.command.kind==="closeRound"?"Zwischen den Runden":"Pause"):"Läuft";
 return result;
}
