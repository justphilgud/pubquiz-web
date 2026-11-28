import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCardSetConfig,cardSetSummary,WILDCARD_COLOR} from './cardSet';
import {CARD_SET_SHEET as g,cardSetSlot,cardSetCutMarks} from './cardSetGeometry';
import {ROUND_COLORS} from '../roundColors';
import {isWildcardCode,shortCardCode,cardBackHeading} from './bingoPrint';
const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
test('wildcard namespace never reinterprets the existing ordinary WC prefix',()=>{
 const prefix=23*26+3;
 assert.equal(shortCardCode(prefix,1),'WC-001');assert.equal(isWildcardCode('WC-001'),false);
 assert.equal(shortCardCode(prefix,1,true),'WC-WC-001');assert.equal(isWildcardCode('WC-WC-001'),true);
 assert.equal(isWildcardCode('WC-A-001'),true);assert.equal(isWildcardCode('A-001'),false);
});
test('counts inherit independently, selection has no generation semantics and wildcards stay separate',()=>{
 const config=parseCardSetConfig({version:1,defaultCount:100,rounds:[{id:id(1),selected:true,count:null},{id:id(2),selected:true,count:120},{id:id(3),selected:false,count:null}],wildcards:100});
 assert.deepEqual(cardSetSummary(config),{sections:[{id:id(1),count:100},{id:id(2),count:120}],cards:320,pages:56});
 assert.equal(cardSetSummary({...config,defaultCount:50}).sections[1].count,120);
 for(const bad of [{...config,wildcards:-1},{...config,defaultCount:0},{...config,rounds:[config.rounds[0],config.rounds[0]]},{...config,unexpected:true}])assert.throws(()=>parseCardSetConfig(bad));
});
test('12 finished 92.5 mm cards, 3 mm bleed and external marks fit without collision on SRA3',()=>{
 for(let i=0;i<12;i++){
  const {trim:[x,y,w,h],bleed:[bx,by,bw,bh]}=cardSetSlot(i);
  assert.equal(w,92.5);assert.equal(h,92.5);assert.equal(x-bx,3);assert.equal(y-by,3);
  assert.ok(bx>=0&&by>=0&&bx+bw<=320&&by+bh<=450);
  const reverse=cardSetSlot(i,true);assert.equal(reverse.trim[0],320-x-w);assert.equal(reverse.trim[1],y);
 }
 assert.ok(g.markInset+g.markLength<cardSetSlot(0).bleed[0]);
 assert.throws(()=>cardSetSlot(12));
});

test('wildcard uses one of the seven approved colours',()=>{assert.equal(WILDCARD_COLOR,'#062C3D');assert.ok(ROUND_COLORS.some(c=>c.background===WILDCARD_COLOR));});

test('wildcard replaces the round heading without an extra caption',()=>{assert.equal(cardBackHeading(7,'WC-H-001'),'Wildkart');assert.equal(cardBackHeading(7,'G-001'),'Runde 7');assert.equal(cardBackHeading(7,'WC-001'),'Runde 7');});

test('28 machine-alignment marks are perpendicular to the outer paper edges at every trim coordinate',()=>{
 const marks=cardSetCutMarks();assert.equal(marks.length,28);assert.equal(new Set(marks.map(m=>JSON.stringify(m))).size,28);
 const xs=new Set<number>(),ys=new Set<number>();for(let i=0;i<12;i++){const {trim:[x,y,w,h]}=cardSetSlot(i);xs.add(x);xs.add(x+w);ys.add(y);ys.add(y+h);}
 for(const {start:[x1,y1],end:[x2,y2]} of marks){
  assert.ok(x1>=0&&x2<=g.width&&y1>=0&&y2<=g.height);
  assert.equal(Math.hypot(x2-x1,y2-y1),g.markLength);
  if(x1===x2){assert.ok(xs.has(x1));assert.ok(y2<=5||y1>=445,'top/bottom margin only');}
  else{assert.equal(y1,y2);assert.ok(ys.has(y1));assert.ok(x2<=5||x1>=315,'left/right margin only');}
  for(let i=0;i<12;i++){const {bleed:[x,y,w,h]}=cardSetSlot(i);assert.ok(x2<x||x1>x+w||y2<y||y1>y+h,'marks never touch a card bleed');}
 }
 for(const x of xs)assert.equal(marks.filter(m=>m.start[0]===x&&m.end[0]===x).length,2);
 for(const y of ys)assert.equal(marks.filter(m=>m.start[1]===y&&m.end[1]===y).length,2);
});
