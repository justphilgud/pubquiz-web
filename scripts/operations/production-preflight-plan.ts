import { createHash } from "node:crypto";
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

// No SQL replay or application execution: only this immutable, reviewed layout release.
export const NO_DELTA_PREFLIGHT_PLAN = Object.freeze({
  baselineSha: "a4c5a9fd9adb182776afcfae38a977a12805a9ea",
  candidateSha: "c50e56a0308276d16bc19681f3e6a7600c41682f",
  migrationCount: 64,
  lastMigration: "20261026210000_shared_game_design",
});

// Separately approved AP1 release; retain the original layout pair unchanged.
export const BINGO_AP1_NO_DELTA_PREFLIGHT_PLAN = Object.freeze({
  ...NO_DELTA_PREFLIGHT_PLAN,
  baselineSha: "3ade18d276d7ead2cc43008a3d887e3d8feaae48",
  candidateSha: "0c23f07ecb263805482ef9bd75277d94f0eac718",
});

// Separately human-approved PR149 pair; immutable complete 69-file manifest.
export const ICON_ORDERING_NO_DELTA_PREFLIGHT_PLAN = Object.freeze({
  "baselineSha": "1b025a78da4f3bc439bda0ac8510b377c1a4eb0f",
  "candidateSha": "ed551d426de69c42eaea604c34176ede72305439",
  "migrationCount": 69,
  "lastMigration": "20261030150000_bingo_event_operation",
  "manifestSha256": "e996d003df6d87260bbd3201e211e2eb11a419f6bf5c3b5cfa7def8ee1a6c498",
  "schemaSha256": "8de3ef99975080831c86be36cae7f62bc4a3abe5e2181e92b1a65b8d590d4947"
});

export function approvedNoDeltaPreflightPlan(baseline: string, candidate: string) {
  return [NO_DELTA_PREFLIGHT_PLAN, BINGO_AP1_NO_DELTA_PREFLIGHT_PLAN, ICON_ORDERING_NO_DELTA_PREFLIGHT_PLAN]
    .find(plan => baseline === plan.baselineSha && candidate === plan.candidateSha);
}

export function assertNoDeltaManifest(baseline: string, candidate: string,
  before: readonly {name: string; checksum: string}[], after: readonly {name: string; checksum: string}[],
  baselineSchema: string, candidateSchema: string) {
  const plan = approvedNoDeltaPreflightPlan(baseline, candidate);
  if (!plan || before.length !== plan.migrationCount || after.length !== plan.migrationCount ||
      new Set(after.map(file => file.name)).size !== plan.migrationCount ||
      !after.some(file => file.name === plan.lastMigration) || baselineSchema !== candidateSchema ||
      JSON.stringify(before.map(({name,checksum}) => ({name,checksum}))) !== JSON.stringify(after.map(({name,checksum}) => ({name,checksum})))) {
    throw new Error("NO_DELTA_MANIFEST_UNVERIFIED");
  }
  if ("manifestSha256" in plan) {
    const hash = (value:string) => createHash("sha256").update(value).digest("hex");
    if (hash(JSON.stringify(before.map(({name,checksum}) => ({name,checksum})))) !== plan.manifestSha256 ||
        hash(baselineSchema) !== plan.schemaSha256) throw new Error("NO_DELTA_PINNED_BYTES_UNVERIFIED");
  }
  return {kind: "NO_SCHEMA_MIGRATION_DELTA" as const, ...plan, manifest: after.map(({name,checksum}) => ({name,checksum}))};
}

export function hasCompleteNoDeltaHistory(result: {gate: {status: string}; applied?: readonly string[]; pending?: readonly string[]; expected?: readonly string[]},
  manifest: readonly {name: string}[], release?: {baselineSha:string;candidateSha:string}) {
  const plan = release ? approvedNoDeltaPreflightPlan(release.baselineSha,release.candidateSha) : NO_DELTA_PREFLIGHT_PLAN;
  return Boolean(plan && result.gate.status === "PASS" && manifest.length === plan.migrationCount &&
    result.applied?.length === manifest.length && new Set(result.applied).size === manifest.length &&
    manifest.every(file => result.applied?.includes(file.name)) && result.pending?.length === 0 && result.expected?.length === 0);
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
