import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
test('shared design selection preserves dirty input on cancelled navigation and saves explicit inheritance in Chromium',async()=>{
 const chrome=[process.env.CHROME_BIN,'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe','/usr/bin/google-chrome','/usr/bin/chromium'].find(p=>p&&existsSync(p));assert.ok(chrome,'Chrome required');
 const source=String.raw`
 import React from'react';import{createRoot}from'react-dom/client';import{flushSync}from'react-dom';import Selection from './app/rendering/sharedDesign/SharedDesignSelection';
 window.qa={saved:null,calls:0};let root=createRoot(document.getElementById('app'));const props={target:{kind:'QUIZ',id:'11'},initial:null,seriesId:10,templates:[{id:'phil-gud',name:'Phil Gud'},{id:'lovd-ungegoogelt',name:'LOVD'}],canWrite:true,returnHref:'/return',answerSelection:null,answerTemplates:[{id:'minimal',name:'Minimal'}]};
 const render=p=>flushSync(()=>root.render(<Selection {...p}/>));const pause=()=>new Promise(r=>setTimeout(r,30));const check=(v,m)=>{if(!v)throw Error(m)};const change=(index,value)=>{const e=document.querySelectorAll('select')[index];e.value=value;e.dispatchEvent(new Event('change',{bubbles:true}));};
 async function run(){render(props);await pause();check(document.querySelectorAll('select')[1].disabled,'legacy answer must stay inactive');change(0,'INHERIT');await pause();change(1,'minimal');await pause();let confirmations=0;window.confirm=()=>{confirmations++;return false};const e=new MouseEvent('click',{bubbles:true,cancelable:true});document.querySelector('a').dispatchEvent(e);check(e.defaultPrevented&&confirmations===1,'cancelled navigation lost guard');check(document.querySelector('select').value==='INHERIT','cancel changed input');document.querySelector('form').requestSubmit();await pause();check(window.qa.calls===1&&window.qa.saved.selection==='INHERIT'&&window.qa.saved.answerSelection==='minimal','wrong separate selection');check(window.qa.saved.expectedSelection===null&&window.qa.saved.expectedAnswerSelection===null,'missing CAS basis');flushSync(()=>root.render(null));render({...props,initial:'INHERIT',answerSelection:'minimal'});await pause();check(document.querySelector('select').value==='INHERIT'&&document.querySelectorAll('select')[1].value==='minimal','reopen lost selections');flushSync(()=>root.render(null));render({...props,canWrite:false});await pause();check(document.querySelector('select').disabled&&!document.querySelector('button[type=submit]'),'readonly write offered');document.getElementById('result').textContent='PASS';}run().catch(e=>document.getElementById('result').textContent='FAIL '+e.message);
 `;
 const mocks:Record<string,string>={navigation:`export const useRouter=()=>({refresh(){}})`,link:`import React from'react';export default function Link({children,...p}){return <a {...p}>{children}</a>}`,actions:`export async function saveSharedDesign(input){window.qa.calls++;window.qa.saved=input;return{success:true}}`};
 const bundle=await build({stdin:{contents:source,resolveDir:process.cwd(),loader:'tsx'},bundle:true,platform:'browser',format:'iife',write:false,define:{'process.env.NODE_ENV':'"production"','process.env':'{}'},plugins:[{name:'adapters',setup(api){api.onResolve({filter:/^next\/(navigation|link)$|^\.\/actions$/},a=>({path:a.path.replace(/^next\//,'').replace(/^\.\//,''),namespace:'fixture'}));api.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:mocks[a.path],loader:'tsx',resolveDir:process.cwd()}));}}]});  const server=createServer((request,response)=>{if(request.url==='/bundle.js'){response.setHeader('Content-Type','application/javascript');response.end(bundle.outputFiles[0].contents);}else{response.setHeader('Content-Type','text/html');response.end('<div id="app"></div><pre id="result">PENDING</pre><script>window.onerror=message=>document.getElementById("result").textContent="FAIL "+message;</script><script src="/bundle.js"></script>');}});
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


