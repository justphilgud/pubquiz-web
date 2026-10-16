// Explicitly reviewed release pairs, never a caller-supplied SQL/delta allowlist.
export const APPROVED_PREFLIGHT_PLANS = Object.freeze([
  { baselineSha: "2258c182e68c40a54fbdc4f0a855c9a7306d1a10", candidateSha: "b7666e1a3e4fcbe1aec4e7884a30b3603e25b151",
    delta: "20261008090000_editorial_question_difficulty", checksum: "2a96e6d7bde1854c534a90b1d2f7433e2ed67e3bbd60c725287d95952a726c3b", kind: "difficulty" },
  { baselineSha: "baedd479615d33a7eb7b5e15f18f36450061dc5b", candidateSha: "41f3c2a87fd320757f158c2854e76cab3dac8d6a",
    delta: "20261016120000_meme_archive", checksum: "99a4b9d18e55d2294383a31cf35fb30973e6a30f9750c3c5da752f102818f641", kind: "meme-archive" },
  { baselineSha: "baedd479615d33a7eb7b5e15f18f36450061dc5b", candidateSha: "23c0b130e1cd6772fb8e1d98498a09f432d0ec08",
    delta: "20261016120000_meme_archive", checksum: "99a4b9d18e55d2294383a31cf35fb30973e6a30f9750c3c5da752f102818f641", kind: "meme-archive" },
] as const);
export type ApprovedPreflightPlan = typeof APPROVED_PREFLIGHT_PLANS[number];

export function approvedPreflightPlan(baseline: string, candidate: string): ApprovedPreflightPlan | undefined {
  return APPROVED_PREFLIGHT_PLANS.find(plan => plan.baselineSha === baseline && plan.candidateSha === candidate);
}

export function hasApprovedPendingDelta(plan: ApprovedPreflightPlan | undefined,
  expected: readonly string[], pending: readonly string[], files: readonly {name: string; checksum: string}[]) {
  return Boolean(plan && expected.length === 1 && expected[0] === plan.delta && pending.length === 1 && pending[0] === plan.delta &&
    files.find(file => file.name === plan.delta)?.checksum === plan.checksum);
}

export function hasApprovedDeltaEvidence(plan: ApprovedPreflightPlan | undefined, value: unknown) {
  if (!plan || !value || typeof value !== "object") return false;
  const evidence = value as Record<string, unknown>;
  return evidence.status === "PASS" && evidence.migration === plan.delta && evidence.baselineSha === plan.baselineSha &&
    evidence.candidateSha === plan.candidateSha && evidence.checksum === plan.checksum && evidence.rowsUnchanged === true &&
    evidence.onlyExpectedSchemaChanges === true && evidence.oldColumnProjectionCompatible === true &&
    (plan.kind !== "meme-archive" || (evidence.captureConfirmed === true && evidence.noBackfill === true &&
      evidence.resetBarrierConfirmed === true && evidence.archiveSurvivesRuntimeDeletion === true));
}
