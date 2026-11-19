import assert from "node:assert/strict";
import test from "node:test";
import { mayLeaveMemeQuestion, nextIndexAfterSkippedMeme } from "./memeNavigationPolicy";
import { buildPresentationQualityFixture } from "@/app/rendering/presentation/presentationQualityFixtures";

test("an explicit empty skip bypasses only its own empty solution slide", () => {
  const fixture = buildPresentationQualityFixture("short");
  assert.ok(fixture.slide.typ === "frage");
  const question = fixture.slide;
  const solution = { ...question, typ: "aufloesung" as const };
  assert.equal(nextIndexAfterSkippedMeme([question, solution, question], 0), 2);
  assert.equal(nextIndexAfterSkippedMeme([question, { ...solution, frage: { ...question.frage, quiz_fragen_id: -1 } }], 0), 1);
  assert.equal(nextIndexAfterSkippedMeme([question, question], 0), 1);
});
test("zero-entry closed skip permits forward navigation without a fictitious voting result", () => {
  assert.equal(mayLeaveMemeQuestion({ finalizedResult: false, reviewState: "SKIPPED", runState: "CLOSED", selectedCandidates: 0 }), true);
});
test("unfinished or selected meme rounds still require finalized voting", () => {
  for (const reviewState of [null, "IN_REVIEW", "COMPLETED", "SKIPPED"]) {
    assert.equal(mayLeaveMemeQuestion({ finalizedResult: false, reviewState, runState: "OPEN", selectedCandidates: 0 }), false);
  }
  assert.equal(mayLeaveMemeQuestion({ finalizedResult: false, reviewState: "SKIPPED", runState: "CLOSED", selectedCandidates: 1 }), false);
  assert.equal(mayLeaveMemeQuestion({ finalizedResult: true, reviewState: "COMPLETED", runState: "CLOSED", selectedCandidates: 3 }), true);
});
