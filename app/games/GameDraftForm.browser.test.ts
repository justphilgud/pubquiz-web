import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

test("draft form: real Chromium editing, rejected writes, cancel guard and reload for both formats", async () => {
 const chrome=[process.env.CHROME_BIN,"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe","/usr/bin/google-chrome","/usr/bin/chromium"].find(p=>p&&existsSync(p));assert.ok(chrome,"Chrome required");
 const source=String.raw`
 import React from 'react';import{renderToString}from'react-dom/server';import{createRoot}from'react-dom/client';import{flushSync}from'react-dom';import GameDraftForm from './app/games/GameDraftForm';
 window.qa={calls:[],stored:null,reject:false,unknown:false,retries:[]};let confirms=0;window.confirm=()=>{confirms++;return false;};const root=createRoot(document.getElementById('app'));
 const wait=async f=>{for(let i=0;i<200;i++){if(f())return;await new Promise(r=>setTimeout(r,10));}throw Error('timeout '+document.body.innerText)};
 const check=(v,m)=>{if(!v)throw Error(m)};const field=n=>document.querySelector('[name="'+n+'"]');
 const set=(n,v)=>{const e=field(n),p=e.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;flushSync(()=>{Object.getOwnPropertyDescriptor(p,'value').set.call(e,v);e.dispatchEvent(new Event(e.tagName==='SELECT'?'change':'input',{bubbles:true}));});};
 const render=(type,initial,canWrite=true)=>flushSync(()=>root.render(<GameDraftForm key={type+(initial?.id??'new')+canWrite} type={type} initial={initial} choices={[{id:10,name:'A',canWrite:true,canCreate:true},{id:20,name:'B',canWrite:true,canCreate:true}]} canWrite={canWrite} returnHref={type==='BINGO'?'/bingo':'/karaoke'}/>));
 const save=async()=>{document.querySelector('button[type=submit]').click();await wait(()=>document.querySelector('button[type=submit]').disabled);await wait(()=>!document.querySelector('button[type=submit]').disabled);await wait(()=>document.querySelector('[role=status],[role=alert]'));};
 async function run(){
 const html=renderToString(<GameDraftForm type="BINGO" choices={[{id:10,name:'A',canWrite:true,canCreate:true}]} canWrite returnHref="/bingo"/>);const serverDoc=new DOMParser().parseFromString(html,'text/html');check(serverDoc.querySelector('fieldset').disabled&&serverDoc.querySelector('button[type=submit]').disabled,'pre-hydration form must prevent native submission');
 for(const type of ['BINGO','POWERPOINT_KARAOKE']){
  window.qa.stored=null;render(type);check(field('seriesId').value==='','series must be explicit');set('title','Original');set('seriesId','10');set('date','2028-02-29');set('time','19:30');await save();
  if(type==='BINGO'){check(window.qa.calls.at(-1).roundCount===3,'Bingo default round count missing');check(/^[a-f0-9-]{36}$/.test(window.qa.calls.at(-1).requestId),'Bingo creation retry identity missing');}
  check(window.qa.stored.date==='2028-02-29'&&window.qa.stored.time==='19:30','civil date/time lost');flushSync(()=>root.render(null));render(type,window.qa.stored);check(field('title').value==='Original','reload title');check(field('date').value==='2028-02-29','reload date');
  set('title','Unsaved');const anchor=document.querySelector('a');const click=new MouseEvent('click',{bubbles:true,cancelable:true});check(!anchor.dispatchEvent(click),'cancelled navigation not prevented');check(confirms>0&&field('title').value==='Unsaved','cancel lost input');check(window.qa.stored.title==='Original','cancel saved input');
  window.qa.reject=true;await save();check(document.querySelector('[role=alert]')?.textContent==='Test rejection','write error missing');check(field('title').value==='Unsaved','rejection lost input');window.qa.reject=false;await save();check(window.qa.stored.title==='Unsaved','edit not saved');
  flushSync(()=>root.render(null));render(type,window.qa.stored,false);check(!document.querySelector('button[type=submit]'),'read only offered save');check(field('title').matches(':disabled'),'read only enabled field');flushSync(()=>root.render(null));
 }
 window.qa.retries=[];window.qa.unknown=true;render('BINGO');set('title','Ambiguous commit');set('seriesId','10');await save();check(field('title').matches(':disabled'),'ambiguous creation must lock its original body');check(window.qa.retries.length===1,'first creation missing');await save();check(window.qa.retries.length===2&&window.qa.retries[0]===window.qa.retries[1],'retry changed its creation identity');check(field('title').matches(':disabled'),'a later denial cannot disprove the earlier uncertain commit');await save();check(window.qa.retries.length===3&&new Set(window.qa.retries).size===1,'recovery changed its original creation identity');check(window.qa.stored.title==='Ambiguous commit','retry lost original content');
 root.unmount();document.getElementById('result').textContent='PASS';}run().catch(e=>document.getElementById('result').textContent='FAIL '+e.message);
 `;
 const mocks:Record<string,string>={teamActions:`export async function gameTeamsAction(){throw Error("Unexpected team action")};export const changeGameTeamAction=gameTeamsAction;`,image:`import React from "react";export default function Image({src,alt,className}){return <img src={src} alt={alt} className={className}/>}`,navigation:`export const useRouter=()=>({refresh(){},replace(){}});`,link:`import React from'react';export default function Link({children,...p}){return <a {...p}>{children}</a>}`,actions:`export async function createBingoDraft(data){window.qa.retries.push(data.requestId);if(window.qa.unknown&&window.qa.retries.length===1){await saveGameDraft('BINGO',data);throw Error('Lost response after commit');}if(window.qa.unknown){await new Promise(r=>setTimeout(r,30));if(window.qa.retries.length===2)return{success:false,retryable:false,message:'Synthetic permission revoked after uncertain result'};return{success:true,game:window.qa.stored};}return saveGameDraft('BINGO',data);}export async function saveGameDraft(type,data){await new Promise(r=>setTimeout(r,30));if(window.qa.reject)return{success:false,message:'Test rejection'};const game={...data,type,id:data.id??'00000000-0000-0000-0000-000000000001',status:'DRAFT',createdAt:'2026-10-26T00:00:00.000Z',updatedAt:new Date().toISOString()};window.qa.calls.push(data);window.qa.stored=game;return{success:true,game}};`};
 const bundle=await build({stdin:{contents:source,resolveDir:process.cwd(),loader:'tsx'},bundle:true,platform:'browser',format:'iife',write:false,define:{'process.env.NODE_ENV':'"production"','process.env':'{}'},plugins:[{name:'adapters',setup(api){api.onResolve({filter:/^next\/(navigation|link|image)$|^\.\/(actions|teamActions)$/},a=>a.path==='./actions'&&!a.importer.endsWith('GameDraftForm.tsx')?undefined:({path:a.path.endsWith('navigation')?'navigation':a.path.endsWith('link')?'link':a.path.endsWith('image')?'image':a.path==='./teamActions'?'teamActions':'actions',namespace:'fixture'}));api.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:mocks[a.path],loader:'tsx',resolveDir:process.cwd()}));}}]});
  const server=createServer((request,response)=>{if(request.url==='/bundle.js'){response.setHeader('Content-Type','application/javascript');response.end(bundle.outputFiles[0].contents);}else{response.setHeader('Content-Type','text/html');response.end('<div id="app"></div><pre id="result">PENDING</pre><script>window.onerror=message=>document.getElementById("result").textContent="FAIL "+message;</script><script src="/bundle.js"></script>');}});
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();assert.ok(address&&typeof address!=='string');
  const profile = mkdtempSync(join(tmpdir(), "pubquiz-night-media-"));
  const browser = spawn(chrome, ["--headless=new", "--no-sandbox", "--disable-gpu", "--disable-background-networking", "--no-first-run", "--autoplay-policy=no-user-gesture-required", `--user-data-dir=${profile}`, "--remote-debugging-port=0", "about:blank"], { stdio: "ignore" });
  let socket: WebSocket | undefined;
  try {
    // Use wall-clock waits: virtual time can exhaust media waits before metadata IO.
    const deadline = Date.now() + 30_000;
    const portFile = join(profile, "DevToolsActivePort");
    while (!existsSync(portFile) && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 50));
    assert.ok(existsSync(portFile), "Test browser did not start");
    const [port, endpoint] = readFileSync(portFile, "utf8").trim().split(/\r?\n/);
    socket = new WebSocket(`ws://127.0.0.1:${port}${endpoint}`);
    await new Promise<void>((resolve, reject) => { socket!.onopen = () => resolve(); socket!.onerror = () => reject(new Error("Test browser connection failed")); });
    let nextId = 0;
    type ProtocolResult = { targetId?: string; sessionId?: string; result?: { value?: string } };
    const pending = new Map<number, { resolve: (result: ProtocolResult) => void; reject: (error: Error) => void }>();
    socket.onmessage = event => {
      const message = JSON.parse(String(event.data)) as { id?: number; result?: ProtocolResult; error?: { message: string } };
      if (!message.id) return;
      const request = pending.get(message.id); pending.delete(message.id);
      if (message.error) request?.reject(new Error(message.error.message));
      else request?.resolve(message.result ?? {});
    };
    const call = (method: string, params: Record<string, unknown>, sessionId?: string) => new Promise<ProtocolResult>((resolve, reject) => {
      const id = ++nextId; pending.set(id, { resolve, reject }); socket!.send(JSON.stringify({ id, method, params, sessionId }));
    });
    const { targetId } = await call("Target.createTarget", { url: `http://127.0.0.1:${address.port}` });
    const { sessionId } = await call("Target.attachToTarget", { targetId, flatten: true });
    let result = "PENDING";
    while (Date.now() < deadline) {
      const response = await call("Runtime.evaluate", { expression: "document.getElementById('result')?.textContent || 'PENDING'", returnByValue: true }, sessionId);
      result = response.result?.value ?? "PENDING";
      if (result !== "PENDING") break;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    assert.equal(result, "PASS");
  } finally {
    socket?.close();
    browser.kill();
    if (browser.exitCode === null) await new Promise(resolve => browser.once("exit", resolve));
    await new Promise<void>(resolve => server.close(() => resolve()));
    // Fresh, test-owned directory under tmpdir, never a user browser profile.
    rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
});

