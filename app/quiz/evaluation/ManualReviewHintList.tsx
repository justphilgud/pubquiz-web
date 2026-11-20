import type { ReviewHint } from "./manualReviewHints";

export function ManualReviewHints({ hints }: { hints: readonly ReviewHint[] }) {
  if (!hints.length) return null;
  return <aside className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs font-normal text-amber-950" aria-label="Prüfhinweise">
    <strong>Prüfhinweise · Entscheidung bleibt bei dir</strong>
    <ul className="mt-1 space-y-1">{hints.map(hint => <li key={hint.kind + hint.text}>{hint.text}</li>)}</ul>
  </aside>;
}
