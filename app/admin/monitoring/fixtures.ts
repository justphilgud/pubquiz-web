import type { Snapshot } from "./model";
export const SCENARIOS = ["healthy", "warning", "error", "no-quiz"] as const;
export type Scenario = typeof SCENARIOS[number];
export function isScenario(value: string): value is Scenario {
  return SCENARIOS.some(s => s === value);
}
export function fixture(scenario: Scenario, now = new Date()): Snapshot {
  return {
    checkedAt: now.toISOString(), environment: "preview", release: "a".repeat(40),
    db: { ok: scenario !== "error", latencyMs: scenario === "error" ? null : scenario === "warning" ? 900 : 24, lastSuccessAt: scenario === "error" ? null : now.toISOString() },
    live: scenario === "error" ? null : scenario === "no-quiz" ? [] : [{ id: 0, name: "Synthetische Generalprobe", slide: 4, registeredTeams: 12, stateChangedAt: new Date(now.getTime() - 180_000).toISOString(), phase: "Offen", savedAnswers: 9, lastDraftAt: now.toISOString() }],
    truncated: false, backup: null, collectionMs: 0, readQueries: 0, simulation: scenario,
  };
}
