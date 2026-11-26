import 'server-only';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/app/lib/prisma';
import type { Prisma } from '@/app/generated/prisma/client';
import { gameSeriesForActor } from '@/app/games/gameDraftRepository.server';
import { preparationContext } from '../preparation/access.server';
import { parseTermSet, type TermSet } from '../preparation/termSet';
import { canonical, sha256 } from '../preparation/printSnapshot';
import { assertUuid } from '../live/live';

type Tx = Prisma.TransactionClient;
export type RoundTemplate = {id:string;eventreihe_id:number;name:string;planned_draws:number;config:TermSet|null;source_game_id:string|null;revision:number;created_at:Date};
async function contentAccess(tx:Tx,userId:number,seriesId:number,write=false) {
  if(write) {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(860012,${seriesId})::text`;
    await tx.$queryRaw`SELECT eventreihe_id FROM pubquiz.eventreihen WHERE eventreihe_id=${seriesId} FOR SHARE`;
    await tx.$queryRaw`SELECT id FROM pubquiz.users WHERE id=${userId} FOR SHARE`;
    await tx.$queryRaw`SELECT benutzer_id FROM pubquiz.benutzer_reihenrollen WHERE benutzer_id=${userId} FOR SHARE`;
    await tx.$queryRaw`SELECT rollenzuweisung_id FROM pubquiz.benutzer_rollenzuweisungen WHERE benutzer_id=${userId} FOR SHARE`;
  }
  const choice=(await gameSeriesForActor(tx,userId,'BINGO')).find(c=>c.id===seriesId&&c.canWrite&&(!write||!c.isArchived));
  if(!choice)throw Error('Bingo-Content nicht gefunden oder kein Schreibrecht.');
}
export async function readRoundContent(userId:number) {
  return prisma.$transaction(async tx=>{
    await tx.$executeRaw`SET TRANSACTION READ ONLY`;
    const choices=(await gameSeriesForActor(tx,userId,'BINGO')).filter(c=>c.canWrite);
    const rows=choices.length?await tx.$queryRaw<RoundTemplate[]>`SELECT id,eventreihe_id,name,planned_draws,config,source_game_id,revision,created_at FROM pubquiz.bingo_round_templates WHERE eventreihe_id=ANY(${choices.map(c=>c.id)}::int[]) ORDER BY created_at DESC,id`:[];
    const games=await tx.game_drafts.findMany({where:{eventart:'BINGO',eventreihe_id:{in:choices.filter(c=>!c.isArchived).map(c=>c.id)}},select:{id:true,titel:true,eventreihe_id:true},orderBy:{created_at:'desc'}});
    return {choices,games,templates:rows.map(r=>({...r,config:r.config===null?null:parseTermSet(r.config),createdAt:r.created_at.toISOString()}))};
  });
}
export async function saveRoundTemplate(userId:number,input:{id?:string;seriesId:number;revision?:number;name:string;target:number;config:unknown;sourceGameId?:string}) {
  if(!Number.isSafeInteger(input.seriesId)||!Number.isInteger(input.target)||input.target<1||input.target>75||typeof input.name!=='string'||!input.name.trim()||input.name.trim().length>80)throw Error('Bitte Reihe, Namen und Ziehungsziel 1–75 angeben.');
  if(input.id)assertUuid(input.id);
  const config=input.config===null?null:parseTermSet(input.config);
  // Media are imported through the existing authenticated round editor, never trusted from JSON.
  if(config?.version===2)throw Error('Medien-/Matchingvorlagen bitte aus einer gespeicherten Runde in den Content übernehmen.');
  return prisma.$transaction(async tx=>{
    await contentAccess(tx,userId,input.seriesId,true);
    if(input.sourceGameId){const context=await preparationContext(tx,userId,input.sourceGameId);if(context.game.eventreihe_id!==input.seriesId)throw Error('Medienkontext gehört nicht zur gewählten Eventreihe.');}
    const id=input.id??randomUUID();
    if(input.id) {
      const changed=await tx.$executeRaw`UPDATE pubquiz.bingo_round_templates SET name=${input.name.trim()},planned_draws=${input.target},config=${config===null?null:JSON.stringify(config)}::jsonb,revision=revision+1 WHERE id=${id}::uuid AND eventreihe_id=${input.seriesId} AND revision=${input.revision??-1} AND (config IS NULL OR config->>'version'='1')`;
      if(changed!==1)throw Error('Content inzwischen geändert oder Medienvorlage: Bitte neu laden.');
    } else await tx.$executeRaw`INSERT INTO pubquiz.bingo_round_templates(id,eventreihe_id,name,planned_draws,config,source_game_id,created_by) VALUES(${id}::uuid,${input.seriesId},${input.name.trim()},${input.target},${config===null?null:JSON.stringify(config)}::jsonb,${input.sourceGameId??null}::uuid,${userId})`;
    return {id};
  });
}
/** Publish an independent content copy. The immutable retained source assets remain protected. */
export async function publishRoundTemplate(userId:number,gameId:string,roundId:string,revision:number) {
  assertUuid(roundId);
  return prisma.$transaction(async tx=>{
    const {game}=await preparationContext(tx,userId,gameId,true);
    const prep=await tx.bingo_preparations.findUnique({where:{game_id:gameId}});
    if(prep?.revision!==revision)throw Error('Vorbereitung inzwischen geändert. Bitte neu laden.');
    const round=await tx.bingo_rounds.findFirst({where:{id:roundId,game_id:gameId}});
    if(!round)throw Error('Runde nicht gefunden.');
    const config=round.term_snapshot===null?null:parseTermSet(round.term_snapshot),id=randomUUID();
    await tx.$executeRaw`INSERT INTO pubquiz.bingo_round_templates(id,eventreihe_id,name,planned_draws,config,source_game_id,created_by) VALUES(${id}::uuid,${game.eventreihe_id},${round.label},${round.planned_draws},${config===null?null:JSON.stringify(config)}::jsonb,${gameId}::uuid,${userId})`;
    return {id};
  });
}
/** Copy mapping and retained media into the destination evening; no live link to mutable content. */
export async function instantiateRoundTemplate(tx:Tx,userId:number,gameId:string,templateId:string,seriesId:number) {
  assertUuid(templateId);
  const [template]=await tx.$queryRaw<RoundTemplate[]>`SELECT * FROM pubquiz.bingo_round_templates WHERE id=${templateId}::uuid AND eventreihe_id=${seriesId} FOR SHARE`;
  if(!template)throw Error('Rundenvorlage nicht gefunden oder fremde Eventreihe.');
  const config=template.config===null?null:parseTermSet(template.config);
  if(config?.version===2) {
    if(!template.source_game_id)throw Error('Gespeicherter Medienkontext fehlt.');
    await preparationContext(tx,userId,template.source_game_id);
    const copied=new Map<string,string>();
    for(const entry of config.entries) {
      if(entry.presentation.kind!=='MEDIA'||!entry.presentation.source)continue;
      const source=entry.presentation.source,old=source.assetId;
      if(!old)throw Error('Die Medienvorlage ist nicht vollständig gespeichert.');
      if(!copied.has(old)) {
        const [existing]=await tx.$queryRaw<{id:string}[]>`SELECT target.id FROM pubquiz.bingo_matching_assets target JOIN pubquiz.bingo_matching_assets source ON source.source_media_id=target.source_media_id AND source.source_revision=target.source_revision AND source.sha256=target.sha256 AND source.kind=target.kind AND source.variant=target.variant AND source.answers=target.answers WHERE source.id=${old}::uuid AND source.game_id=${template.source_game_id}::uuid AND target.game_id=${gameId}::uuid`;
        if(existing){copied.set(old,existing.id);source.assetId=existing.id;continue;}
        const id=randomUUID();
        const count=await tx.$executeRaw`INSERT INTO pubquiz.bingo_matching_assets(id,game_id,source_question_id,source_media_id,source_revision,kind,variant,content_type,sha256,answers,content) SELECT ${id}::uuid,${gameId}::uuid,source_question_id,source_media_id,source_revision,kind,variant,content_type,sha256,answers,content FROM pubquiz.bingo_matching_assets WHERE id=${old}::uuid AND game_id=${template.source_game_id}::uuid`;
        if(count!==1)throw Error('Gespeichertes Medium fehlt. Keine Teilrunde angelegt.');
        copied.set(old,id);
      }
      source.assetId=copied.get(old)!;
    }
  }
  if(config)await tx.$executeRaw`INSERT INTO pubquiz.bingo_term_sets(id,game_id,config,config_hash) VALUES(${randomUUID()}::uuid,${gameId}::uuid,${JSON.stringify(config)}::jsonb,${sha256(canonical(config))})`;
  return {label:template.name,target:template.planned_draws,config};
}

export async function readContentMatching(userId:number,templateId:string) {
 assertUuid(templateId);return prisma.$transaction(async tx=>{
  await tx.$executeRaw`SET TRANSACTION READ ONLY`;
  const [template]=await tx.$queryRaw<RoundTemplate[]>`SELECT * FROM pubquiz.bingo_round_templates WHERE id=${templateId}::uuid`;
  if(!template?.source_game_id)throw Error('Für diese Vorlage fehlt der Medien-/Quellenkontext.');
  await contentAccess(tx,userId,template.eventreihe_id);
  const {series}=await preparationContext(tx,userId,template.source_game_id);
  return {gameId:template.source_game_id,templateId,title:template.name,roundId:template.id,label:'Unabhängige Content-Vorlage',revision:template.revision,current:template.config===null?null:parseTermSet(template.config),locked:series.ist_archiviert,sets:[]};
 });
}
