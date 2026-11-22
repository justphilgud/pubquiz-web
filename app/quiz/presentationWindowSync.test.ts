import assert from "node:assert/strict";
import test from "node:test";
import { respondToPresentationProbe, waitForPresentationPosition } from "./presentationWindowSync";
import { NavigationTransition } from "./navigationTransition";

test("late and missing acknowledgements release navigation without replaying a committed command", async () => {
  let now = 0, writes = 0;
  const gate = new NavigationTransition();
  const peers = new Map([["player", { at: 0, position: { key: "block:1", reveal: 1 } }]]);
  const target = { key: "question:17:question", reveal: 1 };
  const clock = { now: () => now, sleep: async () => { now += 50; if (now === 150) peers.set("player", { at: now, position: target }); } };
  let probes = 0;
  await gate.run(async () => { writes++; assert.equal(await waitForPresentationPosition(target, peers, () => { probes++; }, clock), true); });
  assert.equal(writes, 1); assert.equal(probes, 1);
  assert.equal(gate.busy, false);
  const next = { key: "block:2", reveal: 1 };
  await gate.run(async () => { writes++; assert.equal(await waitForPresentationPosition(next, peers, () => {}, clock, 200), false); });
  assert.equal(gate.busy, false);
  peers.set("player", { at: now, position: next });
  assert.equal(await waitForPresentationPosition(next, peers, () => {}, clock), true);
  assert.equal(writes, 2, "synchronizing an already reached target never writes navigation");
  await assert.rejects(gate.run(async () => { throw new Error("server offline"); }), /offline/);
  assert.equal(gate.busy, false);
  assert.equal(await gate.run(async () => { writes++; }), true);
  assert.equal(writes, 3);
});

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
