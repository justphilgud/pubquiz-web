import {shortCardCode} from '../preparation/bingoPrint';
import Link from 'next/link';
import type {EventModerationView} from './eventRepository.server';
import styles from './EventModerationPanel.module.css';

/** Frozen round membership wins over later preparation edits. No deck selection is invented. */
export default function RoundDecks({data}:{data:EventModerationView}) {
  const live=data.live;
  const current=live?.round.id;
  const rows=live?data.plan.map(p=>({id:p.round_id,position:p.position})):data.rounds;
  function renderRows(selected:typeof rows) {
    return <ol className={styles.deckList}>{selected.map(row=>{
      const round=data.rounds.find(r=>r.id===row.id),frozen=live?.state.frozen.find(r=>r.id===row.id);
      const active=current===row.id&&live?.state.run.status!=='ENDED'&&!live?.between;
      const decks=frozen?data.frozenDecks.filter(d=>d.roundId===row.id):round?.series.map(s=>({id:s.series_id,code:s.series.code,count:s.series.card_count,firstOrdinal:undefined,lastOrdinal:undefined,prefix:undefined}))??[];
      return <li key={row.id} data-active={active||undefined}><strong>{frozen?.label??round?.label??`Runde ${row.position}`}</strong><span>{active?'Aktive Decks':frozen?'Eingefrorene Decks':'Geplante Decks'}</span>
        {decks.length?<ul>{decks.map(deck=><li key={deck.id}><Link href={`/bingo/${data.gameId}/karten?series=${deck.id}`}>{deck.code}</Link> · {deck.count} Karten{deck.prefix!==undefined&&deck.firstOrdinal!==undefined&&deck.lastOrdinal!==undefined&&<span>Karten: {shortCardCode(deck.prefix,deck.firstOrdinal)}–{shortCardCode(deck.prefix,deck.lastOrdinal)}</span>}</li>)}</ul>:<p>Keine Decks zugeordnet.</p>}
      </li>;
    })}</ol>;
  }
  return <section className={`${styles.panel} ${styles.deckPanel}`} aria-label="Kartendecks je Runde"><h2>Kartendecks je Runde</h2>
    {renderRows(current?rows.filter(r=>r.id===current):rows)}
    {current&&rows.some(r=>r.id!==current)&&<details><summary>Weitere Runden und Decks</summary>{renderRows(rows.filter(r=>r.id!==current))}</details>}
  </section>;
}
