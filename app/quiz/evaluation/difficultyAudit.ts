export function difficultyFromCounts(correct: number, notFullyCorrect: number) {
  const sampleSize = correct + notFullyCorrect;
  return { sampleSize, difficulty: sampleSize ? Math.round(100 * notFullyCorrect / sampleSize) : null };
}

export type DifficultyAuditRow = {
  assignment_id: number; question_id: number; template: string;
  stored_correct: number | null; stored_wrong: number | null; stored_difficulty: string | null;
  raw_correct: number; raw_wrong: number; submitted_correct: number; submitted_wrong: number;
  unanswered: number; partial: number; review_required: number;
  global_correct: number; global_wrong: number; usages: number;
};

export function compareDifficultyRow(row: DifficultyAuditRow) {
  const raw = difficultyFromCounts(row.raw_correct, row.raw_wrong);
  const submitted = difficultyFromCounts(row.submitted_correct, row.submitted_wrong);
  const global = difficultyFromCounts(row.global_correct, row.global_wrong);
  return { ...row, raw, submitted, global,
    counterMismatch: (row.stored_correct ?? 0) !== row.raw_correct || (row.stored_wrong ?? 0) !== row.raw_wrong,
    submissionMismatch: row.raw_correct !== row.submitted_correct || row.raw_wrong !== row.submitted_wrong,
    difficultyMismatch: (row.stored_difficulty === null ? null : Number(row.stored_difficulty)) !== global.difficulty,
    creativeOrPoll: row.template === "meme_beschriften" || row.template.startsWith("umfrage"),
  };
}
