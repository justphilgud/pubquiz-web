import assert from "node:assert/strict";
import test from "node:test";
import { AnswerDraftController, type DraftSaveResult } from "./answerDraftController";

const draft = (text: string) => ({ antwortText: text, antwortId: null, antwortfelder: {} });
function fixture(save: (revision: number, text: string | null) => Promise<DraftSaveResult>) {
  const controller = new AnswerDraftController({
    save: async (_id, _run, revision, value) => save(revision, value.antwortText),
    persist: () => {},
    schedule: () => 0,
    cancel: () => {},
  });
  controller.hydrate(1, 10, draft("Berlin"), 4, true);
  return controller;
}
test("R01: an old acknowledgement never labels a new local edit as saved", async () => {
  let complete!: (value: DraftSaveResult) => void;
  const c = fixture(() => new Promise(resolve => { complete = resolve; }));
  c.edit(1, draft("Hamburg"));
  assert.equal(c.getSnapshot()[1].status, "dirty");
  const saving = c.flush(1);
  assert.equal(c.getSnapshot()[1].status, "saving");
  c.edit(1, draft("Bremen"));
  complete({ success: true, draftRevision: 5 });
  await saving;
  assert.equal(c.getSnapshot()[1].status, "dirty");
  assert.equal(c.getSnapshot()[1].value.antwortText, "Bremen");
  assert.equal(c.getSnapshot()[1].baseRevision, 5);
});
test("R02: A edits N, B saves N+1, A polls N+1: no silent overwrite", async () => {
  const writes: number[] = [];
  const c = fixture(async revision => { writes.push(revision); return { success: true, draftRevision: 6 }; });
  c.edit(1, draft("Hamburg"));
  c.hydrate(1, 10, draft("Bremen"), 5, true);
  assert.equal(c.getSnapshot()[1].baseRevision, 4);
  assert.equal(c.getSnapshot()[1].status, "conflict");
  assert.equal(await c.flush(1), false);
  assert.deepEqual(writes, []);
  c.resolve(1, "server");
  assert.equal(c.getSnapshot()[1].value.antwortText, "Bremen");
  c.edit(1, draft("Köln"));
  await c.flush(1);
  assert.deepEqual(writes, [5]);
});
test("a lost save response is reconciled from matching server content before retrying newer edits", async () => {
  let count = 0;
  const c = fixture(async revision => {
    if (++count === 1) throw new Error("response lost");
    assert.equal(revision, 5);
    return { success: true, draftRevision: 6 };
  });
  c.edit(1, draft("Hamburg"));
  await c.flush(1);
  assert.equal(c.getSnapshot()[1].status, "error");
  c.edit(1, draft("Köln"));
  c.hydrate(1, 10, draft("Hamburg"), 5, true);
  assert.equal(c.getSnapshot()[1].baseRevision, 5);
  await c.flush(1);
  assert.equal(c.getSnapshot()[1].status, "saved");
});
test("device switch and reload adopt confirmed content; old polls never roll it back", async () => {
  const c = fixture(async () => ({ success: true, draftRevision: 5 }));
  c.hydrate(1, 10, draft("Hamburg"), 5, true);
  c.hydrate(1, 10, draft("Berlin"), 4, true);
  assert.equal(c.getSnapshot()[1].value.antwortText, "Hamburg");
  assert.equal(c.getSnapshot()[1].status, "saved");
});
test("restored edits require an explicit decision; closed answers are never retried", async () => {
  let writes = 0;
  const c = fixture(async () => { writes++; return { success: false, reason: "LIVE_STATE_CHANGED" }; });
  c.edit(1, draft("Hamburg"));
  const journal = c.journal();
  const restored = fixture(async () => { writes++; return { success: true, draftRevision: 5 }; });
  restored.restore(journal);
  restored.hydrate(1, 10, draft("Berlin"), 4, false);
  assert.equal(restored.getSnapshot()[1].status, "closed");
  assert.equal(restored.getSnapshot()[1].value.antwortText, "Hamburg");
  assert.equal(restored.getSnapshot()[1].serverValue.antwortText, "Berlin");
  assert.equal(await restored.flush(1), false);
  restored.resolve(1, "local");
  assert.equal(await restored.flush(1), false);
  assert.equal(writes, 0);
});
test("server rejection at deadline leaves unconfirmed content visibly unconfirmed", async () => {
  const c = fixture(async () => ({ success: false, reason: "LIVE_STATE_CHANGED" }));
  c.edit(1, draft("Hamburg"));
  assert.equal(await c.flush(1), false);
  assert.equal(c.getSnapshot()[1].status, "closed");
  assert.equal(c.getSnapshot()[1].serverValue.antwortText, "Berlin");
  assert.equal(await c.flush(1), false);
});
test("multiple quick changes coalesce, failures have bounded retry, manual retry works", async () => {
  const attempts: string[] = [];
  const c = fixture(async (_revision, text) => { attempts.push(text!); if (attempts.length <= 4) throw new Error("offline"); return { success: true, draftRevision: 5 }; });
  for (const text of ["H", "Ha", "Hamburg"]) c.edit(1, draft(text));
  for (let i = 0; i < 4; i++) await c.flush(1);
  assert.equal(c.getSnapshot()[1].failures, 4);
  assert.equal(c.getSnapshot()[1].status, "error");
  await c.retry(1);
  assert.equal(c.getSnapshot()[1].status, "saved");
  assert.deepEqual(attempts, Array(5).fill("Hamburg"));
});
test("newer server content arriving before an old save response stays protected", async () => {
  let complete!: (value: DraftSaveResult) => void;
  const c = fixture(() => new Promise(resolve => { complete = resolve; }));
  c.edit(1, draft("Hamburg"));
  const pending = c.flush(1);
  c.hydrate(1, 10, draft("Bremen"), 6, true);
  complete({ success: true, draftRevision: 5 });
  await pending;
  assert.equal(c.getSnapshot()[1].status, "conflict");
  assert.equal(c.getSnapshot()[1].serverRevision, 6);
});

test("a normalized no-op acknowledgement displays the actual persisted content", async () => {
  const c = fixture(async () => ({ success: true, draftRevision: 4, confirmedValue: draft("Berlin") }));
  c.edit(1, draft("BERLIN"));
  await c.flush(1);
  assert.equal(c.getSnapshot()[1].value.antwortText, "Berlin");
  assert.equal(c.getSnapshot()[1].status, "saved");
});
