import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";
import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
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
    import {QuestionRewritePanel} from './app/fragen/editor/components/QuestionRewritePanel';
    import {deQuestionEditorMessages} from './app/i18n/messages/de/questionEditor';
    const root=createRoot(document.getElementById('app'));
    const show=(src,command,id)=>flushSync(()=>root.render(<SynchronizedMedia kind="audio" src={src} command={command} commandId={id} renderMode="PRESENTATION" showCountdown/>));
    let phase='initial';
    const wait=async(predicate)=>{for(let i=0;i<100;i++){if(predicate())return;await new Promise(r=>setTimeout(r,20));}throw Error('condition timeout: '+phase);};
    const check=(condition,message)=>{if(!condition)throw Error(message);};
    const countdown=()=>document.querySelector('output')?.textContent;
    async function run(){
      show('/long.wav',null,0); await wait(()=>countdown()==='2:05');
      const original=document.querySelector('audio'); check(original.paused,'initial autoplay');
      phase='play';show('/long.wav','play',1); await wait(()=>!original.paused);
      phase='pause';show('/long.wav','pause',2); await wait(()=>original.paused);
      phase='buffer';await wait(()=>original.seekable.length && original.seekable.end(original.seekable.length-1)>62);
      phase='seek';original.currentTime=61.2; await wait(()=>original.currentTime>61); original.dispatchEvent(new Event('timeupdate')); await wait(()=>countdown()==='1:04');
      phase='restart';show('/long.wav','stop',3); await wait(()=>countdown()==='2:05');
      phase='short';show('/short.wav',null,4); await wait(()=>countdown()==='0:12');
      check(original.paused,'old audio still playing');
      const short=document.querySelector('audio'); check(short!==original,'source reused stale media node');
      short.currentTime=12; short.dispatchEvent(new Event('ended')); await wait(()=>countdown()==='0:00');
      let settle; const realPlay=HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play=function(){return new Promise(r=>settle=r);};
      phase='stale';show('/stale.wav','play',5); const stale=document.querySelector('audio');
      show('/short.wav',null,6); settle(); await wait(()=>stale.paused);
      check(document.querySelector('audio')!==stale,'stale node reused');
      HTMLMediaElement.prototype.play=realPlay;
      phase='missing';show('/missing.wav',null,7); await wait(()=>document.querySelector('[role="status"]'));
      check(!document.querySelector('output'),'invented countdown after failed audio');
      flushSync(()=>root.unmount()); check(short.paused,'unmounted audio continues');
      // Real client interactions with a simulated endpoint: not a live-provider acceptance.
      let draft='Wie heißt die Hauptstadt von Frankreich?', accepted=0, requests=0, fail=false;
      const untouched={answer:'Paris',unit:'Stück',media:'original.wav',template:'standard'};
      const before=JSON.stringify(untouched), messages=deQuestionEditorMessages.question.rewrite;
      const rewriteRoot=createRoot(document.getElementById('app'));
      const rewrite=()=>flushSync(()=>rewriteRoot.render(<QuestionRewritePanel questionText={draft} disabled={false} messages={messages} onAccept={text=>{draft=text;accepted++;rewrite();}}/>));
      const button=text=>[...document.querySelectorAll('button')].find(node=>node.textContent===text);
      const realFetch=window.fetch;
      window.fetch=async(url,init)=>{check(url==='/api/question-rewrite','unexpected persistence request');check(Object.keys(JSON.parse(init.body)).join(',')==='questionText','structured data sent');requests++;return new Response(JSON.stringify(fail?{ok:false,code:'PROVIDER_TIMEOUT'}:{ok:true,proposal:'Welche Stadt ist Frankreichs Hauptstadt?',usage:null,cost:null}),{status:fail?504:200});};
      phase='rewrite proposal';rewrite();check(requests===0,'automatic provider call');
      button(messages.request).click();await wait(()=>document.querySelector('#questionRewriteProposal'));
      check(accepted===0 && draft==='Wie heißt die Hauptstadt von Frankreich?','unsolicited draft overwrite');
      phase='rewrite stale';draft='In welchem Jahr war das?';rewrite();check(button(messages.accept).disabled,'stale proposal accepted');
      button(messages.discard).click();await wait(()=>!document.querySelector('#questionRewriteProposal'));check(draft==='In welchem Jahr war das?','discard lost draft');
      phase='rewrite accept';button(messages.request).click();await wait(()=>document.querySelector('#questionRewriteProposal'));button(messages.accept).click();await wait(()=>accepted===1);
      check(draft==='Welche Stadt ist Frankreichs Hauptstadt?' && JSON.stringify(untouched)===before,'structured editor data changed');
      phase='rewrite timeout';button(messages.discard).click();await wait(()=>!document.querySelector('#questionRewriteProposal'));fail=true;button(messages.request).click();await wait(()=>document.querySelector('[role="alert"]'));
      check(accepted===1 && draft==='Welche Stadt ist Frankreichs Hauptstadt?' && requests===3,'provider failure changed draft');
      window.fetch=realFetch;flushSync(()=>rewriteRoot.unmount());
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
      if (range) { response.statusCode = 206; response.setHeader("Content-Range", `bytes ${start}-${end}/${wav.length}`); }
      response.setHeader("Content-Length", end - start + 1); response.end(wav.subarray(start, end + 1));
    }
    else if (request.url === "/missing.wav") { response.statusCode = 404; response.end(); }
    else { response.setHeader("Content-Type", "text/html"); response.end('<div id="app"></div><pre id="result">PENDING</pre><script>window.onerror=(message)=>document.getElementById("result").textContent="ERROR "+message;</script><script src="/bundle.js"></script>'); }
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address(); assert.ok(address && typeof address !== "string");
  const profile = mkdtempSync(join(tmpdir(), "pubquiz-night-media-"));
  try {
    const { stdout } = await promisify(execFile)(chrome, ["--headless=new", "--no-sandbox", "--disable-gpu", "--disable-background-networking", "--no-first-run", "--autoplay-policy=no-user-gesture-required", `--user-data-dir=${profile}`, "--virtual-time-budget=8000", "--dump-dom", `http://127.0.0.1:${address.port}`], { timeout: 30_000, maxBuffer: 2 * 1024 * 1024 });
    assert.match(stdout, /<pre id="result">PASS<\/pre>/, stdout.slice(-1500));
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
    // Fresh, test-owned directory under tmpdir, never a user browser profile.
    rmSync(profile, { recursive: true, force: true });
  }
});
