import assert from "node:assert/strict";
import test from "node:test";
import { compareDifficultyRow, difficultyFromCounts, type DifficultyAuditRow } from "./difficultyAudit";

test("audit preserves existing empty, rounding and partial-not-fully-correct formula", () => {
  assert.deepEqual(difficultyFromCounts(0, 0), { sampleSize: 0, difficulty: null });
  assert.deepEqual(difficultyFromCounts(2, 1), { sampleSize: 3, difficulty: 33 });
  assert.equal(difficultyFromCounts(1, 1).difficulty, 50);
  assert.equal(difficultyFromCounts(0, 3).difficulty, 100);
});

test("audit separates assignment counters, missing snapshots and global stored aggregate", () => {
  const row: DifficultyAuditRow = { assignment_id: 1, question_id: 2, template: "standard", stored_correct: 1, stored_wrong: 1, stored_difficulty: "50", raw_correct: 2, raw_wrong: 1, submitted_correct: 1, submitted_wrong: 1, unanswered: 9, partial: 1, review_required: 4, global_correct: 2, global_wrong: 1, usages: 2 };
  const before = JSON.stringify(row);
  const report = compareDifficultyRow(row);
  assert.equal(report.counterMismatch, true); assert.equal(report.submissionMismatch, true); assert.equal(report.difficultyMismatch, true);
  assert.equal(report.raw.sampleSize, 3); assert.equal(report.submitted.difficulty, 50);
  assert.equal(JSON.stringify(row), before);
  assert.equal(compareDifficultyRow({ ...row, template: "meme_beschriften" }).creativeOrPoll, true);
});
