import test from 'node:test';
import assert from 'node:assert/strict';
import { contrastRatio } from '@/app/rendering/presentationTemplates/presentationTemplate';
import { ROUND_COLORS, roundColor, isRoundColor } from './roundColors';
import {parseRoundSnapshot} from './live/roundSnapshot';

test('seven exact round defaults repeat after seven without reducing the round limit', () => {
  assert.deepEqual(ROUND_COLORS.map(c => c.background), ['#6A241C','#C64D3B','#FFF9E9','#307065','#6FBEAC','#062C3D','#68BBCB']);
  for (let n = 1; n <= 10; n++) {
    const theme = roundColor(n);
    assert.ok(contrastRatio(theme.background, theme.foreground) >= 4.5);
    const unseen='#'+[1,3,5].map(i=>Math.round(parseInt(theme.background.slice(i,i+2),16)*.18+255*.82).toString(16).padStart(2,'0')).join('');
    assert.ok(contrastRatio(unseen,'#40555D')>=4.5);

    assert.deepEqual(theme, ROUND_COLORS[(n-1)%7]);
  }
  assert.equal(roundColor(3).foreground, '#062C3D');
  for (const n of [0,11,1.5,NaN]) assert.throws(() => roundColor(n));
});
test('custom colors are strict and receive contrast-safe ink', () => {
  for (const value of ['#ffffff','#000000','#777777','#c64d3b']) {
    const theme = roundColor(2, value);
    assert.ok(contrastRatio(theme.background, theme.foreground) >= 4.5);
    assert.equal(theme.background, value.toUpperCase());
  }
  for (const value of ['red','#fff','#1234567','url(x)',null,12]) assert.equal(isRoundColor(value),false);
  assert.throws(() => roundColor(1, 'red'));
  assert.deepEqual(roundColor(1, null), roundColor(1));
});
test('frozen colors validate strictly while historical round bytes stay compatible',()=>{
 const original={id:'00000000-0000-4000-8000-000000000001',label:'Runde',target:30,issued:null,seriesIds:['00000000-0000-4000-8000-000000000002']};
 const bytes=JSON.stringify(original);
 assert.equal(JSON.stringify(parseRoundSnapshot(original)),bytes);
 assert.equal(parseRoundSnapshot({...original,color:'#FFF9E9'}).color,'#FFF9E9');
 for(const color of [null,'red','#FFF','url(x)',12])assert.throws(()=>parseRoundSnapshot({...original,color}));
});
