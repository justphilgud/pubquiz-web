import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";
import postcss from "postcss";
import tailwindcss from "@tailwindcss/postcss";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

test("classical choices: real text geometry, shared type, resizing and long-short-long across design worlds", async () => {
  const artifact = process.env.CHOICE_ARTIFACTS;
  if (artifact) mkdirSync(artifact, {recursive:true});
  const globals = readFileSync("app/globals.css", "utf8").replace('@import "./rendering/presentation/presentationReadability.css";',readFileSync("app/rendering/presentation/presentationReadability.css","utf8")).replace('@import "./rendering/presentation/bookingSlide.css";',readFileSync("app/rendering/presentation/bookingSlide.css","utf8"));
  const css = (await postcss([tailwindcss()]).process(globals,{from:resolve("app/globals.css")})).css + readFileSync("app/branding/philGud.css","utf8") + readFileSync("app/rendering/presentation/kommOnePresentation.css","utf8");
  const source = String.raw`
    import React from 'react'; import{createRoot}from'react-dom/client';import{flushSync}from'react-dom';
    import Renderer from './app/rendering/presentation/PresentationSlideRenderer';
    import{buildPresentationQualityFixture}from'./app/rendering/presentation/presentationQualityFixtures';
    const root=createRoot(document.getElementById('app'));
    window.show=(scenario,style)=>{const f=buildPresentationQualityFixture(scenario,style);if(scenario.startsWith('image-choice'))f.slide.frage.medien.forEach(m=>m.datei='artwork-layout-test.svg');window.expected=f.slide.frage.antwort_reihenfolge.map((id,i)=>{const a=f.slide.frage.antworten.find(a=>a.antwort_id===id);return String.fromCharCode(65+i)+'.'+a.antwort+(f.slide.typ==='aufloesung'&&a.zusatzinformation?.trim()?a.zusatzinformation:'')});window.expectedQuestion=f.slide.frage.frage;flushSync(()=>root.render(<Renderer {...f}/>));};
    window.measure=()=>{
      const box=e=>{const r=e.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom}};
      const region=document.querySelector('.presentation-content-viewport');
      const cards=[...document.querySelectorAll('.presentation-solution-option,.presentation-answer-option')];
      const rects=[];const issues=[];const boundary=box(region);
      const contained=(a,b)=>a.left>=b.left-1&&a.top>=b.top-1&&a.right<=b.right+1&&a.bottom<=b.bottom+1;
      for(const [index,card] of cards.entries()){
        const walker=document.createTreeWalker(card,NodeFilter.SHOW_TEXT);
        let node;while(node=walker.nextNode()){if(!node.textContent.trim())continue;const range=document.createRange();range.selectNodeContents(node);for(const rect of range.getClientRects()){const b={left:rect.left,top:rect.top,right:rect.right,bottom:rect.bottom};rects.push({index,...b});if(!contained(b,box(card)))issues.push('text outside card '+index);if(!contained(b,boundary))issues.push('text outside stage '+index);}}
      }
      for(let i=0;i<rects.length;i++)for(let j=i+1;j<rects.length;j++){const a=rects[i],b=rects[j];if(a.index!==b.index&&Math.min(a.right,b.right)>Math.max(a.left,b.left)+1&&Math.min(a.bottom,b.bottom)>Math.max(a.top,b.top)+1)issues.push('text overlap '+a.index+':'+b.index);}
      const q=document.querySelector('h2');if(q&&!contained(box(q),boundary))issues.push('question outside stage');
      for(const e of [region,...cards,document.querySelector('[data-choice-fit]')].filter(Boolean))if(e.scrollHeight>e.clientHeight+2||e.scrollWidth>e.clientWidth+2)issues.push('scroll '+e.className);
      const image=document.querySelector('[data-choice-fit] img');if(image&&(!image.complete||!image.naturalWidth||!contained(box(image),boundary)))issues.push('image not visible');
      const infos=[...document.querySelectorAll('.presentation-answer-information')];
      return {viewport:{width:innerWidth,height:innerHeight},questionText:q?.textContent,expectedQuestion:window.expectedQuestion,expectedText:window.expected,layout:document.querySelector('[data-choice-fit]')?.dataset.choiceLayout,questionSize:q?getComputedStyle(q).fontSize:null,answerSizes:cards.map(e=>getComputedStyle(e).fontSize),infoSizes:infos.map(e=>getComputedStyle(e).fontSize),text:cards.map(e=>e.textContent),rects,issues,debug:[...document.querySelectorAll('[data-choice-fit],.presentation-choice-lead,.presentation-choice-options,.presentation-classical-option,h2,p,.presentation-choice-answer')].map(e=>({class:e.className,...box(e),ch:e.clientHeight,sh:e.scrollHeight,cw:e.clientWidth,sw:e.scrollWidth})),scrollHeight:region.scrollHeight,clientHeight:region.clientHeight,image:image?{src:image.src,complete:image.complete,naturalWidth:image.naturalWidth,box:box(image),boundary}:null,fit:document.querySelector('[data-choice-fit]')?.dataset.choiceFit};
    };
    window.show('choice-tunnel-solution','EDITORIAL');
  `;
  const bundle = await build({stdin:{contents:source,resolveDir:process.cwd(),loader:"tsx"},bundle:true,write:false,format:"iife",platform:"browser",jsx:"automatic",define:{"process.env":"{}","process.env.NODE_ENV":'"production"'},logLevel:"silent"});
  const server=createServer((req,res)=>{
    if(req.url==='/bundle.js'){res.setHeader('Content-Type','text/javascript');res.end(bundle.outputFiles[0].contents);}
    else if(req.url==='/medien/artwork-layout-test.svg'){res.setHeader('Content-Type','image/svg+xml');res.end(readFileSync('public/medien/artwork-layout-test.svg'));} else if(req.url==='/style.css'){res.setHeader('Content-Type','text/css');res.end(css);}
    else if(req.url?.startsWith('/branding/')){const p=resolve('public','.'+req.url);if(p.startsWith(resolve('public'))&&existsSync(p)){res.end(readFileSync(p));}else{res.statusCode=404;res.end();}}
    else{res.setHeader('Content-Type','text/html');res.end('<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/style.css"><style>html,body{margin:0;width:100%;height:100%}#app{height:100dvh;padding:16px;box-sizing:border-box;background:black}</style><div id="app"></div><script>window.errors=[];window.onerror=(m)=>window.errors.push(m)</script><script src="/bundle.js"></script>');}
  });
  await new Promise<void>(r=>server.listen(process.env.CHOICE_SERVE ? 4319 : 0,'127.0.0.1',r));const address=server.address();assert.ok(address&&typeof address!=='string');
  if(process.env.CHOICE_SERVE){console.log('Choice renderer harness http://127.0.0.1:4319');await new Promise(()=>{});}
  const chrome=[process.env.CHROME_BIN,'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe','/usr/bin/google-chrome','/usr/bin/chromium'].find(p=>p&&existsSync(p));assert.ok(chrome,'Chrome required');
  const profile=mkdtempSync(join(tmpdir(),'pubquiz-choice-'));
  const browser=spawn(chrome,['--headless=new','--no-sandbox','--disable-gpu','--disable-background-networking','--no-first-run',`--user-data-dir=${profile}`,'--remote-debugging-port=0','about:blank'],{stdio:'ignore'});
  let socket:WebSocket|undefined;
  try{
    const deadline=Date.now()+30000;const portFile=join(profile,'DevToolsActivePort');while(!existsSync(portFile)&&Date.now()<deadline)await new Promise(r=>setTimeout(r,50));assert.ok(existsSync(portFile));
    const [port,endpoint]=readFileSync(portFile,'utf8').trim().split(/\r?\n/);socket=new WebSocket(`ws://127.0.0.1:${port}${endpoint}`);
    await new Promise<void>((r,j)=>{socket!.onopen=()=>r();socket!.onerror=()=>j(Error('Chrome connection failed'));});
    type Reply={targetId?:string;sessionId?:string;result?:{value?:unknown};data?:string;exceptionDetails?:unknown};let id=0;const pending=new Map<number,{resolve:(v:Reply)=>void;reject:(e:Error)=>void}>();
    socket.onmessage=e=>{const m=JSON.parse(String(e.data));if(!m.id)return;const p=pending.get(m.id);pending.delete(m.id);if(m.error)p?.reject(Error(m.error.message));else p?.resolve(m.result);};
    const call=(method:string,params:Record<string,unknown>,sessionId?:string)=>new Promise<Reply>((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});socket!.send(JSON.stringify({id:n,method,params,sessionId}));});
    const {targetId}=await call('Target.createTarget',{url:`http://127.0.0.1:${address.port}`});const{sessionId}=await call('Target.attachToTarget',{targetId,flatten:true});
    const evaluate=async(expression:string)=>{const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true},sessionId);assert.equal(r.exceptionDetails,undefined,JSON.stringify(r.exceptionDetails));return r.result?.value;};
    for(let n=0;n<200;n++){if(await evaluate('typeof window.show === "function"'))break;await new Promise(r=>setTimeout(r,25));}
    assert.equal(await evaluate('typeof window.show'), 'function', JSON.stringify(await evaluate('window.errors'))); const results:Array<Record<string,unknown>>=[];
    for(const style of ['EDITORIAL','PHIL_GUD','NEON','CORPORATE','BIRTHDAY','KOMM_ONE']){
      for(const [width,height] of [[1280,600],[1280,720],[1366,768],[1920,1080],[2560,1440]]){
        await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},sessionId);
        for(const scenario of ['choice-tunnel-solution','choice-short-solution','choice-freud-solution','choice-long','choice-mixed','choice-wrap-solution','choice-long-question','image-choice','image-choice-solution']){
          await evaluate(`window.show(${JSON.stringify(scenario)},${JSON.stringify(style)});document.fonts.ready`);await new Promise(r=>setTimeout(r,70));
          const m=await evaluate('window.measure()') as {issues:string[];answerSizes:string[];infoSizes:string[];text:string[];expectedText:string[];questionText:string;expectedQuestion:string;viewport:{width:number;height:number};fit?:string};results.push({style,scenario,...m});
          if(artifact&&style==='EDITORIAL'&&[1280,1920].includes(width)&&scenario.endsWith('solution')){const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false},sessionId);writeFileSync(join(artifact,`after-${scenario}-${width}x${height}.png`),Buffer.from(shot.data!,'base64'));}
          if(scenario!=='long'){
            if(m.issues.length) console.log(JSON.stringify({style,scenario,...m})); assert.deepEqual(m.viewport,{width,height});assert.deepEqual(m.issues,[],`${style}/${scenario}/${width}x${height}: ${m.issues.join(';')}`);
            assert.equal(m.fit,'fitted',style+'/'+scenario+'/'+width+'x'+height); assert.equal(new Set(m.answerSizes).size,1);assert.ok(new Set(m.infoSizes).size<=1);assert.equal(m.text.length,4);assert.deepEqual(m.text,m.expectedText,'full answers and notes');assert.equal(m.questionText,m.expectedQuestion,'full question');
            assert.ok(m.text.every((text,i)=>text.startsWith(String.fromCharCode(65+i)+'.')), 'letter order');
          }
        }
      }
    }

    // Same mounted slide across all resizes, then long -> short -> long without remounting.
    await evaluate('window.show("choice-tunnel-solution","EDITORIAL")');
    for(const [width,height] of [[1280,600],[2560,1440],[1280,720],[1920,1080],[1366,768]]) {
      await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},sessionId);
      await new Promise(r=>setTimeout(r,100));
      const before=await evaluate('window.measure()') as {issues:string[];answerSizes:string[];fit:string};
      assert.deepEqual(before.issues,[]);assert.equal(before.fit,'fitted');
      await evaluate('window.show("choice-short-solution","EDITORIAL")');await new Promise(r=>setTimeout(r,60));
      const short=await evaluate('window.measure()') as {answerSizes:string[]};
      assert.ok(parseFloat(short.answerSizes[0])>parseFloat(before.answerSizes[0])*1.2);
      await evaluate('window.show("choice-tunnel-solution","EDITORIAL")');await new Promise(r=>setTimeout(r,60));
      const after=await evaluate('window.measure()') as {issues:string[];answerSizes:string[]};
      assert.deepEqual(after.issues,[]);assert.deepEqual(after.answerSizes,before.answerSizes);
      await new Promise(r=>setTimeout(r,120));
      assert.deepEqual((await evaluate('window.measure()') as {answerSizes:string[]}).answerSizes,after.answerSizes,'no ongoing fitting/pumping');
    }
    await call('Emulation.setDeviceMetricsOverride',{width:1280,height:600,deviceScaleFactor:1,mobile:false},sessionId);
    await evaluate('window.show("choice-extreme-solution","EDITORIAL")');await new Promise(r=>setTimeout(r,100));
    const extreme=await evaluate('window.measure()');
    if(artifact)writeFileSync(join(artifact,'extreme.json'),JSON.stringify(extreme,null,2));
    assert.equal((extreme as {fit:string}).fit,'unreadable','must not claim unreadable extreme fits');
    assert.deepEqual(await evaluate('window.errors'),[],'no browser/ResizeObserver errors');
    if(artifact)writeFileSync(join(artifact,'after.json'),JSON.stringify(results,null,2));
    for(const entry of results.filter(r=>r.scenario==='choice-short-solution')){const long=results.find(r=>r.style===entry.style&&r.scenario==='choice-tunnel-solution'&&JSON.stringify(r.viewport)===JSON.stringify(entry.viewport));assert.ok(parseFloat((entry.answerSizes as string[])[0])>parseFloat((long!.answerSizes as string[])[0])*1.2,'short options must grow '+JSON.stringify({style:entry.style,viewport:entry.viewport}));}
    console.log(JSON.stringify({cases:results.length,failures:results.filter(r=>(r.issues as string[]).length).map(r=>({style:r.style,scenario:r.scenario,viewport:r.viewport,issues:r.issues}))}));
  }finally{socket?.close();browser.kill();if(browser.exitCode===null)await new Promise(r=>browser.once('exit',r));await new Promise<void>(r=>server.close(()=>r()));rmSync(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
});
