export type RiskPoolSnapshot = {
  teamCount: number;
  fixedAt: Date;
};

export function shouldFreezeRiskPool(input: {
  existingTeamCount: number | null;
  existingFixedAt: Date | null;
  hasEvaluations: boolean;
  refreeze: boolean;
}): boolean {
  if (input.refreeze) return true;
  if (
    input.existingTeamCount !== null &&
    input.existingFixedAt !== null
  ) {
    return false;
  }
  return input.hasEvaluations;
}

export function isRiskPoolEligible(
  sessionCreatedAt: Date,
  snapshotFixedAt: Date,
): boolean {
  return sessionCreatedAt <= snapshotFixedAt;
}
