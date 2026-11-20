import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

test("quiz planning UI: live reading estimate, disjoint balance dialog, new-tab recommendations and multi-template selection", async () => {
  const chrome = [process.env.CHROME_BIN, "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(path => path && existsSync(path));
  assert.ok(chrome, "Chrome/Chromium required");
  const source = `
    import React,{useState} from 'react';import{createRoot}from'react-dom/client';import{flushSync}from'react-dom';
    import ReviewClient from './app/quiz/[quizId]/auswertung/QuizAuswertungClient';
    import{QuestionSection}from'./app/fragen/editor/components/QuestionSection';
    import{QuestionEditorMessagesProvider}from'./app/fragen/editor/components/QuestionEditorMessagesProvider';
    import{deQuestionEditorMessages}from'./app/i18n/messages/de/questionEditor';
    import QuizBalanceSummary from './app/quiz/planning/QuizBalanceSummary';
    import{getQuizBalance}from'./app/quiz/quizBalance';
    import{StructuredTemplateEditor}from'./app/fragen/editor/components/StructuredTemplateEditor';
    import ContentFilters from './app/components/content/ContentFilters';
    import{parseContentFilters}from'./app/components/content/contentLibrary';
    const initial={kind:'TRANSLATION_READ_ALOUD',originalText:'Original bleibt erhalten',translation:'',sourceLanguage:'en',targetLanguage:'de',voiceProvider:'BROWSER',voiceId:'default',voiceStyle:'',voiceInstruction:'',speed:1};
    const balance=getQuizBalance({questions:Array.from({length:20},()=>({sectionId:1,templateId:'standard',answerMode:'OPEN',categoryIds:[1]})),sections:[{id:1,title:'Block A'},{id:2,title:'Block B'}],categories:[{id:1,name:'Politik'},{id:2,name:'Kultur'}]});
    const base={quiz_fragen_id:1,abschnittId:1,istGespielt:true,istNichtGespielt:false,frageIndex:1,frage:'QA',abschnittTitel:'A',maximumPointsLabel:'1',richtigeAntwort:'Berlin',risikoPruefpflichtigeAntworten:0,istUnbeantwortet:false,bewertungAusstehend:false,istOffeneFrage:true,istAutomatischRichtig:false,istPruefpflichtig:true,autoBasisPunkte:0,autoEndpunkte:0,vergebenePunkte:0,bewertungsstatus:'REVIEW_REQUIRED',bewertungsquelle:'AUTO',templateId:null};
    const reviews=['Berlin','BERLIN','Berlinn','closed','meme','order','face'].map((text,i)=>({...base,team_antwort_id:i+1,teamname:'Team '+i,antwortText:text,templateId:i===4?'meme_beschriften':i===5?'reihenfolge':i===6?'face_morph':null,...(i===3?{istOffeneFrage:false,bewertungsstatus:'WRONG'}:{}),...(i===6?{reviewFields:[{id:10,label:'A',answer:'Bob',solutions:['Alice']},{id:11,label:'B',answer:'Alice',solutions:['Bob']}]}:{})}));
    function General(){const[text,setText]=useState('Wort');return <QuestionEditorMessagesProvider locale="de" messages={deQuestionEditorMessages}><QuestionSection questionText={text} onQuestionTextChange={setText}/></QuestionEditorMessagesProvider>}
    function App(){const[data,setData]=useState(initial);const[filters,setFilters]=useState(parseContentFilters(new URLSearchParams(),'QUESTION'));return <><div id="general"><General/></div><div id="reviews"><ReviewClient quizId={1} revision="v" antworten={reviews} punktestand={[]} backfillStatus={{isComplete:true,incompleteAnswers:0,affectedQuestions:0}} matrix={{questions:[],teams:[]}}/></div><div id="editor"><StructuredTemplateEditor kind="TRANSLATION_READ_ALOUD" data={data} answers={[]} disabled={false} onChange={setData} googlePlacesFeature={{enabled:false}}/></div><QuizBalanceSummary balance={balance}/><div id="search"><ContentFilters filters={filters} categories={[]} eventSeries={[]} templates={[{id:'musik',name:'Musik',availableForFiltering:true},{id:'musik_rueckwaerts',name:'Musik rueckwaerts',availableForFiltering:true}]} loading={false} onChange={setFilters} onTemplateChange={ids=>setFilters({...filters,templateId:ids[0]??null,templateIds:ids})} onApply={()=>{}} onReset={()=>{}}/></div></>}
    const root=createRoot(document.getElementById('app'));flushSync(()=>root.render(<App/>));
    let phase='start'; const wait=async f=>{for(let i=0;i<250;i++){if(f())return;await new Promise(r=>setTimeout(r,20))}throw Error('UI timeout '+phase+' '+document.querySelector('#editor [role=status]')?.textContent+' '+JSON.stringify([...document.querySelectorAll('button')].map(b=>({t:b.textContent,a:b.getAttribute('aria-label')}))))};
    const check=(v,m)=>{if(!v)throw Error(m)};
    const change=(e,value)=>{Object.getOwnPropertyDescriptor(e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(e,value);e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));};
    async function run(){
      phase='general reading';const general=document.querySelector('#general textarea');flushSync(()=>change(general,Array(50).fill('Wort').join(' ')));await wait(()=>document.querySelector('#general [role=status]').textContent.includes('0:20'));check(general.value===Array(50).fill('Wort').join(' '),'general text rewritten');
      phase='review hints';await wait(()=>document.querySelectorAll('#reviews tbody tr').length===5);check(document.querySelector('#reviews').textContent.includes('vertauscht'),'missing face swap');check(document.querySelector('#reviews').textContent.includes('Gleicher Feldtext'),'missing case group');check(document.querySelector('#reviews').textContent.includes('ein Zeichen Unterschied'),'missing typo hint');
      const hintDetail=document.querySelector('#reviews details[aria-label]');hintDetail.querySelector('summary').click();await wait(()=>hintDetail.open);check(!window.ratingWrites,'opening hint caused score write');
      const closedFilter=[...document.querySelectorAll('#reviews label')].find(l=>l.textContent.includes('Eindeutig falsche')).querySelector('input');closedFilter.click();await wait(()=>document.querySelectorAll('#reviews tbody tr').length===4);check(!window.ratingWrites,'hint/filter caused score write');
      const textareas=document.querySelectorAll('#editor textarea');const translation=textareas[1];
      check(document.querySelector('#editor [role=status]').textContent.includes('Noch kein'),'missing empty reading state');
      phase='text';const text=Array(150).fill('Wort').join(' ');flushSync(()=>change(translation,text));await wait(()=>document.querySelector('#editor [role=status]').textContent.includes('1:00'));
      phase='speed';flushSync(()=>change(document.querySelector('#editor input[type=range]'),'2'));await wait(()=>document.querySelector('#editor [role=status]').textContent.includes('0:30'));
      check(translation.value===text&&textareas[0].value===initial.originalText,'text rewritten by duration estimate');
      phase='trigger';await wait(()=>document.querySelector('button[aria-label^="Fragenmix:"]'));const trigger=document.querySelector('button[aria-label^="Fragenmix:"]');trigger.focus();trigger.click();phase='dialog';await wait(()=>document.querySelector('[role=dialog]'));
      const links=[...document.querySelectorAll('[role=dialog] a')];const audio=links.find(a=>a.textContent.startsWith('Audio-Fragen'));
      check(audio&&audio.target==='_blank'&&audio.rel.includes('noopener'),'recommendation must open independent tab');
      const params=new URL(audio.href).searchParams;check(params.get('categoryId')==='2'&&params.getAll('template').length===4,'combined filters missing');
      check(document.querySelector('[role=dialog]').textContent.includes('Block B'),'missing empty block');
      phase='close';const url=location.href;window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));await wait(()=>!document.querySelector('[role=dialog]'));check(document.activeElement===trigger&&location.href===url,'dialog close changed route or focus');
      phase='filters';const filterButton=[...document.querySelectorAll('#search button')].find(b=>b.textContent.includes('Filter'));if(filterButton.getAttribute('aria-expanded')==='false')filterButton.click();await wait(()=>document.querySelector('#search [role=combobox]'));
      phase='options';document.querySelector('#search [role=combobox]').focus();await wait(()=>document.querySelectorAll('#search [role=option]').length===2);
      phase='first';document.querySelectorAll('#search [role=option]')[0].click();await wait(()=>document.querySelectorAll('#search [role=option][aria-selected=true]').length===1);
      phase='second';document.querySelectorAll('#search [role=option]')[1].click();await wait(()=>document.querySelectorAll('#search [role=option][aria-selected=true]').length===2);
      check(document.querySelector('#search [role=listbox]').getAttribute('aria-multiselectable')==='true','not multi-select');
      flushSync(()=>root.unmount());document.getElementById('result').textContent='PASS';
    }run().catch(e=>document.getElementById('result').textContent='FAIL '+e.message);
  `;
  const bundle=await build({stdin:{contents:source,resolveDir:process.cwd(),loader:'tsx'},bundle:true,platform:'browser',format:'iife',write:false,define:{'process.env.NODE_ENV':'"production"','process.env':'{}'},tsconfig:'tsconfig.json',plugins:[{name:'server-action-stubs',setup(api){api.onResolve({filter:/^next\/navigation$/},()=>({path:'navigation',namespace:'qa'}));api.onResolve({filter:/^\.\.\/\.\.\/actions$/},()=>({path:'ratings',namespace:'qa'}));api.onLoad({filter:/navigation/,namespace:'qa'},()=>({contents:'export function useRouter(){return {refresh(){}}}',loader:'js'}));api.onLoad({filter:/ratings/,namespace:'qa'},()=>({contents:'export async function getQuizEvaluationRevision(){return "v"};export async function updateTeamAntwortBewertung(){window.ratingWrites=(window.ratingWrites||0)+1;return {success:true}};export async function continueQuizEvaluationBackfillAction(){throw Error("not used")};export async function recalculateQuizEvaluationsAction(){throw Error("not used")}',loader:'js'}));api.onResolve({filter:/googlePlacesActions/},()=>({path:'google',namespace:'qa'}));api.onLoad({filter:/.*/,namespace:'qa'},()=>({contents:'export async function loadGoogleReviewsAction(){throw Error("not used")};export async function searchGooglePlaceAction(){throw Error("not used")}',loader:'js'}));}}]});
  const server=createServer((request,response)=>{if(request.url==='/bundle.js'){response.setHeader('Content-Type','application/javascript');response.end(bundle.outputFiles[0].contents);}else{response.setHeader('Content-Type','text/html');response.end('<div id="app"></div><pre id="result">PENDING</pre><script>window.onerror=message=>document.getElementById("result").textContent="FAIL "+message;</script><script src="/bundle.js"></script>');}});
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();assert.ok(address&&typeof address!=='string');
  const profile = mkdtempSync(join(tmpdir(), "pubquiz-planning-"));
  const browser = spawn(chrome, ["--headless=new", "--no-sandbox", "--disable-gpu", "--disable-background-networking", "--no-first-run", "--autoplay-policy=no-user-gesture-required", `--user-data-dir=${profile}`, "--remote-debugging-port=0", "about:blank"], { stdio: "ignore", windowsHide: true });
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
    assert.ok(profile.startsWith(join(tmpdir(), "pubquiz-planning-")));
    rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
});
