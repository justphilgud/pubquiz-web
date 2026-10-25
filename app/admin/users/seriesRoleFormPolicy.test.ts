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


test("100 assignments: filtered rendering never affects complete wire payload, including management-only and unavailable series", async () => {
  const { initialSeriesDraft, seriesDraftPayload } = await import("./seriesAssignmentDraft");
  const assignments = Array.from({ length: 99 }, (_, i) => ({ eventSeriesId: i + 1, role: i % 2 ? "EDITOR" as const : "EVENT_MANAGER" as const }));
  const rows = initialSeriesDraft(assignments, [2, 100]);
  assert.equal(rows.length, 100);
  assert.deepEqual(rows[99], { eventSeriesId: 100, role: "", manage: true });
  const visible = rows.filter(row => row.eventSeriesId === 1);
  assert.equal(visible.length, 1);
  function posted(draft: typeof rows) {
    const payload = seriesDraftPayload(draft);
    const f = form(payload.assignments);
    payload.managementIds.forEach(id => f.append("manageEventSeriesIds", String(id)));
    return readSeriesRoleForm(f);
  }
  assert.deepEqual(posted(rows), { assignments, managementIds: [2, 100] });
  // Explicit remove is the only operation removing a row; an added blank row grants nothing.
  const removed = rows.filter(row => row.eventSeriesId !== 1);
  assert.deepEqual(posted([...removed, { eventSeriesId: 101, role: "", manage: false }]), { assignments: assignments.slice(1), managementIds: [2, 100] });
  assert.deepEqual(posted(rows), { assignments, managementIds: [2, 100] }); // cancelled draft did not mutate initial state
});
