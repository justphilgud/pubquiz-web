import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { build } from "esbuild";
import postcss from "postcss";
import tailwindcss from "@tailwindcss/postcss";

type ProtocolResult = { targetId?: string; sessionId?: string; result?: { value?: unknown }; exceptionDetails?: unknown };

test("presentation acknowledges committed targets without focus or animation frames", { timeout: 120_000 }, async () => {
  const chrome = [process.env.CHROME_BIN, "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "/usr/bin/google-chrome", "/usr/bin/chromium"].find((path) => path && existsSync(path));
  assert.ok(chrome, "Chrome required");
  const entry = String.raw`
 import React from 'react';
 import {createRoot} from 'react-dom/client';
 import {flushSync} from 'react-dom';
 import {usePresentationWindowReceipt,usePresentationRenderReceipt} from './app/quiz/presentationWindowSync';
 import {PodiumCeremony} from './app/rendering/presentation/PodiumCeremony';
 import QuestionDurationPreview from './app/components/content/QuestionDurationPreview';
 import QuizBalanceSummary from './app/quiz/planning/QuizBalanceSummary';
 import {getQuizBalance} from './app/quiz/quizBalance';
 import MemeFlowGuide from './app/quiz/[quizId]/moderation/components/MemeFlowGuide';
 import PresentationSlideRenderer from './app/rendering/presentation/PresentationSlideRenderer';
 import {buildPresentationQualityFixture} from './app/rendering/presentation/presentationQualityFixtures';
 const root=createRoot(document.getElementById('root'));
 const publicWindow=location.search.includes('public');
 window.framesRequested=0;
 window.freezeFrames=()=>{window.requestAnimationFrame=()=>{window.framesRequested++;return 0}};
 window.receipts=[];
 if(!publicWindow){const observer=new BroadcastChannel('pubquiz-presentation-904');observer.onmessage=({data})=>{if(data.kind==='applied'||data.kind==='rendered')window.receipts.push(data)}}
 function Player({position}){usePresentationRenderReceipt(904,position.key,position.reveal);return <h1>{position.key}:{position.reveal}</h1>}
 function Moderator(){const wait=usePresentationWindowReceipt(904);window.check=position=>{window.done=null;wait(position).then(result=>window.done=result)};return <button>Moderation bleibt fokussiert</button>}
 window.show=position=>flushSync(()=>root.render(publicWindow?<Player position={position}/>:<Moderator/>));
 const podiumScores=[{teamId:1,teamname:'Ohne Foto',punkte:30},{teamId:2,teamname:'Breit',punkte:20,photoUrl:'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="80"><rect width="800" height="80" fill="red"/></svg>')},{teamId:3,teamname:'Hoch',punkte:10,photoUrl:'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="800"><rect width="80" height="800" fill="blue"/></svg>')}];
 window.podiumReveal=revealCount=>flushSync(()=>root.render(<div className="presentation-template presentation-readable" data-design-style="EDITORIAL" style={{height:'90vh',containerType:'size',display:'flex',flexDirection:'column',background:'#14181C','--quiz-text':'#FFF9E9','--quiz-background':'#14181C','--quiz-surface':'#302C29','--quiz-border':'#FFF9E9'}}><PodiumCeremony revealCount={revealCount} scores={podiumScores}/></div>));
 window.podium=()=>window.podiumReveal(3);
 window.show({key:'block:1',reveal:1});
 window.duration=()=>flushSync(()=>root.render(<QuestionDurationPreview value={{questionSeconds:4,translationSeconds:8,audioUrls:[{url:'/tone.wav',label:'Audiodatei'}]}}/>));
 window.balance=(categorized=true)=>flushSync(()=>root.render(<QuizBalanceSummary balance={getQuizBalance({questions:Array.from({length:25},(_,i)=>({sectionId:1,templateId:'musik',answerMode:'OPEN',categoryIds:categorized&&i===0?[1]:[]})),sections:[{id:1,title:'Prüfblock'}],categories:[{id:1,name:'Film'},{id:2,name:'Kultur'}]})}/>));
 window.guide=()=>flushSync(()=>root.render(<div style={{background:'#14181C',padding:20}}><MemeFlowGuide/></div>));
 window.question=(templateId,typ,number,style)=>{
   const fixture=buildPresentationQualityFixture('short',style);fixture.theme.identity.logoUrl=null;fixture.slide={...fixture.slide,typ,frageIndexImBlock:number};fixture.slide.frage.templateId=templateId;
   if(templateId==='paare_bilden')fixture.slide.frage.templateConfig={templateData:{kind:'PAIRS',pairs:[{leftId:'a',rightId:'b',left:'Berlin',right:'Deutschland'},{leftId:'c',rightId:'d',left:'Paris',right:'Frankreich'}]}};
   if(templateId==='uebersetzt_vorgelesen')fixture.slide.frage.templateConfig={templateData:{kind:'TRANSLATION_READ_ALOUD',originalText:'Original',translation:'Übersetzung',sourceLanguage:'en',targetLanguage:'de',speed:1,voiceProvider:'BROWSER',voiceId:'default',voiceStyle:'',voiceInstruction:''}};
   fixture.slides=[fixture.slide];flushSync(()=>root.render(<PresentationSlideRenderer {...fixture}/>));
 };
`;
  const [{ outputFiles }, css] = await Promise.all([
    build({ stdin: { contents: entry, resolveDir: process.cwd(), loader: "tsx" },
      bundle: true, platform: "browser", write: false, jsx: "automatic",
      define: { "process.env.NODE_ENV": '"production"', "process.env": "{}" } }),
    postcss([tailwindcss()]).process(readFileSync('app/globals.css','utf8'), { from: resolve("app/globals.css") }),
  ]);
  const podiumAssets = resolve("public/assets/podium-ceremony");
  const server = createServer((request, response) => {
    if (request.url?.startsWith("/assets/podium-ceremony/")) {
      const assetPath = join(podiumAssets, basename(decodeURIComponent(request.url)));
      response.setHeader("Content-Type", "image/webp");
      response.end(readFileSync(assetPath));
    } else if (request.url === "/tone.wav") {
      const wav=Buffer.alloc(32044); wav.write('RIFF');wav.writeUInt32LE(32036,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(8000,24);wav.writeUInt32LE(16000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(32000,40);
      response.setHeader('Content-Type','audio/wav');response.end(wav);
    } else if (request.url === "/bundle.js") {
      response.setHeader("Content-Type", "text/javascript");
      response.end(outputFiles[0].contents);
    } else if (request.url === "/style.css") {
      response.setHeader("Content-Type", "text/css");
      response.end(css.css);
    } else {
      response.setHeader("Content-Type", "text/html");
      response.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><div id="root" style="height:100dvh"></div><script>window.fixtureErrors=[];addEventListener("error",e=>window.fixtureErrors.push(e.message));</script><script src="/bundle.js"></script>');
    }
  });
  await new Promise<void>((ready) => server.listen(0, "127.0.0.1", ready));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const url = `http://127.0.0.1:${address.port}`;
  const profile = mkdtempSync(join(tmpdir(), "pubquiz-pairs-"));
  const browser = spawn(chrome, ["--headless=new", "--no-sandbox", "--disable-gpu", "--disable-background-networking",
    "--disable-dev-shm-usage", "--no-first-run", `--user-data-dir=${profile}`, "--remote-debugging-port=0", "about:blank"],
    { stdio: ["ignore", "ignore", "pipe"] });
  let browserDiagnostic = "";
  let browserError: Error | undefined;
  browser.stderr.on("data", (chunk) => { browserDiagnostic = (browserDiagnostic + String(chunk)).slice(-4000); });
  browser.on("error", (error) => { browserError = error; });
  let socket: WebSocket | undefined;
  try {
    const portFile = join(profile, "DevToolsActivePort");
    for (let attempt = 0; attempt < 400 && !existsSync(portFile); attempt++) {
      if (browserError || browser.exitCode !== null || browser.signalCode !== null) break;
      await delay(50);
    }
    assert.ok(existsSync(portFile), `Chrome did not start: ${browserError?.message ?? browserDiagnostic}`);
    const [port, endpoint] = readFileSync(portFile, "utf8").trim().split(/\r?\n/);
    const ws = new WebSocket(`ws://127.0.0.1:${port}${endpoint}`);
    socket = ws;
    await new Promise<void>((ready, reject) => {
      ws.onopen = () => ready();
      ws.onerror = () => reject(new Error("Chrome debug connection failed"));
    });
    let id = 0;
    const pending = new Map<number, { resolve: (result: ProtocolResult) => void; reject: (error: Error) => void }>();
    ws.onmessage = (event) => {
      const message = JSON.parse(String(event.data));
      const request = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) request?.reject(new Error(message.error.message));
      else request?.resolve(message.result);
    };
    function call(method: string, params: object, sessionId?: string) {
      return new Promise<ProtocolResult>((resolve, reject) => {
        const next = ++id;
        pending.set(next, { resolve, reject });
        ws.send(JSON.stringify({ id: next, method, params, sessionId }));
      });
    }
    const { targetId } = await call("Target.createTarget", { url });
    const { sessionId } = await call("Target.attachToTarget", { targetId, flatten: true });
    async function evaluate<T = unknown>(expression: string) {
      const result = await call("Runtime.evaluate", { expression, returnByValue: true }, sessionId);
      assert.equal(result.exceptionDetails, undefined, expression);
      return result.result?.value as T;
    }
    async function loaded() {
      for (let attempt = 0; attempt < 100; attempt++) {
        if (await evaluate("typeof window.show === 'function'")) return;
        await delay(50);
      }
      assert.fail("Fixture did not load: "+await evaluate('JSON.stringify(window.fixtureErrors)'));
    }
    await loaded();

    const playerTarget=await call('Target.createTarget',{url:url+'/?public'});
    const player=await call('Target.attachToTarget',{targetId:playerTarget.targetId,flatten:true});
    async function playerEval(expression:string){const r=await call('Runtime.evaluate',{expression,returnByValue:true},player.sessionId);assert.equal(r.exceptionDetails,undefined);return r.result?.value;}
    for(let i=0;i<100 && !await playerEval("typeof window.show==='function'");i++)await delay(50);
    for(let i=0;i<100 && !await evaluate('window.receipts.length>0');i++)await delay(50);
    assert.ok(await evaluate("window.receipts.some(p=>p.key==='block:1')"),'established player peer before losing focus');
    await playerEval('window.freezeFrames()');
    await call('Target.activateTarget',{targetId});
    await delay(200);
    assert.equal(await playerEval('document.hasFocus()'),false,'presentation has no focus');
    for(const position of [{key:'question:17:question',reveal:1},{key:'question:17:solution',reveal:1},{key:'block:2',reveal:1},{key:'winner',reveal:0},{key:'winner',reveal:1},{key:'closing',reveal:1}]){
      await evaluate('window.check('+JSON.stringify(position)+')');
      await playerEval('window.show('+JSON.stringify(position)+')');
      for(let i=0;i<100 && !await evaluate('window.done===true');i++)await delay(50);
      assert.equal(await evaluate('window.done'),true,JSON.stringify(position));
      assert.ok(await evaluate('window.receipts.some(p=>p.key==='+JSON.stringify(position.key)+'&&p.reveal==='+position.reveal+')'),'target receipt really arrived over BroadcastChannel');
      assert.equal(await playerEval('document.hasFocus()'),false);
    }
    assert.equal(await playerEval('window.framesRequested'),0,'no rAF required for commit acknowledgement');
    await evaluate('window.podiumReveal(0)');
    assert.equal(await evaluate("document.querySelectorAll('[data-podium-friend]').length"),5);
    assert.equal(await evaluate("document.querySelectorAll('.podium-team').length"),0);
    assert.equal(await evaluate("document.querySelector('.podium-ceremony').dataset.phase"),'dance');
    assert.match(await evaluate("getComputedStyle(document.querySelector('.podium-ceremony')).backgroundImage"),/stage\.webp/);
    assert.equal(await evaluate("getComputedStyle(document.querySelector('[data-podium-friend=teal]')).animationName"),'podium-dance-teal');
    await evaluate('window.podiumReveal(1)');
    assert.equal(await evaluate("document.querySelector('.podium-ceremony').dataset.phase"),'settling');
    assert.equal(await evaluate("getComputedStyle(document.querySelector('.podium-team')).visibility"),'hidden');
    await delay(2300);
    assert.equal(await evaluate("document.querySelector('.podium-ceremony').dataset.phase"),'rank3-reveal');
    assert.equal(await evaluate("document.querySelector('.podium-team').dataset.place"),'3');
    assert.equal(await evaluate("document.querySelectorAll('.podium-confetti-piece').length"),56);
    assert.equal(await evaluate("getComputedStyle(document.querySelector('[data-podium-friend=yellow]')).animationName"),'podium-happy-bounce');
    await evaluate('window.podiumReveal(2)');
    assert.equal(await evaluate("document.querySelector('.podium-ceremony').dataset.phase"),'rank2-reveal');
    assert.equal(await evaluate("document.querySelectorAll('.podium-confetti-piece').length"),74);
    await evaluate('window.podiumReveal(3)');
    assert.equal(await evaluate("document.querySelector('.podium-ceremony').dataset.phase"),'winner');
    assert.equal(await evaluate("getComputedStyle(document.querySelector('[data-podium-friend=gudi]')).animationName"),'podium-gudi-firework-flight');
    assert.equal(await evaluate("getComputedStyle(document.querySelector('[data-podium-friend=teal]')).animationName"),'podium-teal-boomerang');
    assert.equal(await evaluate("document.querySelectorAll('.podium-confetti-piece').length"),112);
    assert.equal(await evaluate("document.querySelectorAll('.podium-team-photo').length"),3);
    assert.equal(await evaluate("[...document.querySelectorAll('.podium-team-photo')].filter(img=>img.src.startsWith('data:image/svg+xml')).length"),2);
    const photoFrameSizes=await evaluate<Array<{width:number;height:number}>>("[...document.querySelectorAll('.podium-team-photo-frame')].map(frame=>{const r=frame.getBoundingClientRect();return {width:r.width,height:r.height}})");
    assert.ok(photoFrameSizes.every(frame=>Math.abs(frame.width-frame.height)<2),`Podium photo frames must stay square: ${JSON.stringify(photoFrameSizes)}`);
    assert.equal(await evaluate("getComputedStyle(document.querySelector('.podium-firework-tail')).opacity"),'1');
    assert.match(await evaluate("getComputedStyle(document.querySelector('.podium-gudi-art--hat')).backgroundImage"),/gudi-party-hat\.webp/);
    await delay(4000);
    assert.ok(await evaluate("[...document.querySelectorAll('.podium-team-photo')].every(img=>getComputedStyle(img).objectFit==='contain' && img.getBoundingClientRect().height>=72)"));
    mkdirSync('.artifacts/quiz-corrections',{recursive:true});
    const screenshot=await call('Page.captureScreenshot',{format:'png'},sessionId) as {data:string};
    writeFileSync('.artifacts/quiz-corrections/podium.png',Buffer.from(screenshot.data,'base64'));
    await delay(4200);
    assert.equal(await evaluate("document.querySelector('.podium-ceremony').dataset.phase"),'finale');
    assert.equal(await evaluate("getComputedStyle(document.querySelector('[data-podium-friend=gudi]')).animationName"),'podium-n64-sway');
    assert.equal(await evaluate("getComputedStyle(document.querySelector('.podium-firework-tail')).opacity"),'0');
    assert.equal(await evaluate("document.querySelectorAll('.podium-team').length"),3);
    await evaluate('window.duration()');
    for(let i=0;i<100 && !await evaluate("document.body.textContent.includes('Dateidauer')");i++)await delay(50);
    const text=await evaluate<string>('document.body.textContent');
    assert.match(text,/Fragetext.*geschätzte Vorlesedauer.*0:04/);
    assert.match(text,/Übersetzung.*geschätzte Vorlesedauer.*0:08/);
    assert.match(text,/Audiodatei: 0:02 Min\. \(Dateidauer\)/);
    await evaluate('window.balance();document.querySelector("button").click()');await delay(100);
    const distribution=await evaluate<string>('document.body.textContent');
    assert.match(distribution,/Ohne Kategorie: 24 · 96 %/);
    assert.match(distribution,/Bezugsmenge der Kategorieanteile: 1 Fragen/);
    assert.match(distribution,/Film · 1 · 100 %/);
    assert.ok(await evaluate("[...document.querySelectorAll('a[href*=categoryId]')].every(a=>a.target==='_blank')"));
    await evaluate("[...document.querySelectorAll('h4')].find(x=>x.textContent==='Sachkategorien').scrollIntoView({block:'center'})");await delay(100);
    const balanceScreenshot=await call('Page.captureScreenshot',{format:'png'},sessionId) as {data:string};
    writeFileSync('.artifacts/quiz-corrections/balance.png',Buffer.from(balanceScreenshot.data,'base64'));
    await evaluate('window.balance(false)');await delay(100);
    assert.match(await evaluate<string>('document.body.textContent'),/Keine Kategorien zugeordnet · neutral/);
    await evaluate('window.guide();document.querySelector("details").open=true');await delay(100);
    const guide=await evaluate<string>('document.body.textContent');assert.match(guide,/Abstimmung schließen/);assert.match(guide,/Keine eingereichten/);
    const guideScreenshot=await call('Page.captureScreenshot',{format:'png'},sessionId) as {data:string};
    writeFileSync('.artifacts/quiz-corrections/meme-guide.png',Buffer.from(guideScreenshot.data,'base64'));
    for(const style of ['EDITORIAL','CORPORATE','BIRTHDAY'])for(const template of ['meme_beschriften','uebersetzt_vorgelesen','paare_bilden'])for(const phase of ['frage','aufloesung']){
      await evaluate('window.question('+[template,phase,17,style].map(value=>JSON.stringify(value)).join(',')+')');await delay(30);
      assert.ok(await evaluate("(()=>{const label=document.querySelector('[data-question-sequence=\"17\"] > p');if(!label)return false;const r=label.getBoundingClientRect();return label.textContent.includes('Frage 17')&&r.width>0&&r.height>0&&r.top>=0&&r.bottom<=innerHeight})()"),style+'/'+template+'/'+phase);
    }
    const numberScreenshot=await call('Page.captureScreenshot',{format:'png'},sessionId) as {data:string};
    writeFileSync('.artifacts/quiz-corrections/question-number.png',Buffer.from(numberScreenshot.data,'base64'));
  } finally {
    socket?.close();
    if (browser.exitCode === null && browser.pid) {
      const exited = new Promise<void>((done) => browser.once("exit", () => done()));
      browser.kill();
      await Promise.race([exited, delay(2_000)]);
    }
    await new Promise<void>((done) => server.close(() => done()));
    rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
});
