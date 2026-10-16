import assert from "node:assert/strict";
import test from "node:test";
import { QuestionRewriteController, QuestionRewriteRequestError } from "./questionRewriteController";
import type { QuestionRewriteResult } from "./questionRewrite";

const result: QuestionRewriteResult = { proposal: "Bessere Frage?", usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 }, cost: null };
function deferred() {
  let resolve!: (value: QuestionRewriteResult) => void;
  const promise = new Promise<QuestionRewriteResult>(done => { resolve = done; });
  return { promise, resolve };
}

test("explicit request only; editing proposal and acceptance never persist a question", async () => {
  let calls = 0;
  const controller = new QuestionRewriteController(async () => { calls++; return result; });
  controller.setInput("Alte Frage?", 0);
  assert.equal(calls, 0);
  await controller.request("Alte Frage?", 0, false);
  assert.equal(controller.getSnapshot().session.active?.original, "Alte Frage?");
  controller.edit("Redaktionell bearbeitete Frage?");
  assert.equal(controller.accept("Alte Frage?", 0, false), "Redaktionell bearbeitete Frage?");
  assert.equal(controller.getSnapshot().session.active, null);
  assert.equal(controller.getSnapshot().notice, "accepted");
  assert.equal(calls, 1);
});

test("changed source invalidates an existing proposal, including change and return to original", async () => {
  const controller = new QuestionRewriteController(async () => result);
  await controller.request("Alte Frage?", 0, false);
  controller.setInput("Andere Frage?", 1);
  controller.setInput("Alte Frage?", 2);
  assert.equal(controller.accept("Alte Frage?", 2, false), null);
  assert.equal(controller.getSnapshot().session.history.length, 1);
});

test("late result cannot reappear after source changes A to B to A", async () => {
  const pending = deferred();
  const controller = new QuestionRewriteController(() => pending.promise);
  const work = controller.request("A?", 0, false);
  controller.setInput("B?", 1);
  controller.setInput("A?", 2);
  pending.resolve(result);
  await work;
  assert.equal(controller.getSnapshot().session.active, null);
  assert.equal(controller.getSnapshot().pending, false);
});

test("late result after question/template unmount is discarded", async () => {
  const pending = deferred();
  const controller = new QuestionRewriteController(() => pending.promise);
  const work = controller.request("A?", 0, false);
  controller.dispose();
  pending.resolve(result);
  await work;
  assert.equal(controller.getSnapshot().session.active, null);
});

test("acceptance synchronously rejects a changed revision before effects run", async () => {
  const controller = new QuestionRewriteController(async () => result);
  await controller.request("A?", 0, false);
  assert.equal(controller.accept("A?", 2, false), null);
  assert.equal(controller.getSnapshot().notice, "stale");
});

test("multiple clicks and disabled requests do not call the provider twice", async () => {
  let calls = 0;
  const pending = deferred();
  const controller = new QuestionRewriteController(() => { calls++; return pending.promise; });
  await controller.request("A?", 0, true);
  assert.equal(calls, 0);
  const work = controller.request("A?", 0, false);
  await controller.request("A?", 0, false);
  assert.equal(calls, 1);
  pending.resolve(result);
  await work;
  assert.equal(controller.accept("A?", 0, true), null);
});

test("discard, retry, errors and history do not mutate source text", async () => {
  let calls = 0;
  const controller = new QuestionRewriteController(async () => {
    if (++calls === 3) throw new QuestionRewriteRequestError("PROVIDER_TIMEOUT");
    return result;
  });
  await controller.request("A?", 0, false);
  controller.discard();
  assert.equal(controller.getSnapshot().session.active, null);
  await controller.request("A?", 0, false);
  assert.equal(controller.getSnapshot().session.history.length, 2);
  assert.equal(controller.getSnapshot().session.cumulativeUsage.totalTokens, 30);
  await controller.request("A?", 0, false);
  assert.equal(controller.getSnapshot().error, "PROVIDER_TIMEOUT");
  assert.equal(controller.getSnapshot().pending, false);
  assert.equal(controller.getSnapshot().session.active?.original, "A?");
});
