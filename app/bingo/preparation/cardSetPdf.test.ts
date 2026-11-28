import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {PDFDocument} from 'pdf-lib';
import {getPresentationTemplate} from '@/app/rendering/templateRegistry';
import type {SharedDesign} from '@/app/rendering/sharedDesign/sharedDesign';
import {systemPrintTemplates} from './printTemplates';
import type {StoredCard} from './policy';

test('new SRA3 imposition accepts real V3 and V4 single-card vectors without scaling or database access',{timeout:60000},async()=>{
 const bundle=await build({stdin:{contents:"export * from './app/bingo/preparation/printAssets.server';export * from './app/bingo/preparation/cardSetPdf.server';",resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'cjs',packages:'external',plugins:[{name:'readonly-fixture',setup(b){b.onResolve({filter:/^(server-only|@\/app\/lib\/prisma)$/},a=>({path:a.path,namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:a.path==='server-only'?'':"export const prisma=new Proxy({},{get(){throw Error('UNEXPECTED_DATABASE_ACCESS')}});"}));}}]});
 const runtime={exports:{}};new Function('require','module','exports',bundle.outputFiles[0].text)(createRequire(import.meta.url),runtime,runtime.exports);
 const api=runtime.exports as typeof import('./printAssets.server')&typeof import('./cardSetPdf.server');
 const base=getPresentationTemplate('phil-gud')!;
 const design:SharedDesign={version:1,templateId:base.id,name:'Synthetic card set',config:{version:1,tokens:base.tokens,design:base.design,surfaces:{presentation:base.variant,moderation:'BRANDED',answerForm:'BRANDED'}}};
 const card:StoredCard={id:'fixture',ordinal:1,code:'BG-SAMPLE-0001',shortCode:'WC-WC-001',cells:[[1,16,31,46,61],[2,17,32,47,62],[3,18,null,48,63],[4,19,34,49,64],[5,20,35,50,65]]};
 for(const version of [3,4] as const){
  const settings=structuredClone(systemPrintTemplates().find(t=>t.id==='bingo-print-lovd-phil-gud')!.config.bingoPrint!);settings.layout={version,format:'SRA3_TWELVE',cardProfile:'A4_FOUR',textFont:version===3?'ARIMO':'PHIL_GUD'};
  const snapshot=await api.captureNewPrintSnapshot(design,'Synthetic card set','Last round',settings,undefined,3,'#38264F');
  const before=JSON.stringify({snapshot,card}),pdf=await PDFDocument.load(await api.imposeCardSet([{section:{roundId:'fixture',label:'Wildcards',wildcard:true,cardIds:[card.id],snapshot},cards:[card]}],'Synthetic card set'));
  assert.equal(pdf.getPageCount(),2);for(const page of pdf.getPages()){assert.ok(Math.abs(page.getWidth()*25.4/72-320)<.001);assert.ok(Math.abs(page.getHeight()*25.4/72-450)<.001);}
  assert.equal(JSON.stringify({snapshot,card}),before,'renderer retains frozen inputs');
 }
});
