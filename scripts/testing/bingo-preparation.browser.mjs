import assert from "node:assert/strict"; import fs from "node:fs"; import path from "node:path"; import os from "node:os"; import {spawn} from "node:child_process";
const origin=process.env.BINGO_PREPARATION_REVIEW_URL||"http://localhost:3062";let game;
const target=new URL(origin);if(!(["localhost","127.0.0.1"].includes(target.hostname)&&target.protocol==="http:")&&!(target.protocol==="https:"&&target.hostname==="pubquiz-web-git-codex-bingo-preparation-just-phil-gud.vercel.app"))throw Error("Only the isolated AP2 review origin is permitted");
const accounts=JSON.parse(fs.readFileSync(process.env.BINGO_PREPARATION_ACCOUNTS_FILE||".env.bingo-ap2-accounts.json"));
if(!accounts.every(a=>/^bingo\.(admin|manager|editor)@example\.invalid$/.test(a.email)))throw Error("Only synthetic AP2 review accounts are permitted");
const chrome=[process.env.CHROME_BIN,'C:/Program Files/Google/Chrome/Application/chrome.exe','/usr/bin/google-chrome','/usr/bin/chromium'].find(p=>p&&fs.existsSync(p));if(!chrome)throw Error('Chrome required');
fs.mkdirSync('.artifacts/bingo-ap2',{recursive:true});
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'bingo-ap2-browser-'));
const browser=spawn(chrome,['--headless=new','--no-sandbox','--disable-gpu','--disable-background-networking','--no-first-run',`--user-data-dir=${profile}`,'--remote-debugging-port=0','about:blank'],{stdio:'ignore'});
let ws,id=0;const requests=new Map();
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function until(f,message,timeout=45000){const end=Date.now()+timeout;while(Date.now()<end){if(await f())return;await delay(100);}throw Error(message);}
function call(method,params={},sessionId){return new Promise((resolve,reject)=>{const key=++id,timer=setTimeout(()=>{requests.delete(key);reject(Error('CDP timeout: '+method));},20000);requests.set(key,{resolve:r=>{clearTimeout(timer);resolve(r);},reject:e=>{clearTimeout(timer);reject(e);}});ws.send(JSON.stringify({id:key,method,params,sessionId}));});}
async function evaluate(s,expression){const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true},s);if(r.exceptionDetails)throw Error(r.exceptionDetails.text+': '+r.exceptionDetails.exception?.description);return r.result?.value;}
async function tab(url,context){const t=await call('Target.createTarget',{url,browserContextId:context});const s=(await call('Target.attachToTarget',{targetId:t.targetId,flatten:true})).sessionId;await call('Page.enable',{},s);return s;}
async function goto(s,p){await call('Page.navigate',{url:origin+p},s);await until(()=>evaluate(s,'document.readyState==="complete"'),'page load');}
async function text(s){return evaluate(s,'document.body.innerText');}
async function button(s,label){await evaluate(s,`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(label)});if(!b||b.disabled)throw Error('Unavailable button '+${JSON.stringify(label)});b.click();})()`);}
async function set(s,selector,value){await evaluate(s,`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing input');const p=e.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(p,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event(e.tagName==='SELECT'?'change':'input',{bubbles:true}));})()`);await delay(100);}
async function login(s,account){await goto(s,'/login');await until(()=>evaluate(s,'!!document.querySelector("[name=email]")'),'login form');await set(s,'[name=email]',account.email);await set(s,'[name=password]',account.password);await evaluate(s,'document.querySelector("button[type=submit]").click()');await until(()=>evaluate(s,'location.pathname!=="/login"'),'fresh password login');}
async function screenshot(s,name,width,height){console.log('Viewport check: '+name);await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<500},s);await call('Page.bringToFront',{},s);await delay(250);const r=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false},s);fs.writeFileSync(`.artifacts/bingo-ap2/${name}.png`,Buffer.from(r.data,'base64'));assert.equal(await evaluate(s,'document.documentElement.scrollWidth<=innerWidth'),true,'horizontal overflow');}
(async()=>{
 await until(()=>fs.existsSync(path.join(profile,'DevToolsActivePort')),'Chrome start');const [port,endpoint]=fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').trim().split(/\r?\n/);ws=new WebSocket(`ws://127.0.0.1:${port}${endpoint}`);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
 ws.onmessage=e=>{const m=JSON.parse(String(e.data));if(!m.id)return;const p=requests.get(m.id);requests.delete(m.id);if(m.error)p?.reject(Error(m.error.message));else p?.resolve(m.result||{});};
 const context=(await call('Target.createBrowserContext')).browserContextId,s=await tab(origin+'/login',context);await login(s,accounts.find(a=>a.id===1));
 await goto(s,'/bingo/new');await until(()=>evaluate(s,'!!document.querySelector("#game-title")&&!document.querySelector("#game-title").matches(":disabled")'),'new draft hydrated');await set(s,'#game-title','Browserabnahme '+Date.now());await set(s,'#game-series','10');await button(s,'Entwurf speichern');await until(()=>evaluate(s,'location.pathname.startsWith("/bingo/")&&location.pathname.split("/")[2].length===36'),'new game created');game=await evaluate(s,'location.pathname.split("/")[2]');
 await goto(s,`/bingo/${game}/vorbereitung`);await until(async()=>/Runde hinzufügen/.test(await text(s)),'preparation ready');
 await button(s,'Runde hinzufügen');await until(()=>evaluate(s,'document.querySelectorAll("section[aria-labelledby]").length===1'),'first round');
 const r1=await evaluate(s,'document.querySelector("input[id^=label-]").id.slice(6)');await set(s,`#label-${r1}`,'Druckrunde 1');await set(s,`#target-${r1}`,'40');await button(s,'Runde speichern');await until(()=>evaluate(s,'document.querySelector("h2").textContent==="Druckrunde 1"'),'round save');
 await goto(s,`/bingo/${game}/vorbereitung`);await until(()=>evaluate(s,`document.querySelector('#target-${r1}')?.value==='40'`),'round reload');
 await set(s,`#label-${r1}`,'Ungespeichert');let dialog=false;
 const previous=ws.onmessage;ws.onmessage=e=>{const m=JSON.parse(String(e.data));if(m.method==='Page.javascriptDialogOpening'){dialog=true;call('Page.handleJavaScriptDialog',{accept:false},m.sessionId);}previous(e);};
 await evaluate(s,`setTimeout(()=>[...document.querySelectorAll('a')].find(a=>a.textContent==='Zum Spiel').click(),0);true`);await until(()=>dialog,'native unsaved dialog');
 assert.equal(await evaluate(s,`location.pathname.endsWith('/vorbereitung')&&document.querySelector('#label-${r1}').value==='Ungespeichert'`),true,'cancel must preserve page and field');
 await set(s,`#label-${r1}`,'Druckrunde 1');await set(s,`#count-${r1}`,'9');
 await evaluate(s,`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent==='Kartenserie erzeugen');b.click();b.click();})()`);
 await until(()=>evaluate(s,'[...document.querySelectorAll("a")].some(a=>a.href.includes("/karten?series="))'),'card generation',60000);
 const series=await evaluate(s,'new URL([...document.querySelectorAll("a")].find(a=>a.href.includes("/karten?series=")).href).searchParams.get("series")');
 await button(s,'Runde hinzufügen');await until(()=>evaluate(s,'document.querySelectorAll("section[aria-labelledby]").length===2'),'second round');
 const r2=await evaluate(s,'[...document.querySelectorAll("input[id^=label-]")][1].id.slice(6)');await set(s,`#strategy-${r2}`,'EXISTING');
 await evaluate(s,`document.querySelector('#strategy-${r2}').closest('form').querySelector('button[type=submit]').click()`);await until(()=>evaluate(s,`!!document.querySelector('#series-${r2}')`),'existing strategy saved');
 await set(s,`#series-${r2}`,series);await button(s,'Serie zuordnen');await until(()=>evaluate(s,`document.querySelector('#issued-${r2}').max==='9'`),'reuse linked');
 await set(s,`#issued-${r2}`,'3');await evaluate(s,`document.querySelector('#issued-${r2}').closest('form').querySelector('button[type=submit]').click()`);await until(()=>evaluate(s,`document.querySelector('#issued-${r2}').matches(':disabled')`),'issued saving');await until(()=>evaluate(s,`!document.querySelector('#issued-${r2}').matches(':disabled')`),'issued saved');
 await goto(s,`/bingo/${game}/vorbereitung`);await until(()=>evaluate(s,`document.querySelector('#issued-${r2}')?.value==='3'`),'issued durable reload');
 await screenshot(s,'rounds-laptop',1366,768);await screenshot(s,'rounds-mobile',390,844);
 // A second real tab creates a stale form, without changing its local input.
 const stale=await tab(origin+`/bingo/${game}/vorbereitung`,context);await until(()=>evaluate(stale,`!!document.querySelector('#label-${r1}')`),'stale tab loaded');
 await button(s,'Runde hinzufügen');await until(()=>evaluate(s,'document.querySelectorAll("section[aria-labelledby]").length===3'),'concurrent change');
 await set(stale,`#label-${r1}`,'Konflikt behalten');await evaluate(stale,`document.querySelector('#label-${r1}').closest('form').querySelector('button[type=submit]').click()`);await until(async()=>/inzwischen geändert/.test(await text(stale)),'CAS conflict visible');assert.equal(await evaluate(stale,`document.querySelector('#label-${r1}').value`),'Konflikt behalten');
 await goto(s,`/bingo/${game}/karten?series=${series}`);await until(async()=>/9 passende Karten/.test(await text(s)),'stored cards list');assert.equal(await evaluate(s,'document.querySelectorAll("table").length'),9,'double click generated extra cards');
 await screenshot(s,'cards-mobile',390,844);await screenshot(s,'cards-laptop',1366,768);
 const code=await evaluate(s,'document.querySelector("h3").textContent');await set(s,'#card-search',code);await button(s,'Suchen');await until(async()=>/1 passende Karten/.test(await text(s)),'card code search');assert.equal(await evaluate(s,'document.querySelectorAll("table").length'),1);
 const download=path.resolve('.artifacts/bingo-ap2/browser-downloads');fs.mkdirSync(download,{recursive:true});await call('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:download,browserContextId:context});
 const previousDownloads=new Set(fs.readdirSync(download));await evaluate(s,'document.querySelector("a[download]").click()');await until(()=>fs.readdirSync(download).some(n=>n.endsWith('.pdf')&&!previousDownloads.has(n)),'actual browser PDF download');
 const downloadFilename=fs.readdirSync(download).find(n=>n.endsWith('.pdf')&&!previousDownloads.has(n));
 const restricted=(await call('Target.createBrowserContext')).browserContextId,e=await tab(origin+'/login',restricted);await login(e,accounts.find(a=>a.id===3));
 await goto(e,`/bingo/${game}`);await until(async()=>/Nur Lesezugriff/.test(await text(e)),'editor masterdata preserved');await goto(e,`/bingo/${game}/vorbereitung`);await until(async()=>/404|not be found|nicht gefunden/i.test(await text(e)),'editor preparation denied');
 await goto(s,'/quiz');await until(async()=>/Synthetische Quiz-Regression/.test(await text(s)),'quiz administration regression');
 fs.writeFileSync('.artifacts/bingo-ap2/browser-results.json',JSON.stringify({origin,game,series,downloadFilename,passed:['fresh password login','round create/edit/reload','native unsaved navigation cancellation preserves page+input','double click generation','existing card series reuse','issued total durable reload','concurrent stale form preserves input','stored code search','browser PDF download','editor scope denial with masterdata read preserved','quiz administration','1366x768 and 390x844 no overflow'],productionChanged:false},null,2));console.log('AP2 actual local browser acceptance PASS');
})().catch(e=>{console.error(e.stack);process.exitCode=1;}).finally(async()=>{if(ws?.readyState===1){await call('Browser.close').catch(()=>{});ws.close();}browser.kill();});
