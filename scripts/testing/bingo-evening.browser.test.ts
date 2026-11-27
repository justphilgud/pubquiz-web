import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {existsSync,readFileSync,mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {compile} from '@tailwindcss/node';
import {Scanner} from '@tailwindcss/oxide';

test('Bingo workstation, editable history, ten Full-HD colour schemes and shared prize/raffle scenes',{timeout:90000},async()=>{
 const source=String.raw`
 import React from 'react';import{createRoot}from'react-dom/client';import{flushSync}from'react-dom';
 import Board from './app/bingo/live/BingoBoard';import Panel from './app/bingo/live/EventModerationPanel';import Ceremony from './app/rendering/ceremony/CeremonySlide';import Preparation from './app/bingo/preparation/PreparationPanel';
 import{getPresentationTemplate}from'./app/rendering/templateRegistry';import{generateCard,evaluateCard}from'./app/bingo/core/cards';
 import{applyEventRunEvent,initialEventRun,currentEventRound,blockingCalls}from'./app/bingo/live/eventRun';import{defaultCeremony}from'./app/rendering/ceremony/ceremony';
 const root=createRoot(document.getElementById('app')),id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
 const t=getPresentationTemplate('lovd-ungegoogelt'),design={version:1,templateId:'lovd-ungegoogelt',name:'LOVD',config:{version:1,tokens:t.tokens,design:t.design,surfaces:{presentation:t.variant,answerForm:'BRANDED',moderation:'BRANDED'}}};
 const card={...generateCard(id(900),()=>0),code:'BG-SYNTHETIC-001',shortCode:'A-001',ordinal:1};let mount=0,seq=100,ceremony=defaultCeremony(),state;
 let seed=12345;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 const activeCards=[card,...Array.from({length:99},(_,i)=>({...generateCard(id(901+i),random),code:'BG-SYNTHETIC-'+(i+2),shortCode:'A-'+String(i+2).padStart(3,'0'),ordinal:i+2}))];
 const round={id:id(3),label:'Binglöckchen · Runde 1',target:30,issued:null,seriesIds:[id(4)]};
 function command(c){state=applyEventRunEvent(state,{id:id(seq++),at:2000+seq,actorId:1,command:c,...(c.kind==='navigateRound'&&!state.frozen.some(f=>f.id===c.roundId)?{frozen:{...round,id:c.roundId,label:'Musikrunde',seriesIds:[id(6)]}}:{})},[card]);}
 function view(){const r=currentEventRound(state);return{protocol:2,gameId:id(2),title:'Binglöckchen · 08.12.2026',seriesId:10,archived:false,preparationRevision:0,rounds:[{id:round.id,position:1,label:round.label,series:[{series_id:id(4),series:{code:'DECK-A',card_count:100}}]},{id:id(5),position:2,label:'Musikrunde',series:[{series_id:id(6),series:{code:'DECK-B',card_count:80}}]}],frozenDecks:[{roundId:round.id,id:id(4),code:'DECK-A',count:100,prefix:1,firstOrdinal:1,lastOrdinal:100},{roundId:id(5),id:id(6),code:'DECK-B',count:80,prefix:2,firstOrdinal:1,lastOrdinal:80}],plan:[{round_id:round.id,position:1},{round_id:id(5),position:2}],runs:[],preparation:{rounds:[]},ceremony,live:{id:id(1),revision:seq,startedAt:1000,round:state.frozen.find(f=>f.id===r.id),state,events:[],cards:activeCards,checkCards:[card],matchingEntry:null,design,serverAt:Date.now(),elapsedMs:100000,roundElapsedMs:100000,callContext:'a'.repeat(64),blocked:blockingCalls(state),between:false,summary:[],raffle:{count:0,max:0,overCapacity:false,needsReview:false,voidNumbers:[],entries:[]}}};}
 let preparationOrder=[round.id,id(5)];
 const prep=()=>({gameId:id(2),title:'Synthetischer Abend',seriesId:10,revision:0,archived:false,roundCount:2,seriesCount:0,page:1,seriesPage:1,available:[],templates:[],termSets:[],rounds:preparationOrder.map((rid,index)=>({id:rid,position:index+1,label:rid===round.id?'Runde A':'Runde B',target:30,cardCount:0,issued:null,strategy:'NEW',series:[],history:[],locked:false}))});
 window.showPreparation=()=>flushSync(()=>root.render(<Preparation key={++mount} data={prep()} ceremony={ceremony}/>));
 window.fakePreparation=async command=>{window.prepCommands.push(command);if(command.operation==='reorderRounds')preparationOrder=command.roundIds;return{success:true};};window.prepCommands=[];
 window.fixtureView=view;
 window.savedCommands=[];window.fakeSave=async input=>{window.savedCommands.push(input);if(input.operation==='command')command(input.command);return{success:true};};
 window.fakeCeremony=async(_g,_r,c)=>{ceremony={...ceremony,...(c.kind==='configure'?{config:c.config}:{}),revision:ceremony.revision+1,slide:c.slide??ceremony.slide,revealCount:c.kind==='reveal'?ceremony.revealCount+1:0};return{success:true,state:ceremony};};
 window.fetch=async()=>({ok:true,status:200,json:async()=>view(),headers:new Headers()});
 window.showModeration=()=>{seq=100;state=initialEventRun(id(1),id(2),round,1000);for(const number of [1,16,31,46,61,2,17,32,47,62])command({kind:'draw',number});flushSync(()=>root.render(<Panel key={++mount} initial={view()}/>));};
 window.openCall=()=>{command({kind:'call',stage:'BINGO',context:'a'.repeat(64)});};
 window.showBoard=(roundNumber,media=false,count=20,confirmed=false)=>{const data={id:'fixture',revision:20,startedAt:1,status:'RUNNING',label:'Runde '+roundNumber,roundNumber,target:30,draws:Array.from({length:count},(_,i)=>({id:String(i),position:i+1,number:i+1})),design,assetBase:null,claims:confirmed?[{id:'feedback',action:'CONFIRM',stage:'BINGO',needsReview:false}]:[],...(media?{content:{kind:'IMAGE',url:'/fixture.svg',answer:'Musik-Bingo'}}:{})};flushSync(()=>root.render(<div style={{height:'100dvh'}}><Board data={data}/></div>));};
 window.showCeremony=(slide,revealCount=0)=>{const state={...defaultCeremony(),slide,revealCount,config:{...defaultCeremony().config,prizes:['Goldpreis','Silberpreis','Bronzepreis']}};flushSync(()=>root.render(<div style={{height:'100dvh'}}><Ceremony state={state} title="Binglöckchen" winner={{number:23,cardCode:'B-045',roundLabel:'Runde 2'}}/></div>));};
 window.setInput=(input,value)=>flushSync(()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));});
 window.setSelect=(select,value)=>flushSync(()=>{select.value=value;select.dispatchEvent(new Event('change',{bubbles:true}));});
 window.errors=[];window.onerror=m=>window.errors.push(m);window.showModeration();
 `;
 const bundle=await build({stdin:{contents:source,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'browser',format:'iife',outdir:'out',loader:{'.css':'local-css'},define:{'process.env.NODE_ENV':'"production"','process.env':'{}'},plugins:[{name:'synthetic-boundaries',setup(b){
  b.onResolve({filter:/^(next\/link|next\/navigation)$/},a=>({path:a.path,namespace:'test'}));
  b.onResolve({filter:/PreparationPanel$/},a=>a.importer.endsWith('EventModerationPanel.tsx')?{path:'prep',namespace:'test'}:undefined);
  b.onResolve({filter:/useContentNavigationGuard$/},()=>({path:'guard',namespace:'test'}));
  b.onResolve({filter:/\/actions$|ceremonyActions$|termActions$/},a=>/[\\/]bingo[\\/]/.test(a.importer)?{path:a.path.includes('ceremony')?'ceremony':'actions',namespace:'test'}:undefined);
  b.onLoad({filter:/.*/,namespace:'test'},a=>({resolveDir:process.cwd(),loader:'tsx',contents:a.path==='next/link'?`import React from 'react';export default function Link({children,...props}){return <a {...props}>{children}</a>}`:a.path==='next/navigation'?`export const useRouter=()=>({replace(){},refresh(){}});` :a.path==='prep'?`export const RoundEditor=()=>null;`:a.path==='guard'?`export const useContentNavigationGuard=()=>()=>{};`:a.path==='ceremony'?`export const saveCeremony=(...args)=>window.fakeCeremony(...args);`:`export async function saveRoundTerms(){return {success:true}}export async function publishContent(){return {success:true}}export async function findMatchingSources(){return []}export async function getMatchingSource(){return null}export async function getMatchingTemplates(){return []}export const savePreparation=(...args)=>window.fakePreparation(...args);export const saveEventRun=(...args)=>window.fakeSave(...args);export async function resolveCardCode(_g,code){return code.toUpperCase()==='A-001'?{success:true,cardId:'00000000-0000-4000-8000-000000000900'}:{success:false,message:'Karte im aktuellen Bingo-Abend nicht gefunden'}};`}));
 }}]});
 const js=bundle.outputFiles.find(f=>f.path.endsWith('.js'))!,css=bundle.outputFiles.find(f=>f.path.endsWith('.css'))!;
 // Use the installed app stylesheet/compiler so shared Quiz icon buttons and
 // preparation utilities are exercised visually, including hidden tooltips.
 const compiler=await compile(readFileSync('app/globals.css','utf8'),{base:resolve('app'),onDependency(){}});
 const scanner=new Scanner({sources:[{base:process.cwd(),pattern:'{app,components}/**/*.{ts,tsx}',negated:false}]});
 const globalCss=compiler.build(scanner.scan());
 const server=createServer((req,res)=>{
  const url=req.url??'/';if(url==='/bundle.js'){res.setHeader('Content-Type','text/javascript');res.end(js.contents);return;}if(url==='/style.css'){res.setHeader('Content-Type','text/css');res.end(globalCss+'\n'+css.text);return;}
  if(url.startsWith('/branding/')){const path=resolve('public','.'+url);if(path.startsWith(resolve('public')+requireSeparator())&&existsSync(path)){res.setHeader('Content-Type',url.endsWith('.woff')?'font/woff':url.endsWith('.jpg')?'image/jpeg':'image/png');res.end(readFileSync(path));return;}}
  if(url==='/fixture.svg'){res.setHeader('Content-Type','image/svg+xml');res.end('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="#f6c4dc"/></svg>');return;}
  res.setHeader('Content-Type','text/html');res.end('<meta charset="utf-8"><link rel="stylesheet" href="/style.css"><style>html,body{margin:0;width:100%;height:100%;font-family:Arial}</style><div id="app"></div><script src="/bundle.js"></script>');
 });
 await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const address=server.address();assert.ok(address&&typeof address==='object');
 const chrome=[process.env.CHROME_BIN,'C:/Program Files/Google/Chrome/Application/chrome.exe','/usr/bin/google-chrome','/usr/bin/chromium'].find(p=>p&&existsSync(p));assert.ok(chrome);
 const profile=mkdtempSync(join(tmpdir(),'bingo-evening-')),browser=spawn(chrome,['--headless=new','--no-sandbox','--disable-gpu','--no-first-run',`--user-data-dir=${profile}`,'--remote-debugging-port=0','about:blank'],{stdio:'ignore'});
 let socket:WebSocket|undefined;
 try{
  const deadline=Date.now()+30000;let portInfo='';while(Date.now()<deadline){try{portInfo=readFileSync(join(profile,'DevToolsActivePort'),'utf8');if(portInfo.trim().split(/\r?\n/).length===2)break;}catch{}await new Promise(r=>setTimeout(r,50));}assert.ok(portInfo);
  const [port,endpoint]=portInfo.trim().split(/\r?\n/);socket=new WebSocket(`ws://127.0.0.1:${port}${endpoint}`);await new Promise<void>((r,j)=>{socket!.onopen=()=>r();socket!.onerror=()=>j(Error('Browser connection'));});
  type Reply={targetId?:string;sessionId?:string;result?:{value?:unknown};exceptionDetails?:unknown;data?:string};let id=0;const pending=new Map<number,{resolve:(r:Reply)=>void;reject:(e:Error)=>void}>();
  socket.onmessage=e=>{const m=JSON.parse(String(e.data));if(!m.id)return;const p=pending.get(m.id);pending.delete(m.id);if(m.error)p?.reject(Error(m.error.message));else p?.resolve(m.result);};
  const call=(method:string,params:Record<string,unknown>,sessionId?:string)=>new Promise<Reply>((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});socket!.send(JSON.stringify({id:n,method,params,sessionId}));});
  const {targetId}=await call('Target.createTarget',{url:`http://127.0.0.1:${address.port}`}),{sessionId}=await call('Target.attachToTarget',{targetId,flatten:true});
  const evaluate=async(expression:string)=>{const result=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true},sessionId);assert.equal(result.exceptionDetails,undefined,JSON.stringify(result));return result.result?.value;};
  for(let i=0;i<200;i++){if(await evaluate('typeof window.showBoard')==='function')break;await new Promise(r=>setTimeout(r,30));}
  mkdirSync('docs/acceptance/assets/bingo-outro-layout-2026-11-27',{recursive:true});const shot=async(name:string)=>{const result=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false},sessionId);writeFileSync(`docs/acceptance/assets/bingo-outro-layout-2026-11-27/${name}.png`,Buffer.from(result.data!,'base64'));};
  for(const [width,height] of [[1280,720],[1366,768],[1920,1080]]){
   await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},sessionId);await evaluate('window.showModeration()');await new Promise(r=>setTimeout(r,100));await evaluate(`window.setInput(document.querySelector('[aria-label="Zahlenarbeitsfläche"] input'),'42')`);
   const layout=await evaluate(`(()=>{const workspace=document.querySelector('[aria-label="Zahlenarbeitsfläche"]'),form=workspace.querySelector('form'),current=workspace.querySelector('[aria-live="polite"]'),checks=document.querySelector('[aria-label="Automatische Kartenprüfung"]');return{left:form.getBoundingClientRect().left<current.getBoundingClientRect().left,within:checks.getBoundingClientRect().bottom<=innerHeight,noMatrix:!document.querySelector('[aria-label="Zahlenübersicht"]'),ceremony:!!document.querySelector('[aria-label="Intro und Outro"] select'),history:document.querySelector('[aria-label="Ziehungshistorie"]').querySelectorAll('li').length,scroll:document.documentElement.scrollWidth>innerWidth};})()`);
   assert.deepEqual(layout,{left:true,within:true,noMatrix:true,ceremony:true,history:10,scroll:false});assert.deepEqual(await evaluate(`[...document.querySelectorAll('button')].filter(b=>['Zahl veröffentlichen','Check','Pausieren','Runde abschließen'].includes(b.textContent)).map(b=>{const r=b.getBoundingClientRect();return {text:b.textContent,top:r.top,bottom:r.bottom,height:r.height};}).filter(r=>r.top<0||r.bottom>innerHeight||r.height<44)`),[]);await shot(`moderation-${width}`);
  }
  assert.deepEqual(await evaluate(`(()=>{const decks=document.querySelector('[aria-label="Kartendecks je Runde"]');return{active:decks.querySelector('[data-active]').textContent.includes('DECK-A'),future:decks.textContent.includes('DECK-B')&&decks.textContent.includes('80 Karten'),links:[...decks.querySelectorAll('a')].every(a=>a.href.includes('/karten?series=')),wide:document.querySelector('[aria-label="Live-Bingo-Wahrscheinlichkeit"]').getBoundingClientRect().width<=310};})()`),{active:true,future:true,links:true,wide:true});
  for(const [value,letter] of [['1','B'],['15','B'],['16','I'],['30','I'],['31','N'],['45','N'],['46','G'],['60','G'],['61','O'],['75','O'],['','–'],['0','–'],['76','–'],['1e1','–'],['02','–'],['2.5','–']]){
   await evaluate(`window.setInput(document.querySelector('[aria-label="Zahlenarbeitsfläche"] input'),${JSON.stringify(value)})`);
   assert.equal(await evaluate(`document.querySelector('[aria-label="Bingo-Buchstabe"]').textContent`),letter);
  }
  await evaluate(`window.setInput(document.querySelector('[aria-label="Zahlenarbeitsfläche"] input'),'')`);
  assert.equal(await evaluate(`(()=>{const input=document.querySelector('[aria-label="Automatische Kartenprüfung"] input');input.focus();document.dispatchEvent(new KeyboardEvent('keydown',{key:'+',code:'NumpadAdd',bubbles:true}));return document.activeElement===document.querySelector('[aria-label="Zahlenarbeitsfläche"] input');})()`),true);
  await evaluate(`window.setInput(document.querySelector('[aria-label="Zahlenarbeitsfläche"] input'),'3')`);
  await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',text:'\r',unmodifiedText:'\r',windowsVirtualKeyCode:13},sessionId);
  await call('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13},sessionId);
  await new Promise(r=>setTimeout(r,100));
  assert.equal(await evaluate(`window.savedCommands.filter(c=>c.command?.kind==='draw').length`),1);
  assert.equal(await evaluate(`document.activeElement===document.querySelector('[aria-label="Zahlenarbeitsfläche"] input')`),true);
  assert.ok(await evaluate(`document.querySelector('[aria-label="Kartendecks je Runde"]').textContent.includes('A-001–A-100')`));
  await evaluate('window.showModeration()');
  const sorts=await evaluate(`(()=>{const history=document.querySelector('[aria-label="Ziehungshistorie"]'),select=history.querySelector('select'),results={};for(const order of ['ORDER_ASC','ORDER_DESC','NUMBER_ASC','NUMBER_DESC']){window.setSelect(select,order);results[order]=[...history.querySelectorAll('li')].map(li=>li.innerText);}return results;})()` ) as Record<string,string[]>;
  assert.ok(sorts.ORDER_DESC[0].includes('#10'));assert.ok(sorts.ORDER_ASC[0].includes('#1'));assert.ok(sorts.NUMBER_ASC[0].includes('B 1'));assert.ok(sorts.NUMBER_DESC[0].includes('O 62'));
  await evaluate(`window.setSelect(document.querySelector('[aria-label="Ziehungshistorie"] select'),'ORDER_ASC');document.querySelector('[aria-label="Ziehungshistorie"] li button').click()`);
  await evaluate(`(()=>{const form=document.querySelector('[aria-label="Ziehungshistorie"] form'),inputs=form.querySelectorAll('input');window.setInput(inputs[0],'3');form.requestSubmit();})()`);
  assert.equal(await evaluate(`document.querySelectorAll('[aria-label="Ziehungshistorie"] form input').length`),1);
  assert.equal(await evaluate(`document.querySelectorAll('[role="dialog"]').length`),0);
  await new Promise(r=>setTimeout(r,100));
  assert.deepEqual(await evaluate(`(()=>{const r=window.fixtureView().live.state.run.rounds[0];return{position:r.draws[0].position,number:r.draws[0].number,latest:r.draws.at(-1).number,corrections:r.corrections.length};})()`),{position:1,number:3,latest:62,corrections:1});
  await evaluate(`window.openCall()`);await new Promise(r=>setTimeout(r,1600));assert.equal(await evaluate(`document.querySelector('[aria-label="Zahlenarbeitsfläche"] input').disabled`),false);
  assert.deepEqual(await evaluate(`(()=>{const history=[...document.querySelectorAll('details')].find(d=>d.querySelector('summary')?.textContent.includes('Historische manuelle Rufe'));return{oldControls:document.body.textContent.includes('Frühere Rufe klären'),readOnly:!!history&&!history.querySelector('input,button,form'),canFinish:![...document.querySelectorAll('button')].find(b=>b.textContent==='Runde abschließen').disabled};})()`),{oldControls:false,readOnly:true,canFinish:true});
  for(const [width,height] of [[390,844],[1280,720]]){
   await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},sessionId);await evaluate('window.showModeration()');await new Promise(r=>setTimeout(r,100));
   assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);await shot(width===390?'moderation-390':'moderation-return-1280');
  }
  await call('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},sessionId);
  const backgrounds=new Set<string>();
  for(let number=1;number<=10;number++){
   await evaluate(`window.showBoard(${number});document.fonts.ready`);await new Promise(r=>setTimeout(r,100));
   const measured=await evaluate(`(()=>{const stage=document.querySelector('[aria-label="Bingo-Präsentation"]'),bound=stage.getBoundingClientRect(),cells=[...stage.querySelectorAll('[data-number]')];return{count:cells.length,font:document.fonts.check('40px "Bingo Card Display"'),logos:[...stage.querySelectorAll('img')].every(i=>i.complete&&i.naturalWidth>0),fit:stage.dataset.fit,drawn:getComputedStyle(cells[0]).backgroundColor!==getComputedStyle(cells[40]).backgroundColor,latest:getComputedStyle(cells[19]).outlineStyle,inside:cells.every(c=>{const r=c.getBoundingClientRect();return r.left>=bound.left&&r.right<=bound.right&&r.top>=bound.top&&r.bottom<=bound.bottom}),errors:window.errors};})()`);
   assert.deepEqual(measured,{count:75,font:true,logos:true,fit:'fitted',drawn:true,latest:'solid',inside:true,errors:[]});await shot(`praesentation-runde-${String(number).padStart(2,'0')}`);
   const branding=await evaluate(`(()=>{const stage=document.querySelector('[aria-label="Bingo-Präsentation"]'),header=stage.querySelector('header'),logos=[...header.querySelectorAll('img')],status=header.querySelector('span').getBoundingClientRect();return{title:header.querySelector('strong').textContent,background:getComputedStyle(stage).backgroundColor,font:[header,header.querySelector('strong'),header.querySelector('span'),stage.querySelector('aside'),stage.querySelector('[data-current-panel]>span')].every(e=>getComputedStyle(e).fontFamily.includes('Bingo Card Display')),logos:logos.length===2&&logos.every(e=>e.getBoundingClientRect().width>=180&&e.getBoundingClientRect().height>=84),separate:logos.every(e=>e.getBoundingClientRect().left>=status.right),currentDistinct:getComputedStyle(stage.querySelector('[data-state="current"]')).backgroundColor!==getComputedStyle(stage.querySelector('[data-state="drawn"]')).backgroundColor};})()`) as {title:string;background:string;font:boolean;logos:boolean;separate:boolean;currentDistinct:boolean};
   assert.equal(branding.title,`Runde ${number}`);assert.equal(branding.font,true);assert.equal(branding.logos,true);assert.equal(branding.separate,true);assert.equal(branding.currentDistinct,true);backgrounds.add(branding.background);
  }
  assert.equal(backgrounds.size,10);
  for(const [width,height] of [[1280,600],[1280,720],[1366,768],[1920,1080]]){
   await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},sessionId);
   await evaluate('window.showBoard(1,false,25);document.fonts.ready');await new Promise(r=>setTimeout(r,350));
   const geometry=await evaluate(`(()=>{const stage=document.querySelector('[aria-label="Bingo-Präsentation"]'),board=stage.querySelector('[aria-label="Alle Zahlen von 1 bis 75"]'),recent=stage.querySelector('aside'),rows=[...recent.querySelectorAll('li')],number=stage.querySelector('[data-current-number]').getBoundingClientRect(),heading=stage.querySelector('[data-current-panel]>span').getBoundingClientRect(),title=stage.querySelector('header strong').getBoundingClientRect(),progress=stage.querySelector('[aria-label="Ziehungsfortschritt"]');return{aligned:rows.every((e,i)=>{const a=e.getBoundingClientRect(),b=board.querySelector('[data-number="'+((i%5+1)*15)+'"]').getBoundingClientRect();return Math.abs(a.top+a.height/2-b.top-b.height/2)<1}),columns:rows[5].getBoundingClientRect().left>rows[0].getBoundingClientRect().right,order:rows.map(e=>Number(e.querySelector('span').textContent.split(' ')[0])),right:recent.getBoundingClientRect().left>board.getBoundingClientRect().right,fit:stage.dataset.fit,overflow:[stage,recent,...rows].some(e=>e.scrollWidth>e.clientWidth+1||e.scrollHeight>e.clientHeight+1),ratio:heading.width/number.width,centered:Math.abs(heading.left+heading.width/2-number.left-number.width/2)<1,progress:progress.textContent,under:progress.getBoundingClientRect().top>=title.bottom,separator:stage.querySelector('header [aria-hidden]').textContent,old:!!stage.querySelector('footer')||/Läuft|Ziehungen/.test(stage.innerText)};})()`) as {aligned:boolean;columns:boolean;order:number[];right:boolean;fit:string;overflow:boolean;ratio:number;centered:boolean;progress:string;under:boolean;separator:string;old:boolean};
   assert.deepEqual({...geometry,ratio:undefined},{aligned:true,columns:true,order:[25,24,23,22,21,20,19,18,17,16],right:true,fit:'fitted',overflow:false,ratio:undefined,centered:true,progress:'25 von 30',under:true,separator:'×',old:false});
   assert.ok(Math.abs(geometry.ratio-.9)<.01,JSON.stringify({width,height,...geometry}));await shot('raster-letzte10-'+width+'x'+height);
  }

  await evaluate('window.showBoard(1,false,20,true)');
  assert.ok((await evaluate(`document.querySelector('header').textContent`) as string).includes('Bingo bestätigt'));

  for(const count of [0,3,10,25]){await evaluate(`window.showBoard(1,false,${count});document.fonts.ready`);assert.equal(await evaluate(`document.querySelectorAll('aside[aria-label="Letzte 10"] li').length`),Math.min(10,count));}

  assert.equal(await evaluate(`(()=>{const e=new KeyboardEvent('keydown',{key:'+',code:'NumpadAdd',bubbles:true,cancelable:true});window.dispatchEvent(e);return e.defaultPrevented;})()`),false);
  assert.deepEqual(await evaluate(`(()=>{const footer=document.querySelector('aside[aria-label="Letzte 10"]'),rows=[...footer.querySelectorAll('li')];return{count:rows.length,label:footer.querySelector('h2').textContent,scroll:footer.scrollWidth>footer.clientWidth||footer.scrollHeight>footer.clientHeight,old:footer.textContent.includes('Moderator')};})()`),{count:10,label:'Letzte 10',scroll:false,old:false});
  for(const [width,height] of [[390,844],[1280,720]]){
   await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},sessionId);await evaluate('window.showBoard(1);document.fonts.ready');await new Promise(r=>setTimeout(r,100));
   assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
   assert.equal(await evaluate(`document.querySelector('[aria-label="Bingo-Präsentation"]').dataset.fit`),width<640?'unreadable':'fitted');await shot(`presentation-${width}`);
  }
  await call('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},sessionId);
  await evaluate(`window.showBoard(2,true);document.fonts.ready`);await new Promise(r=>setTimeout(r,100));assert.equal(await evaluate(`document.querySelector('ol').getBoundingClientRect().top>=document.querySelector('[data-media-slot]').getBoundingClientRect().bottom`),true);await shot('musik-bingo');
  for(const count of [0,1,2,3]){await evaluate(`window.showCeremony('prizes',${count})`);const text=await evaluate('document.body.innerText') as string;assert.equal(text.includes('Goldpreis'),count===3);assert.equal(text.includes('Silberpreis'),count>=2);assert.equal(text.includes('Bronzepreis'),count>=1);}
  await shot('preise-aufgedeckt');await evaluate(`window.showCeremony('raffle',2)`);await shot('abschlussverlosung');
  await evaluate('window.showModeration()');
  await evaluate(`document.querySelector('[aria-label="Rundennavigation"] button:last-child').click()`);
  assert.ok((await evaluate(`document.querySelector('[role="dialog"]').textContent`) as string).includes('10 von 30'));
  await shot('rundenwechsel-warnung');
  await evaluate(`[...document.querySelector('[role="dialog"]').querySelectorAll('button')].find(b=>b.textContent==='Abbrechen').click()`);
  assert.equal(await evaluate(`window.fixtureView().live.round.id`),'00000000-0000-4000-8000-000000000003');
  await evaluate(`document.querySelector('[aria-label="Rundennavigation"] button:last-child').click()`);
  await evaluate(`[...document.querySelector('[role="dialog"]').querySelectorAll('button')].find(b=>b.textContent==='Wechsel fortsetzen').click()`);await new Promise(r=>setTimeout(r,100));
  assert.equal(await evaluate(`window.fixtureView().live.round.id`),'00000000-0000-4000-8000-000000000005');
  assert.ok(await evaluate(`document.querySelector('[aria-label="Kartendecks je Runde"] [data-active]').textContent.includes('B-001–B-080')`));
  assert.equal(await evaluate(`window.fixtureView().live.state.run.rounds[0].draws.length`),10);
  assert.deepEqual(await evaluate(`(()=>{const publish=document.querySelector('button[aria-label="Zahl veröffentlichen"]'),link=document.querySelector('a[aria-label="Präsentation öffnen"]'),history=document.querySelector('[aria-label="Ziehungshistorie"] ol');return{publish:!!publish?.querySelector('svg')&&!!publish.title&&!publish.textContent,link:!!link?.querySelector('svg'),history:!history||history.scrollHeight<=history.clientHeight+1,noPencil:!document.querySelector('[aria-label="Ziehungshistorie"]').textContent.includes('✎'),outroLocked:document.querySelector('option[value="outro"]').disabled};})()`),{publish:true,link:true,history:true,noPencil:true,outroLocked:true});
  await evaluate('window.showPreparation()');
  assert.equal(await evaluate(`document.querySelectorAll('details').length`),2);
  assert.equal(await evaluate(`document.querySelectorAll('details[open]').length`),0);
  assert.deepEqual(await evaluate(`(()=>{const root=document.querySelector('[data-round-id]').parentElement,sections=[...document.querySelectorAll('details')];return{intro:!!(sections[0].compareDocumentPosition(root)&Node.DOCUMENT_POSITION_FOLLOWING),outro:!!(root.compareDocumentPosition(sections[1])&Node.DOCUMENT_POSITION_FOLLOWING),icons:['Bearbeiten: Runde A','Runde A löschen'].every(label=>{const b=document.querySelector('button[aria-label="'+label+'"]'),r=b?.getBoundingClientRect();return !!b?.querySelector('svg')&&!!b.title&&r.width>=44&&r.height>=44})};})()`),{intro:true,outro:true,icons:true});
  await evaluate(`document.querySelector('details').open=true;window.setSelect(document.querySelector('details select'),'welcome')`);
  // Intro and outro surround the round block and persist independently.
  await evaluate(`(()=>{const d=[...document.querySelectorAll('details')][1];d.open=true;window.setSelect(d.querySelector('select'),'announcements');const input=[...d.querySelectorAll('textarea')].find(e=>e.closest('label').textContent.startsWith('Bekanntmachungen'));Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(input,'Nur im Outro');input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await evaluate(`document.querySelectorAll('details')[1].querySelector('form').requestSubmit()`);await new Promise(r=>setTimeout(r,50));
  assert.equal(await evaluate(`window.fixtureView().ceremony.config.outro.announcements`),'Nur im Outro');
  assert.equal(await evaluate(`window.fixtureView().ceremony.config.welcome`),'Willkommen zum Bingoabend');
  await evaluate('window.showPreparation()');
  await evaluate(`document.querySelector('[aria-label="Runde verschieben"]').focus()`);
  for(const key of ['Space','ArrowDown','Space']){await call('Input.dispatchKeyEvent',{type:'keyDown',key:key==='Space'?' ':key,code:key,windowsVirtualKeyCode:key==='Space'?32:40},sessionId);await call('Input.dispatchKeyEvent',{type:'keyUp',key:key==='Space'?' ':key,code:key,windowsVirtualKeyCode:key==='Space'?32:40},sessionId);await new Promise(r=>setTimeout(r,100));}
  await new Promise(r=>setTimeout(r,100));
  assert.equal(await evaluate(`window.prepCommands.at(-1)?.operation`),'reorderRounds');
  await evaluate('window.showPreparation()');
  assert.equal(await evaluate(`document.querySelector('[data-round-id]').getAttribute('data-round-id')`),'00000000-0000-4000-8000-000000000005');
  await shot('verwaltung-sortiert');
  const previousCommands=await evaluate('window.prepCommands.length');
  await evaluate(`window.confirm=()=>false;document.querySelector('button[aria-label="Runde A löschen"]').click()`);
  assert.equal(await evaluate('window.prepCommands.length'),previousCommands);
  await evaluate(`window.confirm=message=>{window.lastConfirmation=message;return true};document.querySelector('button[aria-label="Runde A löschen"]').click()`);
  assert.equal(await evaluate('window.prepCommands.at(-1)?.operation'),'removeRound');
  assert.equal(await evaluate('window.prepCommands.at(-1)?.roundId'),'00000000-0000-4000-8000-000000000003');
  assert.ok((await evaluate('window.lastConfirmation') as string).includes('Runde A wirklich löschen?'));

  assert.deepEqual(await evaluate('window.errors'),[]);
 }finally{socket?.close();browser.kill();if(browser.exitCode===null)await new Promise(r=>browser.once('exit',r));await new Promise<void>(r=>server.close(()=>r()));rmSync(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
});
function requireSeparator(){return process.platform==='win32'?'\\':'/';}
