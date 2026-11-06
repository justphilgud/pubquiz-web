import test from 'node:test';
import assert from 'node:assert/strict';
import { exportParts, geometry, position, printFormat, printFormats } from './printFormats';
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
