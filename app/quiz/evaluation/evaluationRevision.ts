import { createHash } from "node:crypto";

// Content-based: automatic evaluation does not update bewertet_am.
export const evaluationRevisionSelect = {
  team_antwort_id: true,
  interaction_run_id: true,
  draft_revision: true,
  auto_basis_punkte: true,
  auto_endpunkte: true,
  vergebene_punkte: true,
  manuelle_punkte: true,
  bewertungsstatus: true,
  bewertungsquelle: true,
  bewertungs_version: true,
  bewertungsdetails: true,
  bewertet_am: true,
  bewertet_von_user_id: true,
  ist_manuell_richtig: true,
  ist_manuell_falsch: true,
  ist_skurril: true,
  bewertung_final: true,
} as const;

export function evaluationRevision(answer: Record<string, unknown>): string {
  return contentRevision(Object.keys(evaluationRevisionSelect).map((key) => answer[key]));
}

export function contentRevision(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function assertEvaluationRevision(expected: string, actual: string) {
  if (expected !== actual) {
    throw new Error("Die Bewertung wurde inzwischen geändert. Bitte den aktuellen Stand prüfen und erneut bewerten.");
  }
}
