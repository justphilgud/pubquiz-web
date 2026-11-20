import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {getPresentationTemplate} from '@/app/rendering/templateRegistry';
import type {SharedDesign} from '@/app/rendering/sharedDesign/sharedDesign';
import {defaultBingoPrint,newBingoPrint,prepareLovdPrint,parseBingoPrint,LOVD_RED,LOVD_LIGHT_LOGO,LOVD_SMALL_LOGO,PHIL_PRINT_LOGO} from './bingoPrint';
import {cardProfiles} from './printFormats';
import {parsePrintSnapshot} from './printSnapshot';
import {parseTermSet} from './termSet';
import type {StoredCard} from './policy';
import {systemPrintTemplates} from './printTemplates';
const t=getPresentationTemplate('lovd-ungegoogelt')!;
const design:SharedDesign={version:1,templateId:t.id,name:'LOVD × Phil Gud',config:{version:1,tokens:t.tokens,design:t.design,surfaces:{presentation:t.variant,moderation:'BRANDED',answerForm:'BRANDED'}}};
test('new inherited LOVD settings correct branding while preserving explicit colors/fonts and Phil Gud',()=>{
 const next=newBingoPrint(design);assert.equal(next.colors.header,LOVD_RED);assert.equal(next.colors.heading,'#FFF9E9');assert.equal(next.partnerBack,1);assert.equal(next.frontLogo,LOVD_SMALL_LOGO);assert.deepEqual(next.backLogos,[LOVD_LIGHT_LOGO,PHIL_PRINT_LOGO]);
 const explicit={...next,partnerBack:undefined,headerFont:'MONTSERRAT' as const,numberFont:'ARIMO' as const,colors:{...next.colors,header:'#123456',heading:'#FFFFFF'}};delete explicit.partnerBack;
 const current=prepareLovdPrint(explicit);assert.deepEqual(current.colors,explicit.colors);assert.equal(current.headerFont,'MONTSERRAT');assert.equal(current.numberFont,'ARIMO');assert.ok(parseBingoPrint(current));assert.equal(parseBingoPrint({...current,partnerBack:2}),null);
 const phil=systemPrintTemplates()[0].config.bingoPrint!;assert.deepEqual(prepareLovdPrint(phil),phil);assert.equal(phil.partnerBack,undefined);
 assert.deepEqual(prepareLovdPrint({...next,backLogos:[PHIL_PRINT_LOGO,LOVD_LIGHT_LOGO]}).backLogos,[LOVD_LIGHT_LOGO,PHIL_PRINT_LOGO]);
 const central=systemPrintTemplates()[1].config.bingoPrint!;assert.equal(central.colors.header,LOVD_RED);assert.equal(central.partnerBack,1);
});
test('new V3 LOVD keeps the old front typography on every profile, freezes code face and exports old snapshots unchanged',{timeout:120000},async()=>{
 const bundle=await build({stdin:{contents:"export * from './app/bingo/preparation/printAssets.server';export * from './app/bingo/preparation/pdf.server';",resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'cjs',packages:'external',plugins:[{name:'marker',setup(b){b.onResolve({filter:/^server-only$/},()=>({path:'marker',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:''}));}}]});
 const runtime={exports:{}};new Function('require','module','exports',bundle.outputFiles[0].text)(createRequire(import.meta.url),runtime,runtime.exports);const api=runtime.exports as typeof import('./printAssets.server')&typeof import('./pdf.server');
 const cards:StoredCard[]=[{id:'same-lovd-card',ordinal:12,code:'BG-SAMPLE-0012',shortCode:'A-012',cells:[[1,16,31,46,61],[2,17,32,47,62],[3,18,null,48,63],[4,19,34,49,64],[5,20,35,50,65]]}];
 const terms=parseTermSet({version:1,name:'Text',publication:'DIRECT',entries:Array.from({length:75},(_,i)=>({number:i+1,text:i===0?'Earth Wind & Fire':`Band ${i+1}`}))});
 const out=process.env.BINGO_LOVD_OUTPUT;if(out)mkdirSync(out,{recursive:true});
 for(const profile of cardProfiles){
  const legacy={...defaultBingoPrint(design),headerFont:'PHIL_GUD' as const,numberFont:'PHIL_GUD' as const,layout:{version:3 as const,format:profile,textFont:'ARIMO' as const}};
  const old=await api.capturePrintSnapshot(design,'Legacy','Round',legacy);assert.equal(old.version,3);if(old.version!==3)throw Error('V3 required');assert.equal(old.codeFont,undefined);const frozen=JSON.stringify(old);
  for(const text of [false,true]){
   const settings=newBingoPrint(design);settings.layout={...legacy.layout};
   const same=await api.captureNewPrintSnapshot(design,'Legacy','Round',settings);assert.equal(same.version,3);if(same.version!==3)throw Error('V3 required');assert.ok(same.codeFont);assert.equal(same.codeFont.sha256,(await api.printFont('Arial, Helvetica, sans-serif')).sha256);
   assert.equal(same.display.sha256,old.display.sha256);assert.equal(same.body.sha256,old.body.sha256);assert.equal(same.text.sha256,old.text.sha256);
   assert.throws(()=>parsePrintSnapshot({...same,codeFont:{...same.codeFont,sha256:'0'.repeat(64)}}),/Druckdesign/);
   const a=parsePrintSnapshot({...old,terms:text?terms:null}),b=parsePrintSnapshot({...same,terms:text?terms:null});
   const sraSettings={...settings,layout:{...settings.layout,format:'SRA3_TWELVE' as const,cardProfile:profile}},sra=await api.captureNewPrintSnapshot(design,'Legacy','Round',sraSettings);
   const c=parsePrintSnapshot({...sra,terms:text?terms:null});
   const before=await api.createCardsPdf(a,cards,'duplex'),after=await api.createCardsPdf(b,cards,'duplex'),sheet=await api.createCardsPdf(c,cards,'duplex');
   if(out){const kind=text?'terms':'numbers';writeFileSync(join(out,`${profile}-${kind}-old.pdf`),before);writeFileSync(join(out,`${profile}-${kind}-new.pdf`),after);writeFileSync(join(out,`${profile}-${kind}-sra3.pdf`),sheet);}
  }
  assert.equal(JSON.stringify(old),frozen);assert.equal(old.settings.partnerBack,undefined);
 }
});
