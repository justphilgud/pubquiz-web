import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawn} from 'node:child_process';

const hosted=process.argv.includes('--hosted');
const origin=hosted?process.env.BINGO_EVENING_PREVIEW_URL:'http://localhost:3068';
const out=hosted?'.artifacts/bingo-evening-hosted':'docs/acceptance/assets/bingo-evening';
fs.mkdirSync(out,{recursive:true});
let automationCredential;
if(hosted){
 assert.equal(process.env.DEPLOYMENT_BRANCH,'codex/bingo-presentation-colors');
 assert.equal(process.env.DEPLOYMENT_ENV,'preview');
 assert.match(origin??'',/^https:\/\/pubquiz-[a-z0-9]+-just-phil-gud\.vercel\.app$/);
 assert.match(process.env.DEPLOYMENT_SHA??'',/^[a-f0-9]{40}$/);
 const project=await fetch('https://api.vercel.com/v9/projects/prj_9Nnwer6B43P0nfrOZPIEygFWg666?teamId=team_BE4XNxNRwsaEnSb9N8FFvWEH',{headers:{Authorization:`Bearer ${process.env.VERCEL_TOKEN}`}});
 assert.equal(project.ok,true,'existing Preview project metadata');
 const metadata=await project.json();
 automationCredential=Object.entries(metadata.protectionBypass??{}).find(([,value])=>value.scope==='automation-bypass')?.[0];
 assert.ok(automationCredential,'existing authorized Preview automation credential required');
}
const account=JSON.parse(hosted?process.env.BINGO_EVENING_ACCOUNTS:fs.readFileSync('.env.bingo-evening-accounts.json','utf8'));
delete process.env.VERCEL_TOKEN;
delete process.env.BINGO_EVENING_ACCOUNTS;
assert.equal(account.email,'bingo.evening.admin@example.invalid');
const chrome=[process.env.CHROME_BIN,'C:/Program Files/Google/Chrome/Application/chrome.exe','/usr/bin/google-chrome','/usr/bin/chromium'].find(p=>p&&fs.existsSync(p));assert.ok(chrome);
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'bingo-evening-http-'));
const browser=spawn(chrome,['--headless=new','--no-sandbox','--disable-gpu','--no-first-run',`--user-data-dir=${profile}`,'--remote-debugging-port=0','about:blank'],{stdio:'ignore'});
let ws,id=0,game,transportFailure,closing=false;const requests=new Map(),delay=ms=>new Promise(r=>setTimeout(r,ms));
async function until(f,label,timeout=45000){const end=Date.now()+timeout;while(Date.now()<end){if(transportFailure)throw transportFailure;try{if(await f())return;}catch(error){if(!/Execution context was destroyed|Cannot find context|Inspected target navigated/.test(error.message))throw error;}await delay(100);}throw Error('Timeout: '+label);}
function call(method,params={},sessionId){return new Promise((resolve,reject)=>{const key=++id,timer=setTimeout(()=>{requests.delete(key);reject(Error('CDP '+method));},20000);requests.set(key,{resolve:r=>{clearTimeout(timer);resolve(r);},reject:e=>{clearTimeout(timer);reject(e);}});ws.send(JSON.stringify({id:key,method,params,sessionId}));});}
async function evaluate(s,expression){const result=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true},s);if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description??result.exceptionDetails.text);return result.result?.value;}
async function tab(url){const target=await call('Target.createTarget',{url:'about:blank'});const session=(await call('Target.attachToTarget',{targetId:target.targetId,flatten:true})).sessionId;await call('Fetch.enable',{patterns:[{urlPattern:origin+'/*',requestStage:'Request'}]},session);await call('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false},session);await call('Page.navigate',{url},session);return session;}
async function goto(s,route){await call('Page.navigate',{url:origin+route},s);await until(()=>evaluate(s,`location.pathname===${JSON.stringify(route.split('?')[0])}&&document.readyState==='complete'`),'navigate '+route);}
async function set(s,selector,value){await until(()=>evaluate(s,`(()=>{const e=document.querySelector(${JSON.stringify(selector)});return !!e&&!e.disabled&&e.getClientRects().length>0;})()`),'editable '+selector);await evaluate(s,`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing input '+${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(e.tagName==='SELECT'?HTMLSelectElement.prototype:e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event(e.tagName==='SELECT'?'change':'input',{bubbles:true}));})()`);await delay(100);}
async function click(s,selector){await until(()=>evaluate(s,`(()=>{const e=document.querySelector(${JSON.stringify(selector)});return !!e&&!e.disabled&&e.getClientRects().length>0;})()`),'clickable '+selector);await evaluate(s,`document.querySelector(${JSON.stringify(selector)}).click()`);}
async function button(s,label,scope='document'){await until(()=>evaluate(s,`[...${scope}.querySelectorAll('button')].some(b=>b.getClientRects().length&&!b.disabled&&b.textContent.trim()===${JSON.stringify(label)})`),'button '+label);await evaluate(s,`[...${scope}.querySelectorAll('button')].find(b=>b.getClientRects().length&&!b.disabled&&b.textContent.trim()===${JSON.stringify(label)}).click()`);}
async function state(s){return evaluate(s,`fetch('/api/bingo/live/${game}',{cache:'no-store'}).then(async r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.json()})`);}
async function confirm(s,label){await button(s,label);await until(()=>evaluate(s,`!!document.querySelector('[role="dialog"]')`),'confirmation');await button(s,'Bestätigen',`document.querySelector('[role="dialog"]')`);}
const report={surface:'real hosted Next.js and synthetic PostgreSQL',origin,checks:[]};
try{
 let info='';await until(()=>{try{info=fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8');return info.trim().split(/\r?\n/).length===2;}catch{return false;}},'Chrome');
 const [port,endpoint]=info.trim().split(/\r?\n/);ws=new WebSocket(`ws://127.0.0.1:${port}${endpoint}`);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});ws.onmessage=e=>{const m=JSON.parse(String(e.data));if(m.method==='Fetch.requestPaused'){const q=m.params;assert.equal(new URL(q.request.url).origin,origin);const headers=Object.entries(q.request.headers).map(([name,value])=>({name,value:String(value)}));if(hosted)headers.push({name:'x-vercel-protection-bypass',value:automationCredential});void call('Fetch.continueRequest',{requestId:q.requestId,headers},m.sessionId).catch(error=>{if(!closing&&!/Invalid InterceptionId/.test(error.message))transportFailure=error;});return;}if(!m.id)return;const p=requests.get(m.id);requests.delete(m.id);if(m.error)p?.reject(Error(m.error.message));else p?.resolve(m.result);};
 const s=await tab(origin+'/login');await until(()=>evaluate(s,`document.readyState==='complete'&&!!document.querySelector('[name=email]')`),'login');await set(s,'[name=email]',account.email);await set(s,'[name=password]',account.password);await evaluate(s,`document.querySelector('button[type=submit]').click()`);await until(()=>evaluate(s,`location.pathname!=='/login'`),'authenticated');report.checks.push('actual credential login');if(hosted){const runtime=await evaluate(s,"fetch('/api/admin/monitoring').then(r=>r.json())");assert.equal(runtime.release,process.env.DEPLOYMENT_SHA);assert.equal(runtime.environment,'preview');assert.equal(runtime.db.ok,true);report.runtime={release:runtime.release,environment:runtime.environment,dbOk:runtime.db.ok};report.checks.push('exact authenticated hosted runtime SHA, Preview and database read');}
 await goto(s,'/bingo/new?series=10');await until(()=>evaluate(s,"!!document.querySelector('#game-title')"),'new event form');
 await set(s,'#game-title','Synthetische Abnahme · Farben und Folien');await set(s,'#game-rounds','3');await set(s,'#game-series','10');await button(s,'Entwurf speichern');
 await until(()=>evaluate(s,"location.pathname.startsWith('/bingo/')&&location.pathname.split('/')[2].length===36"),'created synthetic event');game=await evaluate(s,'location.pathname.split("/")[2]');report.gameId=game;
 await until(()=>evaluate(s,"document.querySelectorAll('[data-round-id]').length===3"),'three blocks');
 assert.equal(await evaluate(s,"document.querySelectorAll('a[href$=\"/slides/intro\"],a[href$=\"/slides/outro\"]').length"),2);
 const roundId=(await state(s)).rounds[0].id;
 await click(s,'[data-round-id="'+roundId+'"] button[aria-label^="Bearbeiten:"]');await until(()=>evaluate(s,'!!document.querySelector("#color-'+roundId+'")'),'round editor');
 await set(s,'#color-'+roundId,'#FFF9E9');await button(s,'Runde speichern');
 await until(()=>evaluate(s,"[...document.querySelectorAll('[role=status]')].some(e=>e.textContent==='Gespeichert.')"),'color save confirmed');
 await goto(s,`/bingo/${game}`);
 await until(()=>evaluate(s,`!!document.querySelector('[data-round-id="${roundId}"]')`),'round reload');
 await click(s,'[data-round-id="'+roundId+'"] button[aria-label^="Bearbeiten:"]');
 await until(()=>evaluate(s,`document.querySelector('#color-${roundId}')?.value==='#FFF9E9'`),'persisted color after actual reload');
 report.checks.push('three numbered blocks, fixed Intro/Outro and saved custom cream color');
 await click(s,'a[href$="/slides/intro"]');await until(()=>evaluate(s,`location.pathname.endsWith('/slides/intro')&&!!document.querySelector('nav[aria-label$="-Slides"]')`),'Intro configuration');
 await evaluate(s,"[...document.querySelectorAll('nav[aria-label$=\"-Slides\"] button')].find(b=>b.textContent.includes('Begrüßung')).click()");
 await set(s,'label:not([hidden]) textarea','Synthetisches Intro bleibt unabhängig');await button(s,'Slide speichern');await until(()=>evaluate(s,'location.pathname==="/bingo/'+game+'"'),'Intro saved and compact');
 await click(s,'a[href$="/slides/outro"]');await until(()=>evaluate(s,`location.pathname.endsWith('/slides/outro')&&!!document.querySelector('nav[aria-label$="-Slides"]')`),'Outro configuration');
 await set(s,'label:not([hidden]) textarea','Synthetisches Outro nach allen Runden');await button(s,'Slide speichern');await until(()=>evaluate(s,'location.pathname==="/bingo/'+game+'"'),'Outro saved and compact');
 const config=(await state(s)).ceremony.config;assert.equal(config.welcome,'Synthetisches Intro bleibt unabhängig');assert.equal(config.outro.announcements,'Synthetisches Outro nach allen Runden');report.checks.push('routed editors with independent Intro/Outro persistence and compact return');
 await click(s,'[data-round-id="'+roundId+'"] button[aria-label^="Bearbeiten:"]');await until(()=>evaluate(s,'!!document.querySelector("#count-'+roundId+'")'),'card form');
 await set(s,'#count-'+roundId,'12');await button(s,'Kartenserie erzeugen');await until(async()=>(await state(s)).rounds[0].series.length>0,'12 synthetic cards');
 await goto(s,`/bingo/${game}/moderation`);await confirm(s,'Erste Runde starten');await until(async()=>Boolean((await state(s)).live),'own round started');
 assert.equal((await state(s)).live.round.color,'#FFF9E9');
 await until(()=>evaluate(s,"!!document.querySelector('[aria-label=\"Zahlenarbeitsfläche\"] input')"),'numeric input');await set(s,'[aria-label="Zahlenarbeitsfläche"] input','45');await click(s,'button[aria-label="Zahl veröffentlichen"]');await until(async()=>(await state(s)).live.state.run.rounds[0].draws.length===1,'one synthetic number');
 const audience=await tab(origin+`/bingo/${game}/praesentation`);await until(()=>evaluate(audience,"document.querySelector('[aria-label=\"Bingo-Präsentation\"]')?.dataset.fit==='fitted'&&!!document.querySelector('[data-current-number]')&&[...document.querySelectorAll('[aria-label=\"Bingo-Präsentation\"] img')].every(i=>i.complete&&i.naturalWidth>0)"),'audience board');
 const geometry=await evaluate(audience,`(()=>{const stage=document.querySelector('[aria-label="Bingo-Präsentation"]'),number=stage.querySelector('[data-current-number]'),board=stage.querySelector('ol'),recent=stage.querySelector('aside');return{fit:stage.dataset.fit,visible:number.getBoundingClientRect().height>0,color:getComputedStyle(stage).backgroundColor,number:number.textContent,left:number.getBoundingClientRect().right<=board.getBoundingClientRect().left,below:recent.getBoundingClientRect().top>=board.getBoundingClientRect().bottom,noWrap:getComputedStyle(number).whiteSpace==='nowrap',cells:stage.querySelectorAll('[data-number]').length,logos:[...stage.querySelectorAll('img')].every(i=>i.complete&&i.naturalWidth>0),overflow:stage.scrollWidth>stage.clientWidth+1};})()`);
 assert.deepEqual(geometry,{fit:'fitted',visible:true,color:'rgb(255, 249, 233)',number:'N 45',left:true,below:true,noWrap:true,cells:75,logos:true,overflow:false});report.geometry=geometry;
 const shot=await call('Page.captureScreenshot',{format:'png'},audience);fs.writeFileSync(path.join(out,'presentation.png'),Buffer.from(shot.data,'base64'));report.checks.push('frozen cream color, 75-cell numeric stage and history below in actual hosted player');
 await click(s,'header details summary');await confirm(s,'Event abschließen');await until(async()=>(await state(s)).live.state.run.status==='ENDED','own synthetic run ended');
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({status:'PASS',checks:report.checks.length,runtime:report.runtime,gameId:game}));
}catch(error){fs.writeFileSync(path.join(out,'failed.json'),JSON.stringify({status:'FAIL',message:error instanceof Error?error.message:'Hosted test failed',gameId:game},null,2));throw error;}
finally{closing=true;automationCredential=undefined;ws?.close();browser.kill();if(browser.exitCode===null)await new Promise(r=>browser.once('exit',r));try{fs.rmSync(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});}catch{/* Windows can hold a test profile briefly. */}}
