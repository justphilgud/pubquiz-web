import assert from "node:assert/strict";
import test from "node:test";
import { formatQuizPoints } from "./formatQuizPoints";

test("quiz points use German formatting with at most two decimals", () => {
  assert.equal(formatQuizPoints(4), "4");
  assert.equal(formatQuizPoints(2.5), "2,5");
  assert.equal(formatQuizPoints(2.6667), "2,67");
});
