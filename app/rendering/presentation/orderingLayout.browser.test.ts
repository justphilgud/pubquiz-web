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

test("ordering solutions: complete canonical text, no overlap, fitting, resize and fallback", async () => {
  const artifact = process.env.ORDERING_ARTIFACTS;
  if (artifact) mkdirSync(artifact, {recursive:true});
  const globals = readFileSync("app/globals.css", "utf8").replace('@import "./rendering/presentation/presentationReadability.css";',readFileSync("app/rendering/presentation/presentationReadability.css","utf8")).replace('@import "./rendering/presentation/bookingSlide.css";',readFileSync("app/rendering/presentation/bookingSlide.css","utf8"));
  const css = (await postcss([tailwindcss()]).process(globals,{from:resolve("app/globals.css")})).css + readFileSync("app/branding/philGud.css","utf8") + readFileSync("app/rendering/presentation/kommOnePresentation.css","utf8");
  const source = String.raw`
    import React from 'react';import{createRoot}from'react-dom/client';import{flushSync}from'react-dom';
    import Renderer from './app/rendering/presentation/PresentationSlideRenderer';
    import{buildPresentationQualityFixture}from'./app/rendering/presentation/presentationQualityFixtures';
    import{buildQuestionTemplateRuntimeModel}from'./app/fragen/editor/templates/questionTemplateRuntime';
    import{EventRow}from'./app/events/EventRow';
    const root=createRoot(document.getElementById('app'));
    window.show=(scenario,style,scale=1)=>{const f=buildPresentationQualityFixture(scenario==='extreme'?'ordering-odyssey-solution':scenario,style);if(scenario==='extreme')f.slide.frage.templateConfig.templateData.items.forEach(i=>i.explanation=i.explanation.repeat(20));const q=f.slide.frage;window.expected=buildQuestionTemplateRuntimeModel({templateId:q.templateId,questionText:q.frage,templateConfig:q.templateConfig,correctAnswers:[]}).solutionLines;flushSync(()=>root.render(scale!==1?<div style={{width:1600,height:900,transform:'scale('+scale+')',transformOrigin:'top left'}}><Renderer {...f}/></div>:<Renderer {...f}/>));};
    window.icons=type=>flushSync(()=>root.render(<EventRow entry={{id:'1',title:'Testevent',seriesName:'Testreihe',typeLabel:type,date:null,status:'Vorbereitung',prepareHref:'/prepare?returnTo=%2Fquiz',moderationHref:'/moderation',presentationHref:'/presentation'}}/>));
    window.measure=()=>{
      const box=e=>{const r=e.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom}};
      const region=document.querySelector('.presentation-content-viewport'),fit=document.querySelector('[data-ordering-fit]');
      const cards=[...document.querySelectorAll('.presentation-solution-answer')],issues=[],rects=[];
      const contained=(a,b)=>a.left>=b.left-1&&a.top>=b.top-1&&a.right<=b.right+1&&a.bottom<=b.bottom+1;
      for(const [index,card] of cards.entries()){
        const walker=document.createTreeWalker(card,NodeFilter.SHOW_TEXT);let node;
        while(node=walker.nextNode()){if(!node.textContent.trim())continue;const range=document.createRange();range.selectNodeContents(node);for(const r of range.getClientRects()){const b={left:r.left,top:r.top,right:r.right,bottom:r.bottom};rects.push({index,...b});if(!contained(b,box(card)))issues.push('text outside card '+index);if(!contained(b,box(region)))issues.push('text outside stage '+index);}}
      }
      for(let i=0;i<rects.length;i++)for(let j=i+1;j<rects.length;j++){const a=rects[i],b=rects[j];if(a.index!==b.index&&Math.min(a.right,b.right)>Math.max(a.left,b.left)+1&&Math.min(a.bottom,b.bottom)>Math.max(a.top,b.top)+1)issues.push('overlap '+a.index+':'+b.index);}
      for(const el of [region,fit,...cards].filter(Boolean))if(el.scrollHeight>el.clientHeight+2||el.scrollWidth>el.clientWidth+2)issues.push('overflow '+el.className);
      const q=document.querySelector('h2');if(q&&!contained(box(q),box(region)))issues.push('question outside stage');
      return {issues,text:cards.map(e=>e.textContent),expected:window.expected,fit:fit?.dataset.orderingFit,layout:fit?.dataset.orderingLayout,sizes:cards.map(c=>getComputedStyle(c.firstElementChild).fontSize),scrollHeight:region.scrollHeight,clientHeight:region.clientHeight,hintVisible:getComputedStyle(document.querySelector('.presentation-overflow-hint')).visibility,debug:[fit,q,...cards].filter(Boolean).map(e=>({class:e.className,...box(e)}))};
    };
    window.show('ordering-odyssey-solution','EDITORIAL');
  `;
  const bundle = await build({stdin:{contents:source,resolveDir:process.cwd(),loader:"tsx"},bundle:true,write:false,format:"iife",platform:"browser",jsx:"automatic",define:{"process.env":"{}","process.env.NODE_ENV":'"production"'},logLevel:"silent"});
  const server=createServer((req,res)=>{
    if(req.url==='/bundle.js'){res.setHeader('Content-Type','text/javascript');res.end(bundle.outputFiles[0].contents);}
    else if(req.url==='/medien/artwork-layout-test.svg'){res.setHeader('Content-Type','image/svg+xml');res.end(readFileSync('public/medien/artwork-layout-test.svg'));} else if(req.url==='/style.css'){res.setHeader('Content-Type','text/css');res.end(css);}
    else if(req.url?.startsWith('/branding/')){const p=resolve('public','.'+req.url);if(p.startsWith(resolve('public'))&&existsSync(p)){res.end(readFileSync(p));}else{res.statusCode=404;res.end();}}
    else{res.setHeader('Content-Type','text/html');res.end('<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/style.css"><style>html,body{margin:0;width:100%;height:100%}#app{height:100dvh;padding:16px;box-sizing:border-box;background:black}</style><div id="app"></div><script>window.errors=[];window.onerror=(m)=>window.errors.push(m)</script><script src="/bundle.js"></script>');}
  });
  await new Promise<void>(r=>server.listen(process.env.ORDERING_SERVE ? 4320 : 0,'127.0.0.1',r));const address=server.address();assert.ok(address&&typeof address!=='string');
  if(process.env.ORDERING_SERVE){console.log('Ordering renderer harness http://127.0.0.1:4320');await new Promise(()=>{});}
  const chrome=[process.env.CHROME_BIN,'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe','/usr/bin/google-chrome','/usr/bin/chromium'].find(p=>p&&existsSync(p));assert.ok(chrome,'Chrome required');
  const profile=mkdtempSync(join(tmpdir(),'pubquiz-ordering-'));
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
    for(const style of ['EDITORIAL','PHIL_GUD','NEON','CORPORATE','KOMM_ONE']) {
      for(const [width,height] of [[1280,600],[1366,768],[1920,1080],[2560,1440]]) {
        await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},sessionId);
        for(const scenario of ['ordering-odyssey-solution','ordering-long-solution']) {
          await evaluate(`window.show(${JSON.stringify(scenario)},${JSON.stringify(style)});document.fonts.ready`);
          await new Promise(r=>setTimeout(r,150));
          const m=await evaluate('window.measure()') as {issues:string[];fit:string;sizes:string[];text:string[];expected:string[]};
          results.push({style,scenario,width,height,...m});
          if(artifact&&style==='EDITORIAL'){const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false},sessionId);writeFileSync(join(artifact,`${scenario}-${width}x${height}.png`),Buffer.from(shot.data!,'base64'));}
          assert.deepEqual(m.issues,[],JSON.stringify({style,scenario,width,height,...m}));assert.equal(m.fit,'fitted');assert.deepEqual(m.text,m.expected);assert.equal(new Set(m.sizes).size,1);assert.ok(parseFloat(m.sizes[0])>=24);
        }
      }
    }
    // Stable content and fonts while the actual container changes height and width.
    await evaluate('window.show("ordering-odyssey-solution","EDITORIAL")');
    for(const [width,height] of [[1280,600],[1920,1080],[1366,768],[1280,720]]){
      await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},sessionId);await new Promise(r=>setTimeout(r,150));
      const m=await evaluate('window.measure()') as {issues:string[];sizes:string[]};assert.deepEqual(m.issues,[]);
      await new Promise(r=>setTimeout(r,150));assert.deepEqual((await evaluate('window.measure()') as {sizes:string[]}).sizes,m.sizes,'stable typography');
    }
    await call('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},sessionId);
    await evaluate('window.show("ordering-odyssey-solution","EDITORIAL",.4)');await new Promise(r=>setTimeout(r,150));
    const scaled=await evaluate('window.measure()') as {issues:string[];sizes:string[]};assert.deepEqual(scaled.issues,[]);
    await evaluate('window.show("ordering-odyssey-solution","EDITORIAL",.8)');await new Promise(r=>setTimeout(r,150));
    assert.deepEqual((await evaluate('window.measure()') as {sizes:string[]}).sizes,scaled.sizes,'logical canvas size, not transform');
    await call('Emulation.setDeviceMetricsOverride',{width:1280,height:600,deviceScaleFactor:1,mobile:false},sessionId);
    await evaluate('window.show("extreme","EDITORIAL")');await new Promise(r=>setTimeout(r,150));
    const extreme=await evaluate('window.measure()') as {fit:string;issues:string[];text:string[];expected:string[];scrollHeight:number;clientHeight:number};assert.equal(extreme.fit,'overflow');assert.deepEqual(extreme.text,extreme.expected);assert.ok(extreme.scrollHeight>extreme.clientHeight);assert.ok(!extreme.issues.some(i=>i.startsWith('overlap')||i.startsWith('text outside card')),'fallback must retain natural rows');
    await evaluate('window.show("ordering-odyssey-solution","EDITORIAL")');await new Promise(r=>setTimeout(r,150));assert.deepEqual((await evaluate('window.measure()') as {issues:string[]}).issues,[],'recover after long content');
    for(const type of ['Quiz','Bingo']){
      await evaluate(`window.icons(${JSON.stringify(type)})`);
      const links=await evaluate(`[...document.querySelectorAll('nav a')].map(a=>({title:a.title,label:a.getAttribute('aria-label'),href:a.getAttribute('href'),target:a.target,icons:a.querySelectorAll('svg').length,text:a.textContent,w:a.getBoundingClientRect().width,h:a.getBoundingClientRect().height}))`) as Array<{title:string;label:string;href:string;target:string;icons:number;text:string;w:number;h:number}>;
      assert.deepEqual(links.map(l=>l.title),['Vorbereiten','Moderation','Präsentieren']);assert.deepEqual(links.map(l=>l.href),['/prepare?returnTo=%2Fquiz','/moderation','/presentation']);assert.ok(links.every(l=>l.icons===1&&l.text===''&&l.label.includes('Testevent')&&l.w>=44&&l.h>=44));assert.ok(links.slice(1).every(l=>l.target==='_blank'));
    }
    assert.deepEqual(await evaluate('window.errors'),[]);
    if(artifact)writeFileSync(join(artifact,'measurements.json'),JSON.stringify(results,null,2));
    console.log(JSON.stringify({cases:results.length,failures:0}));
  }finally{socket?.close();browser.kill();if(browser.exitCode===null)await new Promise(r=>browser.once('exit',r));await new Promise<void>(r=>server.close(()=>r()));rmSync(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
});
