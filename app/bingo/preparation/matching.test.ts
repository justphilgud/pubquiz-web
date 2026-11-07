import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initialMatchingEntries,matchingAnswers,matchingErrors,parseMatchingSet,printedMatchingText,type MatchingSet} from './matching';
import {parseTermSet,termFor,publishedTerm,usesCardText} from './termSet';
import {matchingRange} from '../matching/mediaRange';
const answers=matchingAnswers([{id:42,label:'Titel',solutions:['Blowin’ in the Wind']},{id:9,label:'Interpret',solutions:['Bob Dylan']},{id:10,label:'Leer',solutions:['']}],[]);
const source=(variant:string)=>({questionId:4,revision:'a'.repeat(64),mediaId:variant==='music_reverse_audio'?2:1,variant,kind:'AUDIO' as const});
test('all six media/answer combinations are independent and print exact selected text',()=>{
 for(const variant of ['music_original_audio','music_reverse_audio'])for(const answer of answers){
  const entries=initialMatchingEntries();entries[0]={...entries[0],keepNumber:false,sameText:false,presentation:{kind:'MEDIA',source:source(variant)},answerKey:answer.key,text:answer.text};
  const set=parseMatchingSet({version:2,name:'Musik',publication:'HIDDEN',entries});
  assert.equal(termFor(set,1),answer.text);assert.equal(publishedTerm(set,1,true,false),null);assert.equal(publishedTerm(set,1,true,true),null);
  assert.deepEqual(set.entries[0].presentation,{kind:'MEDIA',source:source(variant)});
 }
 assert.deepEqual(answers.map(a=>a.label),['Titel','Interpret','Interpret + Titel']);
});
test('variant switch preserves answer, own text works; no false or excluded answer defaults',()=>{
 const entry=initialMatchingEntries()[0];entry.keepNumber=false;entry.sameText=false;entry.text='Eigener Text';entry.presentation={kind:'MEDIA',source:source('music_original_audio')};
 entry.presentation.source=source('music_reverse_audio');assert.equal(printedMatchingText(entry),'Eigener Text');
 assert.deepEqual(matchingAnswers([{id:1,label:'Land',solutions:[]}],[]),[]);
 assert.deepEqual(matchingAnswers([],[{id:4,text:'Deutschland'}]),[{key:'answer:4',label:'Antwort',text:'Deutschland'}]);
});
test('range updates retain hidden rows; 76–90 do not enter the 75er print/draw contract',()=>{
 const entries=initialMatchingEntries().map(e=>e.number>=15&&e.number<=26?{...e,keepNumber:false,presentation:{kind:'TEXT' as const,text:`Begriff ${e.number}`}}:e);
 const set=parseMatchingSet({version:2,name:'Bereich',publication:'DIRECT',entries});
 assert.equal(set.entries.length,90);assert.equal(termFor(set,14),'14');assert.equal(termFor(set,15),'Begriff 15');assert.equal(termFor(set,27),'27');assert.equal(usesCardText(set,76),false);
 set.entries[14].keepNumber=true;assert.equal(termFor(set,15),'15');assert.equal(set.entries[14].presentation.kind==='TEXT'&&set.entries[14].presentation.text,'Begriff 15');
});
test('duplicates, missing media, empty values and unexpected fields are rejected with row messages',()=>{
 const set:MatchingSet={version:2,name:'Test',publication:'DIRECT',entries:initialMatchingEntries()};
 set.entries[0]={...set.entries[0],keepNumber:false,presentation:{kind:'TEXT',text:'2'}};
 assert.throws(()=>parseMatchingSet(set),/Kugel/);assert.ok(matchingErrors(set.entries).has(2));
 set.entries[0]={...set.entries[0],sameText:false,presentation:{kind:'MEDIA',source:null},text:'Eins'};
 assert.throws(()=>parseMatchingSet(set),/Aufnahme/);
 set.entries[0].keepNumber=true;assert.equal(parseMatchingSet(set).entries[0].keepNumber,true);
 assert.throws(()=>parseMatchingSet({...set,unexpected:true}));
});
test('legacy 75 terms remain byte-for-byte identical and retain publication rules',()=>{
 const legacy={version:1,name:'Alt',publication:'HIDDEN',entries:Array.from({length:75},(_,i)=>({number:i+1,text:`Alt ${i+1}`}))};
 const parsed=parseTermSet(legacy);assert.deepEqual(parsed,legacy);assert.equal(publishedTerm(parsed,1,true,false),null);assert.equal(publishedTerm(parsed,1,true,true),'Alt 1');
 const modern=parseMatchingSet({version:2,name:'Neu',publication:'DIRECT',entries:initialMatchingEntries(parsed)});assert.equal(termFor(modern,1),'Alt 1');assert.equal(modern.entries[75].keepNumber,true);
});
test('media byte ranges are bounded, support suffix reads and reject malformed requests',()=>{
 assert.equal(matchingRange(null,100),null);assert.deepEqual(matchingRange('bytes=10-19',100),{from:10,to:19,total:100});assert.deepEqual(matchingRange('bytes=90-999',100),{from:90,to:99,total:100});assert.deepEqual(matchingRange('bytes=-5',100),{from:95,to:99,total:100});assert.deepEqual(matchingRange('bytes=0-',100),{from:0,to:99,total:100});
 for(const range of ['bytes=100-','bytes=20-10','bytes=-0','bytes=0-1,4-5','not-range','bytes=999999999999999999-'])assert.equal(matchingRange(range,100),'invalid');
});

import {matchingStaticMediaUrl} from '../matching/staticMedia';
test('legacy static matching IO is restricted to the current deployment and safe media paths',()=>{const env={VERCEL:'1',VERCEL_URL:'own-deployment.vercel.app'};assert.equal(matchingStaticMediaUrl('/medien/audio/song file.wav',env),'https://own-deployment.vercel.app/medien/audio/song%20file.wav');for(const ref of ['https://evil.invalid/a.wav','/other/a.wav','/medien/../secret','/medien/%2e%2e/secret','/medien/a.wav?token=x','/medien/a\\b.wav'])assert.equal(matchingStaticMediaUrl(ref,env),null);assert.equal(matchingStaticMediaUrl('/medien/a.wav',{...env,VERCEL_URL:'127.0.0.1:99'}),null);assert.equal(matchingStaticMediaUrl('/medien/a.wav',{}),null);});

test('externally selected long or invalid answers produce the same row validation as the server',()=>{for(const text of ['W'.repeat(121),'Unzulässig\u0001']){const entries=initialMatchingEntries();entries[0]={...entries[0],keepNumber:false,sameText:false,text,presentation:{kind:'MEDIA',source:source('music_original_audio')}};assert.match(matchingErrors(entries).get(1)??'',/120 Zeichen/);assert.throws(()=>parseMatchingSet({version:2,name:'Ungültig',publication:'HIDDEN',entries}),/Kugel 1/);}});
