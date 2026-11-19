"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { BALANCE_RULES, type BalanceGroup, type BalanceStatus, type QuizBalance } from "../quizBalance";
import { QUIZ_MODES, type QuizMode } from "../quizMode";

const statusNames: Record<BalanceStatus, string> = { RED: "Rot", YELLOW: "Gelb", GREEN: "Grün", NONE: "Nicht bewertet" };
const statusColors: Record<BalanceStatus, string> = { RED: "bg-red-600", YELLOW: "bg-amber-400", GREEN: "bg-emerald-600", NONE: "bg-slate-400" };
const templateNames: Record<BalanceGroup, string> = {
  open: "Standard (offen)", closed: "Standard (geschlossen), Multiple Choice",
  audio: "Musik rückwärts, normale Musik, 8-Bit-Musik, Übersetzt-vorgelesen",
  facts: "Person, Jahr, Land, Freitext", image: "FaceMorph, Pixelbild, Kunstwerk",
  creative: "Anagramm, Meme beschriften, Google-Rezensionen", ordering: "Sortier-/Reihenfolgefragen",
  pairs: "Paare bilden", trueFalse: "Wahr oder Falsch", estimate: "Schätzfrage", poll: "Einfachauswahl, Mehrfachauswahl, Skala",
};

function Status({ value }: { value: BalanceStatus }) {
  if (value === "NONE") return <span className="text-slate-500">Keine Ampel</span>;
  return <span className="inline-flex items-center gap-1.5 whitespace-nowrap"><span aria-hidden="true" className={`inline-block size-2.5 shrink-0 rounded-full ${statusColors[value]}`} />{statusNames[value]}</span>;
}

function percentage(count: number, total: number) { return total ? `${(100 * count / total).toLocaleString("de-DE", { maximumFractionDigits: 1 })} %` : "—"; }

function TemplateRing({ block }: { block: QuizBalance["blocks"][number] }) {
  let cursor = 0;
  const colors = ["#2563eb", "#7c3aed", "#0891b2", "#059669", "#c2410c", "#be185d", "#4f46e5", "#a16207", "#475569", "#9333ea", "#0f766e"];
  const segments = block.groups.map((g, i) => {
    const start = cursor; cursor += block.total ? g.count / block.total * 100 : 0;
    return `${colors[i]} ${start}% ${cursor}%`;
  });
  if (block.unknown) segments.push(`#94a3b8 ${cursor}% 100%`);
  return <div className="flex flex-wrap items-center gap-4">
    <div role="img" aria-label={`Templateverteilung in ${block.title}, ${block.total} Fragen`} className="grid size-28 shrink-0 place-items-center rounded-full" style={{ background: block.total ? `conic-gradient(${segments.join(",")})` : "#e2e8f0" }}><span className="grid size-20 place-items-center rounded-full bg-white text-center text-sm"><span><strong className="block text-xl">{block.total}</strong>Fragen</span></span></div>
    <ul className="grid min-w-0 flex-1 gap-1 text-xs sm:grid-cols-2">{block.groups.map((g, i) => g.count > 0 && <li key={g.id} className="flex items-center gap-2"><span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ backgroundColor: colors[i] }} />{g.label}: {g.count} · {percentage(g.count, block.total)}</li>)}{block.unknown > 0 && <li>Unbekannte Vorlage: {block.unknown}</li>}</ul>
  </div>;
}

function Rules({ mode }: { mode: QuizMode }) {
  return <details className="rounded-xl border border-slate-200 p-3"><summary className="min-h-11 cursor-pointer font-semibold">Verbindliche Ampelregeln und alle Templates</summary><div className="mt-2 overflow-x-auto"><table className="w-full min-w-[580px] text-left text-xs"><caption className="py-2 text-left">Alle Prozentwerte beziehen sich auf die Fragenzahl des jeweiligen Blocks. Die Ampel rechnet mit ungerundeten Anteilen. Modus: {QUIZ_MODES[mode]}. Im Themenquiz werden Sachkategorien neutral angezeigt; nur Templates beeinflussen die Ampel.</caption><thead><tr>{["Gruppe / Templates", "Rot", "Gelb", "Grün"].map(t => <th key={t} className="p-2">{t}</th>)}</tr></thead><tbody>{BALANCE_RULES.map(r => <tr key={r.id} className="border-t"><th scope="row" className="p-2"><span className="block">{r.label}</span><span className="font-normal">{templateNames[r.id]}</span></th><td className="p-2">{r.red}</td><td className="p-2">{r.yellow}</td><td className="p-2">{r.green}</td></tr>)}<tr className="border-t"><th scope="row" className="p-2">Sachkategorien, z. B. Politik, Wirtschaft, Kultur, Film, Geografie (nur abwechslungsreiches Quiz)</th><td className="p-2">&gt;20 %</td><td className="p-2">10–20 %</td><td className="p-2">&gt;0–&lt;10 %</td></tr><tr className="border-t"><th scope="row" className="p-2">Sachkategorien im Themenquiz</th><td colSpan={3} className="p-2">Neutral; keine Bewertung oder Ausgleichsempfehlung</td></tr></tbody></table></div><p className="mt-3 text-xs">Sachkategorien ohne Fragen werden nicht angezeigt. Bei zwei Fragenblöcken muss mindestens einer mindestens drei Audio-Fragen enthalten. Schätzfragen und Umfragen haben keine Ampel. Es genügt ein Template aus einer geforderten Gruppe; nicht jedes einzelne Template muss vorkommen.</p></details>;
}

export default function QuizBalanceSummary({ balance, title = "Fragenmix" }: { balance: QuizBalance; title?: string }) {
  const [open, setOpen] = useState(false);
  return <div className="mt-3 min-w-0">
    <button type="button" onClick={() => setOpen(true)} aria-label={`${title}: Ampeldetails öffnen`} className="inline-flex min-h-11 max-w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs hover:bg-slate-100">
      <span className="font-semibold">{title} · <Status value={balance.status} /></span>
      {balance.blocks.map(b => <span key={b.id}>{b.title}: <Status value={b.status} /></span>)}
      <span>{QUIZ_MODES[balance.mode]}</span><span className="underline">Details</span>
    </button>
    <Modal open={open} title={`${title} · Verteilung je Block`} onClose={() => setOpen(false)} className="[&_[role=dialog]]:max-w-3xl">
      <div className="space-y-5 text-slate-900">
        <p className="rounded-xl bg-slate-50 p-3 text-sm"><strong>{QUIZ_MODES[balance.mode]}</strong> · {balance.mode === "THEMED" ? "Sachkategorien werden wegen des Themenquiz-Modus nicht auf Ausgewogenheit geprüft. Sie beeinflussen weder Gesamtstatus noch Ausgleichsempfehlungen. Template-Ampeln und Template-Empfehlungen bleiben aktiv." : "Sachkategorien und Templates werden je Block nach den bestehenden Ampelregeln bewertet."}</p>
        <p className="text-sm text-slate-600">Jede Frage zählt einmal je Templategruppe und einmal je zugeordneter Sachkategorie. Kategorien können sich überlappen; ihre Anteile müssen zusammen nicht 100 % ergeben.</p>
        {balance.unassigned > 0 && <p className="rounded-xl bg-amber-50 p-3 text-sm">{balance.unassigned} Fragen sind noch keinem Fragenblock zugeordnet und fehlen deshalb in den Blockanteilen.</p>}
        {balance.blocks.length === 0 && <p>Noch keine Fragenblöcke vorhanden.</p>}
        {balance.audioRule && <section className="rounded-xl border border-slate-200 p-3 text-sm"><p><Status value={balance.audioRule.status} /> · {balance.audioRule.label}</p>{balance.audioRule.status === "RED" && <><p className="mt-2">Wähle dafür einen der beiden Blöcke.</p>{balance.audioRule.recommendations.map(r => <a key={r.href + r.label} href={r.href} target="_blank" rel="noopener noreferrer" className="mr-3 inline-flex min-h-11 items-center font-semibold text-emerald-800 underline">{r.label} ↗</a>)}</>}</section>}
        {balance.blocks.map(block => <section key={block.id} className="space-y-3 rounded-xl border border-slate-200 p-3 sm:p-4">
          <h3 className="flex flex-wrap items-center justify-between gap-2 font-semibold"><span>{block.title} · {block.total} Fragen</span><Status value={block.status} /></h3>
          {!block.total ? <p className="text-sm text-slate-600">Noch keine Fragen. Ohne Bezugsgröße werden keine Prozentampeln berechnet.</p> : <>
            <TemplateRing block={block} />
            {block.unknown > 0 && <p className="text-sm text-amber-900">{block.unknown} Fragen verwenden noch nicht zugeordnete Vorlagen. Sie zählen zur Blockgröße, erhalten aber keine erfundene Gruppenzuordnung.</p>}
            <div className="overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">Templategruppen in {block.title}</caption><thead><tr><th className="py-2">Gruppe</th><th className="p-2">Fragen</th><th className="p-2">Ampel</th></tr></thead><tbody>{block.groups.map(g => <tr key={g.id} className="border-t border-slate-100"><th scope="row" className="py-2 font-normal">{g.label}</th><td className="p-2 tabular-nums">{g.count} · {percentage(g.count, block.total)}</td><td className="p-2"><Status value={g.status} /></td></tr>)}</tbody></table></div>
            <h4 className="text-sm font-semibold">Sachkategorien</h4>
            {block.categories.length ? <ul className="space-y-2">{block.categories.map(c => <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 text-sm"><span>{c.name} · {c.count} · {percentage(c.count, block.total)}</span>{balance.mode === "THEMED" ? <span className="text-slate-500">Nicht bewertet</span> : <Status value={c.status} />}</li>)}</ul> : <p className="text-sm text-slate-600">Noch keine Sachkategorien zugeordnet.</p>}
            {block.groups.some(g => g.overrepresented) && <p className="text-sm text-slate-600">Stark vertretene Gruppen durch Fragen aus anderen Gruppen ausgleichen; nicht noch mehr aus derselben Gruppe ergänzen.</p>}
            {block.categories.some(c => c.status === "RED") && <p className="text-sm text-slate-600">Sachkategorien über 20 % durch andere Themen ersetzen oder ausgleichen.</p>}
            {block.recommendations.length > 0 && <div><h4 className="text-sm font-semibold">Passende Fragen suchen</h4><p className="mt-1 text-xs text-slate-600">Öffnet die vorgefilterte Suche in einem neuen Tab. Die Auswahl und Zuordnung bleiben bei dir.</p><ul className="mt-1">{block.recommendations.map(r => <li key={r.href}><a href={r.href} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-sm font-semibold text-emerald-800 underline">{r.label} ↗</a></li>)}</ul></div>}
          </>}
        </section>)}
        <Rules mode={balance.mode} />
      </div>
    </Modal>
  </div>;
}
