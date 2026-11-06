import "server-only";
import { prisma } from "@/app/lib/prisma";
import { gameSeriesForActor } from "@/app/games/gameDraftRepository.server";
import { canonical, sha256 } from "../preparation/printSnapshot";
import { assertUuid } from "./live";

type Target = { mode: "moderation" | "game"; gameId: string; runId?: string; prepareNew?: boolean } | { mode: "audience"; key: string };
/** Only mutable identity/revision metadata. Never select binary or frozen payloads here.
 * A validator is NOT authorization: every conditional request rechecks current policies.
 */
export async function readPollVersion(userId: number, target: Target) {
  if (target.mode === "audience") assertUuid(target.key);
  else { assertUuid(target.gameId); if (target.runId) assertUuid(target.runId); }
  return prisma.$transaction(async tx => {
    await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
    const rows = target.mode === "audience"
      ? await tx.$queryRaw<{id:string;game_id:string;revision:number;status:string;started_at:Date}[]>`
          SELECT id,game_id,revision,status,started_at FROM pubquiz.bingo_live_runs WHERE audience_key=${target.key}::uuid`
      : await tx.$queryRaw<{id:string;game_id:string;revision:number;status:string;started_at:Date}[]>`
          SELECT id,game_id,revision,status,started_at FROM pubquiz.bingo_live_runs WHERE game_id=${target.gameId}::uuid
          AND (${target.mode === "moderation" ? target.runId ?? null : null}::uuid IS NULL OR id=${target.mode === "moderation" ? target.runId ?? null : null}::uuid)
          ORDER BY started_at DESC,id DESC LIMIT 1`;
    const row=rows[0];
    if (target.mode === "audience" && !row || target.mode === "moderation" && target.runId && !row) throw Error("RUN_NOT_FOUND");
    const gameId=target.mode === "audience" ? row.game_id : target.gameId;
    const game=await tx.game_drafts.findUnique({where:{id:gameId},select:{id:true,eventart:true,eventreihe_id:true,titel:true,updated_at:true}});
    if (!game || game.eventart !== "BINGO") throw Error("RUN_NOT_FOUND");
    // Same live/preparation policy, including active account, enabled product and manager role.
    const series=(await gameSeriesForActor(tx,userId,"BINGO")).find(s=>s.id===game.eventreihe_id && s.canWrite);
    if (!series) throw Error("RUN_NOT_FOUND");
    const archive=await tx.eventreihen.findUniqueOrThrow({where:{eventreihe_id:game.eventreihe_id},select:{ist_archiviert:true}});
    const preparation=target.mode === "moderation" ? await tx.bingo_preparations.findUnique({where:{game_id:gameId},select:{revision:true}}) : null;
    const history=target.mode === "moderation" ? await tx.$queryRaw<{version:string}[]>`
      SELECT md5(coalesce(string_agg(id::text || status || started_at::text,',' ORDER BY started_at,id),'')) AS version
      FROM pubquiz.bingo_live_runs WHERE game_id=${gameId}::uuid` : [];
    const [{at}]=await tx.$queryRaw<{at:Date}[]>`SELECT clock_timestamp()::timestamptz(3) AS at`;
    // Before start (and explicit new preparation), resolve the mutable design as before.
    const cacheable=Boolean(row) && !(target.mode === "moderation" && target.prepareNew && !target.runId && row.status === "ENDED");
    return {etag:cacheable ? '"bingo-' + sha256(canonical({target:{...target,runId:target.mode==="moderation" ? target.runId??null : null},row:row ? {...row,started_at:row.started_at.toISOString()} : null,game:{...game,updated_at:game.updated_at.toISOString()},archived:archive.ist_archiviert,preparation,history})) + '"' : null,serverAt:at.getTime()};
  },{isolationLevel:"RepeatableRead"});
}

export function pollResponseHeaders(version: Awaited<ReturnType<typeof readPollVersion>>) {
  return {"Cache-Control":"private, no-store", "X-Bingo-Server-At":String(version.serverAt), ...(version.etag ? {ETag:version.etag} : {})};
}
