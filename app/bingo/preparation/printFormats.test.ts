import test from 'node:test';
import assert from 'node:assert/strict';
import { cardProfiles, changePrintFormat, parsePrintLayout, exportParts, geometry, position, printFormat, printFormats } from './printFormats';

test('SRA3 retains every existing profile and mirrors the complete three-column grid',()=>{
  for(const profile of cardProfiles){
    const selected=changePrintFormat({format:profile},'SRA3_TWELVE');
    assert.deepEqual(selected,{format:'SRA3_TWELVE',cardProfile:profile});
    assert.deepEqual(parsePrintLayout(selected),selected);
    const g=geometry(selected.format,selected.cardProfile),base=geometry(profile);
    assert.equal(g.sideMm,base.sideMm);assert.equal(g.capacity,12);
    assert.equal(g.widthMm,320);assert.equal(g.heightMm,450);assert.equal(g.gapMm,5);
    for(let slot=0;slot<12;slot++){
      const f=position(selected.format,slot,false,profile),b=position(selected.format,slot,true,profile);
      assert.ok(Math.abs(f.x+b.x+f.side-g.width)<1e-8);assert.equal(f.y,b.y);
      assert.ok(Math.min(f.x,f.y,g.width-f.x-f.side,g.height-f.y-f.side)>=10*72/25.4);
    }
    assert.deepEqual(changePrintFormat(selected,'A6_ONE'),{format:'A6_ONE'});
  }
  assert.equal(position('SRA3_TWELVE',0,true).x,position('SRA3_TWELVE',2).x);
  assert.throws(()=>parsePrintLayout({format:'SRA3_TWELVE'}));
  assert.throws(()=>parsePrintLayout({format:'SRA3_TWELVE',cardProfile:'SRA3_TWELVE'}));
  assert.throws(()=>parsePrintLayout({format:'A4_FOUR',cardProfile:'A4_SIX'}));
});
test('V3 physical formats retain safe margins, square cells and long-edge front/back ownership', () => {
  for (const format of Object.keys(printFormats) as (keyof typeof printFormats)[]) {
    const g = geometry(format);
    assert.ok(g.sideMm >= 89 && g.sideMm <= 93);
    for (let slot = 0; slot < g.capacity; slot++) {
      const front = position(format, slot), back = position(format, slot, true);
      assert.ok(Math.abs(front.x + back.x + front.side - g.width) < 0.00001);
      assert.equal(front.y, back.y);
      assert.ok(front.x >= g.margin - 0.00001 && front.y >= g.margin - 0.00001);
      assert.ok(front.x + front.side <= g.width - g.margin + 0.00001);
    }
    // The fifth card occupies the same logical slot on its matching back.
    const slot = 4 % g.capacity;
    assert.equal(position(format, slot).y, position(format, slot, true).y);
  }
  assert.equal(geometry('A4_SIX').capacity, 6);
  assert.equal(geometry('A6_ONE').capacity, 1);
  assert.throws(() => printFormat('__proto__'));
  assert.throws(() => position('A4_FOUR', 4));
});
test('1,000 distinct cards produce five complete explicitly bounded downloads, including partial tails', () => {
  assert.deepEqual(exportParts(1000), [ {from:1,to:200}, {from:201,to:400}, {from:401,to:600}, {from:601,to:800}, {from:801,to:1000} ]);
  assert.deepEqual(exportParts(401).at(-1), {from:401,to:401});
  assert.equal(exportParts(1).length, 1);
  for (const value of [0,-1,1.5,NaN,Infinity]) assert.throws(() => exportParts(value));
});
