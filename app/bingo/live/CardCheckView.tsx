import {termFor,type TermSet} from '../preparation/termSet';
import type { StoredCard } from '../preparation/policy';
import type { CardCheck } from './cardChecks';
import { checkEvaluation, checkResult } from './cardChecks';
import { bingoNumber, BINGO_LETTERS } from './numberDisplay';
import type { Draw } from '../core/round';

export default function CardCheckView({ card, check, correctedDraws }: {card: StoredCard & {terms?:TermSet|null}; check: CardCheck; correctedDraws: readonly Draw[]}) {
  const result = checkResult(check.original), corrected = checkResult(checkEvaluation(check,card,correctedDraws));
  const drawn = new Set(check.draws.map(d=>d.number));
  return <section><h1>Kartenprüfung · {card.shortCode ?? card.code}</h1><p>{card.code}</p><p>{new Date(check.at).toLocaleString('de-DE')} · nach Ziehung {check.throughPosition}</p>
    <h2>{result.label} · {result.lines} Gewinnlinien zum Prüfzeitpunkt</h2>
    <table style={{borderCollapse:'collapse',width:'min(100%,600px)',textAlign:'center',fontSize:28}}><thead><tr>{BINGO_LETTERS.map(l=><th key={l}>{l}</th>)}</tr></thead><tbody>{card.cells.map((row,r)=><tr key={r}>{row.map((n,c)=><td key={c} style={{border:'2px solid #555',padding:14,background:n===null||drawn.has(n)?'#F6C4DC':'#fff',color:'#171717',fontWeight:n===null||drawn.has(n)?800:400}}>{n===null?'Frei':<>{card.terms?termFor(card.terms,n):n}{drawn.has(n)&&<span aria-label="markiert"> ✓</span>}</>}</td>)}</tr>)}</tbody></table>
    <p>Markiert: Freifeld und die zum Prüfzeitpunkt gezogenen Zahlen.</p><p>Gesicherter Ziehungsstand: {check.draws.map(d=>bingoNumber(d.number)).join(' · ')||'Keine Ziehung'}</p>
    <p>Mit späteren Korrekturen an derselben Prüfgrenze: {corrected.label} · {corrected.lines} Linien. Spätere Ziehungen zählen hier nicht. Der ursprüngliche Nachweis bleibt erhalten.</p>
  </section>;
}
