import assert from "node:assert/strict";
import test from "node:test";
import { NavigationTransition } from "./navigationTransition";

test("repeated input while processing or rendering waits causes exactly one transition", async () => {
  const gate = new NavigationTransition();
  let finish!: () => void;
  let index = 16;
  const delayed = new Promise<void>(resolve => { finish = resolve; });
  const first = gate.run(async () => { await delayed; index++; });
  assert.equal(gate.busy, true);
  for (let n = 0; n < 10; n++) assert.equal(await gate.run(async () => { index++; }), false);
  assert.equal(index, 16);
  finish(); await first;
  assert.equal(index, 17);
  assert.equal(await gate.run(async () => { index++; }), true);
  assert.equal(index, 18);
});

test("a failed transition releases the gate for an explicit retry", async () => {
  const gate = new NavigationTransition();
  await assert.rejects(gate.run(async () => { throw new Error("offline"); }), /offline/);
  assert.equal(gate.busy, false);
  assert.equal(await gate.run(async () => {}), true);
});
