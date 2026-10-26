import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
test('format renderers preserve brand, text, fonts and bounds at mobile, laptop and large widths in Chromium',async()=>{
 const chrome=[process.env.CHROME_BIN,'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe','/usr/bin/google-chrome','/usr/bin/chromium'].find(p=>p&&existsSync(p));assert.ok(chrome,'Chrome required');
 const source=String.raw`
 import React from'react';import{createRoot}from'react-dom/client';import{flushSync}from'react-dom';import{BingoDisplayRenderer,KaraokeSlideRenderer}from'./app/rendering/sharedDesign/FormatDisplays';import{getPresentationTemplate}from'./app/rendering/templateRegistry';import{contrastRatio}from'./app/rendering/presentationTemplates/presentationTemplate';
 const root=createRoot(document.getElementById('app'));const check=(x,m)=>{if(!x)throw Error(m)};
 async function run(){for(const id of ['phil-gud','lovd-ungegoogelt']){const t=getPresentationTemplate(id),design={version:1,templateId:id,name:id,config:{version:1,tokens:{...t.tokens,assets:{...t.tokens.assets,logo:null}},design:t.design,surfaces:{presentation:t.variant,answerForm:'BRANDED',moderation:'BRANDED'}}};check(contrastRatio(t.tokens.colors.text,t.tokens.colors.background)>=4.5,'contrast '+id);for(const width of [390,1280,1920]){document.body.style.width=width+'px';flushSync(()=>root.render(<div style={{width:width+'px',maxWidth:'100%'}}><BingoDisplayRenderer design={design} data={{current:'42',previous:['1','7','12','28','ÄÖÜ ß'],kind:'NUMBER'}}/><BingoDisplayRenderer design={design} data={{current:'Größer denken – äußerst überraschend!',previous:['Lange vollständige Phrase statt Zahl'],kind:'PHRASE'}}/><KaraokeSlideRenderer design={design} data={{title:'Äußerst große Ideen für übermorgen',body:'Vollständiger längerer Text mit ÄÖÜ und ß. 0123456789. '.repeat(20),image:'/missing.png',imageAlt:'Fehlendes Beispielbild'}}/></div>));await new Promise(r=>setTimeout(r,60));for(const frame of document.querySelectorAll('[data-shared-design]')){check(Math.abs(frame.getBoundingClientRect().width-width)<=1,'test width mismatch');check(frame.scrollWidth<=frame.clientWidth+1,'horizontal overflow '+id+' '+width);check(getComputedStyle(frame).color!=='rgb(15, 23, 42)','admin colour leakage');}check(document.body.innerText.includes('0123456789'),'content lost');check(document.body.innerText.includes('Bild nicht verfügbar'),'missing image fallback');}if(id==='phil-gud'){await document.fonts.load('32px "Phil Gud Display"');check(document.fonts.check('32px "Phil Gud Display"'),'original font not loaded');}}document.getElementById('result').textContent='PASS';}run().catch(e=>document.getElementById('result').textContent='FAIL '+e.message);
 `;
 const bundle=await build({stdin:{contents:source,resolveDir:process.cwd(),loader:'tsx'},bundle:true,platform:'browser',format:'iife',outdir:'out',write:false,loader:{'.css':'local-css'},define:{'process.env.NODE_ENV':'"production"','process.env':'{}'}});
  const js=bundle.outputFiles.find(f=>f.path.endsWith('.js')),css=bundle.outputFiles.find(f=>f.path.endsWith('.css'));assert.ok(js&&css,'Expected JS and actual CSS bundles');
  const server=createServer((request,response)=>{if(request.url==='/bundle.js'){response.setHeader('Content-Type','application/javascript');response.end(js.contents);}else if(request.url==='/styles.css'){response.setHeader('Content-Type','text/css');response.end(css.contents);}else if(request.url==='/branding/phil-gud/phil-gud.woff'){response.setHeader('Content-Type','font/woff');response.end(readFileSync('public/branding/phil-gud/phil-gud.woff'));}else if(request.url==='/missing.png'){response.statusCode=404;response.end();}else{response.setHeader('Content-Type','text/html');response.end('<link rel="stylesheet" href="/styles.css"><style>@font-face{font-family:Phil Gud Display;src:url(/branding/phil-gud/phil-gud.woff)}body{margin:0}#app{max-width:100%}</style><div id="app"></div><pre id="result">PENDING</pre><script>window.onerror=message=>document.getElementById("result").textContent="FAIL "+message;</script><script src="/bundle.js"></script>');}});
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
