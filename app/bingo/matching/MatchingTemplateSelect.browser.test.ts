import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
test("matching template combobox searches and selects without dismissing its media dialog",async()=>{
 const chrome=[process.env.CHROME_BIN,"/usr/bin/google-chrome","/usr/bin/chromium","C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"].find(p=>p&&existsSync(p));assert.ok(chrome,"Chrome required");
 const source=String.raw`
 import React from 'react';import{createRoot}from'react-dom/client';import{flushSync}from'react-dom';import{useState}from'react';import{Modal}from'./components/ui/Modal';import MatchingTemplateSelect from './app/bingo/matching/MatchingTemplateSelect';
 const root=createRoot(document.getElementById('app'));let closes=0;
 function Fixture(){const[value,setValue]=useState('');return <Modal open title="Quellensuche" onClose={()=>closes++}><MatchingTemplateSelect options={[{code:'reverse',name:'Musik rückwärts'},{code:'flags',name:'Flaggenfragen'}]} value={value} onChange={setValue} disabled={false}/><button id="search">Suchen</button></Modal>}
 const wait=async f=>{for(let i=0;i<200;i++){if(f())return;await new Promise(r=>setTimeout(r,10));}throw Error('timeout '+document.body.innerText)};const check=(v,m)=>{if(!v)throw Error(m)};
 const key=(e,k)=>flushSync(()=>e.dispatchEvent(new KeyboardEvent('keydown',{key:k,bubbles:true,cancelable:true})));
 async function run(){flushSync(()=>root.render(<Fixture/>));await wait(()=>document.querySelector('[role=combobox]'));const input=document.querySelector('[role=combobox]');input.focus();flushSync(()=>input.click());check(document.querySelectorAll('[role=option]').length===3,'all templates visible');
 flushSync(()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'rück');input.dispatchEvent(new Event('input',{bubbles:true}));});check(document.querySelectorAll('[role=option]').length===1,'search filters templates');key(input,'ArrowDown');key(input,'Enter');check(input.value==='Musik rückwärts','Enter selects actual template');check(input.getAttribute('aria-expanded')==='false','selection closes list');
 flushSync(()=>input.click());key(input,'Escape');check(closes===0,'Escape must not dismiss media dialog while list is open');check(input.getAttribute('aria-expanded')==='false','Escape closes list');check(document.activeElement===input,'Escape preserves combobox focus');
 flushSync(()=>input.click());flushSync(()=>document.querySelector('#search').focus());check(input.getAttribute('aria-expanded')==='false','focus outside closes list');check(input.value==='Musik rückwärts','outside focus preserves selected template');
 input.focus();key(input,'Escape');check(closes===1,'Escape closes outer dialog when list is closed');document.getElementById('result').textContent='PASS';}
 run().catch(e=>document.getElementById('result').textContent='FAIL '+e.message);
`;
 const bundle=await build({stdin:{contents:source,resolveDir:process.cwd(),loader:'tsx'},bundle:true,platform:'browser',format:'iife',write:false,loader:{'.module.css':'empty'},define:{'process.env.NODE_ENV':'"production"','process.env':'{}'}});
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

