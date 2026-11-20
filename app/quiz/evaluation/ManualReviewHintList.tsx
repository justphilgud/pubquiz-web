import type { ReviewHint } from "./manualReviewHints";

export function ManualReviewHints({ hints }: { hints: readonly ReviewHint[] }) {
  if (!hints.length) return null;
  const labels = { SAME: "Gleicher Text", SIMILAR: "Schreibvariante", SOLUTION: "Lösungsvariante", FACE_SWAP: "Mögliche Vertauschung" };
  const summary = [...new Set(hints.map(hint => `${labels[hint.kind]}${hint.count ? ` (${hint.count})` : ""}`))].join(" · ");
  return <details className="mt-2 break-words rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs font-normal text-amber-950" aria-label="Prüfhinweise">
    <summary className="cursor-pointer font-semibold">{summary}</summary>
    <p className="mt-1">Prüfhinweise · Entscheidung bleibt bei dir</p>
    <ul className="mt-1 space-y-1">{hints.map(hint => <li key={hint.kind + hint.text}>{hint.text}</li>)}</ul>
  </details>;
}
