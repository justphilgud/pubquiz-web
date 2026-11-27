import type {EventRunState} from './eventRun';
import type {BingoRound} from '../core/round';
import type {StoredCard} from '../preparation/policy';
/** Historical journal projection only. No forms, actions or automatic decisions. */
export default function HistoricalCalls({state,round,cards,events}:{state:EventRunState;round:BingoRound;cards:readonly StoredCard[];events:readonly {id:string;actorId:number;at:number}[]}) {
  const calls=state.calls.filter(c=>c.roundId===round.id&&!state.checks?.some(check=>check.id===c.id));
  if(!calls.length)return null;
  const audit=(id:string)=>{const event=events.find(e=>e.id===id);return event?`Person #${event.actorId} · ${new Date(event.at).toLocaleString('de-DE')}`:'Journalnachweis nicht geladen';};
  return <details><summary>Historische manuelle Rufe (nur Lesen) · {calls.length}</summary>
    <p>Diese Alt-Rufe sperren weder Kartenprüfung noch Runden- oder Eventabschluss.</p>
    <ol>{calls.map(call=>{const claim=round.claims.find(c=>c.id===call.id),card=cards.find(c=>c.id===call.cardId);
      return <li key={call.id}><strong>{call.stage} · Ziehung {call.throughPosition} · {card?.shortCode??card?.code??'Keine Karte zugeordnet'}</strong>
        <p>{audit(call.id)} · {claim?.needsReview?'Historische Nachprüfung offen':claim?.decisions.at(-1)?.action??'Historisch offen'}</p>
        {claim?.decisions.map(decision=><p key={decision.id}>{decision.action} · {decision.reason} · {audit(decision.id)}</p>)}
      </li>;
    })}</ol>
  </details>;
}
