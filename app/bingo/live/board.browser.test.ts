import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { getPresentationTemplate } from "../../rendering/templateRegistry";
import sharp from "sharp";
import { contrastRatio } from "../../rendering/presentationTemplates/presentationTemplate";

test("actual Bingo board fits both dimensions, stable positions, fonts, states, resizing and scaled preview", { timeout: 60000 }, async () => {
  for (const id of ["phil-gud", "lovd-ungegoogelt"]) {
    const t = getPresentationTemplate(id)!.tokens;
    assert.ok(contrastRatio(t.colors.text, t.colors.background) >= 4.5);
    assert.ok(contrastRatio(t.colors.textMuted, t.colors.surface) >= 4.5);
  }
  const source = String.raw`
    import React from 'react';import{createRoot}from'react-dom/client';import{flushSync}from'react-dom';
    import Board from './app/bingo/live/BingoBoard';import Audience from './app/bingo/live/AudienceClient';import{getPresentationTemplate}from'./app/rendering/templateRegistry';import{fetchLiveView}from'./app/bingo/live/useLivePolling';
    const root=createRoot(document.getElementById('app'));
    window.show=(id='phil-gud',count=20,status='RUNNING',scaled=false)=>{
      const t=getPresentationTemplate(id);
      const data={id:'fixture',revision:count,startedAt:1,status,label:'Vorbereitete Bingo-Runde',target:30,draws:Array.from({length:count},(_,i)=>({id:String(i),position:i+1,number:i+1})),design:{version:1,templateId:id,name:id,config:{version:1,tokens:t.tokens,design:t.design,surfaces:{presentation:t.variant,answerForm:'BRANDED',moderation:'BRANDED'}}},assetBase:'/assets/'+id,claims:count?[{id:'call',stage:'BINGO',action:'CONFIRM',needsReview:false}]:[]};
      window.currentData=data;
      flushSync(()=>root.render(<div style={scaled?{width:1280,height:720,transform:'scale(.4)',transformOrigin:'top left'}:{height:'100dvh'}}><Board data={data}/></div>));
    };
    window.mountPolling=()=>flushSync(()=>root.render(<Audience initial={{...window.currentData,id:'polling',revision:0,draws:[]}} audienceKey="fixture"/>));
    window.slowFonts=()=>{
      const t=getPresentationTemplate('phil-gud');
      const data={id:'cold',revision:1,startedAt:1,status:'RUNNING',label:'Originalschrift lädt',target:30,draws:[{id:'42',position:1,number:42}],design:{version:1,templateId:'phil-gud',name:'Phil Gud',config:{version:1,tokens:t.tokens,design:t.design,surfaces:{presentation:t.variant,answerForm:'BRANDED',moderation:'BRANDED'}}},assetBase:'/assets/phil-gud-cold',claims:[]};
      flushSync(()=>root.render(<div style={{height:'100dvh'}}><Board data={data}/></div>));
    };
    window.checkStalledConnection=async()=>{try{await fetchLiveView('/hanging');return 'UNEXPECTED_SUCCESS';}catch(e){return e.name;}};
    window.measure=()=>{
      const stage=document.querySelector('[aria-label="Bingo-Präsentation"]'),bound=stage.getBoundingClientRect(),cells=[...stage.querySelectorAll('[data-number]')],issues=[];
      for(const e of [stage,...stage.querySelectorAll('header,footer,ol,li,strong')]){
        const r=e.getBoundingClientRect();
        if(r.width&&r.height&&(r.left<bound.left-1||r.right>bound.right+1||r.top<bound.top-1||r.bottom>bound.bottom+1))issues.push('outside '+e.tagName);
        if(e.scrollWidth>e.clientWidth+1||e.scrollHeight>e.clientHeight+1)issues.push('scroll '+e.tagName+' '+JSON.stringify({text:e.textContent,cw:e.clientWidth,sw:e.scrollWidth,ch:e.clientHeight,sh:e.scrollHeight,font:getComputedStyle(e).fontSize}));
      }
      return{fit:stage.dataset.fit,issues,numbers:cells.map(c=>Number(c.dataset.number)),states:cells.map(c=>c.dataset.state),sizes:cells.map(c=>getComputedStyle(c).fontSize),positions:cells.map(c=>{const r=c.getBoundingClientRect();return[r.left,r.top,r.width,r.height]}),logo:[...stage.querySelectorAll('img')].every(i=>i.complete&&i.naturalWidth>0),font:[...document.fonts].filter(f=>f.family.includes('Bingo Live')).length===2&&[...document.fonts].filter(f=>f.family.includes('Bingo Live')).every(f=>f.status==='loaded'),errors:window.errors};
    };if(location.search==='?cold')window.slowFonts();else window.show();
  `;
  const bundle = await build({ stdin: { contents: source, resolveDir: process.cwd(), loader: "tsx" }, bundle: true, write: false, platform: "browser", format: "iife", outdir: "out", loader: { ".css": "local-css" }, define: { "process.env": "{}", "process.env.NODE_ENV": '"production"' } });
  const js = bundle.outputFiles.find(f => f.path.endsWith(".js"))!, css = bundle.outputFiles.find(f => f.path.endsWith(".css"))!;
  let pollRequests = 0;
  const server = createServer((req, res) => {
    const path = req.url ?? "/";
    if (path === "/hanging") { return; }
    if (path === "/api/bingo/presentation/fixture") {
      pollRequests++;
      const count = pollRequests === 1 ? 12 : pollRequests === 2 ? 11 : pollRequests === 5 ? 0 : pollRequests === 6 ? 75 : pollRequests >= 7 ? 1 : 13, t = getPresentationTemplate("phil-gud")!;
      const newerRun = pollRequests === 5 || pollRequests >= 7;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ id: newerRun ? "new-run" : "polling", revision: count, startedAt: newerRun ? 2 : 1, status: "RUNNING", label: "Polling test", target: 30, draws: Array.from({ length: count }, (_, i) => ({ id: String(i), position: i + 1, number: i + 1 })), design: { version: 1, templateId: "phil-gud", name: "Phil Gud", config: { version: 1, tokens: t.tokens, design: t.design, surfaces: { presentation: t.variant, moderation: "BRANDED", answerForm: "BRANDED" } } }, assetBase: "/assets/phil-gud", claims: [] }));
    } else if (path === "/bundle.js") { res.setHeader("Content-Type", "text/javascript"); res.end(js.contents); }
    else if (path === "/style.css") { res.setHeader("Content-Type", "text/css"); res.end(css.contents); }
    else if (path.startsWith("/assets/")) {
      const [, , rawId, kind] = path.split("/"), id = rawId.replace(/-(slow|cold)$/, ""), t = getPresentationTemplate(id)!;
      const asset = kind === "logo" ? resolve("public", "." + t.tokens.assets.logo) : kind === "display" && id === "phil-gud" ? resolve("public/branding/phil-gud/phil-gud.woff") : resolve(id === "lovd-ungegoogelt" ? "assets/fonts/bingo/montserrat.ttf" : "assets/fonts/bingo/geist.ttf");
      res.setHeader("Content-Type", kind === "logo" ? "image/png" : kind === "display" && id === "phil-gud" ? "font/woff" : "font/ttf");
      if (rawId.endsWith("-cold") && kind !== "logo") setTimeout(() => res.end(readFileSync(asset)), 2000);
      else res.end(readFileSync(asset));
    } else { res.setHeader("Content-Type", "text/html"); res.end('<meta charset="utf-8"><link rel="stylesheet" href="/style.css"><style>html,body{margin:0;width:100%;height:100%}</style><div id="app"></div><script>window.errors=[];window.onerror=m=>window.errors.push(m)</script><script src="/bundle.js"></script>'); }
  });
  await new Promise<void>(r => server.listen(0, "127.0.0.1", r));
  const address = server.address(); assert.ok(address && typeof address !== "string");
  const chrome = [process.env.CHROME_BIN, "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(p => p && existsSync(p)); assert.ok(chrome);
  const profile = mkdtempSync(join(tmpdir(), "bingo-board-"));
  const browser = spawn(chrome, ["--headless=new", "--no-sandbox", "--disable-gpu", "--no-first-run", `--user-data-dir=${profile}`, "--remote-debugging-port=0", "about:blank"], { stdio: "ignore" });
  let socket: WebSocket | undefined;
  try {
    const portFile = join(profile, "DevToolsActivePort"), deadline = Date.now() + 30000;
    while (!existsSync(portFile) && Date.now() < deadline) await new Promise(r => setTimeout(r, 30));
    assert.ok(existsSync(portFile));
    const [port, endpoint] = readFileSync(portFile, "utf8").trim().split(/\r?\n/);
    socket = new WebSocket(`ws://127.0.0.1:${port}${endpoint}`);
    await new Promise<void>((r, j) => { socket!.onopen = () => r(); socket!.onerror = () => j(Error("Browser connection")); });
    type Reply = { targetId?: string; sessionId?: string; result?: { value?: unknown }; exceptionDetails?: unknown; data?: string };
    let id = 0; const pending = new Map<number, { resolve: (v: Reply) => void; reject: (e: Error) => void }>();
    socket.onmessage = e => { const m = JSON.parse(String(e.data)); if (!m.id) return; const p = pending.get(m.id); pending.delete(m.id); if (m.error) p?.reject(Error(m.error.message)); else p?.resolve(m.result); };
    const call = (method: string, params: Record<string, unknown>, sessionId?: string) => new Promise<Reply>((resolve, reject) => { const n = ++id; pending.set(n, { resolve, reject }); socket!.send(JSON.stringify({ id: n, method, params, sessionId })); });
    const { targetId } = await call("Target.createTarget", { url: `http://127.0.0.1:${address.port}` }), { sessionId } = await call("Target.attachToTarget", { targetId, flatten: true });
    const evaluate = async (expression: string) => { const r = await call("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }, sessionId); assert.equal(r.exceptionDetails, undefined, JSON.stringify(r.exceptionDetails)); return r.result?.value; };
    while (await evaluate("typeof window.show") !== "function" && Date.now() < deadline) await new Promise(r => setTimeout(r, 30));
    const results = [];
    for (const brand of ["phil-gud", "lovd-ungegoogelt"]) for (const [width, height] of [[1280, 600], [1366, 768], [1920, 1080]]) {
      await call("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false }, sessionId);
      let positions: unknown;
      for (const [count, status] of [[0, "PREPARED"], [0, "RUNNING"], [20, "RUNNING"], [75, "PAUSED"], [20, "ENDED"]] as const) {
        await evaluate(`window.show('${brand}',${count},'${status}');document.fonts.ready`);
        await new Promise(r => setTimeout(r, 120));
        const m = await evaluate("window.measure()") as { fit: string; issues: string[]; numbers: number[]; states: string[]; sizes: string[]; positions: unknown; logo: boolean; font: boolean; errors: unknown[] };
        assert.equal(m.fit, "fitted"); assert.deepEqual(m.issues, [], `${brand}/${width}x${height}: ${m.issues}`);
        assert.deepEqual(m.numbers, Array.from({ length: 75 }, (_, i) => i + 1)); assert.equal(new Set(m.sizes).size, 1);
        assert.equal(m.states.filter(s => s !== "unseen").length, count); assert.equal(m.states.filter(s => s === "current").length, count ? 1 : 0);
        assert.equal(m.logo, true); assert.equal(m.font, true); assert.deepEqual(m.errors, []);
        if (positions) assert.deepEqual(m.positions, positions, "cell positions remain stable"); positions = m.positions;
        results.push({ brand, width, height, count, status, fontSize: m.sizes[0] });
        if (process.env.BINGO_ARTIFACT_DIR && count === 20 && status === "RUNNING") {
          mkdirSync(process.env.BINGO_ARTIFACT_DIR, { recursive: true });
          const shot = await call("Page.captureScreenshot", { format: "png", captureBeyondViewport: false }, sessionId);
          writeFileSync(join(process.env.BINGO_ARTIFACT_DIR, `board-${brand}-${width}x${height}.png`), Buffer.from(shot.data!, "base64"));
        }
      }
    }
    await evaluate("window.show('phil-gud',20,'RUNNING',true)"); await new Promise(r => setTimeout(r, 150));
    assert.deepEqual((await evaluate("window.measure()") as { issues: string[] }).issues, []);
    await evaluate("window.show('phil-gud',20)");
    const fullscreen = await call("Runtime.evaluate", { expression: "document.documentElement.requestFullscreen()", userGesture: true, awaitPromise: true, returnByValue: true }, sessionId);
    assert.equal(fullscreen.exceptionDetails, undefined);
    assert.equal(await evaluate("document.fullscreenElement!==null"), true);
    await new Promise(r => setTimeout(r, 100));
    assert.deepEqual((await evaluate("window.measure()") as { issues: string[] }).issues, []);
    await evaluate("document.exitFullscreen()");
    assert.equal(await evaluate("document.fullscreenElement===null"), true);
    // A fresh document and unique URLs prevent an already loaded face from hiding FOIT.
    const coldTarget = await call("Target.createTarget", { url: "about:blank" });
    const coldSession = (await call("Target.attachToTarget", { targetId: coldTarget.targetId, flatten: true })).sessionId;
    await call("Emulation.setDeviceMetricsOverride", { width: 1280, height: 600, deviceScaleFactor: 1, mobile: false }, coldSession);
    await call("Page.navigate", { url: `http://127.0.0.1:${address.port}/?cold` }, coldSession);
    const coldEvaluate = async (expression: string) => { const r = await call("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }, coldSession); assert.equal(r.exceptionDetails, undefined); return r.result?.value; };
    const coldDeadline = Date.now() + 5000;
    while (!await coldEvaluate('!!document.querySelector("[data-current-number]")') && Date.now() < coldDeadline) await new Promise(r => setTimeout(r, 20));
    await new Promise(r => setTimeout(r, 150));
    assert.equal(await coldEvaluate('document.fonts.status'), "loading", "exercise actual cold pending original font");
    const numberBox = await coldEvaluate('(()=>{const r=document.querySelector("[data-current-number]").getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,scale:1}})()') as { x: number; y: number; width: number; height: number; scale: number };
    const loadingShot = await call("Page.captureScreenshot", { format: "png", clip: numberBox }, coldSession);
    const { data: pixels, info } = await sharp(Buffer.from(loadingShot.data!, "base64")).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    let visible = 0;
    for (let p = 0; p < pixels.length; p += info.channels) if (pixels[p] > 200 && pixels[p + 1] > 200 && pixels[p + 2] > 180) visible++;
    assert.ok(visible > 100, "current number must already paint while original font is pending");
    await coldEvaluate("document.fonts.ready");
    assert.equal(await coldEvaluate('[...document.fonts].filter(f=>f.family.includes("Bingo Live")).length===2&&[...document.fonts].filter(f=>f.family.includes("Bingo Live")).every(f=>f.status==="loaded")'), true, "both original frozen faces actually loaded");
    await call("Target.closeTarget", { targetId: coldTarget.targetId });
    await call("Page.bringToFront", {}, sessionId);
    await call("Emulation.setDeviceMetricsOverride", { width: 390, height: 400, deviceScaleFactor: 1, mobile: false }, sessionId);
    await evaluate("window.show()"); await new Promise(r => setTimeout(r, 100));
    assert.equal((await evaluate("window.measure()") as { fit: string }).fit, "unreadable");
    await call("Emulation.setDeviceMetricsOverride", { width: 1280, height: 600, deviceScaleFactor: 1, mobile: false }, sessionId);
    await evaluate("window.show();window.mountPolling()");
    const waitFor = async (expression: string) => {
      const until = Date.now() + 10000;
      while (!await evaluate(expression) && Date.now() < until) await new Promise(r => setTimeout(r, 30));
      assert.equal(await evaluate(expression), true, expression);
    };
    await waitFor('document.querySelector("[data-revision]")?.dataset.revision==="12"');
    while (pollRequests < 2) await new Promise(r => setTimeout(r, 30));
    await new Promise(r => setTimeout(r, 100));
    assert.equal(await evaluate('document.querySelector("[data-revision]")?.dataset.revision'), "12", "late older response cannot replace confirmed state");
    await call("Network.enable", {}, sessionId);
    await call("Network.emulateNetworkConditions", { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 }, sessionId);
    await waitFor('document.body.innerText.includes("Verbindung unterbrochen")');
    assert.equal(await evaluate('document.querySelector("[data-revision]")?.dataset.revision'), "12", "outage preserves last confirmed state");
    await call("Network.emulateNetworkConditions", { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 }, sessionId);
    await waitFor('document.querySelector("[data-revision]")?.dataset.revision==="13"');
    assert.equal(await evaluate('document.body.innerText.includes("Verbindung unterbrochen")'), false);
    await waitFor('document.querySelector("[data-run-id]")?.dataset.runId==="new-run"');
    while (pollRequests < 6) await new Promise(r => setTimeout(r, 30));
    await new Promise(r => setTimeout(r, 100));
    assert.equal(await evaluate('document.querySelector("[data-run-id]")?.dataset.runId'), "new-run");
    assert.equal(await evaluate('document.querySelector("[data-revision]")?.dataset.revision'), "0", "late response from previous run cannot replace newer run");
    await waitFor('document.querySelector("[data-revision]")?.dataset.revision==="1"');
    await evaluate("window.show();window.mountPolling()");
    await waitFor('document.querySelector("[data-run-id]")?.dataset.runId==="new-run"&&document.querySelector("[data-revision]")?.dataset.revision==="1"');
    assert.deepEqual(await evaluate("window.errors"), []);
    assert.equal(await evaluate("window.checkStalledConnection()"), "AbortError", "stalled response is bounded by the real client timeout");
    console.info(JSON.stringify({ boardCases: results.length, results }));
  } finally {
    socket?.close(); browser.kill(); if (browser.exitCode === null) await new Promise(r => browser.once("exit", r));
    await new Promise<void>(r => server.close(() => r()));
    // Fresh test-owned directory only, never an existing user profile.
    rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
});
