import 'server-only';
import {PDFDocument,rgb} from 'pdf-lib';
import {prisma} from '@/app/lib/prisma';
import {preparationContext} from './access.server';
import {parseManifest,type CardSetManifest} from './cardSetManifest';
import {storedCard} from './readExport.server';
import {shortCardCode} from './bingoPrint';
import {BingoPreparationError,denied,type StoredCard} from './policy';
import {assertUuid} from '../live/live';
import {createModernCardsPdf} from './pdfModern.server';
import {createReferenceCardsPdf} from './pdfReference.server';
import {CARD_SET_SHEET as g,cardSetSlot,mmToPt as pt} from './cardSetGeometry';
import {canonical} from './printSnapshot';

const ink=(color:string)=>rgb(...[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)/255) as [number,number,number]);
export type CardSetPrintSection={section:CardSetManifest['sections'][number];cards:StoredCard[]};
/** One frozen read transaction. It cannot create cards, update plans or fetch mutable source assets. */
export async function readCardSetPrint(userId:number,gameId:string,setId:string){
 assertUuid(setId);
 return prisma.$transaction(async tx=>{
  await tx.$executeRaw`SET TRANSACTION READ ONLY`;
  await preparationContext(tx,userId,gameId);
  const saved=await tx.bingo_evening_card_sets.findFirst({where:{id:setId,game_id:gameId}});if(!saved)throw denied();
  const manifest=parseManifest(saved.manifest),sections:CardSetPrintSection[]=[];
  for(const section of manifest.sections){
   const rows=await tx.bingo_cards.findMany({where:{id:{in:section.cardIds},series:{game_id:gameId}},include:{series:{include:{short_label:true,wildcard:true}}}});
   if(rows.length!==section.cardIds.length)throw new BingoPreparationError('Gespeicherter Kartensatz ist unvollständig.');
   const byId=new Map(rows.map(c=>[c.id,c]));
   const cards=section.cardIds.map(id=>{const c=byId.get(id)!;if(!c.series.short_label||Boolean(c.series.wildcard)!==section.wildcard||section.wildcard&&c.series.wildcard?.round_id!==section.roundId)throw denied();return {...storedCard(c),shortCode:shortCardCode(c.series.short_label.prefix,c.ordinal,section.wildcard)};});
   sections.push({section,cards});
  }
  return {manifest,sections};
 },{isolationLevel:'RepeatableRead'});
}
/** Reuse established vector card renderers; only this new imposition has 3 mm bleed. */
export async function imposeCardSet(sections:CardSetPrintSection[],title:string){
 const out=await PDFDocument.create();out.setTitle(`${title} · Abendkartensatz`);
 out.setSubject('SRA3 320 x 450 mm; Endformat 92,5 mm; Anschnitt 3 mm; 100 %; Duplex lange Kante');
 const geometry={unit:'mm',sheet:[g.width,g.height],trim:[g.side,g.side],bleed:g.bleed,duplex:'long-edge',front:Array.from({length:12},(_,i)=>cardSetSlot(i)),back:Array.from({length:12},(_,i)=>cardSetSlot(i,true))};
 await out.attach(Buffer.from(canonical(geometry)), 'ausschiessung.json',{mimeType:'application/json',description:'Endformat und Anschnitt jeder Karte; alle Seitenboxen beziehen sich auf den ganzen Bogen.'});
 for(const {section,cards} of sections){
  const snap=section.snapshot;if(snap.version!==3&&snap.version!==4)throw denied();
  // 192 is a multiple of 12 and stays within the established renderer limit of 200.
  for(let offset=0;offset<cards.length;offset+=192){
   const batch=cards.slice(offset,offset+192);
   const bytes=await (snap.version===4?createReferenceCardsPdf:createModernCardsPdf)(snap,batch,'duplex',true);
   const source=await PDFDocument.load(bytes),embedded=await out.embedPages(source.getPages());
   for(let start=0;start<batch.length;start+=12)for(const back of [false,true]){
    const page=out.addPage([pt(g.width),pt(g.height)]);
    // A sheet can have only one set of page boxes, not twelve independent TrimBoxes.
    page.setCropBox(0,0,pt(g.width),pt(g.height));page.setTrimBox(0,0,pt(g.width),pt(g.height));page.setBleedBox(0,0,pt(g.width),pt(g.height));
    for(let slot=0;slot<12&&start+slot<batch.length;slot++){
     const box=cardSetSlot(slot,back),[x,y,w,h]=box.trim,[bx,by,bw,bh]=box.bleed;
     page.drawRectangle({x:pt(bx),y:pt(by),width:pt(bw),height:pt(bh),color:ink(back?snap.settings.colors.back:snap.settings.colors.background)});
     const card=embedded[(start+slot)*2+(back?1:0)];
     if(Math.abs(card.width-pt(w))>.01||Math.abs(card.height-pt(h))>.01)throw new BingoPreparationError('Karten-Endformat stimmt nicht mit 92,5 mm überein. Keine Skalierung vorgenommen.');
     page.drawPage(card,{x:pt(x),y:pt(y)});
     for(const dx of [0,w])for(const dy of [0,h]){
      const sx=dx?1:-1,sy=dy?1:-1,cx=x+dx,cy=y+dy;
      page.drawLine({start:{x:pt(cx+sx*g.markOffset),y:pt(cy)},end:{x:pt(cx+sx*(g.markOffset+g.markLength)),y:pt(cy)},thickness:.3,color:rgb(0,0,0)});
      page.drawLine({start:{x:pt(cx),y:pt(cy+sy*g.markOffset)},end:{x:pt(cx),y:pt(cy+sy*(g.markOffset+g.markLength))},thickness:.3,color:rgb(0,0,0)});
     }
    }
   }
  }
 }
 const bytes=await out.save();if(bytes.length>20*1024*1024)throw new BingoPreparationError('Der Kartensatz überschreitet 20 MB. Bitte weniger Karten auswählen. Keine unvollständige Datei ausgeliefert.');return bytes;
}
export async function createCardSetPdf(userId:number,gameId:string,setId:string){const data=await readCardSetPrint(userId,gameId,setId);return imposeCardSet(data.sections,data.manifest.title);}
