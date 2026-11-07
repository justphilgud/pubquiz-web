import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {PDFDocument} from 'pdf-lib';
import {getPresentationTemplate} from '@/app/rendering/templateRegistry';
import {newBingoPrint} from './bingoPrint';
import {initialMatchingEntries,parseMatchingSet} from './matching';
import {termFor} from './termSet';
import type {SharedDesign} from '@/app/rendering/sharedDesign/sharedDesign';
import type {StoredCard} from './policy';
import {parsePrintSnapshot} from './printSnapshot';
test('mixed numeric/text matching PDFs retain frozen fonts/identity/duplex and six independent combinations in every format',{timeout:120000},async()=>{
 const bundle=await build({stdin:{contents:"export * from './app/bingo/preparation/printAssets.server';export * from './app/bingo/preparation/pdf.server';",resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'cjs',packages:'external',plugins:[{name:'server-marker',setup(b){b.onResolve({filter:/^server-only$/},()=>({path:'marker',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:''}));}}]});
 const runtime={exports:{}};new Function('require','module','exports',bundle.outputFiles[0].text)(createRequire(import.meta.url),runtime,runtime.exports);const api=runtime.exports as typeof import('./printAssets.server')&typeof import('./pdf.server');
 const template=getPresentationTemplate('phil-gud')!,design:SharedDesign={version:1,templateId:template.id,name:'Phil Gud',config:{version:1,tokens:template.tokens,design:template.design,surfaces:{presentation:template.variant,moderation:'BRANDED',answerForm:'BRANDED'}}};
 const cards:StoredCard[]=Array.from({length:4},(_,i)=>({id:`card-${i}`,code:`BG-0123456789AB-000${i+1}`,shortCode:`A-00${i+1}`,ordinal:i+1,cells:[[1,16,31,46,61],[2,17,32,47,62],[3,18,null,48,63],[4,19,34,49,64],[5,20,35,50,65]]}));
 const immutable=JSON.stringify(cards);
 for(const version of [3,4] as const)for(const format of ['A4_FOUR','A4_SIX','A6_ONE'] as const){const settings=newBingoPrint(design);settings.layout={version,format,textFont:'ARIMO'};const snapshot=await api.capturePrintSnapshot(design,'Matching','Runde 1',settings);assert.equal(snapshot.version,version);
  for(const variant of ['music_original_audio','music_reverse_audio'])for(const text of ['Nina','Song','Nina – Song']){const entries=initialMatchingEntries();entries[0]={...entries[0],keepNumber:false,sameText:false,text,answerKey:'custom',presentation:{kind:'MEDIA',source:{questionId:1,mediaId:variant==='music_original_audio'?1:2,revision:'a'.repeat(64),variant,kind:'AUDIO'}}};entries[89]={...entries[89],keepNumber:false,presentation:{kind:'TEXT',text:'W'.repeat(100)}};const terms=parseMatchingSet({version:2,name:'Sechs gültige Kombinationen',publication:'HIDDEN',entries});
   const frozen=parsePrintSnapshot({...snapshot,terms}),pdf=await PDFDocument.load(await api.createCardsPdf(frozen,cards,'duplex'));assert.equal(pdf.getPageCount(),format==='A6_ONE'?8:2);assert.equal(termFor(terms,1),text);assert.equal(termFor(terms,16),'16');assert.equal(JSON.stringify(cards),immutable);
  }
 }
});
