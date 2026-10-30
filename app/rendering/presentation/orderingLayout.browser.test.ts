import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";
import postcss from "postcss";
import tailwindcss from "@tailwindcss/postcss";
import { createServer } from "node:http";
import { spawn, execFileSync } from "node:child_process";
import { existsSync, statSync, readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join, resolve, sep, extname } from "node:path";
import { tmpdir } from "node:os";

test("ordering solutions: complete canonical text, no overlap, fitting, resize and fallback", async () => {
  const artifact = process.env.ORDERING_ARTIFACTS;
  if (artifact) mkdirSync(artifact, {recursive:true});
  const globals = readFileSync("app/globals.css", "utf8").replace('@import "./rendering/presentation/presentationReadability.css";',readFileSync("app/rendering/presentation/presentationReadability.css","utf8")).replace('@import "./rendering/presentation/bookingSlide.css";',readFileSync("app/rendering/presentation/bookingSlide.css","utf8"));
  const css = (await postcss([tailwindcss()]).process(globals,{from:resolve("app/globals.css")})).css + readFileSync("app/branding/philGud.css","utf8") + readFileSync("app/rendering/presentation/kommOnePresentation.css","utf8");
  const source = String.raw`
    import React from 'react';import{createRoot}from'react-dom/client';import{flushSync}from'react-dom';
    import Renderer from './app/rendering/presentation/PresentationSlideRenderer';
    import BaselineRenderer from 'ordering-reviewed-baseline';
    import{buildPresentationQualityFixture}from'./app/rendering/presentation/presentationQualityFixtures';
    import{buildQuestionTemplateRuntimeModel}from'./app/fragen/editor/templates/questionTemplateRuntime';
    import{EventRow}from'./app/events/EventRow';
    const root=createRoot(document.getElementById('app'));
    window.show=(scenario,style,scale=1,baseline=false)=>{const Surface=baseline?BaselineRenderer:Renderer;const f=buildPresentationQualityFixture(scenario==='extreme'?'ordering-odyssey-solution':scenario,style);if(scenario==='extreme')f.slide.frage.templateConfig.templateData.items.forEach(i=>i.explanation=i.explanation.repeat(20));const q=f.slide.frage;window.expected=buildQuestionTemplateRuntimeModel({templateId:q.templateId,questionText:q.frage,templateConfig:q.templateConfig,correctAnswers:[]}).solutionLines;flushSync(()=>root.render(scale!==1?<div data-preview-responsive="true" style={{width:1600,height:900,transform:'scale('+scale+')',transformOrigin:'top left'}}><Surface {...f}/></div>:<Surface {...f}/>));};
    window.icons=type=>flushSync(()=>root.render(<div data-admin-ui="phil-gud"><EventRow entry={{id:'1',title:'Testevent',seriesName:'Testreihe',typeLabel:type,date:null,status:'Vorbereitung',prepareHref:'/prepare?returnTo=%2Fquiz',moderationHref:'/moderation',presentationHref:'/presentation'}}/></div>));
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
      for(const el of [region,fit,...cards].filter(Boolean))if(el.scrollHeight>el.clientHeight||el.scrollWidth>el.clientWidth)issues.push('overflow '+el.className);
      const q=document.querySelector('h2');if(q&&!contained(box(q),box(region)))issues.push('question outside stage');
      for(const header of document.querySelectorAll('header')){const walker=document.createTreeWalker(header,NodeFilter.SHOW_TEXT);let text;while(text=walker.nextNode()){if(!text.textContent.trim())continue;const range=document.createRange();range.selectNodeContents(text);for(const r of range.getClientRects())if(!contained(r,box(header)))issues.push('header text outside header');}}
      for(const logo of document.querySelectorAll('header img')){if(!logo.complete||!logo.naturalWidth)issues.push('logo not loaded');if(!contained(box(logo),box(logo.closest('header'))))issues.push('logo outside header');}
      return {logos:[...document.querySelectorAll("header img")].map(i=>({logo:box(i),header:box(i.closest("header")),padding:getComputedStyle(i).padding,margin:getComputedStyle(i).margin,height:getComputedStyle(i).height,maxHeight:getComputedStyle(i).maxHeight})),issues,text:cards.map(e=>e.textContent),expected:window.expected,fit:fit?.dataset.orderingFit,layout:fit?.dataset.orderingLayout,sizes:cards.map(c=>getComputedStyle(c.firstElementChild).fontSize),scrollHeight:region.scrollHeight,clientHeight:region.clientHeight,hintVisible:getComputedStyle(document.querySelector('.presentation-overflow-hint')).visibility,debug:[fit,q,...cards].filter(Boolean).map(e=>({class:e.className,...box(e)}))};
    };
    window.show('ordering-odyssey-solution','EDITORIAL');
  `;
  const bundle = await build({plugins:[{name:"reviewed-storybook-baseline",setup(build){build.onResolve({filter:/^ordering-reviewed-baseline$/},()=>({path:"renderer",namespace:"reviewed-baseline"}));build.onLoad({filter:/.*/,namespace:"reviewed-baseline"},()=>({contents:execFileSync("git",["show","1b025a78da4f3bc439bda0ac8510b377c1a4eb0f:app/rendering/presentation/PresentationSlideRenderer.tsx"],{encoding:"utf8"}),loader:"tsx",resolveDir:resolve("app/rendering/presentation")}));}}],stdin:{contents:source,resolveDir:process.cwd(),loader:"tsx"},bundle:true,write:false,format:"iife",platform:"browser",jsx:"automatic",define:{"process.env":"{}","process.env.NODE_ENV":'"production"'},logLevel:"silent"});
  const server=createServer((req,res)=>{
    if(req.url==='/bundle.js'){res.setHeader('Content-Type','text/javascript');res.end(bundle.outputFiles[0].contents);}
    else if(req.url==='/medien/artwork-layout-test.svg'){res.setHeader('Content-Type','image/svg+xml');res.end(readFileSync('public/medien/artwork-layout-test.svg'));} else if(req.url==='/style.css'){res.setHeader('Content-Type','text/css');res.end(css);}
    else if(req.url!=='/'){
      const p=resolve('public','.'+new URL(req.url??'/', 'http://localhost').pathname);
      if(p.startsWith(resolve('public')+sep)&&existsSync(p)&&statSync(p).isFile()){
        const mime:Record<string,string>={'.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf'};
        res.setHeader('Content-Type',mime[extname(p)]??'application/octet-stream');res.end(readFileSync(p));
      }else{res.statusCode=404;res.end();}
    }
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
    await call('Emulation.setDeviceMetricsOverride',{width:1280,height:600,deviceScaleFactor:1,mobile:false},sessionId);
    await evaluate('window.show("ordering-odyssey-solution","EDITORIAL",1,true);document.fonts.ready');await new Promise(r=>setTimeout(r,150));
    const before=await evaluate('window.measure()') as {issues:string[]};assert.ok(before.issues.some(i=>i.startsWith('overlap')||i.startsWith('text outside card')),'unchanged Production renderer reproduces original overlap');
    if(artifact){const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false},sessionId);writeFileSync(join(artifact,'ordering-production-before-1280x600.png'),Buffer.from(shot.data!,'base64'));}
    for(const style of ['EDITORIAL','PHIL_GUD','NEON','CORPORATE','KOMM_ONE']) {
      for(const [width,height] of [[1280,600],[1280,720],[1366,768],[1920,1080],[2560,1440]]) {
        await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},sessionId);
        for(const scenario of ['ordering-odyssey-solution','ordering-long-solution','ordering-short-solution','ordering-mixed-solution']) {
          await evaluate(`window.show(${JSON.stringify(scenario)},${JSON.stringify(style)});document.fonts.ready`);
          await new Promise(r=>setTimeout(r,150));
          const m=await evaluate('window.measure()') as {issues:string[];fit:string;sizes:string[];text:string[];expected:string[]};
          results.push({style,scenario,width,height,...m});
          if(artifact&&(style==='EDITORIAL'||(scenario==='ordering-odyssey-solution'&&(width===1280||width===1920)))){const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false},sessionId);writeFileSync(join(artifact,`${style}-${scenario}-${width}x${height}.png`),Buffer.from(shot.data!,'base64'));}
          assert.deepEqual(m.issues,[],JSON.stringify({style,scenario,width,height,...m}));assert.equal(m.fit,'fitted',JSON.stringify({style,scenario,width,height,...m}));assert.deepEqual(m.text,m.expected);assert.equal(new Set(m.sizes).size,1);assert.ok(parseFloat(m.sizes[0])>=24);
        }
      }
    }
    // Storybook remains a separate renderer, with unchanged numbering and natural rows.
    for(const [width,height] of [[1280,600],[1280,720],[1366,768],[1920,1080],[2560,1440]]){
      await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},sessionId);
      await evaluate('window.show("ordering-short-solution","BIRTHDAY");document.fonts.ready');await new Promise(r=>setTimeout(r,150));
      const story=await evaluate(`(()=>{const rows=[...document.querySelectorAll('.presentation-storybook-sequence--resolved li')],viewport=document.querySelector('.presentation-content-viewport').getBoundingClientRect();return {wrapped:Boolean(document.querySelector('[data-ordering-fit]')),text:rows.map((r,i)=>(i+1)+'. '+r.querySelector('strong').textContent),expected:window.expected,boxes:rows.map(r=>{const b=r.getBoundingClientRect();return {top:b.top,bottom:b.bottom,left:b.left,right:b.right}}),viewport:{top:viewport.top,bottom:viewport.bottom,left:viewport.left,right:viewport.right}}})()`) as {wrapped:boolean;text:string[];expected:string[];boxes:Array<{top:number;bottom:number;left:number;right:number}>;viewport:{top:number;bottom:number;left:number;right:number}};
      assert.equal(story.wrapped,false);assert.deepEqual(story.text,story.expected);assert.equal(story.boxes.length,4);
      // User explicitly authorized this baseline comparison for the newly added
      // Storybook check; all original PR149 geometry/visibility assertions remain.
      await evaluate('window.show("ordering-short-solution","BIRTHDAY",1,true);document.fonts.ready');await new Promise(r=>setTimeout(r,150));
      const baselineBoxes=await evaluate(`[...document.querySelectorAll('.presentation-storybook-sequence--resolved li')].map(r=>{const b=r.getBoundingClientRect();return {top:b.top,bottom:b.bottom,left:b.left,right:b.right}})`);
      assert.deepEqual(story.boxes,baselineBoxes,'separate Storybook geometry remains identical to approved Production baseline, including existing overflow');
      results.push({style:'BIRTHDAY',scenario:'ordering-short-solution',width,height,baselineBoxes,boxes:story.boxes,baselineIdentical:true,existingOverflow:story.boxes.some(b=>b.top<story.viewport.top-1||b.bottom>story.viewport.bottom+1)});
      await evaluate('window.show("ordering-short-solution","BIRTHDAY");document.fonts.ready');
      if(artifact){const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false},sessionId);writeFileSync(join(artifact,`ordering-storybook-${width}x${height}.png`),Buffer.from(shot.data!,'base64'));}
    }
    // A full document reload includes actual font requests before fitting again.
    await call('Page.reload',{},sessionId);
    for(let n=0;n<200;n++){if(await evaluate('typeof window.show === "function"'))break;await new Promise(r=>setTimeout(r,25));}
    await evaluate('document.fonts.ready');await new Promise(r=>setTimeout(r,150));assert.deepEqual((await evaluate('window.measure()') as {issues:string[]}).issues,[],'reload and fonts');
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
    await evaluate('window.show("ordering-short-solution","EDITORIAL")');await new Promise(r=>setTimeout(r,150));const short=await evaluate('window.measure()') as {sizes:string[]};assert.ok(parseFloat(short.sizes[0])>24,'short answers must grow');await evaluate('window.show("ordering-odyssey-solution","EDITORIAL")');await new Promise(r=>setTimeout(r,150));assert.deepEqual((await evaluate('window.measure()') as {issues:string[]}).issues,[],'recover after long content');
    for(const [width,height] of [[1280,720],[390,844]])for(const type of ['Quiz','Bingo']){
      await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},sessionId);
      await evaluate(`window.icons(${JSON.stringify(type)})`);
      const links=await evaluate(`[...document.querySelectorAll('nav a')].map(a=>({title:a.title,label:a.getAttribute('aria-label'),href:a.getAttribute('href'),target:a.target,icons:a.querySelectorAll('svg').length,text:a.textContent,w:a.getBoundingClientRect().width,h:a.getBoundingClientRect().height}))`) as Array<{title:string;label:string;href:string;target:string;icons:number;text:string;w:number;h:number}>;
      assert.deepEqual(links.map(l=>l.title),['Vorbereiten','Moderation','Präsentieren']);assert.deepEqual(links.map(l=>l.href),['/prepare?returnTo=%2Fquiz','/moderation','/presentation']);assert.ok(links.every(l=>l.icons===1&&l.text===''&&l.label.includes('Testevent')&&l.w>=44&&l.h>=44));assert.ok(links.slice(1).every(l=>l.target==='_blank'));
      await evaluate(`document.querySelector('h2 a').focus()`);
      await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9},sessionId);await call('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9},sessionId);
      const focus=await evaluate(`(()=>{const a=document.activeElement,s=getComputedStyle(a);return {name:a.getAttribute('aria-label'),outline:s.outlineStyle,width:parseFloat(s.outlineWidth)}})()`) as {name:string;outline:string;width:number};assert.ok(focus.name?.includes('Testevent'));assert.notEqual(focus.outline,'none');assert.ok(focus.width>=2);
      if(artifact){const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false},sessionId);writeFileSync(join(artifact,`icons-${type}-${width}x${height}.png`),Buffer.from(shot.data!,'base64'));}

    }
    assert.deepEqual(await evaluate('window.errors'),[]);
    if(artifact)writeFileSync(join(artifact,'measurements.json'),JSON.stringify(results,null,2));
    console.log(JSON.stringify({cases:results.length,failures:0}));
  }finally{socket?.close();browser.kill();if(browser.exitCode===null)await new Promise(r=>browser.once('exit',r));await new Promise<void>(r=>server.close(()=>r()));rmSync(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
});
