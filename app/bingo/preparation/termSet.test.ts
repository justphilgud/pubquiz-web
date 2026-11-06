import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTermSet, publishedTerm, termFor } from './termSet';
const sample = () => ({version:1, name:'Musik', publication:'HIDDEN', entries:Array.from({length:75},(_,i)=>({number:i+1,text:`Interpret ${i+1}`}))});
test('term sets require complete unambiguous 75-ball assignments and produce a detached stable snapshot', () => {
  const input = sample(), frozen = parseTermSet(input);
  input.entries[0].text = 'Geändert';
  assert.equal(termFor(frozen,1),'Interpret 1');
  assert.throws(()=>parseTermSet({...input,entries:input.entries.slice(1)}));
  const duplicate = sample(); duplicate.entries[1].number=1; assert.throws(()=>parseTermSet(duplicate),/mehrfach/);
  const ambiguous = sample(); ambiguous.entries[1].text='  INTERPRET 1 '; assert.throws(()=>parseTermSet(ambiguous),/mehrdeutig/);
  assert.throws(()=>parseTermSet({...input,extra:true}));
  assert.throws(()=>parseTermSet({...input,publication:'UNKNOWN'}));
});
test('music answers stay absent from audience data until explicit reveal; approval and direct modes differ', () => {
  const set=parseTermSet(sample());
  assert.equal(publishedTerm(set,1,true,false),null);
  assert.equal(publishedTerm(set,1,false,true),'Interpret 1');
  const approval={...set,publication:'APPROVAL' as const};
  assert.equal(publishedTerm(approval,1,false,true),null);
  assert.equal(publishedTerm(approval,1,true,false),'Interpret 1');
  assert.equal(publishedTerm({...set,publication:'DIRECT'},1,false,false),'Interpret 1');
});
