import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {PDFDocument,PDFArray,PDFRawStream,decodePDFRawStream} from 'pdf-lib';
import {getPresentationTemplate} from '@/app/rendering/templateRegistry';
import {defaultBingoPrint,parseBingoPrint,printContrastIssues,shortCardCode,printFonts} from '@/app/bingo/preparation/bingoPrint';
import type {SharedDesign} from '@/app/rendering/sharedDesign/sharedDesign';
import type {StoredCard} from './policy';
import {resolveBingoPrint} from './printDesign';
import {parsePresentationTemplateConfig,validatePresentationTemplateDraft,toRuntimePresentationTemplate,toRuntimeAnswerFormTemplate} from '@/app/rendering/presentationTemplates/presentationTemplate';
test('strict versioned print settings, inheritance, contrast and stable game-scoped labels',()=>{
 const t=getPresentationTemplate('phil-gud')!,d:SharedDesign={version:1,templateId:t.id,name:'Phil Gud',config:{version:1,tokens:t.tokens,design:t.design,surfaces:{presentation:t.variant,moderation:'BRANDED',answerForm:'BRANDED'}}};
 const c=defaultBingoPrint(d);assert.equal(c.headerFont,'PHIL_GUD');assert.equal(c.numberFont,'ARIMO');assert.equal(c.backLogos.length,1);assert.ok(parseBingoPrint(c));assert.equal(parseBingoPrint({...c,secret:'x'}),null);assert.equal(parseBingoPrint({...c,backLogos:[]}),null);assert.equal(parseBingoPrint({...c,numberFont:'PHIL_GUD'}),null);assert.equal(parseBingoPrint({...c,colors:{...c.colors,background:'red'}}),null);assert.ok(printContrastIssues({...c,colors:{...c.colors,numbers:c.colors.background}}).length);
 const override={...c,headerFont:'ARIMO' as const};assert.deepEqual(resolveBingoPrint(d,override,null),override);assert.deepEqual(resolveBingoPrint(d,override,c),c);assert.deepEqual(resolveBingoPrint(d,null,null),c);
 assert.equal(shortCardCode(1,1),'A-001');assert.equal(shortCardCode(26,500),'Z-500');assert.equal(shortCardCode(27,1),'AA-001');assert.equal(new Set(Array.from({length:100},(_,i)=>shortCardCode(i+1,1))).size,100);assert.throws(()=>shortCardCode(0,1));
 const withPrint={...d.config,bingoPrint:c};assert.deepEqual(parsePresentationTemplateConfig(withPrint)?.bingoPrint,c);assert.equal(parsePresentationTemplateConfig({...d.config,bingoPrint:{...c,secret:'rejected'}}),null);
 const plain={id:'test-template',name:'Test',config:d.config},configured={...plain,config:withPrint};assert.deepEqual(toRuntimePresentationTemplate(configured),toRuntimePresentationTemplate(plain));assert.deepEqual(toRuntimeAnswerFormTemplate(configured),toRuntimeAnswerFormTemplate(plain));
 const bad={...withPrint,bingoPrint:{...c,colors:{...c.colors,numbers:c.colors.background}}};const validation=validatePresentationTemplateDraft({id:'test-template',name:'Test',description:'',status:'ACTIVE',tags:[],sourceTemplateId:null,config:bad});assert.equal(validation.ok,false);if(!validation.ok)assert.ok(validation.errors.some(e=>e.field==='config.bingoPrint.colors'));
});
test('real square front/duplex PDFs, original fonts 1–75, all positions and incomplete sheets',{timeout:180000},async()=>{
 const bundle=await build({stdin:{contents:"export * from './app/bingo/preparation/printAssets.server';export * from './app/bingo/preparation/pdfSquare.server';",resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'cjs',packages:'external',plugins:[{name:'server-only',setup(b){b.onResolve({filter:/^server-only$/},()=>({path:'server-only',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:''}));}}]});
 const runtime={exports:{}};new Function('require','module','exports',bundle.outputFiles[0].text)(createRequire(import.meta.url),runtime,runtime.exports);const api=runtime.exports as typeof import('./printAssets.server')&typeof import('./pdfSquare.server');
 const cards:StoredCard[]=Array.from({length:15},(_,i)=>({id:`fixture-${i}`,code:`BG-0123456789AB-${String(i+1).padStart(4,'0')}`,shortCode:shortCardCode(1,i+1),ordinal:i+1,cells:Array.from({length:5},(_,r)=>Array.from({length:5},(_,c)=>r===2&&c===2?null:c*15+(i+r)%15+1))}));
 for(const brand of ['phil-gud','lovd-ungegoogelt']){
  const t=getPresentationTemplate(brand)!,design:SharedDesign={version:1,templateId:brand,name:brand,config:{version:1,tokens:t.tokens,design:t.design,surfaces:{presentation:t.variant,moderation:'BRANDED',answerForm:'BRANDED'}}};
  const snapshot=await api.capturePrintSnapshot(design,'DO NOT PRINT INTERNAL TITLE','DO NOT PRINT ROUND');assert.equal(snapshot.version,2);if(snapshot.version!==2)throw Error('snapshot');assert.equal(snapshot.backLogos.length,brand==='phil-gud'?1:2);
  for(const count of [1,3,4,5,8]){
   const bytes=await api.createSquareCardsPdf(snapshot,cards.slice(0,count),'duplex'),pdf=await PDFDocument.load(bytes);assert.equal(pdf.getPageCount(),2*Math.ceil(count/4));assert.equal(pdf.getTitle(),'Bingo-Druckkarten');
   for(let p=0;p<pdf.getPageCount();p++){
    const streams=pdf.getPage(p).node.Contents();assert.ok(streams instanceof PDFArray);const operators=Array.from({length:streams.size()},(_,i)=>{const stream=pdf.context.lookup(streams.get(i));assert.ok(stream instanceof PDFRawStream);return Buffer.from(decodePDFRawStream(stream).decode()).toString('utf8');}).join('\n');const present=Math.min(4,count-Math.floor(p/2)*4);
    assert.equal((operators.match(/ Do\n/g)??[]).length,present*(p%2?snapshot.backLogos.length:1),'one front logo and only populated backs');if(p%2)assert.ok(!operators.includes('BT'),'backs contain only logos and background');
   }
  }
  for(let s=0;s<4;s++){const front=api.cardPosition(s),back=api.cardPosition(s,true);assert.equal(front.side,api.printGeometry.side);assert.ok(Math.abs(front.x+back.x+front.side-api.printGeometry.pageWidth)<1e-8);assert.equal(front.y,back.y);}
  const many=Array.from({length:200},(_,i)=>({...cards[i%cards.length],id:`max-${i}`,ordinal:i+1,shortCode:shortCardCode(1,i+1)}));
  const started=performance.now(),maxPdf=await api.createSquareCardsPdf(snapshot,many,'duplex');assert.equal((await PDFDocument.load(maxPdf)).getPageCount(),100);assert.ok(maxPdf.length<20*1024*1024);console.info('Duplex maximum',brand,{cards:200,pages:100,bytes:maxPdf.length,durationMs:Math.round(performance.now()-started)});
  for(const header of printFonts)for(const number of printFonts.filter(f=>f.id!=='PHIL_GUD')){
   const config={...defaultBingoPrint(design),headerFont:header.id,numberFont:number.id as 'ARIMO'|'MONTSERRAT'};const snap=await api.capturePrintSnapshot(design,'hidden','hidden',config);const bytes=await api.createSquareCardsPdf(snap,cards,'front');
   for(const a of [snap.display,snap.body]){const face=api.regularFace(Buffer.from(a.bytes,'base64'));for(let n=1;n<=75;n++){const m=api.glyphGeometry(face,String(n),22);assert.ok(m.width>0&&m.width<api.printGeometry.side/5-6,`${a.name} ${n} bounds`);}}
   if(process.env.PDF_EXAMPLE_DIR&&brand==='phil-gud'){const dir=process.env.PDF_EXAMPLE_DIR;mkdirSync(dir,{recursive:true});writeFileSync(`${dir}/font-${header.id}-${number.id}.pdf`,bytes);}
  }
  if(process.env.PDF_EXAMPLE_DIR){const dir=process.env.PDF_EXAMPLE_DIR;mkdirSync(dir,{recursive:true});writeFileSync(`${dir}/bingo-${brand}-duplex.pdf`,await api.createSquareCardsPdf(snapshot,cards.slice(0,8),'duplex'));writeFileSync(`${dir}/bingo-${brand}-partial.pdf`,await api.createSquareCardsPdf(snapshot,cards.slice(1,6),'duplex'));writeFileSync(`${dir}/bingo-${brand}-expected.json`,JSON.stringify(cards));}
 }
 // Reproduce the exact legacy byte source separately; it is not replaced or edited.
 assert.ok(readFileSync('app/bingo/preparation/pdf.server.ts','utf8').includes('snapshot.version===2'));
});
