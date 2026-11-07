import test from 'node:test';
import assert from 'node:assert/strict';
import {systemPrintTemplates,parsePrintSelection} from './printTemplates';
import {parsePresentationTemplateConfig,toRuntimePresentationTemplate,toRuntimeAnswerFormTemplate} from '@/app/rendering/presentationTemplates/presentationTemplate';
import {supportsSharedDesign} from '@/app/rendering/sharedDesign/sharedDesign';
import {parseBingoPrint,printContrastIssues} from './bingoPrint';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {PDFDocument} from 'pdf-lib';
import {geometry,printFormats,type PrintFormat} from './printFormats';
import {parsePrintSnapshot,sha256} from './printSnapshot';
import {readFileSync} from 'node:fs';
import {parseTermSet} from './termSet';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import type {SharedDesign} from '@/app/rendering/sharedDesign/sharedDesign';
import type {StoredCard} from './policy';
test('Print templates have distinct identities, strict selection, and cannot become live templates',()=>{
 assert.equal(sha256(readFileSync('public/branding/bingo-print/phil-gud.png')),'b9bad3476c151c03f47241ef3b4ff85e6f479d5645a22cdb30c39ed1b9a2c275');
 assert.equal(sha256(readFileSync('public/branding/bingo-print/lovd.png')),'ab4a04f53da6f81d9177519064054c74ae0b8f14c8d30026c8d57a26e975f813');
 for(const t of systemPrintTemplates()){
  assert.ok(parsePresentationTemplateConfig(t.config));assert.equal(t.config.purpose,'BINGO_PRINT');assert.equal(supportsSharedDesign(t.config),false);
  assert.throws(()=>toRuntimePresentationTemplate(t),/Druckvorlagen/);assert.throws(()=>toRuntimeAnswerFormTemplate(t),/Druckvorlagen/);
  assert.deepEqual(printContrastIssues(t.config.bingoPrint!),[]);assert.equal(t.config.bingoPrint!.layout!.textFont,'PHIL_GUD');
  assert.deepEqual(parsePrintSelection({version:2,templateId:t.id,format:'A4_SIX'}),{version:2,templateId:t.id,format:'A4_SIX'});
 }
 for(const v of [{version:2,templateId:'../test',format:'A4_FOUR'},{version:2,templateId:'bingo-print-phil-gud',format:'A5'},{version:2,templateId:'x',format:'A4_FOUR',overrides:{}},null])assert.equal(parsePrintSelection(v),null);
 assert.equal(parseBingoPrint({...systemPrintTemplates()[0].config.bingoPrint,layout:{version:5,format:'A4_FOUR',textFont:'PHIL_GUD'}}),null);
});
test('V4 actual PDFs: both brands, numbers/text, all formats, immutable IDs, embedded font checksums and minimum 10pt', {timeout:180000},async()=>{
 const bundle=await build({stdin:{contents:"export * from './app/bingo/preparation/printAssets.server';export * from './app/bingo/preparation/pdfReference.server';export * from './app/bingo/preparation/pdf.server';export * from './app/bingo/preparation/pdfSquare.server';",resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'cjs',packages:'external',plugins:[{name:'server-marker',setup(b){b.onResolve({filter:/^server-only$/},()=>({path:'marker',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:''}));}}]});
 const runtime={exports:{}};new Function('require','module','exports',bundle.outputFiles[0].text)(createRequire(import.meta.url),runtime,runtime.exports);
 const api=runtime.exports as typeof import('./printAssets.server')&typeof import('./pdfReference.server')&typeof import('./pdf.server')&typeof import('./pdfSquare.server');
 const {getPresentationTemplate}=await import('@/app/rendering/templateRegistry');const base=getPresentationTemplate('phil-gud')!;
 const design:SharedDesign={version:1,templateId:base.id,name:'Synthetische Referenz',config:{version:1,tokens:base.tokens,design:base.design,surfaces:{presentation:base.variant,moderation:'BRANDED',answerForm:'BRANDED'}}};
 const cards:StoredCard[]=Array.from({length:7},(_,i)=>({id:`card-${i}`,code:`BG-0123456789AB-000${i+1}`,shortCode:`AA-${String(i+1).padStart(3,'0')}`,ordinal:i+1,cells:[[1,16,31,46,61],[2,17,32,47,62],[3,18,null,48,63],[4,19,34,49,64],[5,20,35,50,65]]}));
 const original=JSON.stringify(cards);
 const words=['ABBA','Bob Dylan','Take That','Queen','Adele','Lady Gaga','Pink Floyd','U2','Die Ärzte','Falco','Nena','AC/DC','Oasis','Prince','Lou Reed','Bon Jovi','Elton John','Boney M.','Kiss','Earth Wind & Fire','Dua Lipa','Billy Joel','R.E.M.','The Who'];
 const terms=parseTermSet({version:1,name:'Synthetische Musik',publication:'DIRECT',entries:Array.from({length:75},(_,i)=>({number:i+1,text:words[i]??`Band ${i+1}`}))});
 for(const template of systemPrintTemplates())for(const format of Object.keys(printFormats) as PrintFormat[]){
  const settings=structuredClone(template.config.bingoPrint!);settings.layout!.format=format;
  const numeric=await api.capturePrintSnapshot(design,'Vorschau','Runde 1',settings,{id:template.id,name:template.name});assert.equal(numeric.version,4);if(numeric.version!==4)throw Error('snapshot');
  assert.deepEqual(numeric.templateSource,{id:template.id,name:template.name});
  const g=geometry(format),face=api.regularFace(Buffer.from(numeric.text.bytes,'base64'));
  for(const entry of terms.entries){const fit=api.fitReferenceTerm(entry.text,face,(g.side-28)/5-4,(g.side-70)/5-4);assert.ok(fit.size>=10);assert.ok(fit.lines.length<=3);assert.equal(fit.lines.join(' '),entry.text);}
  assert.throws(()=>api.fitReferenceTerm('W'.repeat(40),face,40,30),/mindestens 10 pt/);
  for(const kind of ['numbers','terms']){
   const snapshot=kind==='numbers'?numeric:parsePrintSnapshot({...numeric,terms});
   const bytes=await api.createCardsPdf(snapshot,cards,'duplex'),pdf=await PDFDocument.load(bytes);assert.equal(pdf.getPageCount(),2*Math.ceil(7/g.capacity));assert.ok(Math.abs(pdf.getPage(0).getWidth()-g.width)<.001);
   assert.ok(pdf.context.enumerateIndirectObjects().some(([,v])=>v.toString().includes('/FontFile')),'original fonts must be embedded');
   if(process.env.BINGO_V4_PDF_OUTPUT){await mkdir(process.env.BINGO_V4_PDF_OUTPUT,{recursive:true});await writeFile(join(process.env.BINGO_V4_PDF_OUTPUT,`${template.id}-${kind}-${format}.pdf`),bytes);}
  }
  assert.throws(()=>parsePrintSnapshot({...numeric,codeFont:{...numeric.codeFont,sha256:'0'.repeat(64)}}),/Druckdesign/);
  assert.throws(()=>parsePrintSnapshot({...numeric,version:3}),/Druckdesign/);
 }
 assert.equal(JSON.stringify(cards),original);
});
