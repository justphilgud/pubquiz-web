import {readFileSync} from 'node:fs';import{createHash}from'node:crypto';
import assert from 'node:assert/strict';import test from 'node:test';
import {SCENES,sceneFor} from './catalog';import{choreography}from'./choreography';import{sample,sampleTrack,track}from'./timeline';import{PROP_NAMES}from'./artwork';
test('all 75 scenes have a distinct complete storyboard and executable independent score',()=>{
 assert.equal(SCENES.length,75);assert.equal(new Set(SCENES.map(x=>x.motif)).size,75);
 const scores=new Set<string>();
 for(const scene of SCENES){assert.equal(sceneFor(scene.number),scene);assert.ok(scene.duration>=3000&&scene.duration<=5000);for(const k of ['preparation','action','punchline','reaction','settle'] as const)assert.ok(scene[k].length>15);
  const score=choreography(scene.number);assert.equal(score.filter(x=>x.shape==='ball').length,1);assert.ok(score.some(x=>x.shape==='gudi'));scores.add(JSON.stringify(score));
  for(const actor of score){assert.ok(['ball','gudi',...PROP_NAMES].includes(actor.shape));let previous=-1;for(const key of actor.keys){assert.ok(key.at>=0&&key.at<=1&&key.at>=previous);previous=key.at;}
   for(let i=0;i<=100;i++)assert.ok(Object.values(sample(actor.keys,i/100)).every(Number.isFinite));}
  const ball=sample(score.find(x=>x.shape==='ball')!.keys,1);assert.equal(ball.x,360);assert.equal(ball.y,355);
 }
 assert.equal(scores.size,75);assert.throws(()=>sceneFor(0));assert.throws(()=>choreography(76));
});

test('supplied Gudi originals remain byte-identical',()=>{for(const name of ['gudi','website-gudi'])assert.equal(createHash('sha256').update(readFileSync(`public/branding/phil-gud/${name}.png`)).digest('hex'),'dca783730a6689ec6c189c7befd3365a9b22140a5b86b4fc723df5b9dc977cdb');});

test('flight interpolation preserves endpoints and authored bounds with continuous apex motion',()=>{
 const flight={...track('ball',[[0,0,0],[.5,100,-100],[1,200,0]]),flow:true};
 assert.equal(sampleTrack(flight,.5).y,-100);assert.ok(sampleTrack(flight,.499).x<100);assert.ok(sampleTrack(flight,.501).x>100);
 for(const scene of SCENES)for(const actor of choreography(scene.number))for(let i=0;i<=200;i++){const p=sampleTrack(actor,i/200);assert.ok(Object.values(p).every(Number.isFinite));for(const key of ['x','y'] as const){const values=actor.keys.map(k=>k[key]).filter((v):v is number=>v!==undefined);assert.ok(p[key]>=Math.min(...values)-.00001&&p[key]<=Math.max(...values)+.00001);}}
});

test('reference identities and related motifs remain intentionally distinct',()=>{
 for(const[n,motif,prop]of [[3,'Basketball-Dreier','hoop'],[9,'Alle neune','pin'],[24,'Adventskalender','calendar'],[42,'Antwort auf alles','mirror'],[66,'Route 66','route'],[75,'Konfettifinale','confetti']] as const){assert.equal(sceneFor(n).motif,motif);assert.ok(choreography(n).some(a=>a.shape===prop));}
 assert.equal(choreography(5).filter(a=>a.shape==='hand').length,1);assert.equal(choreography(55).filter(a=>a.shape==='hand').length,2);
 assert.equal(choreography(16).some(a=>a.shape==='king'),false);assert.equal(choreography(64).some(a=>a.shape==='king'),true);
});
