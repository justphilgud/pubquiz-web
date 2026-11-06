import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { PDFDocument } from 'pdf-lib';
import { getPresentationTemplate } from '@/app/rendering/templateRegistry';
import type { SharedDesign } from '@/app/rendering/sharedDesign/sharedDesign';
import { newBingoPrint } from './bingoPrint';
import { geometry, printFormats, type PrintFormat } from './printFormats';
import { parsePrintSnapshot } from './printSnapshot';
import { parseTermSet } from './termSet';
import type { StoredCard } from './policy';
test('V3 renderer embeds original Phil Gud digits, separates IDs onto backs and renders all formats without changing V2', { timeout:120000 }, async()=>{
  const bundle=await build({stdin:{contents:"export * from './app/bingo/preparation/printAssets.server'; export * from './app/bingo/preparation/pdfModern.server';",resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'cjs',packages:'external',plugins:[{name:'server-marker',setup(b){b.onResolve({filter:/^server-only$/},()=>({path:'marker',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:''}));}}]});
  const runtime={exports:{}};new Function('require','module','exports',bundle.outputFiles[0].text)(createRequire(import.meta.url),runtime,runtime.exports);
  const api=runtime.exports as typeof import('./printAssets.server')&typeof import('./pdfModern.server');
  const template=getPresentationTemplate('phil-gud')!,design:SharedDesign={version:1,templateId:template.id,name:'Phil Gud',config:{version:1,tokens:template.tokens,design:template.design,surfaces:{presentation:template.variant,moderation:'BRANDED',answerForm:'BRANDED'}}};
  const cards:StoredCard[]=Array.from({length:7},(_,i)=>({id:`card-${i}`,code:`BG-0123456789AB-000${i+1}`,shortCode:`A-00${i+1}`,ordinal:i+1,cells:[[1,16,31,46,61],[2,17,32,47,62],[3,18,null,48,63],[4,19,34,49,64],[5,20,35,50,65]]}));
  for(const format of Object.keys(printFormats) as PrintFormat[]){
    const settings=newBingoPrint(design);settings.layout!.format=format;
    const snapshot=await api.capturePrintSnapshot(design,'Titel','Runde 1',settings);
    assert.equal(snapshot.version,3);if(snapshot.version!==3)throw Error('snapshot');
    assert.equal(snapshot.settings.numberFont,'PHIL_GUD');
    const g=geometry(format),pdf=await PDFDocument.load(await api.createModernCardsPdf(snapshot,cards,'duplex'));
    assert.equal(pdf.getPageCount(),2*Math.ceil(cards.length/g.capacity));
    assert.ok(Math.abs(pdf.getPage(0).getWidth()-g.width)<.001);
    const terms=parseTermSet({version:1,name:'Musik',publication:'HIDDEN',entries:Array.from({length:75},(_,i)=>({number:i+1,text:i===0?'Björk & Co.':`Interpret ${i+1}`}))});
    const textSnapshot=parsePrintSnapshot({...snapshot,terms});
    assert.equal((await PDFDocument.load(await api.createModernCardsPdf(textSnapshot,cards,'duplex'))).getPageCount(),pdf.getPageCount());
    const zoom=await PDFDocument.load(await api.createModernCardsPdf(textSnapshot,[cards[0]],'back',true));
    assert.ok(Math.abs(zoom.getPage(0).getWidth()-g.side)<.001);
    const tooLong={...terms,entries:terms.entries.map((e,i)=>i?e:{...e,text:'W'.repeat(120)})};
    await assert.rejects(api.createModernCardsPdf(parsePrintSnapshot({...snapshot,terms:tooLong}),cards,'front'),/höchstens|mindestens 10 pt/);
  }
});
