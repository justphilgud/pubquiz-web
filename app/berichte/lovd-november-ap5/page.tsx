import AppHeader from "@/app/components/AppHeader";
import { requireAdmin } from "@/app/lib/permissions";
import aggregate from "@/docs/reports/assets/lovd-november-ap5/aggregate.json";
import { analyzeManualReview } from "@/app/quiz/evaluation/manualReviewAnalysis";

export const metadata = { title: "LOVD November · Analyse der Auswertung", robots: { index: false, follow: false } };

export default async function ManualReviewReportPage() {
  await requireAdmin();
  const { questions, totals } = analyzeManualReview(aggregate);
  function table(rows: typeof questions) {
    return <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full min-w-[850px] text-left text-sm">
        <caption className="bg-slate-100 p-3 text-left text-slate-700">Fragenpositionen und Zuweisungen · zwölf Teams</caption>
        <thead className="bg-slate-100"><tr>{["Position / ID", "Vorlage", "Im Filter", "Manuell gespeichert", "Noch offen", "Gleiche Texte", "Ersparnis Freitext"].map(label => <th key={label} scope="col" className="p-3 font-semibold">{label}</th>)}</tr></thead>
        <tbody>{rows.map(q => <tr key={q.id} className="border-t border-slate-200 align-top">
          <th scope="row" className="whitespace-nowrap p-3">{q.position} / #{q.id}</th><td className="p-3">{q.template}</td>
          <td className="p-3">{q.openAnsweredVisible}</td><td className="p-3">{q.manual}</td><td className="p-3">{q.unresolved}</td>
          <td className="p-3">{q.exactGroups.length ? q.exactGroups.join(" + ") : "–"}</td><td className="p-3">{q.freeTextSavings}</td>
        </tr>)}</tbody>
      </table>
    </div>;
  }
  return <><AppHeader /><main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-8">
    <article className="mx-auto max-w-6xl space-y-8">
      <header className="max-w-3xl space-y-3"><p className="text-sm font-semibold uppercase tracking-wide text-emerald-800">LOVD · Analyseauftrag AP 5</p>
        <h1 className="text-3xl font-bold sm:text-4xl">Was hätte die Auswertung vereinfacht?</h1>
        <p className="text-lg leading-relaxed">Knowvember · 18. November 2026 · Quiz 37 · zwölf Teams. Fester Datenstand vom 19. November 2026, keine Live-Auswertung.</p>
      </header>
      <dl className="grid gap-4 sm:grid-cols-3">{[
        [totals.manual, "manuelle Bewertungen gespeichert"], [totals.unresolved, "Prüffall noch offen"], [totals.freeTextSavings, "Einzelentscheidungen konservativ einsparbar"],
      ].map(([number, label]) => <div key={label} className="rounded-xl border border-slate-200 bg-white p-5"><dt className="text-sm text-slate-600">{label}</dt><dd className="mt-2 text-4xl font-bold">{number}</dd></div>)}</dl>
      <section className="max-w-3xl space-y-3"><h2 className="text-2xl font-bold">Sichtbar heißt nicht prüfpflichtig</h2>
        <p className="leading-7">Die Standardansicht zeigt {totals.defaultVisible} Team-Frage-Fälle. „Nur falsche Antworten“ lässt {totals.incorrectVisible} stehen. Mit „Nur offene Fragen“ und ohne unbeantwortete Fälle bleiben {totals.openAnsweredVisible}. Dieser Filter blendet automatisch richtige Antworten aus, aber keine bereits manuell bewerteten Antworten.</p>
        <p className="leading-7">{totals.manualEvidence} Fälle tragen eine manuelle Entscheidung oder offenen Prüfbedarf: {totals.manual} bereits manuell bewertet, {totals.unresolved} noch REVIEW_REQUIRED (Position 13, Zuweisung #431). Keine Basisbewertung steht aus. Unbeantwortete Fälle ({totals.unanswered}) und das Meme-Voting sind getrennt behandelt.</p>
      </section>
      <section className="space-y-4"><h2 className="text-2xl font-bold">Wo manuell entschieden wurde</h2>
        <p className="max-w-3xl leading-7">„Im Filter“: gespielt, offen, nicht automatisch richtig, beantwortet. „Gleiche Texte“ nennt Gruppengrößen bytegleicher vollständiger Textantworten einschließlich strukturierter Feldkombinationen. Länderwerte zählen separat vom Freitextpotenzial.</p>
        {table(questions.filter(q => q.manual || q.unresolved))}
        <details className="rounded-xl border border-slate-200 bg-white p-4"><summary className="cursor-pointer font-semibold">Alle 49 auswertbaren Fragen anzeigen</summary><div className="mt-4">{table(questions)}</div></details>
      </section>
      <section className="max-w-3xl space-y-3"><h2 className="text-2xl font-bold">Sechs Entscheidungen einsparen</h2>
        <p className="leading-7">Bei Position 7 (#469) sind fünf manuell bewertete komplette Antworten identisch: vier Entscheidungen wären einsparbar. Bei Position 20 (#453) und 32 (#480) sind jeweils zwei identisch: je eine weitere. Das sind {totals.freeTextSavings} von {totals.freeTextEvidence} belegten Freitext-Prüffällen, rund 6,8 %. Zwei weitere Einsparungen betreffen Länderauswahlen bei Position 21 (#486), keine freie Texteingabe.</p>
        <p className="leading-7">Über alle 126 sichtbaren Fälle ergeben sich neun theoretisch weniger Prüfungen; acht beruhen auf gespeicherter manueller Entscheidung oder offenem Prüfbedarf, sechs auf Freitext. Für den einen heute noch offenen Prüffall spart Gruppieren keine Entscheidung.</p>
      </section>
      <section className="max-w-3xl space-y-3"><h2 className="text-2xl font-bold">Empfohlener nächster Schritt</h2>
        <p className="leading-7">Zuerst einen Arbeitsvorrat „Noch zu prüfen“ anbieten: offene Prüffälle und ausstehende Bewertungen trennen von bereits entschiedenen Fällen. Danach identische Freitextantworten je Frage als bewusste Gruppenaktion mit Vergleich und Bestätigung anbieten. Vollständig gleiche Antworten haben hier nur begrenztes Potenzial.</p>
        <p className="leading-7">{totals.structuredManual} gespeicherte manuelle Bewertungen entfallen auf Musik und Face-Morph. Als nächste Analyse lohnt sich die Prüfung einzelner Antwortfelder und akzeptierter Schreibvarianten. Deren zusätzliches Einsparpotenzial ist hier nicht gemessen. Keine Sammelbewertung und keine Änderung von Punkten sind Teil dieses Auftrags.</p>
      </section>
      <aside className="max-w-3xl rounded-xl border border-amber-200 bg-amber-50 p-5 leading-7 text-amber-950">Gespeicherte manuelle Bewertungen belegen betroffene Antworten, keine Zahl tatsächlich ausgeführter Klicks. Historische Filterzustände und vollständige Entscheidungsverläufe sind nicht gespeichert. Pixel-, Risiko-, Zahlen- und Länderfälle zählen nicht als allgemeines Freitextpotenzial. Dieser Bericht verändert keine Antworten, Punkte oder Quizstände und lädt keine Produktionsdaten nach.</aside>
    </article>
  </main></>;
}
