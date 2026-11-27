# Bingo: Intro, Rundenblock, Outro und schnelle Moderation

Aktuelle Ergänzung: [Rundenfarben, Zahlenbühne und Folienpflege](bingo-presentation-colors.md)
ersetzt die nachfolgenden historischen Angaben zu zehn Farben, dunkleren
ungezogenen Zellen, zweispaltiger Historie und Inline-Konfiguration ausdrücklich.

Stand: 27.11.2026. Ergänzt `bingo-evening-dramaturgy.md`; Quiz-Lifecycle,
Antwortbewertung, AP3 und Druckstände bleiben getrennt und unverändert.

## Zweck und Oberflächen

Die Vorbereitung zeigt ein kompaktes Intro vor allen Runden und ein unabhängiges
Outro nach dem gesamten Rundenblock. Dies ersetzt bewusst die frühere Anordnung
von Einfügungen nach jeder Runde. Erst „Konfigurieren“ öffnet die Felder.
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
Intro und Outro verwenden getrennte Entwürfe. Umsortieren verändert keine Folieninhalte.
Frühere Rundeneinfügungen bleiben unter ihren stabilen UUIDs als Altdaten lesbar;
die neue Oberfläche erzeugt oder verändert sie nicht.

## Persistenz und Eingaben

Die vorhandene `game_ceremonies.state.config` erhält optional `outro: CeremonyConfig`.
Intro bleibt im bisherigen Wurzelobjekt; das Outro besitzt eine unabhängige Kopie
mit eigener Aktivierung und eigenen Text-/Medienfeldern. Ohne gespeichertes Outro
liest ein reiner Adapter die bisherigen OUTRO-Folien der Wurzel; kein Backfill.
Verschachtelte Outros oder Einfügungen innerhalb eines Outros werden abgewiesen.
Alte `insertions: Record<roundUuid, CeremonyConfig>` bleiben unverändert lesbar.
`state.placement="outro"` wählt das Outro; ohne Wert wird das Intro ausgewählt.
Öffentlich wird nur die aktive Konfiguration projiziert. Die Oberfläche bietet
historische Rundeneinfügungen nur lesend an; der kompatible Reader bleibt erhalten.
CAS, Rechte und explizite Reveal-/Medienaktionen gelten weiter.

Die Folienauswahl und Vor/Zurück bleiben innerhalb des jeweiligen Abschnitts.
Der Server sperrt sämtliche OUTRO-Folien bis alle Runden im eingefrorenen Plan
abgeschlossen sind oder das Event ausdrücklich beendet wurde. Der letzte
Rundenabschluss öffnet die erste aktive normale Outro-Folie, frühere Abschlüsse
zeigen das Board. Abschlussverlosung bleibt zusätzlich bis zum Eventende gesperrt.
Ein explizites Eventende darf auch einen unvollständigen Abend beenden; es ergänzt
keine Ziehungen. Intro/Runden/Outro starten weder durch Countdown noch Folienwechsel
automatisch. Rundenwahl bleibt bewusst, ihr Wechsel stoppt den alten Medienkontext.
Eine bestehende manuelle Pause muss ausdrücklich aufgehoben werden.

## Rundensortierung und Löschung

`SortableRounds` verwendet wie die Quizblöcke das bereits installierte dnd-kit,
mit eigener Griffaktion, Pointer-Schwelle und Tastaturkoordinaten. Bearbeiten und Löschen verwenden die gemeinsamen `IconButton`-Komponenten mit
Tooltip und barrierefreiem Namen; die bestehende Auf-/Ab-Aktion bleibt verfügbar. Der neue `reorderRounds`-Befehl akzeptiert nur
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
Enter-Ereignisse werden abgefangen. Bewusste V2-Erweiterung der früheren
APPROVAL-Bedienregel: Der ausdrückliche Enter-/Iconbutton-Submit ist selbst die
Moderationsfreigabe; kein zusätzlicher Dialog verzögert diese Veröffentlichung.
Die vorbereitete Veröffentlichungsvorschau und DIRECT/HIDDEN-Projektion bleiben;
AP3 behält seinen bisherigen zusätzlichen APPROVAL-Dialog. Der vorhandene synchrone Inflight-Schutz,
Request-ID und serverseitige Dublettenschutz bleiben maßgeblich. Nach bestätigter
Veröffentlichung wird die Eingabe geleert und erneut fokussiert. `+` und
`NumpadAdd` fokussieren ausschließlich während des Mounts der V2-Moderation die
Zahleneingabe; kein Shortcut veröffentlicht selbst. Der Veröffentlichungsbutton
zeigt ein Weiter-Icon mit Tooltip und barrierefreiem Namen; der Präsentationslink
verwendet denselben Play-Icon-Link wie die Quizübersicht. Zahleneingabe und Kartenkennung besitzen größere Schrift/Eingabeflächen.
Das sichtbare Label „Kartenkennung“ entfällt, sein zugänglicher Name bleibt.
Die linke Arbeitsfläche hat Vorrang, die Sidebar ist auf 300 px begrenzt.
Die kompakte Ziehungshistorie bricht in Zeilen um, ohne eigenen Scrollbereich
oder Stiftglyphen. Die Sortierauswahl bleibt beschriftet und bedienbar.
Die fachliche Kartenprüfung und ihre bewussten Ergebnisaktionen bleiben erhalten.

Aktive Decks zeigen gespeicherte Serienkennung, tatsächlich eingefrorene Anzahl
und Anfang/Ende der echten Kurzkennungen, aus Serienpräfix und Kartenordinalen.
Alle Decks einer Runde bleiben gleichzeitig sichtbar. Rundenwahl und Deckanzeige
verwenden dieselbe ausgewählte Runden-ID.

Die Präsentation behält die zehn Rundenfarben, leitet ungezogene Zellen aber als
dunklere Nuance dieser Farbe ab. Gezogen und aktuell bleiben zusätzlich über
Kontur und Inversion unterscheidbar. Logos stehen unverändert und transparent
ohne schwarze Plakette mit einem dünnen × dazwischen. „Aktuelle Zahl“ steht
zentriert direkt über der großen Zahl, ihre Box ist 90 % der unskalierten
Zahlenbreite breit. Der DOM-Fitter berücksichtigt Schriftladen, Resize und
Vollbild; die Einblendanimation verändert die Messgrundlage nicht. Links unter
dem Rundentitel steht ausschließlich der Zähler „10 von 30“. Laufstatus bleibt
für Screenreader zugänglich, ohne doppelten sichtbaren Zähler.
Rechts neben dem Raster steht ein durch eine dünne Linie abgetrennter Bereich
„Letzte 10“: die letzten zehn Ziehungen absteigend, Position · Buchstabe Zahl,
spaltenweise fünf Einträge. Beide Spalten verwenden dieselben fünf Zeilenhöhen
und Abstände wie das Zahlenraster. Leere/kurze Historien verändern die Geometrie
nicht. Kein interner Scrollbereich, keine alte Fußzeile und kein allgemeiner
Moderatorprüfhinweis. Konkrete öffentliche Gewinnrückmeldungen bleiben in der Kopfstatuszeile sichtbar. Konkrete Gewinnprüfungen werden
weiterhin in der Moderation bearbeitet, nicht automatisch entschieden.

Die dokumentierte Abweichung von der neutralen Manifest-Bühne bleibt bewusst:
Eine einzige Rundenfarbfamilie dient der Orientierung; keine konkurrierenden
Akzentwelten oder pauschale schwarze Ersatzfläche. Druckfarben und Originalassets
werden nicht verändert.

## Migration, Rückweg und Regressionen

Keine Schema-Migration, kein Backfill, keine neue Abhängigkeit. Alte Konfiguration
und alte Journale bleiben lesbar. Alte Codeversionen kennen `navigateRound`,
`placement`, `insertions` und `outro` jedoch nicht: Nach solchen neuen Schreibvorgängen
ist ein blindes Code-Rollback nicht zulässig; ein kompatibler Reader wäre vorab
separat zu prüfen. Es erfolgt keine Journalreparatur oder automatische Rückmigration.

- `eventRun.test.ts`: unvollständige Hin-/Rücknavigation, unveränderte Ziehungen,
  geschlossene Runde schreibgeschützt, neue Kontexte, Parser/Envelope.
- `ceremonyInsertions.test.ts`: unabhängige JSON-Persistenz, Defaults und
  abgewiesene ungültige/verschachtelte Einfügungen.
- `bingo-preparation.integration.test.ts` / `bingo-evening.acceptance.ts`:
  echte atomare Sortierung, CAS/Rechte, eingefrorene Karten, Journal-Readback,
  Rundennummer, Outro-Sperre, letzte Runde und Outro-Inhalt im öffentlichen Read Model.
- `bingo-evening.browser.test.ts`: größere Eingaben, echtes Enter, Plus/Fokus
  und Cleanup, Warnung/Abbrechen/Fortsetzen, Deckwechsel mit echten Fixturecodes,
  unabhängige Folienbearbeitung und Tastatur-Drag-&-Drop, zehn Farben und Historie.
- Bestehende Bingo-, Board-, Matching-, Kartenprüf-, Preis- und Druckregressionen.

Tatsächlich ausgeführte Prüfungen und reale Geräte-/Deploymentgrenzen stehen im
[Abnahmebericht](../acceptance/bingo-outro-layout-2026-11-27.md).
