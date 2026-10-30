import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

test("event series: repeated browser saves preserve visibility, custom template and fields, reload and intentional changes", async () => {
  const chrome = [process.env.CHROME_BIN, "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(path => path && existsSync(path));
  assert.ok(chrome, "Chrome/Chromium required");
  const source = String.raw`
    import React from 'react';import{createRoot}from'react-dom/client';import{flushSync}from'react-dom';
    import{EventSeriesManager}from'./app/admin/eventreihen/EventSeriesManager';import{deRenderingMessages}from'./app/i18n/messages/de/rendering';
    window.qa={stored:{id:999,name:'Isolated QA',publicName:'Public QA',description:'Original',internalNote:'INTERNAL',reservationUrl:'https://example.org/book',isPublic:true,defaultPresentationTemplateId:'lovd-ungegoogelt',logoUrl:null,slug:'qa',isArchived:false,quizCount:0,canEdit:true,canChangeArchiveState:false},calls:[],reject:false};
    const root=createRoot(document.getElementById('app'));
    const render=()=>flushSync(()=>root.render(<EventSeriesManager series={[window.qa.stored]} canCreate messages={deRenderingMessages} presentationTemplates={[]} canAssignPresentationTemplates environmentPrefix="preview"/>));
    const check=(v,m)=>{if(!v)throw Error(m)};
    const wait=async(f)=>{for(let i=0;i<200;i++){if(f())return;await new Promise(r=>setTimeout(r,10));}throw Error('timeout '+document.body.innerText)};
    const button=t=>[...document.querySelectorAll('button')].find(e=>e.textContent===t);
    const field=n=>document.querySelector('[name="'+n+'"]');
    const set=(n,v)=>{const e=field(n);const p=e.tagName==='SELECT'?HTMLSelectElement.prototype:e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;flushSync(()=>{Object.getOwnPropertyDescriptor(p,'value').set.call(e,v);e.dispatchEvent(new Event(e.tagName==='SELECT'?'change':'input',{bubbles:true}));});};
    const edit=()=>flushSync(()=>button('Bearbeiten').click());
    const save=async()=>{button('Änderungen speichern').click();await wait(()=>document.querySelector('fieldset').disabled);await wait(()=>!document.querySelector('fieldset').disabled);await new Promise(r=>setTimeout(r,40));};
    async function run(){
      render();edit();set('description','Neue Beschreibung\n\nAbsatz 2');
      button('Änderungen speichern').click();await wait(()=>document.querySelector('fieldset').disabled);check(document.body.innerText.includes('Wird gespeichert'),'saving state missing');await wait(()=>!document.querySelector('fieldset').disabled);await new Promise(r=>setTimeout(r,40));
      check(field('isPublic').checked,'first save reset public checkbox');check(field('defaultPresentationTemplateId').value==='lovd-ungegoogelt','first save reset template');
      await save();check(window.qa.stored.isPublic,'second save withdrew visibility');check(window.qa.stored.defaultPresentationTemplateId==='lovd-ungegoogelt','second save replaced template');check(window.qa.stored.reservationUrl==='https://example.org/book','repeat save changed unrelated link');check(window.qa.stored.description==='Neue Beschreibung\n\nAbsatz 2','description lost');check(document.body.innerText.includes('Änderungen gespeichert'),'success missing');
      flushSync(()=>root.render(null));render();edit();check(field('isPublic').checked,'reload lost visibility');check(field('defaultPresentationTemplateId').value==='lovd-ungegoogelt','reload lost template');
      flushSync(()=>field('isPublic').click());set('defaultPresentationTemplateId','komm-one-pubquiz');await save();check(!window.qa.stored.isPublic,'explicit off failed');check(window.qa.stored.defaultPresentationTemplateId==='komm-one-pubquiz','explicit template change failed');
      window.qa.reject=true;await save();check(document.body.innerText.includes('Speichern abgelehnt'),'failure missing');check(!document.body.innerText.includes('Änderungen gespeichert'),'failure displayed success');
      window.qa.reject=false;window.qa.uploadFail=true;window.qa.created=0;window.qa.uploads=0;
      flushSync(()=>root.render(null));flushSync(()=>root.render(<EventSeriesManager series={[]} canCreate messages={deRenderingMessages} presentationTemplates={[]} canAssignPresentationTemplates environmentPrefix="preview"/>));set('name','Created with staged logo');
      const file=document.querySelector('input[type=file]'),transfer=new DataTransfer();transfer.items.add(new File(['synthetic PNG bytes'],'logo.png',{type:'image/png'}));file.files=transfer.files;flushSync(()=>file.dispatchEvent(new Event('change',{bubbles:true})));
      button('Eventreihe anlegen').click();await wait(()=>document.body.innerText.includes('Logo noch nicht gespeichert'));check(window.qa.created===1,'creation must happen once before upload');check(document.body.innerText.includes('Eventreihe bearbeiten'),'created ID not retained after upload failure');
      window.qa.uploadFail=false;await save();check(window.qa.created===1,'logo retry created a duplicate series');check(window.qa.uploads===2,'staged file was lost on upload failure');check(window.qa.lastId===1000,'retry did not update its original series');check(window.qa.lastOptions.expectedRevision==='created-revision','new-series retry lost its CAS revision');check(window.qa.lastOptions.logoUrl==='https://synthetic.public.blob.vercel-storage.com/preview/logo.png','existing save did not include staged logo atomically');
      flushSync(()=>root.unmount());document.getElementById('result').textContent='PASS';
    }run().catch(e=>document.getElementById('result').textContent='FAIL '+e.message);
`;

  const mocks:Record<string,string>={
    navigation:`export const useSearchParams=()=>new URLSearchParams();export const useRouter=()=>({refresh:()=>{}});`,
    link:`import React from'react';export default function Link({children,...p}){return <a {...p}>{children}</a>}`,
    actions:`export async function updateEventSeries(id,input,options){window.qa.lastId=id;window.qa.lastOptions=options;await new Promise(r=>setTimeout(r,70));if(window.qa.reject)return{success:false,message:'Speichern abgelehnt'};window.qa.calls.push(input);window.qa.stored={...window.qa.stored,...input};return{success:true,message:'Gespeichert',savedValue:input}};export async function createEventSeries(input){await new Promise(r=>setTimeout(r,70));window.qa.created++;return{success:true,eventSeriesId:1000,settingsRevision:'created-revision',savedValue:input,message:'Angelegt'}};export async function archiveEventSeries(){};export async function restoreEventSeries(){}`,
    preview:`export const TemplatePreview=()=>null;`,upload:`export async function uploadEventSeriesLogo(){window.qa.uploads++;if(window.qa.uploadFail)throw Error('Synthetic upload failure');return 'https://synthetic.public.blob.vercel-storage.com/preview/logo.png'}`,save:`export async function saveEventSeriesLogo(){return{ok:true}}`,
  };
  const bundle=await build({stdin:{contents:source,resolveDir:process.cwd(),loader:'tsx'},bundle:true,platform:'browser',format:'iife',write:false,define:{'process.env.NODE_ENV':'"production"','process.env':'{}'},tsconfig:'tsconfig.json',plugins:[{name:'qa-mocks',setup(api){api.onResolve({filter:/next\/(navigation|link)$|eventreihen\/actions$|\/TemplatePreview$|\/uploadEventSeriesLogo$|\/eventSeriesLogoActions$/},a=>({path:a.path.endsWith('/actions')?'actions':a.path.endsWith('TemplatePreview')?'preview':a.path.endsWith('uploadEventSeriesLogo')?'upload':a.path.endsWith('eventSeriesLogoActions')?'save':a.path.endsWith('navigation')?'navigation':'link',namespace:'qa'}));api.onLoad({filter:/.*/,namespace:'qa'},a=>({contents:mocks[a.path],loader:'tsx',resolveDir:process.cwd()}));}}]});
  const server=createServer((request,response)=>{if(request.url==='/bundle.js'){response.setHeader('Content-Type','application/javascript');response.end(bundle.outputFiles[0].contents);}else{response.setHeader('Content-Type','text/html');response.end('<div id="app"></div><pre id="result">PENDING</pre><script>window.onerror=message=>document.getElementById("result").textContent="FAIL "+message;</script><script src="/bundle.js"></script>');}});
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
