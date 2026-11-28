import test from 'node:test';
import assert from 'node:assert/strict';
import {ROUND_COLORS} from '../roundColors';
import {contrastRatio} from '@/app/rendering/presentationTemplates/presentationTemplate';
import {unseenNumberAppearance} from './numberAppearance';

test('quieter numeric cells retain readable ink on every round and custom hue',()=>{
 for(const color of [...ROUND_COLORS.map(c=>c.background),'#000000','#ffffff','#888888','#ff0000','#00ff00','#0000ff']){
  const appearance=unseenNumberAppearance(color);
  assert.ok(contrastRatio(appearance.background,appearance.foreground)>=4.5);
 }
 assert.equal(unseenNumberAppearance('#6A241C').background,'#94615C');
 assert.throws(()=>unseenNumberAppearance('red'));
});
