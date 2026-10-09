"use client";

import { useEffect, useRef, useState } from "react";
import GenericAnswerRenderer from "./[quizId]/antworten/GenericAnswerRenderer";
import { getModeratorTiebreak, getParticipantTiebreak, hideEstimationTiebreak, revealEstimationTiebreak, startEstimationTiebreak, submitEstimationTiebreak } from "./estimationTiebreakActions";
import type { projectTiebreak } from "./estimationTiebreak";

type View = ReturnType<typeof projectTiebreak>;
export function EstimationTiebreakPanel({ quizId, token, moderator = false, onChanged }: { quizId: number; token?: string; moderator?: boolean; onChanged?: () => void }) {
  const [view, setView] = useState<View | null>(null);
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const roundId = useRef<number | null>(null);
  const localEdit = useRef(false);
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    async function refresh() {
      try {
        const next = moderator ? await getModeratorTiebreak(quizId) : token ? await getParticipantTiebreak(quizId, token) : null;
        if (active) {
          setView(next);
          if (roundId.current !== next?.round?.id || !localEdit.current) {
            setAnswer(next?.round?.ownAnswer ? String(next.round.ownAnswer.value) : "");
            roundId.current = next?.round?.id ?? null;
            localEdit.current = false;
          }
        }
      } catch (cause) { if (active && moderator) setError(cause instanceof Error ? cause.message : "Stichentscheid konnte nicht geladen werden."); }
      finally { if (active) timer = setTimeout(() => void refresh(), 1500); }
    }
    void refresh();
    return () => { active = false; clearTimeout(timer); };
  }, [quizId, moderator, token]);
  async function mutate(action: () => Promise<View>) {
    if (pending) return;
    setPending(true); setError(null);
    try { setView(await action()); localEdit.current = false; onChanged?.(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Stichentscheid fehlgeschlagen."); }
    finally { setPending(false); }
  }
  if (!moderator && !view?.round) return null;
  const round = view?.round;
  return <section className="rounded-2xl border border-amber-500 bg-white p-4 text-slate-950" aria-label="Stichentscheid">
    <h2 className="text-xl font-bold">Stichentscheid durch Schätzfrage</h2>
    {moderator && <p>{view ? `${view.unresolved} unentschiedene Gruppen` : "Gleichstand wird geprüft …"}. Reguläre Punkte bleiben unverändert.</p>}
    {error && <p role="alert">{error}</p>}
    {round && <><p className="mt-3 font-semibold">Runde {round.id}: {round.question} ({round.unit})</p>
      <p>{round.answered} / {round.total} Antworten · {round.state === "OPEN" ? "offen" : "aufgelöst"}</p>
      {round.state === "REVEALED" && <p>Lösung: {round.correctValue} {round.unit}</p>}
      {!moderator && !round.authorized && <p>Dein Team gehört nicht zu dieser Gleichstandsgruppe.</p>}
      {!moderator && round.authorized && token && <>
        <GenericAnswerRenderer questionAssignmentId={-round.id} interaction={{ type: "NUMBER", inputMode: "decimal", step: "any", unit: round.unit }} value={{ antwortText: answer, antwortId: null, antwortfelder: {} }} disabled={pending || round.state !== "OPEN"} now={0} onChange={draft => { setAnswer(draft.antwortText ?? ""); localEdit.current = true; }} />
        <button type="button" disabled={pending || round.state !== "OPEN" || !answer.trim()} onClick={() => void mutate(() => submitEstimationTiebreak({ quizId, token, roundId: round.id, answerText: answer, expectedRevision: round.ownAnswer?.revision ?? 0 }))} className="mt-3 min-h-11 rounded-xl bg-slate-950 px-4 py-2 text-white">Schätzung verbindlich abgeben</button>
        {round.ownAnswer && <p role="status">Gespeichert: {round.ownAnswer.value} {round.unit}</p>}
      </>}
    </>}
    {moderator && <div className="mt-3 flex flex-wrap gap-2">
      <button type="button" disabled={pending || !view?.unresolved || round?.state === "OPEN"} onClick={() => void mutate(() => startEstimationTiebreak(quizId))} className="min-h-11 rounded-xl bg-slate-950 px-4 py-2 text-white">{round ? "Weitere Schätzrunde" : "Stichentscheid starten"}</button>
      {round?.state === "OPEN" && <button type="button" disabled={pending} onClick={() => void mutate(() => revealEstimationTiebreak(quizId, round.id))} className="min-h-11 rounded-xl border border-slate-500 px-4 py-2">Antwortphase schließen und auflösen</button>}
      {round?.state === "REVEALED" && <button type="button" disabled={pending} onClick={() => void mutate(() => hideEstimationTiebreak(quizId))} className="min-h-11 rounded-xl border border-slate-500 px-4 py-2">Zurück zum Endstand</button>}
    </div>}
  </section>;
}
