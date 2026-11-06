import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {build} from 'esbuild';
import {EventRow,type EventEntry} from './EventRow';
test('shared Quiz action extraction preserves the actual released complete markup, icons, labels and destinations',async()=>{
 const source=execFileSync('git',['show','192f27848f723559e3e18a0b9fdbbeb169a10ed3:app/events/EventRow.tsx'],{encoding:'utf8'});
 const compiled=await build({stdin:{contents:source,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'node',format:'cjs',packages:'external',jsx:'automatic'});
 const baseline={exports:{}};new Function('require','module','exports',compiled.outputFiles[0].text)(createRequire(import.meta.url),baseline,baseline.exports);
 const Previous=(baseline.exports as {EventRow:typeof EventRow}).EventRow;
 for(const entry of [{id:'1',title:'Existing Quiz',seriesName:'Reihe',typeLabel:'Quiz',date:'2026-11-06',time:'19:30',status:'Vorbereitung',prepareTitle:'Quizinhalt bearbeiten',prepareHref:'/quiz/11?returnTo=%2Fquiz',moderationHref:'/quiz/11/moderation',presentationHref:'/quiz/11/praesentation'},{id:'2',title:'Draft',seriesName:'Reihe',typeLabel:'Quiz',date:null,status:'Vorbereitung',prepareHref:'/quiz/12'}] satisfies EventEntry[]){
  assert.equal(renderToStaticMarkup(createElement(EventRow,{entry})),renderToStaticMarkup(createElement(Previous,{entry})));
 }
});
