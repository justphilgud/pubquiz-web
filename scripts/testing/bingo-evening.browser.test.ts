import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {existsSync,readFileSync,mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';

test('Bingo workstation, editable history, ten Full-HD colour schemes and shared prize/raffle scenes',{timeout:90000},async()=>{
 const source=String.raw`
 import React from 'react';import{createRoot}from'react-dom/client';import{flushSync}from'react-dom';
 import Board from './app/bingo/live/BingoBoard';import Panel from './app/bingo/live/EventModerationPanel';import Ceremony from './app/rendering/ceremony/CeremonySlide';
 import{getPresentationTemplate}from'./app/rendering/templateRegistry';import{generateCard,evaluateCard}from'./app/bingo/core/cards';
 import{applyEventRunEvent,initialEventRun,currentEventRound}from'./app/bingo/live/eventRun';import{defaultCeremony}from'./app/rendering/ceremony/ceremony';
 const root=createRoot(document.getElementById('app')),id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
 const t=getPresentationTemplate('lovd-ungegoogelt'),design={version:1,templateId:'lovd-ungegoogelt',name:'LOVD',config:{version:1,tokens:t.tokens,design:t.design,surfaces:{presentation:t.variant,answerForm:'BRANDED',moderation:'BRANDED'}}};
 const card={...generateCard(id(900),()=>0),code:'BG-SYNTHETIC-001',shortCode:'A-001',ordinal:1};let seq=100,ceremony=defaultCeremony(),state;
 const round={id:id(3),label:'Binglöckchen · Runde 1',target:30,issued:null,seriesIds:[id(4)]};
 function command(c){state=applyEventRunEvent(state,{id:id(seq++),at:2000+seq,actorId:1,command:c},[card]);}
 function view(){const r=currentEventRound(state);return{protocol:2,gameId:id(2),title:'Binglöckchen · 08.12.2026',seriesId:10,archived:false,preparationRevision:0,rounds:[{id:round.id,label:round.label,series:[{series_id:id(4)}]}],plan:[{round_id:round.id,position:1}],runs:[],preparation:{rounds:[]},ceremony,live:{id:id(1),revision:seq,startedAt:1000,round,state,events:[],cards:[card],checkCards:[card],matchingEntry:null,design,serverAt:Date.now(),elapsedMs:100000,roundElapsedMs:100000,callContext:'a'.repeat(64),blocked:state.calls.some(c=>!r.claims.some(cl=>cl.id===c.id)),between:false,summary:[],raffle:{count:0,max:0,overCapacity:false,needsReview:false,voidNumbers:[],entries:[]}}};}
 window.fixtureView=view;
 window.fakeSave=async input=>{if(input.operation==='command')command(input.command);return{success:true};};
 window.fakeCeremony=async(_g,_r,c)=>{ceremony={...ceremony,revision:ceremony.revision+1,slide:c.slide??ceremony.slide,revealCount:c.kind==='reveal'?ceremony.revealCount+1:0};return{success:true,state:ceremony};};
 window.fetch=async()=>({ok:true,status:200,json:async()=>view(),headers:new Headers()});
 window.showModeration=()=>{seq=100;state=initialEventRun(id(1),id(2),round,1000);for(const number of [1,16,31,46,61,2,17,32,47,62])command({kind:'draw',number});flushSync(()=>root.render(<Panel key={seq} initial={view()}/>));};
 window.openCall=()=>{command({kind:'call',stage:'BINGO',context:'a'.repeat(64)});};
 window.showBoard=(roundNumber,media=false)=>{const data={id:'fixture',revision:20,startedAt:1,status:'RUNNING',label:'Binglöckchen',roundNumber,target:30,draws:Array.from({length:20},(_,i)=>({id:String(i),position:i+1,number:i+1})),design,assetBase:null,claims:[],...(media?{content:{kind:'IMAGE',url:'/fixture.svg',answer:'Musik-Bingo'}}:{})};flushSync(()=>root.render(<div style={{height:'100dvh'}}><Board data={data}/></div>));};
 window.showCeremony=(slide,revealCount=0)=>{const state={...defaultCeremony(),slide,revealCount,config:{...defaultCeremony().config,prizes:['Goldpreis','Silberpreis','Bronzepreis']}};flushSync(()=>root.render(<div style={{height:'100dvh'}}><Ceremony state={state} title="Binglöckchen" winner={{number:23,cardCode:'B-045',roundLabel:'Runde 2'}}/></div>));};
 window.setInput=(input,value)=>flushSync(()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));});
 window.setSelect=(select,value)=>flushSync(()=>{select.value=value;select.dispatchEvent(new Event('change',{bubbles:true}));});
 window.errors=[];window.onerror=m=>window.errors.push(m);window.showModeration();
 `;
 const bundle=await build({stdin:{contents:source,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'browser',format:'iife',outdir:'out',loader:{'.css':'local-css'},define:{'process.env.NODE_ENV':'"production"','process.env':'{}'},plugins:[{name:'synthetic-boundaries',setup(b){
  b.onResolve({filter:/^(next\/link|next\/navigation)$/},a=>({path:a.path,namespace:'test'}));
  b.onResolve({filter:/PreparationPanel$/},a=>a.importer.endsWith('EventModerationPanel.tsx')?{path:'prep',namespace:'test'}:undefined);
  b.onResolve({filter:/useContentNavigationGuard$/},()=>({path:'guard',namespace:'test'}));
  b.onResolve({filter:/\/actions$|ceremonyActions$/},a=>/[\\/]bingo[\\/]/.test(a.importer)?{path:a.path.includes('ceremony')?'ceremony':'actions',namespace:'test'}:undefined);
  b.onLoad({filter:/.*/,namespace:'test'},a=>({resolveDir:process.cwd(),loader:'tsx',contents:a.path==='next/link'?`import React from 'react';export default function Link({children,...props}){return <a {...props}>{children}</a>}`:a.path==='next/navigation'?`export const useRouter=()=>({replace(){},refresh(){}});` :a.path==='prep'?`export const RoundEditor=()=>null;`:a.path==='guard'?`export const useContentNavigationGuard=()=>()=>{};`:a.path==='ceremony'?`export const saveCeremony=(...args)=>window.fakeCeremony(...args);`:`export async function findMatchingSources(){return []}export async function getMatchingSource(){return null}export async function getMatchingTemplates(){return []}export const saveEventRun=(...args)=>window.fakeSave(...args);export async function resolveCardCode(_g,code){return code.toUpperCase()==='A-001'?{success:true,cardId:'00000000-0000-4000-8000-000000000900'}:{success:false,message:'Karte im aktuellen Bingo-Abend nicht gefunden'}};`}));
 }}]});
 const js=bundle.outputFiles.find(f=>f.path.endsWith('.js'))!,css=bundle.outputFiles.find(f=>f.path.endsWith('.css'))!;
 const server=createServer((req,res)=>{
  const url=req.url??'/';if(url==='/bundle.js'){res.setHeader('Content-Type','text/javascript');res.end(js.contents);return;}if(url==='/style.css'){res.setHeader('Content-Type','text/css');res.end(css.contents);return;}
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
  mkdirSync('docs/acceptance/assets/bingo-evening',{recursive:true});const shot=async(name:string)=>{const result=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false},sessionId);writeFileSync(`docs/acceptance/assets/bingo-evening/${name}.png`,Buffer.from(result.data!,'base64'));};
  for(const [width,height] of [[1366,768],[1920,1080]]){
   await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},sessionId);await evaluate('window.showModeration()');await new Promise(r=>setTimeout(r,100));
   const layout=await evaluate(`(()=>{const workspace=document.querySelector('[aria-label="Zahlenarbeitsfläche"]'),form=workspace.querySelector('form'),current=workspace.querySelector('[aria-live="polite"]'),checks=document.querySelector('[aria-label="Automatische Kartenprüfung"]');return{left:form.getBoundingClientRect().left<current.getBoundingClientRect().left,within:checks.getBoundingClientRect().bottom<=innerHeight,noMatrix:!document.querySelector('[aria-label="Zahlenübersicht"]'),ceremony:!!document.querySelector('[aria-label="Intro und Outro"] select'),history:document.querySelector('[aria-label="Ziehungshistorie"]').querySelectorAll('li').length,scroll:document.documentElement.scrollWidth>innerWidth};})()`);
   assert.deepEqual(layout,{left:true,within:true,noMatrix:true,ceremony:true,history:10,scroll:false});await shot(`moderation-${width}`);
  }
  const sorts=await evaluate(`(()=>{const history=document.querySelector('[aria-label="Ziehungshistorie"]'),select=history.querySelector('select'),results={};for(const order of ['ORDER_ASC','ORDER_DESC','NUMBER_ASC','NUMBER_DESC']){window.setSelect(select,order);results[order]=[...history.querySelectorAll('li')].map(li=>li.innerText);}return results;})()` ) as Record<string,string[]>;
  assert.ok(sorts.ORDER_DESC[0].includes('#10'));assert.ok(sorts.ORDER_ASC[0].includes('#1'));assert.ok(sorts.NUMBER_ASC[0].includes('B 1'));assert.ok(sorts.NUMBER_DESC[0].includes('O 62'));
  await evaluate(`window.setSelect(document.querySelector('[aria-label="Ziehungshistorie"] select'),'ORDER_ASC');document.querySelector('[aria-label="Ziehungshistorie"] li button').click()`);
  await evaluate(`(()=>{const form=document.querySelector('[aria-label="Ziehungshistorie"] form'),inputs=form.querySelectorAll('input');window.setInput(inputs[0],'3');window.setInput(inputs[1],'Frühere Kugel berichtigt');form.requestSubmit();})()`);
  await evaluate(`[...document.querySelectorAll('[role="dialog"] button')].find(b=>b.textContent==='Bestätigen').click()`);
  await new Promise(r=>setTimeout(r,100));
  assert.deepEqual(await evaluate(`(()=>{const r=window.fixtureView().live.state.run.rounds[0];return{position:r.draws[0].position,number:r.draws[0].number,latest:r.draws.at(-1).number,corrections:r.corrections.length};})()`),{position:1,number:3,latest:62,corrections:1});
  await evaluate(`window.openCall()`);await new Promise(r=>setTimeout(r,1600));assert.equal(await evaluate(`document.querySelector('[aria-label="Zahlenarbeitsfläche"] input').disabled`),false);
  for(let number=1;number<=10;number++){
   await evaluate(`window.showBoard(${number});document.fonts.ready`);await new Promise(r=>setTimeout(r,100));
   const measured=await evaluate(`(()=>{const stage=document.querySelector('[aria-label="Bingo-Präsentation"]'),bound=stage.getBoundingClientRect(),cells=[...stage.querySelectorAll('[data-number]')];return{count:cells.length,font:document.fonts.check('40px "Bingo Card Display"'),logos:[...stage.querySelectorAll('img')].every(i=>i.complete&&i.naturalWidth>0),fit:stage.dataset.fit,drawn:getComputedStyle(cells[0]).backgroundColor!==getComputedStyle(cells[40]).backgroundColor,latest:getComputedStyle(cells[19]).outlineStyle,inside:cells.every(c=>{const r=c.getBoundingClientRect();return r.left>=bound.left&&r.right<=bound.right&&r.top>=bound.top&&r.bottom<=bound.bottom}),errors:window.errors};})()`);
   assert.deepEqual(measured,{count:75,font:true,logos:true,fit:'fitted',drawn:true,latest:'solid',inside:true,errors:[]});await shot(`praesentation-runde-${String(number).padStart(2,'0')}`);
  }
  await evaluate(`window.showBoard(2,true);document.fonts.ready`);await new Promise(r=>setTimeout(r,100));assert.equal(await evaluate(`document.querySelector('ol').getBoundingClientRect().top>=document.querySelector('[data-media-slot]').getBoundingClientRect().bottom`),true);await shot('musik-bingo');
  for(const count of [0,1,2,3]){await evaluate(`window.showCeremony('prizes',${count})`);const text=await evaluate('document.body.innerText') as string;assert.equal(text.includes('Goldpreis'),count===3);assert.equal(text.includes('Silberpreis'),count>=2);assert.equal(text.includes('Bronzepreis'),count>=1);}
  await shot('preise-aufgedeckt');await evaluate(`window.showCeremony('raffle',2)`);await shot('abschlussverlosung');
  assert.deepEqual(await evaluate('window.errors'),[]);
 }finally{socket?.close();browser.kill();if(browser.exitCode===null)await new Promise(r=>browser.once('exit',r));await new Promise<void>(r=>server.close(()=>r()));rmSync(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
});
function requireSeparator(){return process.platform==='win32'?'\\':'/';}
