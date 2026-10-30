import assert from 'node:assert/strict';
import test from 'node:test';
import {newlyConfirmedDraw,type Observation} from './observation';
const view=(revision=0,draws:Observation['view']['draws']=[]):Observation=>({connected:true,view:{id:'run',startedAt:1,revision,status:'RUNNING',draws}});
const first={id:'one',number:3,position:1},second={id:'two',number:42,position:2};
test('only a newly confirmed append animates; duplicate, edit, reset, reconnect and old replies are quiet',()=>{
 const empty=view(),one=view(1,[first]),two=view(2,[first,second]);
 assert.equal(newlyConfirmedDraw(undefined,one),null);
 assert.deepEqual(newlyConfirmedDraw(empty,one),first);
 assert.deepEqual(newlyConfirmedDraw(one,two),second);
 assert.deepEqual(newlyConfirmedDraw({...one,view:{...one.view,status:"PAUSED"}},two),second);
 assert.deepEqual(newlyConfirmedDraw(empty,two),second);
 for(const [a,b]of [[one,one],[two,one],[one,{...one,view:{...one.view,revision:2}}],[one,view(2,[{...first,number:9}])],[two,view(3,[{...first,number:9},second])],[two,{...two,view:{...two.view,id:'other',startedAt:2}}],[one,{...two,view:{...two.view,status:'PAUSED'}}],[{...one,connected:false},two],[one,{...two,connected:false}],[one,{...two,view:{...two.view,phase:'BETWEEN'}}],[one,view(3,[first,{...second,id:first.id}])]] as const)assert.equal(newlyConfirmedDraw(a,b),null);
 assert.equal(newlyConfirmedDraw(one,view(2,[first,{...second,number:76}])),null);
});
