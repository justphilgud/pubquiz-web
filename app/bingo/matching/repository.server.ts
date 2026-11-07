import 'server-only';
import {randomUUID} from 'node:crypto';
import type {Prisma} from '@/app/generated/prisma/client';
import {prisma} from '@/app/lib/prisma';
import {preparationContext} from '../preparation/access.server';
import {parseMatchingSet,MatchingError,printedMatchingText,type MatchingEntry,type MatchingSet,type SourceAnswer} from '../preparation/matching';
import {canonical,sha256} from '../preparation/printSnapshot';
import {parseTermSet} from '../preparation/termSet';
import {assertUuid,type FrozenMatching} from '../live/live';
import {authorizedSource,matchingMediaRows} from './source.server';
import {captureMatchingMedia} from './media.server';
import {matchingRange} from './mediaRange';
type Tx=Prisma.TransactionClient;
export async function readMatchingEditor(userId:number,gameId:string,roundId:string){
 assertUuid(roundId);return prisma.$transaction(async tx=>{
  const {game,series}=await preparationContext(tx,userId,gameId);
  const round=await tx.bingo_rounds.findFirst({where:{id:roundId,game_id:gameId},select:{id:true,label:true,term_snapshot:true,series:{select:{series_id:true}}}});
  if(!round)throw new MatchingError('Runde nicht gefunden oder kein Zugriff.');
  const used=round.series.length>0||await tx.bingo_card_series.count({where:{origin_round_id:round.id}})>0;
  return {gameId,title:game.titel,roundId,label:round.label,revision:(await tx.bingo_preparations.findUnique({where:{game_id:gameId},select:{revision:true}}))?.revision??0,current:round.term_snapshot?parseTermSet(round.term_snapshot):null,locked:used||series.ist_archiviert,sets:(await tx.bingo_term_sets.findMany({where:{game_id:gameId},select:{id:true,config:true,created_at:true},orderBy:{created_at:'desc'}})).map(s=>({id:s.id,config:parseTermSet(s.config),createdAt:s.created_at.toISOString()}))};
 },{isolationLevel:'RepeatableRead'});
}
export async function writeMatching(userId:number,input:{gameId:string;roundId:string;revision:number;config:unknown}){
 const draft=parseMatchingSet(input.config);assertUuid(input.gameId);assertUuid(input.roundId);if(!Number.isSafeInteger(input.revision)||input.revision<0)throw new MatchingError('Ungültiger Bearbeitungsstand.');
 // Network IO before the game lock; authorization/source revision is checked again at commit.
 const pending=new Map<string,Awaited<ReturnType<typeof captureMatchingMedia>>>();
 const sources=await prisma.$transaction(async tx=>{const {game}=await preparationContext(tx,userId,input.gameId);const result=[];
  for(const e of draft.entries){if(e.presentation.kind!=='MEDIA'||!e.presentation.source)continue;const s=e.presentation.source;
   if(s.assetId){const old=await tx.$queryRaw<{id:string;answers:SourceAnswer[]}[]>`SELECT id,answers FROM pubquiz.bingo_matching_assets WHERE id=${s.assetId}::uuid AND game_id=${game.id}::uuid AND source_question_id=${s.questionId} AND source_media_id=${s.mediaId} AND source_revision=${s.revision} AND kind=${s.kind} AND variant=${s.variant}`;if(!old.length)throw new MatchingError(`Kugel ${e.number}: gespeichertes Medium nicht berechtigt.`);if(e.answerKey!=='custom'&&!old[0].answers.some(a=>a.key===e.answerKey&&a.text===e.text))throw new MatchingError(`Kugel ${e.number}: Kartenantwort passt nicht zur gespeicherten Quellfassung.`);continue;}
   const source=await authorizedSource(tx,userId,game.eventreihe_id,s.questionId),m=source.view.media.find(m=>m.id===s.mediaId&&m.variant===s.variant&&m.kind===s.kind);
   if(source.view.revision!==s.revision||!m)throw new MatchingError(`Kugel ${e.number}: Quelle geändert oder Medium fehlt. Bitte erneut auswählen.`);
   if(e.answerKey!=='custom'&&!source.view.answers.some(a=>a.key===e.answerKey&&a.text===e.text))throw new MatchingError(`Kugel ${e.number}: Kartenantwort passt nicht mehr zur Quelle. Bitte erneut auswählen.`);
   result.push({key:`${s.mediaId}:${s.revision}`,url:matchingMediaRows(source.row).find(m=>m.medien_id===s.mediaId)!.datei,kind:s.kind});
  }return result;});
 let total=0;for(const source of sources){if(pending.has(source.key))continue;const media=await captureMatchingMedia(source.url,source.kind);total+=media.bytes.length;if(total>200*1024*1024)throw new MatchingError('Die Auswahl überschreitet das technische Speicherbudget von 200 MB pro Speichervorgang. Bitte weniger große Aufnahmen verwenden.');pending.set(source.key,media);}
 return prisma.$transaction(async tx=>{
  const {game}=await preparationContext(tx,userId,input.gameId,true),prep=await tx.bingo_preparations.findUnique({where:{game_id:game.id}});
  if(!prep||prep.revision!==input.revision)throw new MatchingError('Die Vorbereitung wurde inzwischen geändert. Bitte neu laden; deine Eingaben bleiben erhalten.');
  const round=await tx.bingo_rounds.findFirst({where:{id:input.roundId,game_id:game.id},select:{id:true,series:{select:{series_id:true}}}});
  if(!round)throw new MatchingError('Runde nicht gefunden oder kein Zugriff.');
  if(round.series.length||await tx.bingo_card_series.count({where:{origin_round_id:round.id}})||(await tx.$queryRaw<{id:string}[]>`SELECT f.round_id id FROM pubquiz.bingo_event_rounds f JOIN pubquiz.bingo_live_runs r ON r.id=f.run_id WHERE f.round_id=${round.id}::uuid AND r.status IN ('RUNNING','PAUSED') LIMIT 1`).length)throw new MatchingError('Die Runde hat bereits Karten oder wurde gestartet. Ihre Zuordnung bleibt unverändert; bitte eine neue Runde anlegen.');
  for(const e of draft.entries){if(e.presentation.kind!=='MEDIA'||!e.presentation.source)continue;const s=e.presentation.source;
   if(s.assetId){const old=await tx.$queryRaw<{id:string}[]>`SELECT id FROM pubquiz.bingo_matching_assets WHERE id=${s.assetId}::uuid AND game_id=${game.id}::uuid AND source_question_id=${s.questionId} AND source_media_id=${s.mediaId} AND source_revision=${s.revision} AND kind=${s.kind} AND variant=${s.variant}`;if(!old.length)throw new MatchingError('Gespeicherte Medienreferenz ist ungültig.');continue;}
   const q=await authorizedSource(tx,userId,game.eventreihe_id,s.questionId);if(q.view.revision!==s.revision)throw new MatchingError(`Kugel ${e.number}: Quelle während des Speicherns geändert. Bitte erneut auswählen.`);
   const [old]=await tx.$queryRaw<{id:string}[]>`SELECT id FROM pubquiz.bingo_matching_assets WHERE game_id=${game.id}::uuid AND source_media_id=${s.mediaId} AND source_revision=${s.revision}`;
   if(old){s.assetId=old.id;continue;}const media=pending.get(`${s.mediaId}:${s.revision}`);if(!media)throw new MatchingError('Medienaufnahme fehlt.');const id=randomUUID();
   await tx.$executeRaw`INSERT INTO pubquiz.bingo_matching_assets(id,game_id,source_question_id,source_media_id,source_revision,kind,variant,content_type,sha256,answers,content) VALUES(${id}::uuid,${game.id}::uuid,${s.questionId},${s.mediaId},${s.revision},${s.kind},${s.variant},${media.contentType},${media.sha256},${JSON.stringify(q.view.answers)}::jsonb,${media.bytes})`;s.assetId=id;
  }
  const config=parseMatchingSet(draft),hash=sha256(canonical(config));
  await tx.$executeRaw`INSERT INTO pubquiz.bingo_term_sets(id,game_id,config,config_hash) VALUES(${randomUUID()}::uuid,${game.id}::uuid,${JSON.stringify(config)}::jsonb,${hash})`;
  await tx.bingo_rounds.update({where:{id:round.id},data:{term_snapshot:config as unknown as Prisma.InputJsonValue}});
  await tx.bingo_preparations.update({where:{game_id:game.id},data:{revision:{increment:1}}});return {success:true as const};
 },{timeout:30000});
}
/** Freeze only an immutable small reference; no full mapping/assets in runtime polling. */
export async function frozenMatching(tx:Tx,gameId:string,config:MatchingSet):Promise<{matching:FrozenMatching}>{
 const hash=sha256(canonical(config));
 const [set]=await tx.$queryRaw<{id:string}[]>`SELECT id FROM pubquiz.bingo_term_sets WHERE game_id=${gameId}::uuid AND config_hash=${hash} AND config=${JSON.stringify(config)}::jsonb ORDER BY created_at DESC LIMIT 1`;
 if(!set)throw new MatchingError('Die unveränderliche Zuordnungsfassung fehlt.');
 return {matching:{id:set.id,hash,publication:config.publication}};
}
export async function readMatchingEntry(tx:Tx,gameId:string,ref:FrozenMatching,number:number):Promise<MatchingEntry>{
 if(!Number.isInteger(number)||number<1||number>75)throw new MatchingError('Im 75er-Spiel sind nur Kugeln von 1 bis 75 erlaubt.');
 const [row]=await tx.$queryRaw<{entry:MatchingEntry}[]>`SELECT config->'entries'->(${number-1}::int) AS entry FROM pubquiz.bingo_term_sets WHERE id=${ref.id}::uuid AND game_id=${gameId}::uuid AND config_hash=${ref.hash}`;
 if(!row?.entry||row.entry.number!==number)throw new MatchingError('Die eingefrorene Zuordnung fehlt.');return row.entry;
}
export async function readMatchingAsset(userId:number,gameId:string,id:string,range?:string|null){assertUuid(id);return prisma.$transaction(async tx=>{
 await preparationContext(tx,userId,gameId);
 const [row]=await tx.$queryRaw<{size:number;content_type:string;sha256:string;actual_sha256:string}[]>`SELECT octet_length(content) AS size,content_type,sha256,encode(sha256(content),'hex') AS actual_sha256 FROM pubquiz.bingo_matching_assets WHERE id=${id}::uuid AND game_id=${gameId}::uuid`;
 if(!row||row.actual_sha256!==row.sha256)throw new MatchingError('Das gespeicherte Medium fehlt oder seine Integritätsprüfung ist fehlgeschlagen.');
 const part=matchingRange(range,row.size);if(part==='invalid')return {bytes:new Uint8Array(),contentType:row.content_type,invalidRangeSize:row.size};
 const start=part?.from??0,length=part?part.to-part.from+1:row.size;
 const [data]=await tx.$queryRaw<{content:Uint8Array}[]>`SELECT substring(content from ${start+1}::int for ${length}::int) AS content FROM pubquiz.bingo_matching_assets WHERE id=${id}::uuid AND game_id=${gameId}::uuid`;
 if(!data||data.content.length!==length)throw new MatchingError('Der Medienbereich konnte nicht gelesen werden.');return {bytes:data.content,contentType:row.content_type,...(part?{byteRange:part}:{})};
});}
export async function readRetainedAnswers(userId:number,gameId:string,id:string){assertUuid(id);return prisma.$transaction(async tx=>{await preparationContext(tx,userId,gameId);const [row]=await tx.$queryRaw<{answers:SourceAnswer[]}[]>`SELECT answers FROM pubquiz.bingo_matching_assets WHERE game_id=${gameId}::uuid AND id=${id}::uuid`;if(!row)throw new MatchingError('Gespeicherte Quellfassung nicht gefunden.');return row.answers;});}
export function audienceMatching(entry:MatchingEntry,revealed:boolean,publication:MatchingSet['publication'],gameId:string){
 if(entry.keepNumber)return {kind:'TEXT' as const,text:String(entry.number)};
 if(entry.presentation.kind==='TEXT')return {kind:'TEXT' as const,text:publication==='HIDDEN'&&!revealed?'Verdeckt':entry.presentation.text};
 const source=entry.presentation.source;if(!source?.assetId)throw new MatchingError('Gespeichertes Medium fehlt.');
 return {kind:source.kind,url:`/api/bingo/matching/${gameId}/assets/${source.assetId}`,...(revealed?{answer:printedMatchingText(entry)}:{})};
}
