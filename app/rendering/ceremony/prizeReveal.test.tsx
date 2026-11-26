import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import PresentationSlideRenderer from '../presentation/PresentationSlideRenderer';
import {buildPresentationQualityFixture} from '../presentation/presentationQualityFixtures';

test('the actual Pubquiz renderer reveals prizes in order on both existing presentation surfaces',()=>{
 for(const style of ['PHIL_GUD','EDITORIAL'] as const)for(const surface of ['fixed','flow'])for(let count=0;count<=3;count++){
  const fixture=buildPresentationQualityFixture('lovd-intro',style);
  fixture.quiz.intro_preise='Geheimer Hauptpreis\nZweiter Gewinn\nDritter Gewinn';
  if(surface==='fixed')fixture.slide={typ:'fixer-slide',slideTyp:'preise'};
  else {assert.equal(fixture.slide.typ,'ablauf');if(fixture.slide.typ!=='ablauf')throw Error('fixture');fixture.slide={...fixture.slide,element:{...fixture.slide.element,type:'PRIZES'}};}
  fixture.displayState.endstandRevealCount=count;
  const html=renderToStaticMarkup(createElement(PresentationSlideRenderer,fixture));
  assert.equal(html.includes('Geheimer Hauptpreis'),count===3,`${style}/${surface}/${count}: first place`);
  assert.equal(html.includes('Zweiter Gewinn'),count>=2);assert.equal(html.includes('Dritter Gewinn'),count>=1);
  assert.match(html,/Platz 3/);assert.match(html,/Platz 2/);assert.match(html,/Platz 1/);
 }
});
