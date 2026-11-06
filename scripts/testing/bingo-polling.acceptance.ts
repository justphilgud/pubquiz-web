import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import type {Client} from "pg";
import type * as Preparation from "../../app/bingo/preparation/repository.server";
import type * as Creation from "../../app/bingo/eventCreation.server";
import type * as Live from "../../app/bingo/live/repository.server";
import type * as Events from "../../app/bingo/live/eventRepository.server";
import type * as Polling from "../../app/bingo/live/pollVersion.server";
import type * as Route from "../../app/api/bingo/live/[gameId]/route";

type Api=typeof Preparation & {live:typeof Live;creation:typeof Creation;eventRun:typeof Events;polling:typeof Polling;pollRoute:typeof Route};
export async function exerciseBingoPolling(db:Client,api:Api,queries:string[]){
 const game=await api.creation.createBingoEvent(1,{seriesId:10,title:"Large-asset polling regression",date:"",time:"",roundCount:1,requestId:randomUUID()});
 let prep=await api.readPreparation(1,game.id);
 await api.writePreparation(1,{gameId:game.id,expectedSeriesId:10,revision:prep.revision,operation:"generate",roundId:prep.rounds[0].id,count:3,requestId:randomUUID()});prep=await api.readPreparation(1,game.id);
 let runId="";for(let i=0;i<4;i++){
  runId=(await api.eventRun.startEventRun(1,{gameId:game.id,expectedSeriesId:10,preparationRevision:prep.revision,requestId:randomUUID()})).runId;
  if(i<3){for(const command of [{kind:"closeRound"},{kind:"end"}] as const){const v=await api.eventRun.readEventModeration(1,game.id,runId);await api.eventRun.commandEventRun(1,{gameId:game.id,runId,requestId:randomUUID(),revision:v.live!.revision,command});}}
 }
 const assets=(await db.query("SELECT count(*)::int n,min(octet_length(visual_assets::text))::int bytes FROM pubquiz.bingo_live_runs WHERE game_id=$1",[game.id])).rows[0];assert.equal(assets.n,4);assert.ok(assets.bytes>1_000_000,"regression fixture has real embedded original fonts/images per run");
 const get=(token?:string)=>api.pollRoute.GET(new Request(`http://localhost/api/bingo/live/${game.id}?run=${runId}`,{headers:token?{"If-None-Match":token}:{}}),{params:Promise.resolve({gameId:game.id})});
 queries.length=0;let response=await get();assert.equal(response.status,200);let token=response.headers.get("ETag")!;assert.ok(token);const v=await response.json();assert.equal(v.runs.length,4);assert.equal(v.live.id,runId);
 assert.ok(queries.every(q=>!/(?:SELECT\s+(?:r\.)?\*\s+FROM\s+pubquiz\.bingo_live_runs|\"visual_assets\"|r\.visual_assets|\"bingo_card_series\"\.\"print_snapshot\")/i.test(q)),"full refresh must exclude binary fields in SQL, not after fetching");
 const runQueries=queries.filter(q=>/FROM pubquiz\.bingo_live_runs/.test(q)&&/round_snapshot/.test(q));assert.equal(runQueries.length,1);assert.match(runQueries[0],/LIMIT 1/);
 for(let i=0;i<5;i++){queries.length=0;response=await get(token);assert.equal(response.status,304);assert.equal(await response.text(),"");assert.ok(response.headers.get("X-Bingo-Server-At"));assert.ok(queries.every(q=>!/(visual_assets|print_snapshot|round_snapshot|design_snapshot|bingo_live_events|bingo_event_round_cards|bingo_cards)/i.test(q)),"unchanged status must not load immutable assets, snapshots, cards or history");}
 const before=await api.eventRun.readEventModeration(1,game.id,runId);await api.eventRun.commandEventRun(1,{gameId:game.id,runId,requestId:randomUUID(),revision:before.live!.revision,command:{kind:"pause"}});
 queries.length=0;response=await get(token);assert.equal(response.status,200);assert.equal((await response.json()).live.state.run.status,"PAUSED");assert.notEqual(response.headers.get("ETag"),token);token=response.headers.get("ETag")!;assert.equal((await get(token)).status,304);
 // A validator cannot retain access after the user/role/product changes.
 for(const userId of [2,4,5,6])await assert.rejects(api.polling.readPollVersion(userId,{mode:"moderation",gameId:game.id,runId}));
 await db.query("INSERT INTO pubquiz.users(id,name,email,password_hash,role,updated_at)VALUES(701,'Polling revoke QA','polling-revoke@example.invalid','not-a-login-hash','USER',now());INSERT INTO pubquiz.benutzer_reihenrollen(benutzer_id,eventreihe_id,rolle)VALUES(701,10,'EVENT_MANAGER')");
 await api.polling.readPollVersion(701,{mode:"moderation",gameId:game.id,runId});await db.query("DELETE FROM pubquiz.benutzer_reihenrollen WHERE benutzer_id=701");await assert.rejects(api.polling.readPollVersion(701,{mode:"moderation",gameId:game.id,runId}));
 const key=(await api.eventRun.readEventModeration(1,game.id,runId)).live!.audienceKey;
 for(const read of [()=>api.live.readAudience(1,key),()=>api.live.readGameAudience(1,game.id)]) {
  queries.length=0;await read();assert.ok(queries.every(q=>!/(visual_assets|print_snapshot)/i.test(q)),"public full refresh also excludes all binary payloads in SQL");
 }
 for(const target of [{mode:"audience",key},{mode:"game",gameId:game.id}] as const){queries.length=0;assert.ok((await api.polling.readPollVersion(1,target)).etag);assert.ok(queries.every(q=>!/(visual_assets|print_snapshot|round_snapshot|design_snapshot|bingo_cards|bingo_live_events)/i.test(q)));}
 await db.query("INSERT INTO pubquiz.eventreihen(eventreihe_id,name,slug)VALUES(702,'Polling product QA','polling-product-qa');INSERT INTO pubquiz.eventreihe_eventarten(eventreihe_id,eventart,ist_freigeschaltet)VALUES(702,'BINGO',true)");
 const gated=await api.creation.createBingoEvent(1,{seriesId:702,title:"Product revoke QA",date:"",time:"",roundCount:1,requestId:randomUUID()});
 await api.polling.readPollVersion(1,{mode:"game",gameId:gated.id});await db.query("UPDATE pubquiz.eventreihe_eventarten SET ist_freigeschaltet=false WHERE eventreihe_id=702 AND eventart='BINGO'");await assert.rejects(api.polling.readPollVersion(1,{mode:"game",gameId:gated.id}));
 await assert.rejects(api.polling.readPollVersion(1,{mode:"moderation",gameId:game.id,runId:randomUUID()}));
 console.info("Bingo SQL polling regression: four runs with >1MB real assets each, minimal initial refresh, unchanged 304 without frozen details, revision invalidation and fresh authorization PASS");
}
