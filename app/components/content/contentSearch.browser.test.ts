import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

test("content UI: paging, inline approval/assignment, return anchor, rejection and stale request isolation", async () => {
  const chrome = [process.env.CHROME_BIN, "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(path => path && existsSync(path));
  assert.ok(chrome, "Chrome/Chromium required");
  const source = `
    import React from 'react'; import {createRoot} from 'react-dom/client'; import {flushSync} from 'react-dom';
    import {ContentSearchState} from './app/components/content/ContentSearch';
    const root=createRoot(document.getElementById('app'));
    const show=paramsKey=>flushSync(()=>root.render(<ContentSearchState initialType="QUESTION" quizzes={[{quizId:7,title:'Isolated QA quiz',date:null,eventSeriesId:1}]} categories={[]} eventSeries={[]} templates={[]} paramsKey={paramsKey}/>));
    let phase='initial';
    const wait=async(predicate)=>{for(let i=0;i<200;i++){if(predicate())return;await new Promise(r=>setTimeout(r,20));}throw Error('condition timeout '+phase+' '+document.body.innerText.slice(-500));};
    const check=(condition,message)=>{if(!condition)throw Error(message);};
    const button=(text,scope=document)=>[...scope.querySelectorAll('button')].find(node=>node.textContent===text);
    const row=id=>document.querySelector('[data-content-key="QUESTION:'+id+'"]');
    async function run(){
      show('status=NOT_APPROVED'); await wait(()=>document.querySelectorAll('[data-content-key]').length===50 && !button('Weitere Treffer laden')?.disabled);
      phase='load more';button('Weitere Treffer laden').click();await wait(()=>document.querySelectorAll('[data-content-key]').length===100 && !document.querySelector('[aria-busy=true]'));
      const target=row(80), index=[...document.querySelectorAll('[data-content-key]')].indexOf(target);
      phase='approve';button('Freigeben',target).click();await wait(()=>target.textContent.includes('Gerade freigegeben') && !target.querySelector('select').disabled);
      check(document.querySelectorAll('[data-content-key]').length===100,'approval collapsed loaded pages');
      check([...document.querySelectorAll('[data-content-key]')].indexOf(target)===index,'approved row moved');
      const assignment=target.querySelector('select');check(!assignment.options[1].disabled,'quiz eligibility was not refreshed');
      phase='assignment';assignment.value='7';assignment.dispatchEvent(new Event('change',{bubbles:true}));await wait(()=>target.textContent.includes('Zum Quiz hinzugefügt') && !assignment.disabled);
      check(assignment.options[1].disabled,'assigned quiz remains selectable');
      target.querySelector('a').click();check(window.qa.lastHref.includes('returnTo='),'return URL missing');
      const resume=JSON.parse(sessionStorage.getItem('content-resume:v1:/content?status=NOT_APPROVED'));
      check(resume.pages===2 && resume.anchor==='QUESTION:80','loaded pages or selected anchor lost');
      phase='return';flushSync(()=>root.render(null));show('status=NOT_APPROVED');await wait(()=>document.querySelectorAll('[data-content-key]').length===100 && !document.querySelector('[aria-busy=true]'));
      check(!row(80),'fresh search retained approved item under not approved');
      window.qa.reject=true;button('Freigeben',row(79)).click();await wait(()=>row(79).textContent.includes('Konflikt'));
      check(button('Freigeben',row(79)),'rejected approval presented success');
      window.qa.reject=false;window.qa.delay=true;button('Freigeben',row(79)).click();show('q=fast');await wait(()=>document.querySelector('h2')?.textContent==='fast');await new Promise(r=>setTimeout(r,100));check(document.body.textContent.includes('1 Suchtreffer'),'late approval changed another search total');
      show('q=slow');await new Promise(r=>setTimeout(r,5));show('q=fast');await wait(()=>document.querySelector('h2')?.textContent==='fast');
      await new Promise(r=>setTimeout(r,100));check(document.querySelector('h2').textContent==='fast','stale response replaced current search');
      flushSync(()=>root.unmount());document.getElementById('result').textContent='PASS';
    }
    run().catch(error=>document.getElementById('result').textContent='FAIL '+error.message);
  `;
  const mocks = {
    navigation: `export const usePathname=()=>'/content'; export const useSearchParams=()=>new URLSearchParams(); export const useRouter=()=>({push:href=>window.qa.lastHref=href,refresh:()=>{},back:()=>{}});`,
    link: `import React from 'react'; export default function Link({href,onClick,children,...props}){return <a {...props} href={href} onClick={event=>{event.preventDefault();onClick?.(event);window.qa.lastHref=href;}}>{children}</a>}`,
    actions: `window.qa={approved:new Set(),lastHref:'',reject:false}; const item=(id,title)=>({key:'QUESTION:'+id,id,contentType:'QUESTION',title:title||'Question '+id,status:window.qa.approved.has(id)?'Freigegeben':'Entwurf',archived:false,scope:'Global',mediaCount:0,quizUsages:[],assignableQuizIds:window.qa.approved.has(id)?[7]:[],editHref:'/content/questions/'+id,canClone:false,canArchive:false,canApprove:!window.qa.approved.has(id),updatedAt:'2026-10-14T00:00:00.000Z'});
      export async function searchContent(filters,cursor){await new Promise(r=>setTimeout(r,filters.query==='slow'?80:3));if(filters.query)return{items:[item(999,filters.query)],total:1};const all=Array.from({length:160},(_,i)=>160-i).filter(id=>!window.qa.approved.has(id));const offset=Number(cursor||0);return{items:all.slice(offset,offset+50).map(id=>item(id)),total:all.length,nextCursor:offset+50<all.length?String(offset+50):null};}
      export async function approveContentQuestion(input){if(window.qa.delay)await new Promise(r=>setTimeout(r,60));if(window.qa.reject)return{success:false,message:'Konflikt: anderer Stand',item:null};window.qa.approved.add(input.questionId);return{success:true,message:'Freigegeben',item:item(input.questionId)}}
      export async function assignContentToQuiz(){return{success:true,message:'Zum Quiz hinzugefügt'}};export async function cloneContent(){};export async function setContentArchived(){};`,
  };
  const bundle = await build({ stdin:{contents:source,resolveDir:process.cwd(),loader:'tsx'},bundle:true,platform:'browser',format:'iife',write:false,define:{'process.env.NODE_ENV':'"production"','process.env':'{}'},tsconfig:'tsconfig.json',plugins:[{name:'qa-mocks',setup(api){api.onResolve({filter:/^next\/(navigation|link)$|^\.\/actions$/},args=>{if(args.path==='./actions'&&!args.importer.replaceAll('\\','/').includes('components/content'))return;return{path:args.path==='next/navigation'?'navigation':args.path==='next/link'?'link':'actions',namespace:'qa'};});api.onLoad({filter:/.*/,namespace:'qa'},args=>({contents:mocks[args.path as keyof typeof mocks],loader:'tsx',resolveDir:process.cwd()}));}}] });
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
