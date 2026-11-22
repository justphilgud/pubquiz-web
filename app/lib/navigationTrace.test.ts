import test from "node:test";
import assert from "node:assert/strict";
import { startNavigationTrace, NAVIGATION_TRACE_EXPIRES_AT } from "./navigationTrace";

test("navigation tracing is Preview-only, expires, rejects arbitrary content and excludes all payload fields", () => {
  const id="12345678-1234-1234-1234-123456789abc",lines:string[]=[];
  let now=NAVIGATION_TRACE_EXPIRES_AT-1000;
  for(const environment of ["production","development",undefined]) startNavigationTrace("navigation",id,environment,()=>now,line=>lines.push(line))();
  startNavigationTrace("navigation","team name and answer","preview",()=>now,line=>lines.push(line))();
  startNavigationTrace("navigation",id,"preview",()=>NAVIGATION_TRACE_EXPIRES_AT,line=>lines.push(line))();
  assert.equal(lines.length,0);
  const end=startNavigationTrace("navigation",id,"preview",()=>now,line=>lines.push(line));
  now+=25;end({queryCount:3,queryDurationMs:10,quizId:99,unknown:123,total:Infinity});
  const events=lines.map(line=>JSON.parse(line.slice(line.indexOf('{'))));
  assert.equal(events[1].durationMs,25);assert.equal(events[1].correlationId,id);
  assert.equal(events[1].queryCount,3);assert.equal(events[1].queryDurationMs,10);
  for(const key of ["quizId","unknown","total"])assert.ok(!(key in events[1]));
});
