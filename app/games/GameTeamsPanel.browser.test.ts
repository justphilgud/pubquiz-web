import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
test("game team panel isolates dirty master fields and confirms only membership removal in Chromium",async()=>{
 const chrome=[process.env.CHROME_BIN,"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe","/usr/bin/google-chrome","/usr/bin/chromium"].find(p=>p&&existsSync(p));assert.ok(chrome,"Chrome required");
 const source=String.raw`
 import React from 'react';import{createRoot}from'react-dom/client';import{flushSync}from'react-dom';import GameDraftForm from './app/games/GameDraftForm';
 window.qa={masterCalls:0,teamCalls:0,data:null};const root=createRoot(document.getElementById('app'));window.confirm=()=>false;
 const wait=async f=>{for(let i=0;i<200;i++){if(f())return;await new Promise(r=>setTimeout(r,10));}throw Error('timeout '+document.body.innerText)};const check=(v,m)=>{if(!v)throw Error(m)};
 const set=(selector,v)=>{const e=document.querySelector(selector);flushSync(()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,v);e.dispatchEvent(new Event('input',{bubbles:true}));});};
 const button=text=>Array.from(document.querySelectorAll('button')).find(b=>b.textContent===text);
 const game={id:'00000000-0000-0000-0000-000000000001',seriesId:10,title:'Saved master title',type:'BINGO',date:'',time:'',status:'DRAFT',createdAt:'2026-10-26T00:00:00.000Z',updatedAt:'2026-10-26T00:00:00.000Z'};
 const initial={assigned:[],candidates:Array.from({length:50},(_,i)=>({id:i+1,name:'Team '+i+' '+('LangerName'.repeat(i===0?20:0)),avatar:'toaster',archived:false})),hasMore:true,canWrite:true,canAdd:true,hasTeamScope:true};window.qa.data=initial;
 const render=()=>flushSync(()=>root.render(<GameDraftForm type='BINGO' initial={game} choices={[{id:10,name:'A',canWrite:true,canCreate:true}]} canWrite returnHref='/bingo' teams={window.qa.data}/>));
 async function run(){render();await wait(()=>!document.querySelector('fieldset').disabled);
 set('[name=title]','Unsaved master title');check(button('Hinzufügen').disabled,'dirty metadata must block membership');check(button('Teams suchen').disabled,'dirty metadata must block search');check(window.qa.masterCalls===0&&window.qa.teamCalls===0,'dirty inputs persisted unexpectedly');
 const link=document.querySelector('a');const ev=new MouseEvent('click',{bubbles:true,cancelable:true});check(!link.dispatchEvent(ev),'existing cancel guard lost');check(document.querySelector('[name=title]').value==='Unsaved master title','guard lost draft');
 set('[name=title]','Saved master title');check(!button('Hinzufügen').disabled,'clean membership blocked');button('Hinzufügen').click();await wait(()=>document.body.innerText.includes('Team zugeordnet.'));check(window.qa.masterCalls===0&&window.qa.teamCalls===1,'membership saved master');check(document.querySelector('[name=title]').value==='Saved master title','membership changed title');
 await wait(()=>!button('Zuordnung entfernen').disabled);button('Zuordnung entfernen').click();await wait(()=>document.querySelector('[role=dialog]'));button('Abbrechen').click();await wait(()=>!document.querySelector('[role=dialog]'));check(window.qa.data.assigned.length===1&&window.qa.teamCalls===1,'cancel removal wrote');
 await wait(()=>!button('Zuordnung entfernen').disabled);button('Zuordnung entfernen').click();await wait(()=>document.querySelector('[role=dialog]'));Array.from(document.querySelectorAll('[role=dialog] button')).find(b=>b.textContent==='Zuordnung entfernen').click();await wait(()=>document.body.innerText.includes('Zuordnung entfernt.'));check(window.qa.data.assigned.length===0&&window.qa.masterCalls===0,'removal affected master');
 flushSync(()=>root.render(null));render();check(document.body.innerText.includes('Noch keine Teams zugeordnet.'),'remount lost persisted membership');document.getElementById('result').textContent='PASS';}
 run().catch(e=>document.getElementById('result').textContent='FAIL '+e.message);
 `;
 const mocks:Record<string,string>={navigation:`export const useRouter=()=>({refresh(){},replace(){}})`,link:`import React from'react';export default function Link({children,...p}){return <a {...p}>{children}</a>}`,image:`import React from'react';export default function Image({src,alt,className}){return <img src={src} alt={alt} className={className}/>}`,actions:`export async function createBingoDraft(){throw Error("Unexpected creation in existing team form")};export async function saveGameDraft(){window.qa.masterCalls++;throw Error('Unexpected master save')}`,teamActions:`export async function gameTeamsAction(){return{success:true,data:window.qa.data}};export async function changeGameTeamAction(type,input){window.qa.teamCalls++;await new Promise(r=>setTimeout(r,20));const d=window.qa.data;window.qa.data=input.operation==='ADD'?{...d,assigned:[{id:'a1',createdAt:'2026-10-26T00:00:00Z',team:d.candidates.find(t=>t.id===input.teamId)}],candidates:d.candidates.filter(t=>t.id!==input.teamId)}:{...d,assigned:[]};return{success:true,data:window.qa.data}}`};
 const bundle=await build({stdin:{contents:source,resolveDir:process.cwd(),loader:'tsx'},bundle:true,platform:'browser',format:'iife',write:false,define:{'process.env.NODE_ENV':'"production"','process.env':'{}'},plugins:[{name:'adapters',setup(api){api.onResolve({filter:/^next\/(navigation|link|image)$|^\.\/(actions|teamActions)$/},a=>({path:a.path.replace(/^next\//,'').replace(/^\.\//,''),namespace:'fixture'}));api.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:mocks[a.path],loader:'tsx',resolveDir:process.cwd()}));}}]});
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

