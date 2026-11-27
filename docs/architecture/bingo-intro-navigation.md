# Bingo: Einfügungen, Rundenwahl und schnelle Moderation

Stand: 27.11.2026. Ergänzt `bingo-evening-dramaturgy.md`; Quiz-Lifecycle,
Antwortbewertung, AP3 und Druckstände bleiben getrennt und unverändert.

## Zweck und Oberflächen

Die Vorbereitung zeigt vor Runde 1 eine kompakte Folienkonfiguration und nach
jeder Runde eine eigene Einfügung. Erst „Konfigurieren“ öffnet die Felder.
Die Auswahl einer einzelnen Slide zeigt deren Inhalt und Medienfelder. Wie im
Quiz bleiben Aktivierung, ausdrückliches Speichern und Abbrechen getrennt.
Wartebild/-video, Countdown/Startzeit, Begrüßung, Preise, Regeln,
Bekanntmachungen/-musik, Frageneinreichung, Kalender, Buchung und Abschlussziehung
verwenden den bestehenden Veranstaltungsrenderer. Die produktgebundenen
Quiz-Actions und Quiz-Runtime werden nicht in eine Universalengine extrahiert.
Formatneutrale Folientypen und Renderer bleiben in `rendering/ceremony`.

`CeremonyEditor` verwaltet jeweils nur einen lokalen Konfigurationsentwurf.
`PreparationPanel` verteilt erfolgreich gespeicherte Revisionen an saubere
Editoren. Bereits veränderte andere Entwürfe werden nicht überschrieben; ihre
alte Revision führt gegebenenfalls zum sichtbaren CAS-Konflikt statt Datenverlust.
Alle Rundeneinfügungen sind über stabile Runden-UUIDs zugeordnet, nicht über
Listenindizes. Umsortieren vertauscht deshalb keine Folieninhalte.

## Persistenz und Eingaben

Die vorhandene `game_ceremonies.state.config` erhält optional
`insertions: Record<roundUuid, CeremonyConfig>`. Jede Einfügung besitzt eine
vollständige unabhängige Konfiguration; verschachtelte Einfügungen werden
abgewiesen. Ohne gespeicherte Einfügung wird nur lokal ein neuer Standardentwurf
angezeigt. Bestehende Datensätze werden weder migriert noch zurückgeschrieben.
`state.placement` wählt optional eine gespeicherte Rundeneinfügung; ohne Wert ist
der Rahmen vor Runde 1 ausgewählt. Öffentlich wird ausschließlich die ausgewählte
Konfiguration projiziert. Folien-, Reveal- und Musikbefehle behalten CAS,
Rechteprüfung und ihre bisherigen bewussten Aktionen. Abschlussziehung bleibt
bis zum beendeten Event gesperrt und verwendet unverändert gültige Lose.

Rundenabschluss öffnet die erste aktivierte normale Slide der zugehörigen
gespeicherten Einfügung. Weitere Slides sind mit Vor/Zurück bzw. der expliziten
Auswahl erreichbar. Eine Foliennavigation startet keine Runde und erzeugt keine
Ziehung. Ein Rundenwechsel verlässt die Folie und stoppt ihren Medienkontext.
Die nächste Runde wird ausdrücklich gewählt; eine bestehende manuelle Pause
bleibt bestehen und muss ausdrücklich aufgehoben werden.

## Rundensortierung und Löschung

`SortableRounds` verwendet wie die Quizblöcke das bereits installierte dnd-kit,
mit eigener Griffaktion, Pointer-Schwelle und Tastaturkoordinaten. Die bestehende
Auf-/Ab-Aktion bleibt verfügbar. Der neue `reorderRounds`-Befehl akzeptiert nur
die vollständige eindeutige ID-Menge des Events, prüft Rechte und Revision und
schreibt die Reihenfolge atomar über temporäre Positionen. Laufende/pausierte
Events werden nicht umsortiert. Der Durchlauf übernimmt weiterhin beim Start
den bestehenden eingefrorenen Rundenplan; Moderation und Publikum lesen ihn.

Entfernen verwendet weiterhin die ausdrückliche Bestätigung und den bestehenden
serverseitigen Löschschutz: keine gestarteten, referenzierten oder mit Karten,
Ausgabeangaben bzw. Historie versehenen Runden löschen. Der Auftrag hebt diesen
Datenerhalt nicht auf. Karten müssen gegebenenfalls zuerst über die vorhandenen
zulässigen Vorbereitungsaktionen behandelt werden; keine automatische Entkopplung
oder Löschung von Decks. Historische Einfügungskonfiguration wird nicht als
Seiteneffekt eines Rundenlöschens bereinigt.

## V2-Rundennavigation

`navigateRound` ist ein neuer unveränderlicher V2-Journalbefehl mit Ziel-ID und
Vorbereitungsrevision. Der Writer erlaubt ausschließlich benachbarte Runden
des gespeicherten Durchlaufplans. Eine erstmals besuchte Runde friert ihre echten
Decks wie bisher ein. Ein Wiederbesuch verwendet dieselben Snapshots und Karten.
`selectedRoundId` wird ausschließlich aus dem Journal rekonstruiert.

Bewusste Erweiterung des bisherigen V2-Vertrags: Mehrere besuchte, noch nicht
abgeschlossene Runden dürfen `OPEN` bleiben. Nur die ausgewählte Runde ist der
Schreib-/Publikums-/Kartenprüfkontext. Ein Wechsel schließt die alte Runde nicht,
ergänzt keine Ziehungen, ändert keine Grenzen, Entscheidungen oder Punkte und
schreibt keine historischen Journalereignisse um. Offene Runden können weiter
bearbeitet werden; `CLOSED` bleibt auch bei Rücknavigation schreibgeschützt.
Der AP1/AP3-Vertrag für das erstmalige Öffnen einer Runde bleibt unverändert.
Eventabschluss prüft nötige direkte Karten-Nachprüfungen aller besuchten Runden.
Zeitaggregation zählt je Runde nur die ausgewählten Abschnitte der aktiven
Durchlaufzeit; Wiederbesuche zählen keine früheren Intervalle doppelt.

Vor Verlassen einer offenen Runde unter ihrem Ziehungsziel nennt der Dialog
Runde, Ist/Soll und Ziel. Abbrechen schreibt nichts; „Wechsel fortsetzen“ sendet
den einmaligen revisionierten Befehl. Bei erreichtem Ziel oder geschlossener
Runde entfällt die zusätzliche Warnung. Eine neue Zahl invalidiert wie bisher
den Kartenprüfkontext. Auch Wechsel hinweg und zurück erzeugen keinen alten
wiederverwendbaren Kontext.

## Eingaben und Darstellung

Enter im Zahlenfeld löst das Formular direkt aus; wiederholte gehaltene
Enter-Ereignisse werden abgefangen. Der vorhandene synchrone Inflight-Schutz,
Request-ID und serverseitige Dublettenschutz bleiben maßgeblich. Nach bestätigter
Veröffentlichung wird die Eingabe geleert und erneut fokussiert. `+` und
`NumpadAdd` fokussieren ausschließlich während des Mounts der V2-Moderation die
Zahleneingabe; kein Shortcut veröffentlicht selbst. Der sichtbare Textbutton
bleibt. Zahleneingabe und Kartenkennung besitzen größere Schrift/Eingabeflächen.
Die fachliche Kartenprüfung und ihre bewussten Ergebnisaktionen bleiben erhalten.

Aktive Decks zeigen gespeicherte Serienkennung, tatsächlich eingefrorene Anzahl
und Anfang/Ende der echten Kurzkennungen, aus Serienpräfix und Kartenordinalen.
Alle Decks einer Runde bleiben gleichzeitig sichtbar. Rundenwahl und Deckanzeige
verwenden dieselbe ausgewählte Runden-ID.

Die Präsentation behält die zehn Rundenfarben, leitet ungezogene Zellen aber als
dunklere Nuance dieser Farbe ab. Gezogen und aktuell bleiben zusätzlich über
Kontur und Inversion unterscheidbar. Logos stehen unverändert und transparent
ohne schwarze Plakette. „Aktuelle Zahl“ steht direkt über der vergrößerten Zahl;
der bestehende DOM-Fitter berücksichtigt Schriftladen und Resize. Die Fußzeile
zeigt maximal zehn letzte Ziehungen, neueste zuerst, ohne Scrollbereich und ohne
den bisherigen allgemeinen Moderatorprüfhinweis. Konkrete Gewinnprüfungen werden
weiterhin in der Moderation bearbeitet, nicht automatisch entschieden.

Die dokumentierte Abweichung von der neutralen Manifest-Bühne bleibt bewusst:
Eine einzige Rundenfarbfamilie dient der Orientierung; keine konkurrierenden
Akzentwelten oder pauschale schwarze Ersatzfläche. Druckfarben und Originalassets
werden nicht verändert.

## Migration, Rückweg und Regressionen

Keine Schema-Migration, kein Backfill, keine neue Abhängigkeit. Alte Konfiguration
und alte Journale bleiben lesbar. Alte Codeversionen kennen `navigateRound`,
`placement` und `insertions` jedoch nicht: Nach solchen neuen Schreibvorgängen
ist ein blindes Code-Rollback nicht zulässig; ein kompatibler Reader wäre vorab
separat zu prüfen. Es erfolgt keine Journalreparatur oder automatische Rückmigration.

- `eventRun.test.ts`: unvollständige Hin-/Rücknavigation, unveränderte Ziehungen,
  geschlossene Runde schreibgeschützt, neue Kontexte, Parser/Envelope.
- `ceremonyInsertions.test.ts`: unabhängige JSON-Persistenz, Defaults und
  abgewiesene ungültige/verschachtelte Einfügungen.
- `bingo-preparation.integration.test.ts` / `bingo-evening.acceptance.ts`:
  echte atomare Sortierung, CAS/Rechte, eingefrorene Karten, Journal-Readback,
  Rundennummer und Einfügungsinhalt im öffentlichen Read Model.
- `bingo-evening.browser.test.ts`: größere Eingaben, echtes Enter, Plus/Fokus
  und Cleanup, Warnung/Abbrechen/Fortsetzen, Deckwechsel mit echten Fixturecodes,
  unabhängige Folienbearbeitung und Tastatur-Drag-&-Drop, zehn Farben und Historie.
- Bestehende Bingo-, Board-, Matching-, Kartenprüf-, Preis- und Druckregressionen.

Tatsächlich ausgeführte Prüfungen und reale Geräte-/Deploymentgrenzen stehen im
[Abnahmebericht](../acceptance/bingo-intro-2026-11-27.md).
