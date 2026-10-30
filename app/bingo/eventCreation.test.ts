import assert from "node:assert/strict";
import test from "node:test";
import {parseBingoCreation} from "./eventCreation";
const input={seriesId:10,title:"Bingo",date:"2028-02-29",time:"19:30",roundCount:3,requestId:"00000000-0000-4000-8000-000000000001"};
test("creation is explicit, bounded by transaction resources and never silently changes dates or rounds",()=>{
 assert.equal(parseBingoCreation(input).roundCount,3);
 assert.equal(parseBingoCreation({...input,roundCount:10000}).roundCount,10000);
 for(const value of [{...input,roundCount:0},{...input,roundCount:1.5},{...input,roundCount:10001},{...input,roundCount:undefined},{...input,requestId:"../31"},{...input,seriesId:0},{...input,date:"2027-02-29"},{...input,date:"",time:"19:30"},{...input,createdBy:1},{...input,id:input.requestId}])assert.throws(()=>parseBingoCreation(value));
});
