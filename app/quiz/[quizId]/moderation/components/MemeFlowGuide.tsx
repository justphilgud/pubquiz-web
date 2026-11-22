export default function MemeFlowGuide() {
  return <details className="rounded-lg border border-zinc-700 p-3 text-sm text-zinc-200">
    <summary className="cursor-pointer font-semibold">Meme-Ablauf · was passiert beim Weiterklicken?</summary>
    <ol className="mt-2 list-decimal space-y-2 pl-5">
      <li><strong>Antwortphase schließen:</strong> Einreichungen werden beendet und vorhandene Entwürfe finalisiert. Teams können nicht mehr bearbeiten; die Präsentation bleibt bei der Meme-Frage.</li>
      <li><strong>Memes prüfen / vorstellen:</strong> Offene Kandidaten zuerst freigeben oder ausschließen. Solange Entscheidungen offen sind, bleibt Weiter hier. Nach abgeschlossenem Review beginnt die Vorstellung beim ersten freigegebenen Meme.</li>
      <li><strong>Nächstes Meme vorstellen:</strong> Publikum sieht jeweils das nächste freigegebene Meme. Nach dem letzten folgt die Übersicht; Teams stimmen noch nicht ab.</li>
      <li><strong>Übersicht:</strong> Weitere Übersichtsseiten durchklicken. Auf der letzten Seite öffnet „Abstimmung starten“ die Teamabstimmung; eigene Beiträge sind ausgeschlossen.</li>
      <li><strong>Abstimmung schließen:</strong> Keine weiteren Stimmen. Der nächste Klick finalisiert das Meme-Ergebnis; erst danach geht Weiter zur nächsten Quizfolie. Die Auflösung folgt der konfigurierten Quizstrategie und zeigt gegebenenfalls weitere Ergebnisseiten.</li>
    </ol>
    <p className="mt-2">Keine eingereichten oder keine freigegebenen Memes: den leeren Review ausdrücklich abschließen. Weiter überspringt dann nur die zugehörige Meme-Auflösung; es wird kein Abstimmungsergebnis erfunden. Rückwärts-/Seitensteuerung bleibt im Meme-Bereich verfügbar; Schritte werden nicht durch zusätzliche Weiterklicks übersprungen.</p>
  </details>;
}
