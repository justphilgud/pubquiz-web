import assert from "node:assert/strict";
import test from "node:test";
import { respondToPresentationProbe } from "./presentationWindowSync";

test("two public windows answer one probe without echoing each other's receipts", () => {
  const queue: { sender: number; data: unknown }[] = [{ sender: 0, data: { kind: "probe" } }];
  let published = 0;
  let deliveries = 0;
  while (queue.length && deliveries++ < 20) {
    const message = queue.shift()!;
    for (const peer of [1, 2]) {
      if (peer === message.sender) continue;
      respondToPresentationProbe(message.data, () => {
        published++;
        queue.push({ sender: peer, data: { kind: "rendered", id: String(peer), key: "question:17:question", reveal: 1 } });
      });
    }
  }
  assert.equal(published, 2);
  assert.equal(queue.length, 0);
});

test("unrelated or malformed channel messages do not publish a receipt", () => {
  for (const data of [null, undefined, "probe", {}, { kind: "rendered" }]) {
    respondToPresentationProbe(data, () => assert.fail("unexpected receipt"));
  }
});
