import assert from "node:assert/strict";
import test from "node:test";
import { aggregateLiveChoiceResults } from "./liveChoiceResults";

test("choice results count only the supplied effective submission payloads", () => {
  const result = aggregateLiveChoiceResults({
    interaction: { type: "SINGLE_CHOICE", selectionMode: "SINGLE", options: [{ id: 1, label: "A" }, { id: 2, label: "B" }] },
    visible: true,
    state: "OPEN",
    totalTeams: 8,
    payloads: [{ optionId: 1 }, { optionId: 1 }, { optionId: 2 }],
  });
  assert.equal(result.finalAnswers, 3);
  assert.deepEqual(result.options.map(({ count, share }) => ({ count, share })), [
    { count: 2, share: 66.7 },
    { count: 1, share: 33.3 },
  ]);
});

test("multi-choice percentages remain team-submission based", () => {
  const result = aggregateLiveChoiceResults({
    interaction: { type: "MULTI_CHOICE", selectionMode: "MULTIPLE", options: [{ id: 1, label: "A" }, { id: 2, label: "B" }] },
    visible: false,
    state: "OPEN",
    totalTeams: 2,
    payloads: [{ optionIds: [1, 2] }, { optionIds: [2] }],
  });
  assert.deepEqual(result.options.map(({ share }) => share), [50, 100]);
  assert.equal(result.visible, false);
});

test("live aggregates contain labels and counts but no correctness metadata", () => {
  const result = aggregateLiveChoiceResults({
    interaction: { type: "POLL_SINGLE", selectionMode: "SINGLE", options: [{ id: 1, label: "A" }] },
    visible: true,
    state: "CLOSED",
    totalTeams: 1,
    payloads: [{ optionId: 1 }],
  });
  assert.deepEqual(Object.keys(result.options[0]).sort(), ["count", "id", "label", "share"]);
});

test("true-false uses the same neutral single-choice result contract", () => {
  const result = aggregateLiveChoiceResults({
    interaction: {
      type: "SINGLE_CHOICE",
      selectionMode: "SINGLE",
      options: [
        { id: 10, label: "Wahr" },
        { id: 11, label: "Falsch" },
      ],
    },
    visible: true,
    state: "OPEN",
    totalTeams: 2,
    payloads: [{ optionId: 10 }, { optionId: 11 }],
  });

  assert.deepEqual(result.options.map(({ label, count }) => ({ label, count })), [
    { label: "Wahr", count: 1 },
    { label: "Falsch", count: 1 },
  ]);
  assert.ok(result.options.every((option) => !("correct" in option)));
});

test("poll multi and poll scale aggregate effective team payloads", () => {
  const multi = aggregateLiveChoiceResults({
    interaction: {
      type: "POLL_MULTI",
      selectionMode: "MULTIPLE",
      options: [{ id: 1, label: "A" }, { id: 2, label: "B" }],
    },
    visible: true,
    state: "OPEN",
    totalTeams: 2,
    payloads: [{ optionIds: [1, 2] }, { optionIds: [2] }],
  });
  assert.deepEqual(multi.options.map(({ count }) => count), [1, 2]);

  const scale = aggregateLiveChoiceResults({
    interaction: {
      type: "POLL_SCALE",
      inputMode: "decimal",
      min: 1,
      max: 3,
      step: 1,
      minLabel: "niedrig",
      maxLabel: "hoch",
      values: [1, 2, 3],
    },
    visible: true,
    state: "OPEN",
    totalTeams: 3,
    payloads: [{ value: 1 }, { value: 3 }, { value: 3 }],
  });
  assert.deepEqual(scale.scale?.values.map(({ count }) => count), [1, 0, 2]);
  assert.equal(scale.scale?.average, 7 / 3);
});
