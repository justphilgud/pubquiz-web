import type { Client } from 'pg';
import { randomUUID } from 'node:crypto';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { getPresentationTemplate } from '../../app/rendering/templateRegistry';
import { generateCard } from '../../app/bingo/core/cards';
import { canonical,sha256 } from '../../app/bingo/preparation/printSnapshot';
/** Genuine old V2 rows, inserted before the V3 migration, not reconstructed afterwards. */
export async function seedLegacyPrintFixture(db:Client){
 const bundle=await build({stdin:{contents:"export * from './app/bingo/preparation/printAssets.server';",resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'cjs',packages:'external',plugins:[{name:'server-marker',setup(b){b.onResolve({filter:/^server-only$/},()=>({path:'marker',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:''}));}}]});
 const runtime={exports:{}};new Function('require','module','exports',bundle.outputFiles[0].text)(createRequire(import.meta.url),runtime,runtime.exports);
 const api=runtime.exports as typeof import('../../app/bingo/preparation/printAssets.server'),template=getPresentationTemplate('phil-gud')!;
 const snapshot=await api.capturePrintSnapshot({version:1,templateId:template.id,name:'Historischer V2-Test',config:{version:1,tokens:template.tokens,design:template.design,surfaces:{presentation:template.variant,moderation:'BRANDED',answerForm:'BRANDED'}}},'Vor V3 erzeugt','Alte Runde');
 if(snapshot.version!==2)throw Error('LEGACY_V2_REQUIRED');
 const gameId=randomUUID(),roundId=randomUUID(),seriesId=randomUUID(),card=generateCard(randomUUID(),()=>0);
 await db.query('BEGIN');
 try{
  await db.query("INSERT INTO pubquiz.game_drafts(id,eventart,eventreihe_id,titel,updated_at) VALUES($1,'BINGO',10,'Historische V2-Karte',now())",[gameId]);
  await db.query('INSERT INTO pubquiz.bingo_preparations(game_id) VALUES($1)',[gameId]);
  await db.query("INSERT INTO pubquiz.bingo_rounds(id,game_id,position,label) VALUES($1,$2,1,'Alte Runde')",[roundId,gameId]);
  await db.query("INSERT INTO pubquiz.bingo_card_series(id,game_id,origin_round_id,code,card_count,request_id,request_hash,print_snapshot,created_by) VALUES($1,$2,$3,'BG-ABCDEF123456',1,$4,$5,$6,1)",[seriesId,gameId,roundId,randomUUID(),'0'.repeat(64),snapshot]);
  await db.query("INSERT INTO pubquiz.bingo_cards(id,series_id,ordinal,printed_code,cells,layout_hash) VALUES($1,$2,1,'BG-ABCDEF123456-0001',$3,$4)",[card.id,seriesId,JSON.stringify(card.cells),sha256(canonical(card.cells))]);
  await db.query('INSERT INTO pubquiz.bingo_round_series(round_id,series_id,game_id) VALUES($1,$2,$3)',[roundId,seriesId,gameId]);
  await db.query('COMMIT');
 }catch(error){await db.query('ROLLBACK');throw error;}
 const read=async()=> (await db.query("SELECT to_jsonb(c) card,to_jsonb(s) series,to_jsonb(l) label,to_jsonb(r)-'term_snapshot' round FROM pubquiz.bingo_cards c JOIN pubquiz.bingo_card_series s ON s.id=c.series_id JOIN pubquiz.bingo_rounds r ON r.id=s.origin_round_id JOIN pubquiz.bingo_series_labels l ON l.series_id=s.id WHERE c.id=$1",[card.id])).rows[0];
 return {gameId,seriesId,read,before:await read()};
}
