import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {posix} from 'node:path';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import {BINGO_BELL_PLAN} from './production-preflight-bingo-bell-plan';

/** Execute immutable candidate domain/projection code, never current working-tree app code. */
test('PR180 immutable candidate: earlier music/media correction, publication, checks and audit agree without changing prepared content',async()=>{
 const sha=BINGO_BELL_PLAN.candidateSha;
 const show=(path:string)=>execFileSync('git',['show',`${sha}:${path}`],{encoding:'utf8',maxBuffer:8*1024*1024,stdio:['pipe','pipe','pipe']});
 // The separate actual-media browser regression must still exercise candidate bytes.
 for(const path of ['app/bingo/live/MatchingPresentation.tsx','app/bingo/live/matchingPlayback.browser.test.ts'])assert.equal(readFileSync(path,'utf8').replaceAll('\r\n','\n'),show(path).replaceAll('\r\n','\n'));
 const source=`
 import assert from 'node:assert/strict';
 import {initialEventRun,applyEventRunEvent,currentEventRound,callContextData} from './app/bingo/live/eventRun';
 import {parseRoundSnapshot} from './app/bingo/live/roundSnapshot';
 import {readMatchingEntry,audienceMatching} from './app/bingo/matching/repository.server';
 import {canonical,sha256} from './app/bingo/preparation/printSnapshot';
 import {generateCard} from './app/bingo/core/cards';
 import {checkEvaluation} from './app/bingo/live/cardChecks';
 const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
 export async function run(){
 const evidence=[];
 for(const kind of ['TEXT','AUDIO','IMAGE','VIDEO'])for(const publication of ['DIRECT','APPROVAL','HIDDEN']){
  const entries=Array.from({length:75},(_,i)=>({number:i+1,text:'Answer '+(i+1),sameText:false,keepNumber:false,answerKey:'custom',presentation:kind==='TEXT'?{kind:'TEXT',text:'Prepared content '+(i+1)}:{kind:'MEDIA',source:{assetId:id(1000+i),kind,questionId:1,revision:'a'.repeat(64),mediaId:i+1,variant:'normal'}}}));
  const immutable=JSON.stringify(entries),frozen=parseRoundSnapshot({id:id(1),label:'Independent music round',target:30,issued:null,seriesIds:[id(2)],matching:{id:id(3),hash:'a'.repeat(64),publication}});
  const card=generateCard(id(9),()=>0);let state=initialEventRun(id(4),id(5),frozen,1000),n=20;
  const send=command=>{state=applyEventRunEvent(state,{id:id(n++),at:2000+n,actorId:1,command},[card]);};
  const tx={$queryRaw:async(strings,...values)=>{assert.equal(values[1],id(3));assert.equal(values[2],id(5));assert.equal(values[3],'a'.repeat(64));return [{entry:entries[values[0]]}];}};
  const resolve=async draw=>audienceMatching(await readMatchingEntry(tx,id(5),frozen.matching,draw.number),state.revealed?.includes(draw.id)??false,publication,id(5));
  for(const number of card.cells[0])send({kind:'draw',number});
  const old=currentEventRound(state).draws[0];send({kind:'reveal',drawId:old.id});
  const oldContent=await resolve(old);assert.equal(oldContent.kind,kind);
  send({kind:'check',cardId:card.id,context:sha256(canonical(callContextData(state)))});
  const original=state.checks[0];assert.equal(original.original.lines.length,1);
  const snapshot=JSON.stringify(state);
  assert.throws(()=>send({kind:'correct',drawId:old.id,number:16,reason:'Duplicate'}),/DUPLICATE/);assert.equal(JSON.stringify(state),snapshot);
  send({kind:'correct',drawId:old.id,number:75,reason:'Synthetic earlier-content correction'});
  const round=currentEventRound(state),corrected=round.draws[0];
  assert.equal(corrected.id,old.id);assert.equal(corrected.number,75);assert.deepEqual(round.draws.slice(1).map(d=>d.number),[16,31,46,61]);
  const next=await resolve(corrected);assert.equal(next.kind,kind);assert.notDeepEqual(next,oldContent);
  if(kind==='TEXT')assert.equal(next.text,publication==='HIDDEN'?'Verdeckt':'Prepared content 75');
  else {assert.ok(next.url.endsWith(id(1074)));assert.equal(next.answer,undefined);}
  send({kind:'reveal',drawId:old.id});const revealed=await resolve(corrected);
  if(kind==='TEXT')assert.equal(revealed.text,'Prepared content 75');else assert.equal(revealed.answer,'Answer 75');
  assert.deepEqual(state.checks[0],original);assert.equal(checkEvaluation(original,card,round.draws).lines.length,0);
  send({kind:'check',cardId:card.id,context:sha256(canonical(callContextData(state)))});assert.equal(state.checks[1].original.lines.length,0);
  assert.equal(JSON.stringify(entries),immutable);assert.equal(round.corrections.length,1);assert.ok(JSON.stringify(round.corrections).includes('Synthetic earlier-content correction'));
  // Current media replacement must discard old playback rather than replay its cue.
  if(kind==='AUDIO'||kind==='VIDEO'){
   const current=round.draws.at(-1);send({kind:'playback',drawId:current.id,action:'PLAY'});assert.ok(state.playback);
   send({kind:'correct',drawId:current.id,number:74,reason:'Current media replacement'});assert.equal(state.playback,undefined);
   const changed=currentEventRound(state).draws.at(-1),content=await resolve(changed);assert.ok(content.url.endsWith(id(1073)));
   send({kind:'playback',drawId:changed.id,action:'REPLAY'});assert.equal(state.playback.drawId,changed.id);assert.equal(state.playback.position,0);
  }
  evidence.push({kind,publication,position:1,oldNumber:1,newNumber:75,preparedUnchanged:true,originalLines:1,correctedLines:0});
 }
 return evidence;
 }
 `;
 const bundled=await build({stdin:{contents:source,resolveDir:process.cwd(),sourcefile:'immutable-entry.ts'},bundle:true,platform:'node',format:'cjs',packages:'external',write:false,plugins:[{name:'immutable-candidate',setup(api){
  api.onResolve({filter:/.*/},args=>{
   if(args.path==='server-only')return {path:'empty',namespace:'stub'};
   if(args.path==='@/app/lib/prisma')return {path:'prisma',namespace:'stub'};
   if(args.path.startsWith('@/'))return {path:args.path.slice(2),namespace:'candidate'};
   if(args.path.startsWith('.')&&(args.namespace==='candidate'||args.importer.endsWith('immutable-entry.ts')))return {path:posix.normalize(posix.join(args.namespace==='candidate'?posix.dirname(args.importer):'',args.path)),namespace:'candidate'};
  });
  api.onLoad({filter:/.*/,namespace:'stub'},args=>({contents:args.path==='prisma'?'export const prisma={};':'',loader:'js'}));
  api.onLoad({filter:/.*/,namespace:'candidate'},args=>{
   let contents:string|undefined,path=args.path;
   for(const suffix of ['', '.ts','.tsx','.json','/index.ts']){try{contents=show(args.path+suffix);path=args.path+suffix;break;}catch{}}
   if(contents===undefined)throw Error('Candidate source missing: '+args.path);
   return {contents,loader:path.endsWith('.json')?'json':path.endsWith('.tsx')?'tsx':'ts',resolveDir:process.cwd()};
  });
 }}]});
 const candidateModule={exports:{} as {run:()=>Promise<unknown[]>}};
 new Function('require','module','exports',bundled.outputFiles[0].text)(createRequire(import.meta.url),candidateModule,candidateModule.exports);
 const evidence=await candidateModule.exports.run();assert.equal(evidence.length,12);
 console.info(JSON.stringify({candidate:sha,cases:evidence}));
});
