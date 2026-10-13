import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

function silentWav(seconds: number) {
  const rate = 8000, data = rate * seconds * 2, wav = Buffer.alloc(44 + data);
  wav.write("RIFF"); wav.writeUInt32LE(36 + data, 4); wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
  wav.write("data", 36); wav.writeUInt32LE(data, 40); return wav;
}

test("real browser audio metadata, pause/seek/restart, phase change and stale playback", async () => {
  const chrome = [process.env.CHROME_BIN, "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(path => path && existsSync(path));
  assert.ok(chrome, "Chrome/Chromium required");
  const source = `
    import React from 'react';
    import {createRoot} from 'react-dom/client';
    import {flushSync} from 'react-dom';
    import {SynchronizedMedia} from './app/rendering/presentation/PresentationSlideRenderer';
    import {SynchronizedSpeech} from './app/rendering/presentation/SynchronizedSpeech';
    const root=createRoot(document.getElementById('app'));
    const show=(src,command,id)=>flushSync(()=>root.render(<SynchronizedMedia kind="audio" src={src} command={command} commandId={id} renderMode="PRESENTATION" showCountdown/>));
    let phase='initial';
    const wait=async(predicate)=>{for(let i=0;i<250;i++){if(predicate())return;await new Promise(r=>setTimeout(r,20));}const audio=document.querySelector('audio');throw Error('condition timeout: '+phase+' '+JSON.stringify(audio?{position:audio.currentTime,duration:audio.duration,readyState:audio.readyState,seeking:audio.seeking,countdown:countdown()}:{}));};
    const check=(condition,message)=>{if(!condition)throw Error(message);};
    const countdown=()=>document.querySelector('output')?.textContent;
    async function run(){
      show('/long.wav',null,0); await wait(()=>countdown()==='2:05');
      const original=document.querySelector('audio'); check(original.paused,'initial autoplay');
      phase='play';show('/long.wav','play',1); await wait(()=>!original.paused);
      phase='pause';show('/long.wav','pause',2); await wait(()=>original.paused);
      phase='buffer';await wait(()=>original.seekable.length && original.seekable.end(original.seekable.length-1)>62);
      phase='seek';original.currentTime=61.2; await wait(()=>original.currentTime>61); original.dispatchEvent(new Event('timeupdate')); await wait(()=>countdown()==='1:04');
      phase='paused reload';flushSync(()=>root.render(null));show('/long.wav',null,2);
      await wait(()=>countdown()==='2:05');
      show('/long.wav','pause',2);
      await wait(()=>document.querySelector('audio')?.currentTime>61 && countdown()==='1:04');
      check(document.querySelector('audio').paused,'reload started paused intro');
      check(original.paused,'reload kept previous media playing');
      phase='restart';show('/long.wav','stop',3); await wait(()=>countdown()==='2:05');
      phase='short';show('/short.wav',null,4); await wait(()=>countdown()==='0:12');
      check(original.paused,'old audio still playing');
      let short=document.querySelector('audio'); check(short!==original,'source reused stale media node');
      phase='short buffer';show('/short.wav','play',11);await wait(()=>short.readyState===4 && short.buffered.length && short.buffered.end(short.buffered.length-1)===12);
      show('/short.wav','pause',12);await wait(()=>short.paused);
      phase='end position';short.currentTime=12;await wait(()=>short.currentTime===12);
      phase='end';short.dispatchEvent(new Event('ended'));await wait(()=>countdown()==='0:00');
      phase='ended reload';flushSync(()=>root.render(null));show('/short.wav',null,12);
      await wait(()=>countdown()==='0:12');show('/short.wav','play',12);
      await wait(()=>countdown()==='0:00');short=document.querySelector('audio');
      check(short.paused,'activation restarted completed intro');
      let settle; const realPlay=HTMLMediaElement.prototype.play;
      let settleEarlier;let playCalls=0;
      HTMLMediaElement.prototype.play=function(){return ++playCalls===1?new Promise(resolve=>settleEarlier=resolve):realPlay.call(this);};
      phase='repeat play';short.currentTime=0;show('/short.wav','play',8);show('/short.wav','play',9);await wait(()=>!short.paused);settleEarlier();await new Promise(resolve=>setTimeout(resolve,20));check(!short.paused,'older play promise stopped current playback');
      show('/short.wav','pause',10);await wait(()=>short.paused);
      HTMLMediaElement.prototype.play=function(){return new Promise(r=>settle=r);};
      phase='stale';show('/stale.wav','play',5); const stale=document.querySelector('audio');
      show('/short.wav',null,6); settle(); await wait(()=>stale.paused);
      check(document.querySelector('audio')!==stale,'stale node reused');
      HTMLMediaElement.prototype.play=realPlay;
      phase='blocked intro';let activationRequests=0;
      const requestActivation=()=>activationRequests++;
      HTMLMediaElement.prototype.play=function(){return Promise.reject(new DOMException('Gesture required','NotAllowedError'));};
      flushSync(()=>root.render(<SynchronizedMedia kind="audio" src="/long.wav" command="play" commandId={21} renderMode="PRESENTATION" showCountdown allowPublicActivation={false} onPlaybackBlocked={requestActivation}/>));
      await wait(()=>activationRequests===1);
      check(!document.querySelector('button'),'public intro play button leaked after blocked playback');
      HTMLMediaElement.prototype.play=realPlay;
      phase='activation retry';show('/long.wav',null,22);show('/long.wav','play',23);
      await wait(()=>document.querySelector('audio')?.currentTime>0.1 && !document.querySelector('audio').paused);
      check(document.querySelectorAll('audio').length===1,'duplicate media after activation retry');
      phase='missing';show('/missing.wav',null,7); await wait(()=>document.querySelector('[role="status"]'));
      check(!document.querySelector('output'),'invented countdown after failed audio');
      flushSync(()=>root.render(null)); check(short.paused,'unmounted audio continues');
      phase='browser speech commands';
      const nativeSpeech=window.speechSynthesis, NativeUtterance=window.SpeechSynthesisUtterance;
      const spoken=[];let currentSpeech=null, cancels=0, pauses=0, resumes=0;
      const fakeVoice={voiceURI:'qa-voice',name:'QA Voice'};
      Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{
        getVoices:()=>[fakeVoice],
        speak:u=>{spoken.push(u);currentSpeech=u;queueMicrotask(()=>u.onstart?.());},
        cancel:()=>{cancels++;currentSpeech=null;}, pause:()=>pauses++,resume:()=>resumes++,
      }});
      Object.defineProperty(window,'SpeechSynthesisUtterance',{configurable:true,value:class {constructor(text){this.text=text;}}});
      const showSpeech=(text,command,id)=>flushSync(()=>root.render(<SynchronizedSpeech text={text} language="de" voiceId="qa-voice" speed={1.3} command={command} commandId={id} onPlaybackBlocked={requestActivation}/>));
      showSpeech('First saved translation','play',30);
      await wait(()=>document.querySelector('[data-speech-position]')?.textContent==='Text wird vorgelesen');
      check(spoken.length===1 && spoken[0].text==='First saved translation','wrong speech source');
      check(spoken[0].voice===fakeVoice && spoken[0].lang==='de' && spoken[0].rate===1.3,'saved speech metadata lost');
      currentSpeech.onboundary({charIndex:12});
      await wait(()=>document.querySelector('[data-speech-position]')?.dataset.speechPosition==='12');
      showSpeech('First saved translation','pause',31);check(pauses===1,'speech pause missing');
      showSpeech('First saved translation','play',32);check(spoken.length===1 && resumes>0,'speech resume restarted or duplicated');
      const oldSpeech=currentSpeech, staleBoundary=oldSpeech.onboundary;
      showSpeech('Second saved translation','play',33);
      await wait(()=>spoken.length===2 && currentSpeech.text==='Second saved translation');
      check(cancels>0 && oldSpeech.onboundary===null,'question change kept old speech active');
      staleBoundary({charIndex:99}); await new Promise(resolve=>setTimeout(resolve,20));
      check(document.querySelector('[data-speech-position]')?.dataset.speechPosition!=='99','stale speech event changed current question');
      showSpeech('Second saved translation','stop',34);check(currentSpeech===null,'speech stop failed');
      showSpeech('Blocked speech','play',35);await wait(()=>currentSpeech?.text==='Blocked speech');
      const blockedSpeech=currentSpeech, beforeRequests=activationRequests;
      blockedSpeech.onerror({error:'not-allowed'});
      await wait(()=>activationRequests===beforeRequests+1 && document.querySelector('[role="alert"]'));
      check(!document.body.textContent.includes('Blocked speech'),'speech stimulus leaked into presentation');
      flushSync(()=>root.render(null));
      showSpeech('','play',36);await wait(()=>document.querySelector('[role="alert"]')?.textContent.includes('kein übersetzter Text'));
      flushSync(()=>root.render(null));
      Object.defineProperty(window,'speechSynthesis',{configurable:true,value:undefined});
      showSpeech('Unsupported speech','play',37);await wait(()=>document.querySelector('[role="alert"]')?.textContent.includes('unterstützt keine Sprachausgabe'));
      flushSync(()=>root.unmount());
      Object.defineProperty(window,'speechSynthesis',{configurable:true,value:nativeSpeech});
      Object.defineProperty(window,'SpeechSynthesisUtterance',{configurable:true,value:NativeUtterance});
      document.getElementById('result').textContent='PASS';
    }
    run().catch(error=>document.getElementById('result').textContent='FAIL '+error.message);
  `;
  const bundle = await build({ stdin: { contents: source, resolveDir: process.cwd(), loader: "tsx" }, bundle: true, platform: "browser", format: "iife", write: false, define: { "process.env.NODE_ENV": '"production"', "process.env": "{}" }, tsconfig: "tsconfig.json" });
  const server = createServer((request, response) => {
    if (request.url === "/bundle.js") { response.setHeader("Content-Type", "application/javascript"); response.end(bundle.outputFiles[0].contents); }
    else if (["/long.wav", "/short.wav", "/stale.wav"].includes(request.url ?? "")) {
      const wav = silentWav(request.url === "/long.wav" ? 125 : 12);
      response.setHeader("Content-Type", "audio/wav"); response.setHeader("Accept-Ranges", "bytes");
      const range = /^bytes=(\d+)-(\d*)$/.exec(request.headers.range ?? "");
      const start = range ? Number(range[1]) : 0, end = range?.[2] ? Math.min(Number(range[2]), wav.length - 1) : wav.length - 1;
      if (start >= wav.length || start > end) { response.statusCode = 416; response.setHeader("Content-Range", `bytes */${wav.length}`); response.end(); return; }
      if (range) { response.statusCode = 206; response.setHeader("Content-Range", `bytes ${start}-${end}/${wav.length}`); }
      response.setHeader("Content-Length", end - start + 1); response.end(wav.subarray(start, end + 1));
    }
    else if (request.url === "/missing.wav") { response.statusCode = 404; response.end(); }
    else { response.setHeader("Content-Type", "text/html"); response.end('<div id="app"></div><pre id="result">PENDING</pre><script>window.onerror=(message)=>document.getElementById("result").textContent="ERROR "+message;</script><script src="/bundle.js"></script>'); }
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address(); assert.ok(address && typeof address !== "string");
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
