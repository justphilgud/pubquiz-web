import test from "node:test";
import assert from "node:assert/strict";
import {createLiveViewReader,advanceLiveClock} from "./liveViewReader";

test("one queue serializes polling and post-command refresh, preserves validator and bodies",async()=>{
 let active=0,maximum=0,calls=0;const headers:string[]=[];
 const fetcher:typeof fetch=async(_url,init)=>{active++;maximum=Math.max(active,maximum);headers.push(new Headers(init?.headers).get("If-None-Match")??"");await new Promise(r=>setTimeout(r,5));active--;calls++;return calls===1?Response.json({id:"run",revision:3},{headers:{ETag:'"v3"'}}):new Response(null,{status:304,headers:{ETag:'"v3"'}});};
 const reader=createLiveViewReader<{id:string;revision:number}>("/status",fetcher);
 const results=await Promise.all([reader.read(),reader.read(),reader.read()]);assert.equal(maximum,1);assert.equal(calls,3);assert.deepEqual(headers,['','"v3"','"v3"']);for(const r of results)assert.equal(r.revision,3);
});

test("aborted queued/unmounted work does not start a request; connection recovery requires full state",async()=>{
 let calls=0;const headers:string[]=[];
 const reader=createLiveViewReader("/status",async(_url,init)=>{calls++;headers.push(new Headers(init?.headers).get("If-None-Match")??"");if(calls===2)throw Error("offline");return Response.json({id:"a",revision:calls},{headers:{ETag:'"a"'}});});
 await reader.read();await assert.rejects(reader.read(),/offline/);await reader.read();assert.deepEqual(headers,['','"a"','']);
 const controller=new AbortController();controller.abort();await assert.rejects(reader.read(controller.signal),{name:"AbortError"});assert.equal(calls,3);
});

test("cleanup aborts active fetch and timeout bounds stalled fetch",async t=>{
 t.mock.timers.enable({apis:["setTimeout"]});
 const reader=createLiveViewReader("/status",async(_url,init)=>new Promise((_resolve,reject)=>{init!.signal!.addEventListener("abort",()=>reject(new DOMException("Aborted","AbortError")));}));
 const controller=new AbortController(),pending=reader.read(controller.signal);await Promise.resolve();controller.abort();await assert.rejects(pending,{name:"AbortError"});
 const stalled=reader.read();await Promise.resolve();await Promise.resolve();t.mock.timers.tick(8001);await assert.rejects(stalled,{name:"AbortError"});
});

test("unchanged moderation status advances database display time only while running",()=>{
 const source={live:{serverAt:100,elapsedMs:40,roundElapsedMs:20,round:{id:"r"},state:{run:{status:"RUNNING"}},summary:[{id:"r",activeMs:20},{id:"old",activeMs:10}]}};
 const next=advanceLiveClock(source,150);assert.equal(next.live.elapsedMs,90);assert.equal(next.live.roundElapsedMs,70);assert.deepEqual(next.live.summary.map(r=>r.activeMs),[70,10]);assert.equal(source.live.elapsedMs,40);
 const paused={...source,live:{...source.live,state:{run:{status:"PAUSED"}}}};assert.equal(advanceLiveClock(paused,200).live.elapsedMs,40);assert.equal(advanceLiveClock(source,99),source);
});

test("effect cleanup cancels active and queued manual refreshes; remount can restart the same reader",async()=>{
 let calls=0;const reader=createLiveViewReader("/status",async(_url,init)=>{calls++;if(calls===1)return new Promise((_resolve,reject)=>init!.signal!.addEventListener("abort",()=>reject(new DOMException("Aborted","AbortError"))));return Response.json({revision:2});});
 const active=reader.read(),queued=reader.read();await new Promise(r=>setImmediate(r));reader.cancel();await assert.rejects(active,{name:"AbortError"});await assert.rejects(queued,{name:"AbortError"});assert.equal(calls,1);assert.deepEqual(await reader.read(),{revision:2});
});
