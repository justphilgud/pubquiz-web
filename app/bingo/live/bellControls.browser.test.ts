import assert from 'node:assert/strict';
import test from 'node:test';
import {build} from 'esbuild';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {existsSync,mkdtempSync,readFileSync,rmSync,mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';

test('Bingo checks: 7×4 grid/history, mobile containment, fresh input focus, explicit decisions and independent clocks',{timeout:60000},async()=>{
 const source=String.raw`
 import React,{useState} from 'react';import{createRoot}from'react-dom/client';import{flushSync}from'react-dom';
 import Panel from './app/bingo/live/CardChecksPanel';import Clock from './app/bingo/live/LiveTimes';
 import{generateCard,evaluateCard}from'./app/bingo/core/cards';import styles from './app/bingo/live/EventModerationPanel.module.css';
 const root=createRoot(document.getElementById('app'));let choice=null;
 const cards=Array.from({length:32},(_,i)=>({...generateCard('card-'+i,()=>0),code:'BG-'+i,shortCode:'A-'+String(i+1).padStart(3,'0'),ordinal:i+1}));
 const draws=cards[0].cells[0].map((number,i)=>({id:'d'+i,number,position:i+1}));
 const checks=cards.map((card,i)=>({id:'c'+i,cardId:card.id,roundId:'r',at:1000+i,throughPosition:5,draws,original:evaluateCard(card.cells,draws.map(d=>d.number))}));
 function Fixture({running=true,serverAt=1000}){const [history,setHistory]=useState(checks);return <main className={styles.root} style={{height:'auto',padding:10,'--bingo-paper':'#faf8f2','--bingo-ink':'#171717','--bingo-pink':'#F6C4DC','--bingo-yellow':'#F0FC16'}}><div id="clock"><Clock sample={{serverAt,elapsedMs:60000,roundElapsedMs:30000}} running={running}/></div><Panel gameId="game" runId="run" checks={history} cards={cards} draws={draws} claims={[]} disabled={false} onDecision={c=>choice=c} onCheck={async cardId=>{setHistory(old=>[...old,{...checks[0],id:'repeat',cardId}]);return true;}}/></main>}
 const wait=async f=>{for(let i=0;i<200;i++){if(f())return;await new Promise(r=>setTimeout(r,10));}throw Error('timeout '+document.body.innerText.slice(-300));};
 const check=(v,m)=>{if(!v)throw Error(m)};
 function set(input,value){flushSync(()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));});}
 window.run=async()=>{
  flushSync(()=>root.render(<Fixture key={Math.random()}/>));await wait(()=>document.querySelector('ol'));
  const grid=document.querySelector('ol'),tiles=[...grid.children],box=grid.parentElement,style=getComputedStyle(grid);
  check(tiles.length===32,'32 saved cards remain');check(style.gridTemplateColumns.split(' ').length===7,'seven columns');
  const a=tiles[0].getBoundingClientRect(),eighth=tiles[7].getBoundingClientRect();check(Math.abs(a.left-eighth.left)<1&&eighth.top>a.top,'eighth card starts row two');
  check(box.clientHeight===610,'four 145px rows plus three 10px gaps');check(box.scrollHeight>box.clientHeight,'fifth row retained in scroll history');
  check(document.documentElement.scrollWidth<=innerWidth,'no page-level horizontal overflow');
  check(tiles.every(t=>t.scrollHeight<=t.clientHeight+1),'tiles do not hide their default content in nested scrolling');
  check([...grid.querySelectorAll('a')].every(a=>a.target==='_blank'),'card snapshots open separately');
  const input=document.querySelector('input');set(input,'unknown');flushSync(()=>input.form.requestSubmit());await wait(()=>document.querySelector('[role=alert]'));check(grid.children.length===32,'unknown does not register');
  set(input,'a-001');flushSync(()=>input.form.requestSubmit());await wait(()=>input.value===''&&document.activeElement===input);check(grid.children.length===32,'repeat is grouped, input ready and focused');
  flushSync(()=>tiles[0].querySelector('button').click());await wait(()=>document.querySelector('[aria-label="Ausgewählte Kartenprüfung"]'));
  const detail=document.querySelector('[aria-label="Ausgewählte Kartenprüfung"]');check(detail.querySelectorAll('a').length===2,'both original/repeat snapshots retained');
  set(detail.querySelector('input[name=reason]'),'Explicit review');flushSync(()=>detail.querySelector('form').requestSubmit());check(choice?.kind==='decideCheck','decision requires explicit submit');
  const initial=document.getElementById('clock').innerText;await wait(()=>document.getElementById('clock').innerText!==initial);
  flushSync(()=>root.render(<Fixture key="paused" running={false} serverAt={2000}/>));const paused=document.getElementById('clock').innerText;await new Promise(r=>setTimeout(r,1100));check(paused===document.getElementById('clock').innerText,'paused timer frozen without clicks');
  return {width:innerWidth,height:innerHeight,cards:32,columns:7,visibleRows:4,passed:true};
 };
`;
 const bundle=await build({stdin:{contents:source,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'browser',format:'iife',outdir:'out',loader:{'.css':'local-css'},define:{'process.env.NODE_ENV':'"production"','process.env':'{}'},plugins:[{name:'read-only-test-actions',setup(b){b.onResolve({filter:/^\.\/actions$/},a=>a.importer.endsWith('CardChecksPanel.tsx')?{path:'actions',namespace:'fixture'}:undefined);b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:"export async function resolveCardCode(_game,code){return code.toLowerCase()==='a-001'?{success:true,cardId:'card-0'}:{success:false,message:'Karte im aktuellen Bingo-Abend nicht gefunden'}}"}));}}]});
 const js=bundle.outputFiles.find(f=>f.path.endsWith('.js'))!,css=bundle.outputFiles.find(f=>f.path.endsWith('.css'))!;
 const server=createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/bundle.js'?'text/javascript':req.url==='/style.css'?'text/css':'text/html');res.end(req.url==='/bundle.js'?js.contents:req.url==='/style.css'?css.contents:'<meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/style.css"><style>html,body{margin:0}*{box-sizing:border-box}</style><div id="app"></div><script src="/bundle.js"></script>');});
 await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const address=server.address();assert.ok(address&&typeof address!=='string');
 const chrome=[process.env.CHROME_BIN,'C:/Program Files/Google/Chrome/Application/chrome.exe','/usr/bin/google-chrome','/usr/bin/chromium'].find(p=>p&&existsSync(p));assert.ok(chrome);
 const profile=mkdtempSync(join(tmpdir(),'bingo-bell-controls-')),browser=spawn(chrome,['--headless=new','--no-sandbox','--disable-gpu','--no-first-run',`--user-data-dir=${profile}`,'--remote-debugging-port=0','about:blank'],{stdio:'ignore'});
 let socket:WebSocket|undefined;
 try{
  const portFile=join(profile,'DevToolsActivePort'),deadline=Date.now()+30000;let portInfo='';
  while(Date.now()<deadline){try{portInfo=readFileSync(portFile,'utf8');if(portInfo.trim().split(/\r?\n/).length===2)break;}catch{}await new Promise(r=>setTimeout(r,50));}
  assert.ok(portInfo);const [port,endpoint]=portInfo.trim().split(/\r?\n/);socket=new WebSocket(`ws://127.0.0.1:${port}${endpoint}`);await new Promise<void>((r,j)=>{socket!.onopen=()=>r();socket!.onerror=()=>j(Error('Browser connection'));});
  type Reply={targetId?:string;sessionId?:string;result?:{value?:unknown};exceptionDetails?:unknown;data?:string};let id=0;const pending=new Map<number,{resolve:(v:Reply)=>void;reject:(e:Error)=>void}>();
  socket.onmessage=e=>{const m=JSON.parse(String(e.data));if(!m.id)return;const p=pending.get(m.id);pending.delete(m.id);if(m.error)p?.reject(Error(m.error.message));else p?.resolve(m.result);};
  const call=(method:string,params:Record<string,unknown>,sessionId?:string)=>new Promise<Reply>((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});socket!.send(JSON.stringify({id:n,method,params,sessionId}));});
  const {targetId}=await call('Target.createTarget',{url:`http://127.0.0.1:${address.port}`}),{sessionId}=await call('Target.attachToTarget',{targetId,flatten:true});
  for(const [width,height] of [[1366,768],[390,844]]){
   await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<500},sessionId);
   const result=await call('Runtime.evaluate',{expression:'window.run()',awaitPromise:true,returnByValue:true},sessionId);assert.equal(result.exceptionDetails,undefined,JSON.stringify(result));assert.deepEqual(result.result?.value,{width,height,cards:32,columns:7,visibleRows:4,passed:true});
   mkdirSync('.artifacts/bingo-bell',{recursive:true});const shot=await call('Page.captureScreenshot',{format:'png'},sessionId);writeFileSync(`.artifacts/bingo-bell/controls-${width}.png`,Buffer.from(shot.data!,'base64'));
  }
 }finally{
  socket?.close();browser.kill();if(browser.exitCode===null)await new Promise(r=>browser.once('exit',r));await new Promise<void>(r=>server.close(()=>r()));
  // This is a uniquely created test profile, never an existing user profile.
  rmSync(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});
 }
});
