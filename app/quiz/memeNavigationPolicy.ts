/** A completed explicit skip is a terminal review, not an unfinished voting. */
export function mayLeaveMemeQuestion(input: {
  finalizedResult: boolean; reviewState: string | null;
  runState: string | null; selectedCandidates: number;
}): boolean {
  return input.finalizedResult || (input.reviewState === "SKIPPED"
    && (input.runState === "CLOSED" || input.runState === "REVEALED")
    && input.selectedCandidates === 0);
}
