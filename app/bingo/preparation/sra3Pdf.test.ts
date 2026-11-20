import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {PDFDocument} from 'pdf-lib';
import {getPresentationTemplate} from '@/app/rendering/templateRegistry';
import type {SharedDesign} from '@/app/rendering/sharedDesign/sharedDesign';
import {systemPrintTemplates} from './printTemplates';
import {cardProfiles,geometry,position} from './printFormats';
import {parsePrintSnapshot,designHash} from './printSnapshot';
import {parseTermSet} from './termSet';
import {initialMatchingEntries,parseMatchingSet} from './matching';
import type {StoredCard} from './policy';

test('SRA3 actual PDFs preserve V3/V4 drawings, profiles and complete/partial duplex sheets',{timeout:180000},async()=>{
 const bundle=await build({stdin:{contents:"export * from './app/bingo/preparation/printAssets.server';export * from './app/bingo/preparation/pdf.server';export * from './app/bingo/preparation/pdfModern.server';",resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'cjs',packages:'external',plugins:[{name:'marker',setup(b){b.onResolve({filter:/^server-only$/},()=>({path:'marker',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:''}));}}]});
 const runtime={exports:{}};new Function('require','module','exports',bundle.outputFiles[0].text)(createRequire(import.meta.url),runtime,runtime.exports);
 const api=runtime.exports as typeof import('./printAssets.server')&typeof import('./pdf.server')&typeof import('./pdfModern.server');
 const base=getPresentationTemplate('phil-gud')!;
 const design:SharedDesign={version:1,templateId:base.id,name:'Synthetic SRA3',config:{version:1,tokens:base.tokens,design:base.design,surfaces:{presentation:base.variant,moderation:'BRANDED',answerForm:'BRANDED'}}};
 const cards:StoredCard[]=Array.from({length:25},(_,i)=>({id:`sra3-${i+1}`,ordinal:i+1,code:`BG-SAMPLE-${i+1}`,shortCode:`AA-${String(i+1).padStart(3,'0')}`,cells:[[1,16,31,46,61],[2,17,32,47,62],[3,18,null,48,63],[4,19,34,49,64],[5,20,35,50,65]]}));
 for(let i=0;i<cards.length;i++)cards[i].cells=cards[i].cells.map((row,r)=>row.map((v,c)=>c===0?1+(r+i)%5:c===1?16+(r+Math.floor(i/5))%5:v));
 const frozenCards=JSON.stringify(cards),out=process.env.BINGO_SRA3_OUTPUT,manifest:unknown[]=[];
 const terms=parseTermSet({version:1,name:'Long words',publication:'DIRECT',entries:Array.from({length:75},(_,i)=>({number:i+1,text:i===0?'Earth Wind & Fire':`Band ${i+1}`}))});
 const mixedEntries=initialMatchingEntries();for(let i=0;i<75;i++)if(i%2===0)mixedEntries[i]={...mixedEntries[i],keepNumber:false,sameText:false,text:i===0?'Earth Wind & Fire':`Band ${i+1}`,answerKey:'custom',presentation:{kind:'TEXT',text:`Prompt ${i+1}`}};
 const mixed=parseMatchingSet({version:2,name:'Mixed',publication:'DIRECT',entries:mixedEntries});
 for(const template of systemPrintTemplates())for(const version of [3,4] as const)for(const profile of cardProfiles){
  const settings=structuredClone(template.config.bingoPrint!);if(version===3&&template.id==='bingo-print-lovd-phil-gud'){settings.headerFont='MONTSERRAT';settings.numberFont='ARIMO';settings.colors.numbers='#222222';}settings.layout={version,format:profile,textFont:version===3?'ARIMO':'PHIL_GUD'};
  const baseline=await api.capturePrintSnapshot(design,'SRA3 sample','Round 1',settings);
  const layout={...settings.layout,format:'SRA3_TWELVE' as const,cardProfile:profile};
  for(const [kind,content] of [['numbers',null],['terms',terms],['mixed',mixed]] as const){
   const old=parsePrintSnapshot({...baseline,terms:content});if(old.version!==3&&old.version!==4)throw Error('Modern snapshot required');
   const changed={...old.settings,layout};
   const changedDesign={...old.design,config:{...old.design.config,bingoPrint:changed}};
   const sra=parsePrintSnapshot({...old,settings:changed,design:changedDesign,designHash:designHash(changedDesign)});
   // Recompute the same existing snapshot hash contract, never bypass parser checks.

   if(version===3&&profile==='A4_SIX'&&kind==='numbers'){const tooLong=parseTermSet({version:1,name:'37 characters',publication:'DIRECT',entries:Array.from({length:75},(_,i)=>({number:i+1,text:i===0?'a'.repeat(37):`Band ${i+1}`}))});await assert.rejects(api.createCardsPdf(parsePrintSnapshot({...sra,terms:tooLong}),cards.slice(0,1)),/höchstens 36 Zeichen/);await assert.rejects(api.createCardsPdf(parsePrintSnapshot({...old,terms:tooLong}),cards.slice(0,1)),/höchstens 36 Zeichen/);}
   const oldBytes=await api.createCardsPdf(old,cards.slice(0,1),'duplex');
   const newBytes=await api.createCardsPdf(sra,cards.slice(0,1),'duplex');
   const doc=await PDFDocument.load(newBytes);assert.equal(doc.getPageCount(),2);
   assert.ok(Math.abs(doc.getPage(0).getWidth()*25.4/72-320)<1e-8);assert.ok(Math.abs(doc.getPage(0).getHeight()*25.4/72-450)<1e-8);
   if(out){mkdirSync(out,{recursive:true});const name=`v${version}-${template.id}-${profile}-${kind}`;writeFileSync(join(out,name+'-baseline.pdf'),oldBytes);writeFileSync(join(out,name+'-sra3.pdf'),newBytes);manifest.push({name,profile,version,kind,sideMm:geometry(profile).sideMm,baseFront:position(profile,0),baseBack:position(profile,0,true),front:position('SRA3_TWELVE',0,false,profile),back:position('SRA3_TWELVE',0,true,profile)});}
   if(version===4&&profile==='A4_FOUR'&&kind==='numbers'&&template.id==='bingo-print-phil-gud'){
    for(const count of [1,12,13]){const bytes=await api.createCardsPdf(sra,cards.slice(0,count),'duplex');assert.equal((await PDFDocument.load(bytes)).getPageCount(),2*Math.ceil(count/12));if(out)writeFileSync(join(out,`duplex-${count}.pdf`),bytes);}
    const front=await api.createCardsPdf(sra,cards.slice(0,13),'front');assert.equal((await PDFDocument.load(front)).getPageCount(),2);
    const range=await api.createCardsPdf(sra,cards.slice(4,17),'duplex');assert.equal((await PDFDocument.load(range)).getPageCount(),4);
    if(out){writeFileSync(join(out,'front-13.pdf'),front);writeFileSync(join(out,'duplex-range-5-17.pdf'),range);}
   }
  }
 }
 assert.equal(JSON.stringify(cards),frozenCards);
 if(out)writeFileSync(join(out,'pdf-manifest.json'),JSON.stringify(manifest,null,2));
});
