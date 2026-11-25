import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createServer} from 'node:http';
import {BINGO_BELL_PLAN} from './production-preflight-bingo-bell-plan';
import {posix} from 'node:path';
import {execFileSync,spawn} from 'node:child_process';
import {existsSync,mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
test('PR180 immutable correction form: earlier draw, invalid values, duplicate, cancel and exact save',{timeout:60000},async()=>{
 const chrome=[process.env.CHROME_BIN,'C:/Program Files/Google/Chrome/Application/chrome.exe','/usr/bin/google-chrome','/usr/bin/chromium'].find(p=>p&&existsSync(p));assert.ok(chrome);
 const source=String.raw`
 import React from 'react';import {createRoot} from 'react-dom/client';import {flushSync} from 'react-dom';
 import Correction from './candidate-correction';
 const draws=[{id:'first',number:1,position:1},{id:'second',number:16,position:2}];let commands=[];
 const root=createRoot(document.getElementById('app'));flushSync(()=>root.render(<Correction draws={draws} disabled={false} onCorrect={c=>commands.push(c)}/>));
 const wait=async f=>{for(let i=0;i<100;i++){if(f())return;await new Promise(r=>setTimeout(r,20));}throw Error('timeout')};
 const check=(v,m)=>{if(!v)throw Error(m)},button=text=>[...document.querySelectorAll('button')].find(b=>b.textContent.includes(text));
 const set=(input,value)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));};
 async function run(){
  await wait(()=>document.querySelector('details'));document.querySelector('details').open=true;button('Ziehung 1').click();await wait(()=>document.querySelector('form'));
  const input=()=>document.querySelector('form input');set(input(),'16');await wait(()=>document.querySelector('[role=alert]'));check(button('Korrektur speichern').disabled,'duplicate accepted');
  for(const value of ['0','76','1e1','2.5','B 2']){set(input(),value);await new Promise(r=>setTimeout(r,10));check(button('Korrektur speichern').disabled,'invalid accepted '+value);}
  set(input(),'75');set(document.querySelectorAll('form input')[1],'Synthetic correction');await wait(()=>!button('Korrektur speichern').disabled);button('Abbrechen').click();await wait(()=>!document.querySelector('form'));check(commands.length===0,'cancel published');
  button('Ziehung 1').click();await wait(()=>document.querySelector('form'));set(input(),'75');set(document.querySelectorAll('form input')[1],'Synthetic correction');await wait(()=>!button('Korrektur speichern').disabled);
  check(document.querySelector('form').textContent.includes('B 1 → O 75'),'preview mismatch');button('Korrektur speichern').click();await wait(()=>commands.length===1);
  check(JSON.stringify(commands[0])===JSON.stringify({kind:'correct',drawId:'first',number:75,reason:'Synthetic correction'}),'wrong position/save command');check(draws[0].number===1,'form mutated source');document.getElementById('result').textContent='PASS';
 }
 run().catch(e=>document.getElementById('result').textContent='ERROR '+e.message);
 `;
 const bundle=await build({jsx:'automatic',plugins:[{name:'immutable-correction',setup(api){api.onResolve({filter:/.*/},args=>{if(args.path==='./candidate-correction')return {path:'app/bingo/live/DrawCorrection.tsx',namespace:'candidate'};if(args.namespace==='candidate'&&args.path.startsWith('.'))return {path:posix.normalize(posix.join(posix.dirname(args.importer),args.path)),namespace:'candidate'};});api.onLoad({filter:/.*/,namespace:'candidate'},args=>{if(args.path.endsWith('.css'))return {contents:'export default {}',loader:'js'};for(const suffix of ['', '.ts','.tsx']){try{return {contents:execFileSync('git',['show',BINGO_BELL_PLAN.candidateSha+':'+args.path+suffix],{encoding:'utf8',stdio:['pipe','pipe','pipe']}),loader:'tsx',resolveDir:process.cwd()};}catch{}}throw Error('Immutable candidate source missing');});}}],stdin:{contents:source,resolveDir:process.cwd(),loader:'tsx'},bundle:true,platform:'browser',format:'iife',write:false,outdir:'out',loader:{'.css':'local-css'},define:{'process.env.NODE_ENV':'"production"','process.env':'{}'}});
 const js=bundle.outputFiles.find(f=>f.path.endsWith('.js'))!,css=bundle.outputFiles.find(f=>f.path.endsWith('.css'));
 const wav=Buffer.alloc(44+16000*12);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(8000,24);wav.writeUInt32LE(16000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(wav.length-44,40);
 const server=createServer((req,res)=>{if(req.url==='/bundle.js'){res.setHeader('Content-Type','application/javascript');res.end(js.contents);}else if(req.url==='/style.css'){res.setHeader('Content-Type','text/css');res.end(css?.contents??'');}else if(req.url==='/sample.wav'||req.url==='/other.wav'){const m=/bytes=(\d+)-(\d*)/.exec(req.headers.range??''),from=m?Number(m[1]):0,to=m&&m[2]?Number(m[2]):wav.length-1;res.setHeader('Content-Type','audio/wav');res.setHeader('Accept-Ranges','bytes');res.setHeader('Content-Length',to-from+1);if(m){res.statusCode=206;res.setHeader('Content-Range',`bytes ${from}-${to}/${wav.length}`);}res.end(wav.subarray(from,to+1));}else if(req.url==='/missing.wav'){res.statusCode=404;res.end();}else {res.setHeader('Content-Type','text/html');res.end('<meta charset="utf-8"><link rel="stylesheet" href="/style.css"><div id="app" style="width:300px;height:300px"></div><pre id="result">PENDING</pre><script>window.onerror=m=>document.getElementById("result").textContent="ERROR "+m;window.onunhandledrejection=e=>document.getElementById("result").textContent="ERROR "+e.reason;</script><script src="/bundle.js"></script>');}});
 await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const address=server.address();assert.ok(address&&typeof address!=='string');
 const profile=mkdtempSync(join(tmpdir(),'bingo-matching-browser-')),browser=spawn(chrome,['--headless=new','--no-sandbox','--disable-gpu','--disable-background-networking','--no-first-run','--autoplay-policy=no-user-gesture-required',`--user-data-dir=${profile}`,'--remote-debugging-port=0','about:blank'],{stdio:'ignore',windowsHide:true});let socket:WebSocket|undefined;
 try{const deadline=Date.now()+45000,portFile=join(profile,'DevToolsActivePort');while(!existsSync(portFile)&&Date.now()<deadline)await new Promise(r=>setTimeout(r,50));assert.ok(existsSync(portFile));const [port,endpoint]=readFileSync(portFile,'utf8').trim().split(/\r?\n/);socket=new WebSocket(`ws://127.0.0.1:${port}${endpoint}`);await new Promise<void>((resolve,reject)=>{socket!.onopen=()=>resolve();socket!.onerror=()=>reject(Error('CDP unavailable'));});
  type Result={targetId?:string;sessionId?:string;result?:{value?:string}};let id=0;const pending=new Map<number,(r:Result)=>void>();socket.onmessage=e=>{const m=JSON.parse(String(e.data)) as {id:number;result:Result};pending.get(m.id)?.(m.result);pending.delete(m.id);};const call=(method:string,params:Record<string,unknown>,sessionId?:string)=>new Promise<Result>(resolve=>{const n=++id;pending.set(n,resolve);socket!.send(JSON.stringify({id:n,method,params,sessionId}));});const {targetId}=await call('Target.createTarget',{url:`http://127.0.0.1:${address.port}`}),{sessionId}=await call('Target.attachToTarget',{targetId,flatten:true});let result='PENDING';while(Date.now()<deadline){const r=await call('Runtime.evaluate',{expression:"document.getElementById('result')?.textContent||'PENDING'",returnByValue:true},sessionId);result=r.result?.value??'PENDING';if(result!=='PENDING')break;await new Promise(r=>setTimeout(r,50));}assert.equal(result,'PASS');
 }finally{socket?.close();browser.kill();if(browser.exitCode===null)await new Promise(r=>browser.once('exit',r));server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));rmSync(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
});
