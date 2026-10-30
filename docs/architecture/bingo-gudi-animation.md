# Bestätigte Bingo-Ziehungen: Gudi-Animationsvertrag

`BingoBoard` bleibt die tatsächliche Publikumsfläche. Bestehende Reader, Polling-
Revisionen, Live-Assets und eingefrorene Design-Snapshots behalten ihre Autorität.
`AudienceClient` reicht ausschließlich zusätzlich den bestehenden Verbindungsstatus
an das Board. Keine Datenbank, Migration, Server-Action, Befehl oder Spielregel ändert sich.

`BingoDrawVisual` ist eine rein visuelle Grenze um die bisherige aktuelle Zahl.
Die statische Zahl bleibt unabhängig vom lazy geladenen Szenenmodul verfügbar.
Die alte pauschale CSS-Einblendung jeder keyed Zahl entfällt; Ereignisse steuern jetzt
die begrenzte Inszenierung. Die Zahl hat eine stabile React-Identität, die Szene eine
separate Ereignis-ID. Identische Geschwisterkeys sind ausgeschlossen.

## Beobachtungsvertrag

Die reine Funktion `newlyConfirmedDraw` vergleicht den zuletzt beobachteten Snapshot
mit dem neu bestätigten Snapshot. Sie verwendet bestehende Run-ID, Startzeit,
Revision sowie Ziehungs-ID, Position und Zahl. Keine Browseruhr wird fachliche Zeit.

- Erstes Öffnen/Hydrieren/Reload etabliert eine ruhige Basis, auch bei vorhandenen Zahlen.
- Nur bei durchgehend beobachteter Verbindung und höherer Revision wird ein echter
  Append betrachtet. Bestehende IDs, Positionen und Zahlen müssen als Präfix identisch bleiben.
- Nur der neueste zusätzliche Eintrag wird dargestellt; es gibt keine Warteschlange.
- Gleiche/ältere Revision, Rufentscheidung ohne Append, Korrektur, Run-/Rundenwechsel
  sowie Wiederverbindung etablieren eine ruhige Basis. Historische Animationen werden
  nicht nachgeholt. Eine zusammen beobachtete Korrektur plus Append wird vorsichtshalber ruhig übernommen.
- Ein während einer Pause noch beobachteter Snapshot darf nach bestätigtem Fortsetzen
  einen neuen Append enthalten; dieser ist neu. Der Zielzustand muss RUNNING sein.
- Bei Pause, Abschluss, Trennung, Korrektur der aktuellen Zahl oder Sichtbarkeitsverlust
  wird eine alte Szene entfernt. Eine alte Zahl bleibt niemals als Animation darüber stehen.

Die Beobachtung kann bewusst nicht beweisen, welche Zwischenereignisse zwischen
Pollantworten fehlten. In Zweifelsfällen hat der aktuelle ruhige Spielstand Vorrang
vor einer möglicherweise historischen Animation. Der Vertrag ergänzt keine zweite
fachliche Ereignishistorie und benötigt keine neuen API-Daten.

## Darstellung und Ausfallsicherheit

Ganze Zahlenübersicht, Kopf und Fuß bleiben an ihren vorhandenen Positionen. Die
Animationsspur nutzt nur den bestehenden aktuellen Zahlenbereich, einschließlich
seines freien Randes, und darf nicht in das Board ragen. Styles sind CSS-Module,
keine globalen Quiz-/Templateänderungen. Die Originalschriften und geprüften Logos
kommen weiterhin aus dem bestehenden eingefrorenen Design-/Assetvertrag.

Die gemeinsame Vektor-Requisitenbibliothek und die 75 Bewegungsscores werden erst
beim tatsächlichen Bedarf als separater Codechunk geladen. Keine 75 Videos, PNG-Sequenzen,
externen Anbieter oder gleichzeitigen Medien-Downloads im Präsentationsstart.
Bei ausbleibendem Chunk zeigt die Suspense-/Fehlergrenze weiter die bestätigte Zahl.
Nach mehr als 750 ms verzögert eintreffender Code startet keine historische Szene mehr.
Die Zeitgrenze ist ausschließlich visuell; sie ändert keine fachliche Serverzeit.
Fehler beim Zeichnen stellen die Zahl wieder her; RAF und CSS-Überblendung werden aufgeräumt.
Keine Audioelemente. `prefers-reduced-motion` zeigt die ruhige Zahl; die Galerie kann
reduzierte Bewegung zusätzlich einschalten, aber eine Systempräferenz nicht ausschalten.

Pro sichtbarer Szene existiert höchstens ein RAF, kein Polling/Spielbefehl. Unmount,
neuer aktueller Eintrag und Ende räumen Ressourcen auf. Keine Animation-Ende-Action,
kein Speichern und keine automatische Gewinn-/Runden-/Evententscheidung.

## Synthetische Abnahme

Authentifizierte interne Galerie: `/templates/bingo-animations`. Sie erstellt keine
Spielinstanz und verwendet weder Datenbankinhalte noch eine echte Live-Session.
Auswahl, Vorherige/Nächste/Wiederholen, Gesamtdurchlauf/sofortiger Stopp, zwei Marken,
reduzierte Bewegung sowie neue/doppelte/neu geöffnete/wiederverbundene/korrigierte
Beobachtungen sind lokal. Ein nicht sichtbarer Galerietab stoppt den Gesamtdurchlauf.
Eine normale Moderation erhält keine dieser Testaktionen.

`npm run test:gudi` ist in die bestehende Nachtestsuite integriert. Tests prüfen 75
unabhängige Scores, kanonische Zuordnung/Abschlüsse, Bestätigungsidentität, die echte
SVG-/Boardgeometrie, Originalschriften, mehrere Größen/Marken, schnellen Wechsel,
Pause, Reload, reduzierte Bewegung, fehlende und verzögerte Chunks sowie Ressourcen.
Die unveränderten bisherigen Boardtests bleiben maßgeblich für die Bestandsgeometrie.

Siehe [Figurenmodell und Stil](../design/gudi-bingo-animation.md) und
[alle Storyboards](../design/gudi-bingo-storyboards.md). Kein Merge/Deployment freigegeben.

Flug- und Fahrzeugspuren verwenden formtreue kubische Interpolation mit durchgehender Geschwindigkeit und ohne Überschwingen. Fahrerpositionen bei 18/66 leiten sich aus denselben Fahrzeugmarken ab. Antizipation und Schauspiel bleiben gesonderte, bewusst gehaltene Posen.
