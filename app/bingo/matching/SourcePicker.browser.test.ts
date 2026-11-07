import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
test("Matching source dialog handles failures, rapid filters, stale results and fresh apply authorization",async()=>{
 const chrome=[process.env.CHROME_BIN,"/usr/bin/google-chrome","/usr/bin/chromium","C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"].find(p=>p&&existsSync(p));assert.ok(chrome,"Chrome required");
 const source=String.raw`
 import React from 'react';import{createRoot}from'react-dom/client';import{flushSync}from'react-dom';import{useState}from'react';import SourcePicker from './app/bingo/matching/SourcePicker';
 const root=createRoot(document.getElementById('app')),calls=window.matchingFixture;
 const wait=async f=>{for(let i=0;i<400;i++){if(f())return;await new Promise(r=>setTimeout(r,10));}throw Error('timeout '+document.body.innerText)};const check=(v,m)=>{if(!v)throw Error(m)};
 const click=t=>flushSync(()=>[...document.querySelectorAll('button')].find(e=>e.textContent.trim()===t).click());
 const change=(e,v)=>flushSync(()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,v);e.dispatchEvent(new Event('input',{bubbles:true}));});
 let applied=0;const entry={number:1,text:'Preserved custom draft',answerKey:'custom',keepNumber:true,sameText:false,presentation:{kind:'MEDIA',source:null}};
 function Fixture(){const[open,setOpen]=useState(true);return <><button id="reopen" onClick={()=>setOpen(true)}>Öffnen</button>{open&&<SourcePicker gameId="synthetic" entry={entry} onClose={()=>setOpen(false)} onApply={()=>{applied++;setOpen(false);}}/>}</>}
 const detail=(id,revision='a'.repeat(64))=>({id,title:'Source '+id,template:'Actual template',revision,media:[{id:100+id,variant:'music_original_audio',kind:'AUDIO'}],answers:[{key:'artist',label:'Interpret',text:'Artist'}],browserSpeechOnly:false});
 async function run(){flushSync(()=>root.render(<Fixture/>));await wait(()=>document.body.innerText.includes('Vorlagen konnten nicht'));check(document.body.innerText.includes('Vorlagen erneut laden'),'metadata failure has retry');click('Vorlagen erneut laden');await wait(()=>calls.templateCalls===2&&document.querySelector('[role=combobox]:not(:disabled)'));await wait(()=>calls.searches.length===1);check(calls.searches.length===1,'one initial search');
 const input=document.querySelector('input[maxlength="120"]');change(input,'Old');await new Promise(r=>setTimeout(r,300));change(input,'Newest');await new Promise(r=>setTimeout(r,300));check(calls.searches.length===1,'in-flight request serialized');calls.searches[0].resolve({success:true,items:[{id:9,title:'Obsolete result',template:'old'}],more:false});await wait(()=>calls.searches.length===2);check(calls.searches[1].input.search==='Newest','queued old filter coalesced');check(!document.body.innerText.includes('Obsolete result'),'obsolete result never appears');calls.searches[1].resolve({success:true,items:[{id:1,title:'Source 1',template:'actual'},{id:2,title:'Source 2',template:'actual'}],more:false});await wait(()=>document.body.innerText.includes('Source 1'));
 click('Source 1actual');await wait(()=>calls.details.length===1);click('Source 2actual');calls.details[0].resolve({success:true,item:detail(1)});await wait(()=>calls.details.length===2);check(!document.querySelector('h3'),'late source must not appear');calls.details[1].resolve({success:true,item:detail(2)});await wait(()=>document.querySelector('h3')?.textContent==='Source 2');
 click('Zuordnung übernehmen');click('Zuordnung übernehmen');await wait(()=>calls.details.length===3);check(calls.details[2].id===2,'fresh read before apply');calls.details[2].resolve({success:false});await wait(()=>document.body.innerText.includes('Nicht übernommen'));check(applied===0,'revoked source not applied');check(document.querySelector('h3').textContent==='Source 2','selection and draft retained');
 click('Zuordnung übernehmen');await wait(()=>calls.details.length===4);calls.details[3].resolve({success:true,item:detail(2,'b'.repeat(64))});await wait(()=>document.body.innerText.includes('Quelle wurde geändert'));check(applied===0,'changed source revision cannot silently apply');
 click('Zuordnung übernehmen');await wait(()=>calls.details.length===5);calls.details[4].resolve({success:true,item:detail(2)});await wait(()=>applied===1);check(!document.querySelector('[role=dialog]'),'successful fresh apply closes dialog');
 click('Öffnen');await wait(()=>calls.searches.length===3);calls.searches[2].resolve({success:false,message:'Synthetic network failure'});await wait(()=>document.body.innerText.includes('Suche erneut versuchen'));check(!document.body.innerText.includes('Keine passenden berechtigten'),'technical error is not empty result');click('Suche erneut versuchen');await wait(()=>calls.searches.length===4);calls.searches[3].resolve({success:true,items:[],more:false});await wait(()=>document.body.innerText.includes('Keine passenden berechtigten'));check(calls.templateCalls===3,'one metadata read on reopen, no polling');await new Promise(r=>setTimeout(r,500));check(calls.searches.length===4&&calls.templateCalls===3,'idle has no search or metadata requests');
 change(document.querySelector('input[maxlength="120"]'),'Late closed');await wait(()=>calls.searches.length===5);click('Schließen');calls.searches[4].resolve({success:true,items:[{id:99,title:'Must stay closed',template:'x'}],more:false});await new Promise(r=>setTimeout(r,50));check(!document.querySelector('[role=dialog]'),'late response cannot reopen closed dialog');document.getElementById('result').textContent='PASS';}
 run().catch(e=>document.getElementById('result').textContent='FAIL '+e.message);
`;
 const bundle=await build({stdin:{contents:source,resolveDir:process.cwd(),loader:'tsx'},bundle:true,platform:'browser',format:'iife',write:false,loader:{'.module.css':'empty'},plugins:[{name:'matching-action-fixture',setup(api){api.onResolve({filter:/^\.\/actions$/},()=>({path:'actions',namespace:'fixture'}));api.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:`const f=window.matchingFixture??(window.matchingFixture={templateCalls:0,searches:[],details:[]});export async function getMatchingTemplates(){f.templateCalls++;return f.templateCalls===1?{success:false,message:'Vorlagen konnten nicht geladen werden.'}:{success:true,items:[{code:'actual',name:'Actual template'}]};}export function findMatchingSources(gameId,input){return new Promise(resolve=>f.searches.push({input,resolve}));}export function getMatchingSource(gameId,id){return new Promise(resolve=>f.details.push({id,resolve}));}`,loader:'js'}));}}],define:{'process.env.NODE_ENV':'"production"','process.env':'{}'}});
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

