import assert from "node:assert/strict";
import test from "node:test";
import { canAccessGame, gameReturnHref, parseGameFields } from "./gameDraft";
import type { AuthorizationActor } from "@/app/roles/roleAssignmentPolicy";
const fields = { seriesId: 10, title: " Spiel ", date: "2028-02-29", time: "19:30" };
test("draft validation preserves civil dates and rejects forged state, IDs and impossible dates", () => {
  assert.deepEqual(parseGameFields(fields), {...fields,title:"Spiel"});
  for (const patch of [{seriesId:0},{seriesId:"10"},{title:" "},{title:"x".repeat(151)},{date:"2027-02-29"},{date:"0000-01-01"},{time:"24:00"},{date:"",time:"19:30"},{status:"LIVE"},{eventart:"QUIZ"},{id:"../11"},{id:"00000000-0000-0000-0000-000000000001"}]) assert.throws(() => parseGameFields({...fields,...patch}));
  assert.deepEqual(parseGameFields({...fields,date:"",time:""}), {...fields,title:"Spiel",date:"",time:""});
});
test("format policy retains management and editor boundaries and disabled products deny Admin", () => {
  const actor: AuthorizationActor = {userId:1,assignments:[],eventTypeAssignments:[{eventSeriesId:10,eventType:"BINGO",role:"EDITOR",enabled:true},{eventSeriesId:10,eventType:"POWERPOINT_KARAOKE",role:"EDITOR",enabled:true}],managedEventSeriesIds:[20]};
  assert.equal(canAccessGame(actor,10,"BINGO",true),true);
  assert.equal(canAccessGame(actor,10,"BINGO",true,true),false);
  assert.equal(canAccessGame(actor,10,"POWERPOINT_KARAOKE",true),false);
  assert.equal(canAccessGame(actor,20,"BINGO",true),false);
  const admin: AuthorizationActor = {userId:2,assignments:[{role:"ADMIN",scopeType:"GLOBAL",eventSeriesId:null}]};
  assert.equal(canAccessGame(admin,10,"BINGO",false,true),false);
  assert.equal(canAccessGame(admin,10,"POWERPOINT_KARAOKE",true,true),true);
});
test("return destinations remain within their own filtered collection", () => {
  assert.equal(gameReturnHref("BINGO","/bingo?series=10"),"/bingo?series=10");
  for (const value of ["//evil.invalid","https://evil.invalid/bingo","/karaoke","/bingo/new","/bingo?series=0","/bingo?series=10&next=x","/bingo?series=1#x"]) assert.equal(gameReturnHref("BINGO",value),"/bingo");
});
