import assert from "node:assert/strict";
import test from "node:test";

import { aggregatePollSubmissions } from "./pollInteraction";

test("single polls count final team choices and team shares", () => {
  const result = aggregatePollSubmissions({
    interaction: {
      type: "POLL_SINGLE",
      selectionMode: "SINGLE",
      options: [{ id: 1, label: "A" }, { id: 2, label: "B" }],
    },
    state: "REVEALED",
    totalTeams: 4,
    payloads: [{ optionId: 1 }, { optionId: 2 }, { optionId: 1 }],
  });
  assert.equal(result.finalAnswers, 3);
  assert.deepEqual(result.options.map(({ count, share }) => ({ count, share })), [
    { count: 2, share: 50 },
    { count: 1, share: 25 },
  ]);
});

test("multi polls count every selection without inflating final team answers", () => {
  const result = aggregatePollSubmissions({
    interaction: {
      type: "POLL_MULTI",
      selectionMode: "MULTIPLE",
      options: [{ id: 1, label: "A" }, { id: 2, label: "B" }],
    },
    state: "CLOSED",
    totalTeams: 2,
    payloads: [{ optionIds: [1, 2] }, { optionIds: [2] }],
  });
  assert.equal(result.finalAnswers, 2);
  assert.deepEqual(result.options.map(({ count, share }) => ({ count, share })), [
    { count: 1, share: 50 },
    { count: 2, share: 100 },
  ]);
});

test("scale polls expose distribution and average", () => {
  const result = aggregatePollSubmissions({
    interaction: {
      type: "POLL_SCALE",
      inputMode: "decimal",
      min: 1,
      max: 5,
      step: 1,
      minLabel: "niedrig",
      maxLabel: "hoch",
      values: [1, 2, 3, 4, 5],
    },
    state: "REVEALED",
    totalTeams: 4,
    payloads: [{ value: 2 }, { value: 4 }, { value: 4 }],
  });
  assert.equal(result.finalAnswers, 3);
  assert.equal(result.scale?.average, 10 / 3);
  assert.deepEqual(result.scale?.values.map((entry) => entry.count), [0, 1, 0, 2, 0]);
});
