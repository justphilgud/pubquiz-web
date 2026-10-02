export type LivePollPlacementReadback = {
  quizId: number;
  pollId: number;
  placementId: number;
};

export function isExpectedLivePollPlacement(
  expected: LivePollPlacementReadback,
  actual: LivePollPlacementReadback | null,
) {
  return actual !== null &&
    actual.quizId === expected.quizId &&
    actual.pollId === expected.pollId &&
    actual.placementId === expected.placementId;
}
