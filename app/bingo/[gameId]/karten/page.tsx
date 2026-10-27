import Link from "next/link";
import { notFound } from "next/navigation";
import AppHeader from "@/app/components/AppHeader";
import { requireActor } from "@/app/lib/permissions";
import { BingoPreparationError, cardSearch, pageNumber } from "../../preparation/policy";
import { readCards, readPreparation } from "../../preparation/readPreparation.server";
import { Button, Input } from "@/components/ui";
export default async function Page({ params, searchParams }: { params: Promise<{ gameId: string }>; searchParams: Promise<{ series?: string; seriesPage?: string; page?: string; search?: string }> }) {
  const { actor } = await requireActor(), { gameId } = await params, q = await searchParams;
  const { prep, selected, page, search, data } = await (async () => {
   try {
    const prep = await readPreparation(actor.userId, gameId, 1, pageNumber(q.seriesPage));
    const selected = q.series ?? prep.available[0]?.id, page = pageNumber(q.page), search = cardSearch(q.search);
    const data = selected ? await readCards(actor.userId, gameId, selected, page, search) : null;
    return { prep, selected, page, search, data };
   } catch (error) { if (error instanceof BingoPreparationError) notFound(); throw error; }
  })();
    const href = (p: number) => `?series=${selected}&page=${p}&search=${encodeURIComponent(search)}`;
    return <><AppHeader /><main className="mx-auto w-full max-w-5xl space-y-5 px-4 py-8"><h1>{prep.title}: Karten und PDF</h1><Link className="inline-flex min-h-11 items-center underline" href={`/bingo/${gameId}/vorbereitung`}>Zu den Runden</Link>
      <p className="text-sm">Vorbereitung · Karten und Druckdesign bleiben nach der Erzeugung unverändert. Downloads verändern die ausgegebene Gesamtmenge nicht.</p>
      {!prep.seriesCount && <p>Noch keine Karten vorhanden. Erzeuge zuerst eine Kartenserie in einer Runde.</p>}
      <nav aria-label="Kartenserien" className="flex flex-wrap gap-3">{prep.available.map(s => <Link key={s.id} aria-current={selected === s.id ? "page" : undefined} className="min-h-11 max-w-full break-all rounded-lg border p-3 underline" href={`?series=${s.id}&seriesPage=${prep.seriesPage}`}>{s.code} · {s.count} · {s.designName}{s.olderDesign ? " · älteres Design" : ""}</Link>)}</nav>
      <nav className="flex gap-4">{prep.seriesPage > 1 && <Link href={`?seriesPage=${prep.seriesPage - 1}`}>Vorherige Serien</Link>}{prep.seriesPage * 25 < prep.seriesCount && <Link href={`?seriesPage=${prep.seriesPage + 1}`}>Weitere Serien</Link>}</nav>
      {data && <><h2 className="break-all">{data.code} · {data.total} Karten</h2><p className="text-xs">Druckschriften: {data.snapshot.display.name}; Zahlen: {data.snapshot.body.name}.</p>
        <div className="flex flex-wrap gap-3">{Array.from({ length: Math.ceil(data.total / 200) }, (_, i) => { const from = i * 200 + 1, to = Math.min((i + 1) * 200, data.total); return <a key={from} download className="inline-flex min-h-11 items-center rounded-lg border px-3 underline" href={`/bingo/${gameId}/karten/${selected}/pdf?from=${from}&to=${to}`}>PDF herunterladen · Karten {from}–{to}</a>; })}</div>
        <form action={`/bingo/${gameId}/karten/${selected}/pdf`} className="flex flex-wrap items-end gap-3"><label>Von Karte<Input name="from" type="number" min={1} max={data.total} defaultValue={1} required /></label><label>Bis Karte<Input name="to" type="number" min={1} max={data.total} defaultValue={Math.min(data.total, 200)} required /></label><Button type="submit">Bereich als PDF</Button><p className="w-full text-xs">Höchstens 200 Karten je PDF.</p></form>
        <form className="flex flex-wrap items-end gap-3"><input name="series" type="hidden" value={selected} /><label htmlFor="card-search">Kartenkennung suchen<Input id="card-search" name="search" maxLength={64} defaultValue={search} /></label><Button type="submit">Suchen</Button></form>
        <p>{data.count} passende Karten</p><div className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3">{data.cards.map(c => <section key={c.id} className="min-w-0 rounded-lg border bg-white p-3"><h3 className="mb-3 break-all text-sm">{c.code}</h3><table className="w-full table-fixed text-center"><caption className="sr-only">Gespeicherte Karte {c.code}</caption><thead><tr>{[..."BINGO"].map(l => <th key={l} className="border p-1">{l}</th>)}</tr></thead><tbody>{c.cells.map((row, i) => <tr key={i}>{row.map((v, j) => <td key={j} className="border py-2 text-sm">{v ?? "FREI"}</td>)}</tr>)}</tbody></table></section>)}</div>
        <nav aria-label="Kartenseiten" className="flex gap-4">{page > 1 && <Link href={href(page - 1)}>Vorherige Karten</Link>}{page * 50 < data.count && <Link href={href(page + 1)}>Weitere Karten</Link>}</nav></>}
    </main></>;
}
