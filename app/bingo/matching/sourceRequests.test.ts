import assert from 'node:assert/strict';
import test from 'node:test';
import {createMatchingRequestLane} from './sourceRequests';
const tick=()=>new Promise<void>(resolve=>setImmediate(resolve));
function deferred<T>(){let resolve!:(value:T)=>void,reject!:(error:unknown)=>void;const promise=new Promise<T>((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
test('Matching source requests serialize, discard obsolete results and coalesce queued filters',async()=>{
 const lane=createMatchingRequestLane(),first=deferred<string>(),last=deferred<string>(),seen:string[]=[],errors:unknown[]=[];let active=0,max=0;
 const load=async(d:ReturnType<typeof deferred<string>>)=>{active++;max=Math.max(max,active);try{return await d.promise;}finally{active--;}};
 lane.request(()=>load(first),v=>seen.push(v),e=>errors.push(e));
 lane.request(async()=>{throw Error('obsolete queued search must never execute');},v=>seen.push(v),e=>errors.push(e));
 lane.request(()=>load(last),v=>seen.push(v),e=>errors.push(e));
 first.resolve('old');await tick();assert.equal(seen.length,0);last.resolve('new');await tick();assert.deepEqual(seen,['new']);assert.equal(max,1);assert.equal(errors.length,0);
});
test('filter change and dialog close invalidate late success and error; reopened dialog can retry',async()=>{
 const lane=createMatchingRequestLane(),pending=deferred<string>(),seen:string[]=[],errors:unknown[]=[];
 lane.request(()=>pending.promise,v=>seen.push(v),e=>errors.push(e));lane.invalidate();pending.reject(Error('late network failure'));await tick();assert.equal(errors.length,0);assert.equal(seen.length,0);
 lane.request(async()=>{throw Error('current failure');},v=>seen.push(v),e=>errors.push(e));await tick();assert.equal(errors.length,1);
 lane.request(async()=>'retried',v=>seen.push(v),e=>errors.push(e));await tick();assert.deepEqual(seen,['retried']);
});
