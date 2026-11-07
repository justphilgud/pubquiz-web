import assert from 'node:assert/strict';
import test from 'node:test';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import type {AuthorizationActor} from '@/app/roles/roleAssignmentPolicy';
import type {MatchingTemplateOption} from './templateOptions';

test('template options use fresh permissions, page metadata and preserve source-template identity',async()=>{
 const calls:Record<string,unknown>[]=[];
 let denied=false,authorizations=0;
 let actor:AuthorizationActor={userId:7,assignments:[{role:'EDITOR',scopeType:'EVENT_SERIES',eventSeriesId:10}]};
 const base={geltungsbereich:'GLOBAL',created_by_user_id:1,review_status:'APPROVED',ist_archiviert:false,freigegeben:true,eventreihen:[],vorlage:{code:'base',name:'Basis'},source_vorlage:null};
 const rows=[...Array.from({length:200},(_,i)=>({...base,fragen_id:i+1})),
  {...base,fragen_id:201,source_vorlage:{code:'reverse',name:'Musik rückwärts'}},
  {...base,fragen_id:202,geltungsbereich:'EVENT_SERIES',eventreihen:[{eventreihe_id:99}],source_vorlage:{code:'private',name:'Nicht berechtigt'}},
  {...base,fragen_id:203,vorlage:null}];
 const fixture={
  prisma:{$transaction:async(fn:(tx:unknown)=>unknown)=>fn({fragen:{findMany:async(args:Record<string,unknown>)=>{calls.push(args);const where=args.where as {AND?:{fragen_id?:{gt:number}}[]};const cursor=where.AND?.find(f=>f.fragen_id)?.fragen_id;return cursor?rows.filter(r=>r.fragen_id>cursor.gt).slice(0,200):[];}}})},
  actor:()=>actor,
  access:()=>{authorizations++;if(denied)throw Error('denied');return {game:{eventreihe_id:10}};},
 };
 const mocks:Record<string,string>={
  'server-only':'',
  '@/app/lib/prisma':'export const prisma=fixture.prisma;',
  '@/app/roles/roleAssignments.server':'export const getActorPermissions=async()=>fixture.actor();',
  '../preparation/access.server':'export const preparationContext=async()=>fixture.access();',
  '@/app/fragen/editor/questionAccess.server':'export const mapQuestionAccessContext=q=>({scope:q.geltungsbereich,eventSeriesIds:q.eventreihen.map(e=>e.eventreihe_id),createdByUserId:q.created_by_user_id,reviewStatus:q.review_status,isArchived:q.ist_archiviert,isApproved:q.freigegeben});',
 };
 const compiled=await build({entryPoints:['app/bingo/matching/source.server.ts'],bundle:true,write:false,platform:'node',format:'cjs',plugins:[{name:'test-adapters',setup(api){api.onResolve({filter:/.*/},args=>Object.hasOwn(mocks,args.path)?{path:args.path,namespace:'fixture'}:undefined);api.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:mocks[args.path],loader:'js'}));}}]});
 const compiledModule={exports:{}};
 new Function('require','module','exports','fixture',compiled.outputFiles[0].text)(createRequire(import.meta.url),compiledModule,compiledModule.exports,fixture);
 const api=compiledModule.exports as {listMatchingTemplates:(user:number,game:string)=>Promise<MatchingTemplateOption[]>;searchMatchingSources:(user:number,game:string,input:unknown)=>Promise<unknown>};
 const options=await api.listMatchingTemplates(7,'game');
 assert.deepEqual(options.map(o=>o.code),['__general__','base','reverse']);
 assert.equal(calls.length,2,'options after the first 200 eligible rows are retained');
 assert.equal(authorizations,1);
 for(const call of calls){
  const fields=Object.keys(call.select as object);
  for(const forbidden of ['frage','medien','antworten','antwortfelder'])assert(!fields.includes(forbidden),'no heavy question or media content');
  const where=call.where as Record<string,unknown>;assert.match(JSON.stringify(where),/freigegeben":true/);assert.match(JSON.stringify(where),/ist_archiviert":false/);
  assert.match(JSON.stringify(where),/gueltig_bis/);assert.match(JSON.stringify(where),/eventreihe_id":10/);
 }
 actor={userId:7,assignments:[]};assert.deepEqual(await api.listMatchingTemplates(7,'game'),[],'Bingo access alone grants no Quiz-source visibility');
 denied=true;await assert.rejects(api.listMatchingTemplates(7,'wrong-game'),/denied/);denied=false;
 await api.searchMatchingSources(7,'game',{search:'',template:'',templateCode:'reverse',kind:'',page:1});
 const filter=JSON.stringify(calls.at(-1)!.where);assert.match(filter,/source_vorlage.*code.*reverse/);assert.match(filter,/source_vorlage_id":null/);
 await assert.rejects(api.searchMatchingSources(7,'game',{search:'',template:'',templateCode:123,kind:'',page:1}),/Ungültige Quellensuche/);
});
