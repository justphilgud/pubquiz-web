import assert from "node:assert/strict";
import test from "node:test";
import { sanitizePublicLiveText } from "./publicTextSanitizer";

const rules = [{ id: 1, searchTerm: "Penis", replacement: "Sonnenblume" }];

test("replaces case, leetspeak, repetitions and conservative separators", () => {
  for (const input of [
    "Penis",
    "penis",
    "PENIS",
    "P3nis",
    "p.e.n.i.s",
    "Peeenis",
    "p.e-n_i s",
  ]) {
    assert.equal(sanitizePublicLiveText(input, rules).publicText, "Sonnenblume");
  }
});

test("keeps surrounding text and avoids word-fragment false positives", () => {
  assert.equal(
    sanitizePublicLiveText("Das ist ein Penis!", rules).publicText,
    "Das ist ein Sonnenblume!",
  );
  assert.equal(sanitizePublicLiveText("peninsula", rules).publicText, "peninsula");
});

test("returns a moderation diff without mutating the original", () => {
  const original = "P3nis";
  const result = sanitizePublicLiveText(original, rules);
  assert.equal(original, "P3nis");
  assert.equal(result.changed, true);
  assert.deepEqual(result.appliedRuleIds, [1]);
});

test("an inactive rule leaves the public text unchanged", () => {
  assert.equal(
    sanitizePublicLiveText("Penis", [{ ...rules[0], active: false }]).publicText,
    "Penis",
  );
});
