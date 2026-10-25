import assert from "node:assert/strict";
import test from "node:test";
import { readSeriesRoleForm } from "./seriesRoleFormPolicy";
function form(value: unknown) { const f = new FormData(); f.set("seriesRolesVersion","1"); f.set("eventSeriesRoles",JSON.stringify(value)); return f; }
test("old identity-only forms preserve all scoped and management rights", () => assert.equal(readSeriesRoleForm(new FormData()),null));
test("explicit empty selection removes rights; one role per series and separate management", () => {
  assert.deepEqual(readSeriesRoleForm(form([])),{assignments:[],managementIds:[]});
  const f = form([{eventSeriesId:10,role:"EDITOR"},{eventSeriesId:20,role:"EVENT_MANAGER"}]); f.append("manageEventSeriesIds","20");
  assert.deepEqual(readSeriesRoleForm(f),{assignments:[{eventSeriesId:10,role:"EDITOR"},{eventSeriesId:20,role:"EVENT_MANAGER"}],managementIds:[20]});
});
test("forged format/admin roles, duplicate series, bad ids and stale versions are rejected", () => {
  for (const input of [null,{},[{eventSeriesId:10,role:"ADMIN"}],[{eventSeriesId:-1,role:"EDITOR"}],[{eventSeriesId:10,role:"EDITOR"},{eventSeriesId:10,role:"EVENT_MANAGER"}]]) assert.throws(() => readSeriesRoleForm(form(input)));
  const f=form([]);f.set("seriesRolesVersion","2");assert.throws(() => readSeriesRoleForm(f));
  const bad=form([]);bad.append("manageEventSeriesIds","abc");assert.throws(() => readSeriesRoleForm(bad));
});
