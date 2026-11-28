import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCardSetConfig,cardSetSummary,WILDCARD_COLOR} from './cardSet';
import {CARD_SET_SHEET as g,cardSetSlot} from './cardSetGeometry';
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
  assert.ok(x-g.markOffset-g.markLength>=0&&y-g.markOffset-g.markLength>=0&&x+w+g.markOffset+g.markLength<=320&&y+h+g.markOffset+g.markLength<=450);
  const reverse=cardSetSlot(i,true);assert.equal(reverse.trim[0],320-x-w);assert.equal(reverse.trim[1],y);
 }
 assert.ok(g.gap>2*(g.markOffset+g.markLength));
 assert.ok(g.markOffset>g.bleed);
 assert.throws(()=>cardSetSlot(12));
});

test('wildcard uses one of the seven approved colours',()=>{assert.equal(WILDCARD_COLOR,'#062C3D');assert.ok(ROUND_COLORS.some(c=>c.background===WILDCARD_COLOR));});

test('wildcard replaces the round heading without an extra caption',()=>{assert.equal(cardBackHeading(7,'WC-H-001'),'Wildkart');assert.equal(cardBackHeading(7,'G-001'),'Runde 7');assert.equal(cardBackHeading(7,'WC-001'),'Runde 7');});
