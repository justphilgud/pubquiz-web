import assert from "node:assert/strict";
import test from "node:test";
import {parseGameTeamCommand,parseTeamSearch} from "./gameTeams";
const base={gameId:"00000000-0000-0000-0000-000000000001",updatedAt:"2026-10-26T00:00:00.000Z"};
test("team assignment accepts only explicit identity-bound operations",()=>{
  assert.equal(parseGameTeamCommand({...base,operation:"ADD",teamId:1}).teamId,1);
  assert.equal(parseGameTeamCommand({...base,operation:"REMOVE",assignmentId:base.gameId}).assignmentId,base.gameId);
  for(const data of [null,{}, {...base,operation:"ADD",teamId:0},{...base,operation:"ADD",teamId:"1"},{...base,operation:"ADD",teamId:1,status:"LIVE"},{...base,operation:"REMOVE",assignmentId:base.gameId,teamId:1},{...base,operation:"ADD",teamId:1,gameId:"../1"},{...base,operation:"ADD",teamId:1,updatedAt:"bad"}]) assert.throws(()=>parseGameTeamCommand(data));
  assert.equal(parseTeamSearch(" Name "),"Name");assert.throws(()=>parseTeamSearch("a".repeat(151)));
});
