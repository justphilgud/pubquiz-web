import assert from "node:assert/strict";
import test from "node:test";

import { buildTrueFalsePresentationOptions } from "./trueFalsePresentation";

test("true/false presentation marks the configured answer instead of a fixed color side", () => {
  assert.deepEqual(buildTrueFalsePresentationOptions(true), [
    { id: "TRUE", label: "Wahr", isCorrect: true },
    { id: "FALSE", label: "Falsch", isCorrect: false },
  ]);
  assert.deepEqual(buildTrueFalsePresentationOptions(false), [
    { id: "TRUE", label: "Wahr", isCorrect: false },
    { id: "FALSE", label: "Falsch", isCorrect: true },
  ]);
});
