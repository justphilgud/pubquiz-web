/** Synthetic, offline print proofs. Never reads a database or creates playable stock. */
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import {getPresentationTemplate} from '@/app/rendering/templateRegistry';
import type {SharedDesign} from '@/app/rendering/sharedDesign/sharedDesign';
import {ROUND_COLORS} from '@/app/bingo/roundColors';
import {WILDCARD_COLOR} from '@/app/bingo/preparation/cardSet';
import {shortCardCode} from '@/app/bingo/preparation/bingoPrint';
import {systemPrintTemplates} from '@/app/bingo/preparation/printTemplates';
import {parsePrintSnapshot} from '@/app/bingo/preparation/printSnapshot';
import {parseTermSet} from '@/app/bingo/preparation/termSet';
import type {CardSetPrintSection} from '@/app/bingo/preparation/cardSetPdf.server';
import type {StoredCard} from '@/app/bingo/preparation/policy';

async function main(){
 const bundle=await build({stdin:{contents:"export * from './app/bingo/preparation/printAssets.server';export * from './app/bingo/preparation/cardSetPdf.server';export * from './app/bingo/preparation/pdfModern.server';",resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'cjs',packages:'external',plugins:[{name:'offline-proof',setup(b){b.onResolve({filter:/^(server-only|@\/app\/lib\/prisma)$/},a=>({path:a.path,namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:a.path==='server-only'?'':"export const prisma=new Proxy({},{get(){throw Error('DATABASE_FORBIDDEN_IN_SYNTHETIC_PROOF')}});"}));}}]});
 const runtime={exports:{}};new Function('require','module','exports',bundle.outputFiles[0].text)(createRequire(import.meta.url),runtime,runtime.exports);
 const api=runtime.exports as typeof import('@/app/bingo/preparation/printAssets.server')&typeof import('@/app/bingo/preparation/cardSetPdf.server')&typeof import('@/app/bingo/preparation/pdfModern.server');
 const template=getPresentationTemplate('phil-gud')!,design:SharedDesign={version:1,templateId:template.id,name:'Synthetischer Farbnachweis',config:{version:1,tokens:template.tokens,design:template.design,surfaces:{presentation:template.variant,moderation:'BRANDED',answerForm:'BRANDED'}}};
 const settings=structuredClone(systemPrintTemplates().find(t=>t.id==='bingo-print-lovd-phil-gud')!.config.bingoPrint!);settings.layout={version:3,format:'SRA3_TWELVE',cardProfile:'A4_FOUR',textFont:'ARIMO'};
 const originalPhil=await api.loadPrintLogo('/branding/bingo-print/phil-gud.png');
 const cards=(prefix:number,count:number,wildcard=false):StoredCard[]=>Array.from({length:count},(_,i)=>({id:`synthetic-${prefix}-${i}`,ordinal:i+1,code:`SYNTHETIC-${prefix}-${i+1}`,shortCode:shortCardCode(prefix,i+1,wildcard),cells:Array.from({length:5},(_,r)=>Array.from({length:5},(_,c)=>r===2&&c===2?null:c*15+(i+r)%15+1))}));
 const sections:CardSetPrintSection[]=[],overview=await PDFDocument.create(),font=await overview.embedFont(StandardFonts.Helvetica),bold=await overview.embedFont(StandardFonts.HelveticaBold),pt=(mm:number)=>mm*72/25.4;
 const page=overview.addPage([pt(420),pt(297)]);page.drawText('Bingo: sieben Rundenfarben und Wildcard',{x:pt(15),y:pt(281),font:bold,size:17});page.drawText('Synthetische Designbeispiele · keine spielbaren Karten · Phil Gud immer im farbigen Original',{x:pt(15),y:pt(272),font,size:10});
 for(let i=0;i<8;i++){
  const wildcard=i===7,color=wildcard?WILDCARD_COLOR:ROUND_COLORS[i].background,name=wildcard?'Wildcard · STELP Dunkelblau':ROUND_COLORS[i].name;
  const snapshot=await api.captureNewPrintSnapshot(design,'Farbnachweis',wildcard?'Letzte Runde':`Runde ${i+1}`,structuredClone(settings),undefined,wildcard?7:i+1,color);
  assert.ok(snapshot.version===3);assert.equal(snapshot.backLogos.length,2);assert.deepEqual(Buffer.from(snapshot.backLogos[1].bytes,'base64'),Buffer.from(originalPhil),'Phil Gud must remain the original colour PNG');
  const deck=cards(i+1,12,wildcard);sections.push({section:{roundId:`synthetic-round-${i+1}`,label:name,wildcard,cardIds:deck.map(c=>c.id),snapshot},cards:deck});
  const bytes=await api.createModernCardsPdf(snapshot,deck.slice(0,1),'back',true),[back]=await overview.embedPdf(bytes),x=15+(i%4)*97.5,y=i<4?158:38;
  page.drawPage(back,{x:pt(x),y:pt(y)});page.drawText(name,{x:pt(x),y:pt(y-6),font:bold,size:8});page.drawText(color,{x:pt(x),y:pt(y-11),font,size:8});
 }
 const out='docs/acceptance/assets/bingo-card-set';mkdirSync(out,{recursive:true});
 writeFileSync(`${out}/farben-und-logos-uebersicht.pdf`,await overview.save());writeFileSync(`${out}/sieben-farben-sra3.pdf`,await api.imposeCardSet(sections,'Sieben Farben und Wildcard · synthetische Beispiele'));
 const terms=parseTermSet({version:1,name:'Musik',publication:'DIRECT',entries:Array.from({length:75},(_,i)=>({number:i+1,text:`Band ${i+1}`}))});
 const demo:CardSetPrintSection[]=[{...sections[0],cards:cards(1,13)},{...sections[2],cards:cards(2,14)},{...sections[7],cards:cards(3,13,true)}].map((s,i)=>{const snapshot=i===0?s.section.snapshot:parsePrintSnapshot({...s.section.snapshot,terms,...(i===2?{roundNumber:3,roundLabel:'Runde 3'}:{})});return {...s,section:{...s.section,snapshot,cardIds:s.cards.map(c=>c.id)}};});
 writeFileSync(`${out}/beispiel-sra3.pdf`,await api.imposeCardSet(demo,'Synthetischer Abendkartensatz'));
 writeFileSync(`${out}/farben-und-logos-nachweis.json`,JSON.stringify({source:'https://www.branddoq.io/stelp/farben',colours:ROUND_COLORS,wildcard:WILDCARD_COLOR,philOriginalBytesVerified:true,backLogosPerCard:2,productionDataRead:false},null,2)+'\n');
 console.info('Seven palette examples, both logos, original colour Phil Gud and dark-blue wildcard generated without database access.');
}
void main().catch(error=>{console.error(error);process.exitCode=1;});
