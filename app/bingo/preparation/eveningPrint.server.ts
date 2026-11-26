import 'server-only';
import { PDFDocument,StandardFonts,rgb } from 'pdf-lib';
import { prisma } from '@/app/lib/prisma';
import { preparationContext } from './access.server';
import { readExport } from './readExport.server';
import { createCardsPdf } from './pdf.server';
import { BingoPreparationError } from './policy';
import { assertUuid } from '../live/live';

export async function readEveningJobs(userId:number,gameId:string) {
  return prisma.$transaction(async tx=>{
    await tx.$executeRaw`SET TRANSACTION READ ONLY`;
    const {game}=await preparationContext(tx,userId,gameId);
    const jobs=await tx.$queryRaw<{id:string;created_at:Date;cards_per_round:number}[]>`SELECT id,created_at,cards_per_round FROM pubquiz.bingo_print_jobs WHERE game_id=${gameId}::uuid ORDER BY created_at DESC,id DESC`;
    const items=await tx.$queryRaw<{job_id:string;series_id:string;round_id:string;round_position:number;round_label:string;card_count:number;code:string;special:boolean}[]>`SELECT i.job_id,i.series_id,i.round_id,i.round_position,i.round_label,s.card_count,s.code,(s.print_snapshot->'terms' IS NOT NULL AND s.print_snapshot->'terms'<>'null'::jsonb) AS special FROM pubquiz.bingo_print_job_items i JOIN pubquiz.bingo_card_series s ON s.id=i.series_id AND s.game_id=i.game_id WHERE i.game_id=${gameId}::uuid ORDER BY i.round_position,s.code`;
    return {title:game.titel,jobs:jobs.map(j=>({...j,createdAt:j.created_at.toISOString(),items:items.filter(i=>i.job_id===j.id)}))};
  });
}

/** Combine existing renderers, preserving paired fronts/backs and independent round decks. */
export async function createEveningPdf(userId:number,gameId:string,jobId:string) {
  assertUuid(jobId);
  const data=await readEveningJobs(userId,gameId),job=data.jobs.find(j=>j.id===jobId);
  if(!job?.items.length)throw new BingoPreparationError('Druckauftrag gehört nicht zu diesem Bingo-Abend oder enthält keine Karten.');
  const out=await PDFDocument.create(),font=await out.embedFont(StandardFonts.Helvetica);
  out.setTitle(`${data.title} · gesamter Bingo-Abend`);
  let roundId='';
  for(const item of job.items) {
    if(roundId!==item.round_id) {
      roundId=item.round_id;
      // A duplex pair separates decks without shifting subsequent reverse pages.
      const page=out.addPage();page.setSize(595.28,841.89);
      for(const [i,text] of [`Bingo-Abend: ${data.title}`,`Runde ${item.round_position}: ${item.round_label}`,item.special?'Spezialkarten mit Matching-Zuordnung':'Standardkarten 75',`Druckauftrag ${job.id}`,`Erzeugt ${job.createdAt}`,'Deck getrennt schneiden und bereitstellen.','Duplex: lange Kante, 100 % / tatsaechliche Groesse.'].entries()) {
        // Standard metadata font is separate from unchanged original card fonts.
        const safe=Array.from(text).map(c=>{try{font.encodeText(c);return c;}catch{return '?';}}).join('');
        const lines=safe.match(/.{1,78}(?:\s|$)|.{1,78}/g)??[];
        lines.forEach((line,n)=>page.drawText(line.trim(),{x:35,y:790-i*65-n*16,size:i===1?16:11,font,color:rgb(0,0,0)}));
      }
      out.addPage().setSize(595.28,841.89);
    }
    for(let from=1;from<=item.card_count;from+=200) {
      const batch=await readExport(userId,gameId,item.series_id,from,Math.min(item.card_count,from+199));
      const bytes=await createCardsPdf(batch.snapshot,batch.cards,batch.snapshot.version===1?'front':'duplex');
      const source=await PDFDocument.load(bytes);
      for(const page of await out.copyPages(source,source.getPageIndices()))out.addPage(page);
      if(source.getPageCount()%2)out.addPage().setSize(source.getPage(0).getWidth(),source.getPage(0).getHeight());
    }
  }
  const bytes=await out.save();
  if(bytes.length>20*1024*1024)throw new BingoPreparationError('Der gemeinsame Druckauftrag überschreitet 20 MB. Einzelne Serien-PDFs bleiben verfügbar; keine unvollständige Datei ausgeliefert.');
  return bytes;
}
