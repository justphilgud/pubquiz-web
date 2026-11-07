import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {existsSync,mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
test('Bingo actual browser media activation, stable polling, pause/replay, reload and stale source stop',{timeout:60000},async()=>{
 const chrome=[process.env.CHROME_BIN,'C:/Program Files/Google/Chrome/Application/chrome.exe','/usr/bin/google-chrome','/usr/bin/chromium'].find(p=>p&&existsSync(p));assert.ok(chrome);
 const source=String.raw`
 import React from 'react';import{createRoot}from'react-dom/client';import{flushSync}from'react-dom';
 import Matching from './app/bingo/live/MatchingPresentation';
 const root=createRoot(document.getElementById('app'));let data={id:'run',status:'RUNNING',draws:[{id:'draw-1',number:1}],content:{kind:'AUDIO',url:'/sample.wav'},playback:undefined,serverAt:1000};
 let playCount=0;const nativePlay=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){playCount++;return nativePlay.call(this)};
 const show=(change={},connected=true)=>{data={...data,...change};flushSync(()=>root.render(<Matching key={connected?'online':'offline'} data={data} connected={connected}/>));};
 const cue=(id,action,sequence,position=0,restartId=null)=>({id,drawId:data.draws.at(-1).id,action,sequence,position,restartId,at:1000});
 const wait=async(f)=>{for(let i=0;i<300;i++){if(f())return;await new Promise(r=>setTimeout(r,20));}throw Error('timeout '+document.body.innerText)};
 const check=(v,m)=>{if(!v)throw Error(m)},delay=ms=>new Promise(r=>setTimeout(r,ms));
 const enable=()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent==='Präsentation freigeben');check(b,'activation missing');b.click()};
 async function run(){
  show();await wait(()=>document.querySelector('audio')?.readyState>=1);check(document.querySelector('audio').paused,'initial autoplay');check(playCount===0,'play before activation');
  show({playback:cue('old','PLAY',1)});await delay(100);check(playCount===0,'command bypassed activation');enable();await delay(100);check(playCount===0,'activation replayed an old command');
  show({playback:cue('play','PLAY',2)});await wait(()=>!document.querySelector('audio').paused);const first=document.querySelector('audio');await wait(()=>first.currentTime>.1);const count=playCount;
  for(let i=0;i<8;i++){show({revision:i,playback:{...data.playback},serverAt:1000+i});await delay(20);}check(playCount===count,'poll restarted media');check(document.querySelector('audio')===first,'poll replaced media node');
  show({playback:cue('pause','PAUSE',3,1.2)});await wait(()=>first.paused&&Math.abs(first.currentTime-1.2)<.2);
  show({playback:cue('resume','PLAY',4,1.2)});await wait(()=>!first.paused&&first.currentTime>=1.2);
  show({playback:cue('replay','REPLAY',5,0,'replay')});await wait(()=>document.querySelector('audio')!==first&&!document.querySelector('audio').paused);check(first.paused,'old replay node continues');check(document.querySelector('audio').currentTime<1,'replay did not restart');
  const replay=document.querySelector('audio');show({status:'PAUSED',playback:cue('global-pause','PAUSE',6,.4,'replay')});await wait(()=>replay.paused);show({status:'RUNNING'});await delay(120);check(replay.paused,'resume auto-replayed stale command');
  show({playback:cue('after-pause','PLAY',7,.4,'replay')});await wait(()=>!replay.paused);
  show({},false);check(replay.paused,'offline retained old playback');show({},true);await wait(()=>document.querySelector('button')?.textContent==='Präsentation freigeben');check(document.querySelector('audio').paused,'reconnect autoplay');enable();const before=playCount;await delay(100);check(playCount===before,'reconnect replayed old cue');
  show({playback:cue('after-online','PLAY',8,.5,'replay')});await wait(()=>!document.querySelector('audio').paused);const online=document.querySelector('audio');flushSync(()=>root.render(null));check(online.paused,'unmount kept sound');show();await wait(()=>document.querySelector('audio'));enable();await delay(100);check(document.querySelector('audio').paused,'reload replayed old cue');
  show({playback:cue('fresh','PLAY',9,.7,'replay')});await wait(()=>!document.querySelector('audio').paused);const old=document.querySelector('audio');
  show({draws:[...data.draws,{id:'draw-2',number:2}],content:{kind:'AUDIO',url:'/other.wav'},playback:undefined});await wait(()=>document.querySelector('audio')!==old);check(old.paused,'number/source change kept old sound');check(document.querySelector('audio').paused,'new number autoplays');
  show({content:{kind:'AUDIO',url:'/missing.wav'}});await wait(()=>document.querySelector('[role=status]')?.textContent.includes('konnte nicht geladen'));check(document.querySelectorAll('audio').length===1,'duplicate audio elements');
  document.getElementById('result').textContent='PASS';
 }
 run().catch(e=>document.getElementById('result').textContent='ERROR '+e.message);
 `;
 const bundle=await build({stdin:{contents:source,resolveDir:process.cwd(),loader:'tsx'},bundle:true,platform:'browser',format:'iife',write:false,outdir:'out',loader:{'.css':'local-css'},define:{'process.env.NODE_ENV':'"production"','process.env':'{}'}});
 const js=bundle.outputFiles.find(f=>f.path.endsWith('.js'))!,css=bundle.outputFiles.find(f=>f.path.endsWith('.css'))!;
 const wav=Buffer.alloc(44+16000*12);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(8000,24);wav.writeUInt32LE(16000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(wav.length-44,40);
 const server=createServer((req,res)=>{if(req.url==='/bundle.js'){res.setHeader('Content-Type','application/javascript');res.end(js.contents);}else if(req.url==='/style.css'){res.setHeader('Content-Type','text/css');res.end(css.contents);}else if(req.url==='/sample.wav'||req.url==='/other.wav'){const m=/bytes=(\d+)-(\d*)/.exec(req.headers.range??''),from=m?Number(m[1]):0,to=m&&m[2]?Number(m[2]):wav.length-1;res.setHeader('Content-Type','audio/wav');res.setHeader('Accept-Ranges','bytes');res.setHeader('Content-Length',to-from+1);if(m){res.statusCode=206;res.setHeader('Content-Range',`bytes ${from}-${to}/${wav.length}`);}res.end(wav.subarray(from,to+1));}else if(req.url==='/missing.wav'){res.statusCode=404;res.end();}else {res.setHeader('Content-Type','text/html');res.end('<meta charset="utf-8"><link rel="stylesheet" href="/style.css"><div id="app"></div><pre id="result">PENDING</pre><script>window.onerror=m=>document.getElementById("result").textContent="ERROR "+m;window.onunhandledrejection=e=>document.getElementById("result").textContent="ERROR "+e.reason;</script><script src="/bundle.js"></script>');}});
 await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const address=server.address();assert.ok(address&&typeof address!=='string');
 const profile=mkdtempSync(join(tmpdir(),'bingo-matching-browser-')),browser=spawn(chrome,['--headless=new','--no-sandbox','--disable-gpu','--disable-background-networking','--no-first-run','--autoplay-policy=no-user-gesture-required',`--user-data-dir=${profile}`,'--remote-debugging-port=0','about:blank'],{stdio:'ignore',windowsHide:true});let socket:WebSocket|undefined;
 try{const deadline=Date.now()+45000,portFile=join(profile,'DevToolsActivePort');while(!existsSync(portFile)&&Date.now()<deadline)await new Promise(r=>setTimeout(r,50));assert.ok(existsSync(portFile));const [port,endpoint]=readFileSync(portFile,'utf8').trim().split(/\r?\n/);socket=new WebSocket(`ws://127.0.0.1:${port}${endpoint}`);await new Promise<void>((resolve,reject)=>{socket!.onopen=()=>resolve();socket!.onerror=()=>reject(Error('CDP unavailable'));});
  type Result={targetId?:string;sessionId?:string;result?:{value?:string}};let id=0;const pending=new Map<number,(r:Result)=>void>();socket.onmessage=e=>{const m=JSON.parse(String(e.data)) as {id:number;result:Result};pending.get(m.id)?.(m.result);pending.delete(m.id);};const call=(method:string,params:Record<string,unknown>,sessionId?:string)=>new Promise<Result>(resolve=>{const n=++id;pending.set(n,resolve);socket!.send(JSON.stringify({id:n,method,params,sessionId}));});const {targetId}=await call('Target.createTarget',{url:`http://127.0.0.1:${address.port}`}),{sessionId}=await call('Target.attachToTarget',{targetId,flatten:true});let result='PENDING';while(Date.now()<deadline){const r=await call('Runtime.evaluate',{expression:"document.getElementById('result')?.textContent||'PENDING'",returnByValue:true},sessionId);result=r.result?.value??'PENDING';if(result!=='PENDING')break;await new Promise(r=>setTimeout(r,50));}assert.equal(result,'PASS');
 }finally{socket?.close();browser.kill();if(browser.exitCode===null)await new Promise(r=>browser.once('exit',r));server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));rmSync(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
});
