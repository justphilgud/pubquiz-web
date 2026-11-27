# Bingoabend: Moderation, Rundendesign und Abschlussverlosung

Aktuelle Ergänzung vom 27.11.2026: [Bingo-Intro und Rundennavigation](bingo-intro-navigation.md)
präzisiert unabhängige Folieneinfügungen, journalisierte Hin-/Rücknavigation,
größere Eingaben und die abgestufte Präsentation. Bei diesen Punkten gilt die
Ergänzung vor den nachfolgenden historischen Bestandsbeschreibungen.

Stand: 26.11.2026. Basis `93f074973c4bf73ed4bf6c489d375682f510ba82`, einschließlich PR180 und PR181. Dieser Vertrag erweitert die bisherigen Bingo-Verträge ausdrücklich für den Auftrag Binglöckchen am 08.12.2026.

## Zuständigkeiten und Zustandsquellen

Der 75er-Regelkern, die zwölf geometrischen Linien, unveränderliche Karten, eingefrorene Rundensnapshots und das revisionsgesicherte Ereignisjournal bleiben maßgeblich. Keine Quizinstanzen für Bingo, kein zweites Ziehungsjournal, keine Änderung an Antworten oder Bewertungen. `EventModerationPanel` behält Polling, CAS, Retries und explizite Bestätigungen. `DrawCorrection` besitzt ausschließlich Sortierung und Korrekturentwurf. `CardChecksPanel` ist der einzige reguläre Kartenprüfarbeitsplatz. `HistoricalCalls` ist ausschließlich eine read-only Journalprojektion, ohne Zuordnung oder Entscheidungsaktionen. `RoundDecks` projiziert aktuelle eingefrorene und weitere geplante Decks mit Kennung, Anzahl und Kartenlink; der Reader zählt tatsächlich eingefrorene Karten je Serie, unabhängig von späteren Vorbereitungsänderungen.

`statistics.ts` berechnet ausschließlich Aggregate für den Moderator. `raffle.ts` rekonstruiert die Losvergabe deterministisch aus bestätigten Journalentscheidungen. `ceremonyRepository.server.ts` hält den frei konfigurierbaren Veranstaltungsrahmen getrennt vom Bingo-Regelkern. Jede Schreibaktion nutzt die vorhandene frische Rollen-/Reihen-/Produkt-/Archivprüfung und dieselbe Reihenfolge der Sperren.

## Moderation und Korrekturen

Zahleneingabe links, unverändert große aktuelle Zahl rechts. Das öffentliche Raster wird in der Moderation durch eine begrenzte, editierbare Historie ersetzt. Standard neueste Ziehung zuerst; alternativ älteste zuerst oder Zahlenwert auf-/absteigend. Sortiert wird eine Kopie; Ziehungs-ID und ursprüngliche Position ändern sich nicht. Korrekturen werden mit einer Speichern-Aktion ohne Begründungsfeld und ohne weiteren Bestätigungsdialog abgeschlossen. V2 schreibt eine tatsächlich leere Begründung (`reason: ""`), keinen erfundenen Text. Die AP1-Funktion verlangt standardmäßig weiterhin eine Begründung; ausschließlich V2 aktiviert die ausdrückliche Option für eine leere Begründung. Alte Zahlen, neue Zahlen, Position, Actor und Zeitpunkt bleiben im unveränderlichen Journal/Audit. Die neue Zahl darf keine Dublette sein.

Korrekturen verändern den effektiven Lauf, Präsentation, Statistik und Prüfungen an ihren ursprünglichen Grenzen. Bestätigungen werden erhalten. Zusätzlich zur bisherigen Gewinnstufenprüfung führt auch der Verlust einer konkret bestätigten Loslinie zu `needsReview`, selbst wenn eine andere Linie dieselbe Gewinnstufe deckt. Nachprüfungen und explizite Widerrufe bleiben auch nach wiederholten Kartenprüfungen über die Auswahl des ursprünglichen Nachweises erreichbar.

**Bewusste Änderung des V3.1-Vertrags:** Offene Rufe und Nachprüfungen sperren keine weiteren Ziehungen. Ausschließlich die manuelle Pause und vorhandene Verbindungs-/Rechte-/CAS-Sperren halten Zahleneingaben an. Kartenprüfungen funktionieren auch während einer manuellen Pause. Rundenabschluss und Eventabschluss erfordern weiterhin die ausdrückliche Klärung von Nachprüfungen direkter Kartenentscheidungen. Historische manuelle Rufe und deren Nachprüfungen sind davon ausgenommen. Es wird keine automatische Entscheidung ergänzt. Neue V2-Schreibbefehle `call`/`identify`/`decide` werden abgewiesen; Parser, Replays und identische technische Retries bereits gespeicherter Ereignisse bleiben kompatibel. AP3 bleibt unverändert. Eine neue direkte Kartenentscheidung wird nicht durch frühere manuelle Bestätigungen als Dublette abgewiesen; alte Claims und Entscheidungen werden dabei vollständig erhalten.

Die echte PostgreSQL-Regression `bingo-event.acceptance.ts` wählt zusätzliche
gültige Ziehungen aus den aktuell ungezogenen Zahlen. Feste Werte wie 73/74 sind
bei zufällig erzeugten Karten keine sichere Fixtureannahme. Eine zusätzliche
ausdrückliche Dublettenprobe muss weiterhin `DUPLICATE_DRAW_NUMBER` liefern und
Revision sowie Ziehungen unverändert lassen. Dies ändert keine Produktionsregel.

Die Kennungsauflösung erkennt fremde/alte Karten weiterhin ohne fremde Metadaten offenzulegen. Neue Prüfungen und Bestätigungen verlangen die tatsächliche Zuordnung zur aktiven Runde. Historische Nachweise aus älteren Implementierungsständen bleiben lesbar. Vier Ergebnisstufen behalten Klartext, Zeichen und semantische Ergebnisfarben.

## Live-Wahrscheinlichkeit

Für jede zugeordnete generierte Karte werden bereits vollständige Linien ermittelt. Für jede verbleibende Zahl wird geprüft, ob mindestens eine zusätzliche Linie entsteht. Die Vereinigung dieser Zahlen wird einmal durch die Anzahl verbleibender Zahlen geteilt. Keine Addition von Kartenwahrscheinlichkeiten. Bereits vollständige Linien zählen nicht erneut; weitere Linien auf derselben Karte bleiben möglich. Ohne verbleibende Zahlen gilt 0 Prozent, ohne Karten ebenfalls. Die Zahl wartender Karten zählt jede Karte höchstens einmal, wenn genau eine weitere Ziehung mindestens eine neue Linie auslösen kann.

Die Grundlage lautet sichtbar „Alle generierten, dieser Runde zugeordneten Karten“. Ein erfasster Ausgabe-Gesamtwert identifiziert keine einzelnen ausgegebenen Karten und wird deshalb nicht zur Auswahl erfundener Karten benutzt. Weder konkrete wartende Karten noch auslösende Zahlen werden ausgegeben. Die Statistik wird ausschließlich in der Moderation berechnet und erreicht kein Audience-Read-Model.

## Rundenfarbe, Schrift und Druck

`roundColors.ts` ist die gemeinsame Quelle von zehn nummerierten Farben. LOVD-Rot `#74291D` ist die erste Farbe. Alle zehn Schrift-/Farbpaare erreichen mindestens 4,5:1. Die Präsentation verwendet die Rundenfarbe als sichtbare Bühne, dunkle ungezogene Zellen, rundenfarbige gezogene Zahlen mit heller Kontur und eine invertierte helle Fläche plus mehrfache Kontur für die aktuelle Zahl. Dies ersetzt bewusst die bisher neutrale Bühne des Designmanifests: Die dominante Farbe dient der Rundenorientierung, nicht gleichzeitiger Dekoration. Gespeicherte Designs und Druckstände werden nicht verändert. Farbe ist nicht das einzige Merkmal: Flächen, Helligkeit, Schrift und zugängliche Zustandsnamen unterscheiden die Zustände.

Die vorhandene Phil-Gud-WOFF-Datei setzt aktuelle Zahl, Zahlenraster, B/I/N/G/O sowie Kopf-, Status- und Fußbeschriftungen. Der gespeicherte Rundenname erscheint genau einmal. Partnerlogos erhalten bei Präsentationsbreiten ab 901 px je 180 × 84 px statt 90 × 42 px und einen reservierten Bereich; schmale Fenster brechen um. Nach einem zu schmalen Fenster wird das wieder sichtbare Board neu gemessen, statt einen ausgeblendeten Bereich als dauerhaft unlesbar zu behandeln. Fonts werden lokal geladen; die bestehende Größenmessung reagiert weiterhin auf Fontladen, Resize und Vollbild. LOVD und Phil Gud stehen gemeinsam in einem reservierten Logo-Bereich. Der Titel erhält einen eigenen, begrenzten Bereich.

Neue Generierungen frieren die Rundennummer, Rundenfarbe und die vorhandenen kontrastreichen Partnerlogos in den jeweiligen Druckstand ein. V3/V4 zeichnen eine explizite Rundennummer zusätzlich zur dauerhaften Kartenkennung. Formatgeometrie, Schriften der Vorderseite, vollständige Kennungen, SRA3-Raster, lange-Kante-Spiegelung, Abenddruck und historische Exporte bleiben im bestehenden Renderer. Bestehende gespeicherte Karten werden nicht umgefärbt. Historische Neugestaltung bleibt eine ausdrückliche separate Druckversion.

**Bewusste neue Produktgrenze:** Neue Abende und zusätzliche Runden sind serverseitig auf zehn begrenzt. Alte gespeicherte Reihen werden nicht gekürzt oder gelöscht. Bei Kartenwiederverwendung bleiben historische Rückseiten unverändert; für einen vollständig farbkonsistent neu gestalteten Abend werden neue Karten je Runde erzeugt. Runden vor dem Druck in die endgültige Reihenfolge bringen. Farben ersetzen nie gedruckte Nummer und Kartenkennung.

## Gemeinsamer Veranstaltungsrahmen

`app/rendering/ceremony` enthält formatneutrale Konfiguration, Folientypen und Preisenthüllung. Bingo verwendet außerdem die bestehende Pubquiz-`BookingSlide`, die gemeinsame Kalender-URL-Funktion und die vorhandene `PodiumCeremony` einschließlich ihrer Animation und reduzierten Bewegung. Pubquiz behält seinen eigenen Live-/Medien-/Navigationsvertrag und seine vorhandenen Intro-/Outro-Konfigurationen. Seine Preisfolie verwendet dieselbe `PrizeReveal`-Komponente.

Bingo konfiguriert Wartebild, absolute Startzeit/Countdown, Begrüßung, Preise, Regeln, Bekanntmachungen, Frage einreichen, Kalender, Buchung und Abschlussverlosung. Jede Folie ist einzeln deaktivierbar. Änderungen bleiben lokale Entwürfe bis zum Speichern. CAS verhindert unbemerkte Überschreibungen. Expliziter Rundenstart schaltet vom Intro zum Spiel. Normale Folienwechsel erzeugen weder Ziehungen noch Laufzeitstarts. Die Countdownanzeige ist lesend und benutzt die konfigurierte absolute Zeit; sie startet das Spiel nicht automatisch.

Optionales stummes Wartevideo sowie Intro- und Outro-Musik verwenden bestehende Medienreferenzen. Musik übernimmt den vorhandenen `SynchronizedMedia`-Player mit gespeicherten Play-/Pause-/Stop-Befehlen; die bestehende bewusste Publikumsaktivierung bei Browser-Autoplay-Sperren bleibt erhalten. Ein Folienwechsel stoppt den alten Medienkontext. Die frühere Pubquiz-Mediensteuerung bleibt unverändert.

Preise werden von der letzten belegten Platzierung zu Platz 1 aufgedeckt, bleiben danach sichtbar und können Leerplätze besitzen. Die gemeinsame Logik unterstützt beliebige Preisanzahlen; Bingo begrenzt die Eingabe auf 20 Plätze. Die bisherige Drei-Platz-Konfiguration im Pubquiz bleibt erhalten. Dessen vorhandener persistierter Reveal-Zähler und NavigationTransition steuern jeden Schritt; beim Wechsel auf die Preisfolie beginnt der Zähler bei 0. Vorschau und Publikum lesen denselben Zähler.

## Lose und physische Abschlussziehung

**Auslegung der vorhandenen drei Gewinnstufen:** Bingo zählt kumulativ eine, Doppel-Bingo zwei und Triple-Bingo drei bestätigte Linien/Lose pro Karte und Runde. Ein späteres Doppel nach einem bestätigten einfachen Bingo ergänzt nur ein Los. Die reine Wahrscheinlichkeit berücksichtigt unabhängig davon alle zwölf gültigen Linien. Die Einführung einer vierten Gewinnstufe ist nicht Teil dieses Auftrags.

Jedes Los bindet stabile Nummer, Runde, Karte und konkrete Linie. Bestätigungen werden in Journalreihenfolge verarbeitet. Wiederholte Prüfung vergibt keine Lose; wiederholte Bestätigung derselben Linie dupliziert keine Lose. Mehrere Nachweise können dasselbe Los stützen. Widerruf oder Korrektur kann ein Los ungültig machen, ohne Nummern zu verschieben oder erneut zu vergeben. Offene Nachprüfung einer direkten Kartenentscheidung sperrt die Abschlussziehung. Historische manuelle Nachprüfungstickets bleiben unverändert ungültig, sperren aber nicht die Auswahl eines anderen gültigen Loses. Die abgeleitete `blocksDraw`-Kennzeichnung ändert weder Ticketnummern noch Entscheidungen; ohne diese V2-Kennzeichnung bleiben die bisherigen strikten Regeln erhalten. Die Moderation sieht gültige Lose, nötigen Kugelbereich, ungültige Nummern, Losliste und die zugehörige Karte/Runde. Auf Kartenkacheln erscheinen die gültigen Lose der Karte.

Der Outro-Baustein läuft bewusst in Schritten: Hauptpreis → Abschlussziehung ankündigen → physische Kugel ziehen → Nummer speichern → Karte aufdecken → vorhandene Siegerehrungsanimation. Die Nummer bleibt bis zum ausdrücklichen Aufdecken im öffentlichen Read Model verborgen. Auswahl ist ausschließlich für den neuesten abgeschlossenen Durchlauf dieses Events zulässig. Eine ungültige, widerrufene oder fehlende Losnummer gewinnt nicht.

Oberhalb von 90 benötigten Kugelnummern warnt die Moderation frühzeitig und der Server sperrt die Ziehung. Es gibt weder Modulo-Verteilung noch Abschneiden oder computergenerierten Ersatzgewinner. Lücken nach Widerruf werden sichtbar benannt; entsprechende Kugeln müssen vor der Ziehung ausgenommen werden. Eine andere Methode bei mehr als 90 Losen benötigt fachliche Abstimmung.

## Persistenz, Migration und Rückweg

`20261126120000_event_ceremony` legt ausschließlich `game_ceremonies` mit UUID-Primärschlüssel, restriktivem Fremdschlüssel auf das Event, geprüftem JSON-Objekt und Zeitstempel an. Kein Daten-UPDATE, keine Datenreparatur, kein Trigger und keine neue ausführbare Datenbankfunktion. Prisma-Schema und Client sind aktualisiert. Ohne Migration liest der neue Reader den Standardrahmen; Schreibversuche werden nicht als Erfolg ausgegeben.

Folienzustand enthält Revision, Konfiguration, aktuelle Folie, Reveal-Schritt und gegebenenfalls Losnummer/Run-ID. Gespeicherte Gewinner benötigen den weiterhin gültigen, aktuellen beendeten Run. Die bestehenden Event-Zeitstempel invalidieren bedingtes Polling auch bei reinen Folienwechseln. Backup-Inventur erfasst die neue Tabelle automatisch; der Zeilenvalidator prüft ihre Konfiguration zusätzlich. Neues Journalformat ist für die Losvergabe nicht nötig: bestehende `check`, `decideCheck`, `decide` und Korrekturen bleiben Quelle.

Rückweg: Die zusätzliche Tabelle kann strukturell bestehen bleiben. Frühere Druckreader verstehen jedoch das neue optionale `roundNumber`-Metadatum nicht; ein Code-Rollback nach Erzeugung neuer Druckstände benötigt einen kompatiblen Reader. Keine automatische Down-Migration und keine Löschung von Konfiguration, Gewinnern oder Karten. Die neue fachliche Entkopplung offener Rufe und die neue Preisenthüllung würden beim Code-Rollback wieder das alte Verhalten erhalten. Die nachfolgende ausdrückliche Benutzerfreigabe gilt ausschließlich für die isolierte Branch-Preview; Einrichtung und Schutzprüfungen sind im Abnahmebericht dokumentiert. Kein Production-Release.

## Prüfungen

- `evening.test.ts`: vier Sortierungen, 0/100 Prozent, überlappende Möglichkeiten, weitere Linien, sechs/zehn × 100 Karten, Kontrast aller zehn Farben, einfache/doppelte/dreifache Lose, Wiederholung, Korrektur/Widerruf, 90/91 Lose, gemeinsame Preisfolge.
- `eventRun.test.ts`, `cardChecks.test.ts`: unveränderte Rufgrenzen, manuelle Pause, Korrekturen und Bestätigungen.
- `bingo-evening.acceptance.ts` im echten PostgreSQL-Gesamtharness: sechs × 100 gespeicherte Karten, zehn Runden und SRA3, falsche Runde, CAS, Rechte, vollständiger Abend/Outro, verborgenes Los vor Reveal, additive Migration/Rollback, alte Karten identisch.
- `bingo-evening.browser.test.ts`: produktive Komponenten mit ausdrücklich synthetischen Action-Grenzen, 1366/1920 px Moderation, alle Sortierungen und Korrektur, offene Rufe, zehn Full-HD-Farben mit echten Fonts/Logos, Musik-Inhalt und Preisenthüllung. Das ist kein vollständiger HTTP-End-to-End-Nachweis.
- Bestehende Pubquiz-Navigation, Intro-/Outro-/Podiums-, Bingo-Matching-, SRA3-, Abenddruck- und Dump-/Restoretests bleiben erforderlich. Tatsächlicher Prüfstand und Grenzen im Abnahmebericht.


## Bedienkorrektur 27.11.2026 – Abnahmevertrag

- Eingabebuchstabe unmittelbar vor dem Zahlenfeld, live aus `parseNumberInput` und `bingoLetter`; ungültig/leer zeigt „–“. Serverseitiger Bereich und Dubletten bleiben maßgeblich.
- Breitere Statistikspalte, kompakter Eingabearbeitsplatz, Historien-Sortierung links. Aktuelle Decks zuerst, weitere Runden aufklappbar; sämtliche eingefrorenen Decks einer Runde sind gleichzeitig aktiv, keine erfundene Einzeldeckwahl.
- Historische manuelle Rufe ausschließlich in der getrennten read-only Historie mit gespeicherten Entscheidungen und Journal-Actor/Zeit. Direkte Kartenprüfung und ihre explizite Gewinnentscheidung bleiben der einzige neue V2-Bedien-/Schreibweg.
- Keine Schema-Migration, kein Daten-UPDATE/Backfill, keine Karten-, Event-, Logo- oder Quizbewertungsänderung. Rechte, CAS, Kontextbindung, technische Retries und AP3-Regressionen bleiben verbindlich.
- Regressionen: 75er-Grenzen/ungültige Texte, leere V2-Begründung bei striktem AP3, historische Rufe und Bestätigungen, nicht blockierender Abschluss, weiterhin blockierende direkte Nachprüfung, unveränderte Journalbytes im echten PostgreSQL-Test, eingefrorene Deckanzahlen, alle zehn Bühnenfarben, doppelte Logoabmessungen, Statusschrift, Laptop/Mobil und Rückkehr aus dem schmalen Board-Fallback. Tatsächliche Nachweise: `docs/acceptance/bingo-moderation-2026-11-27.md`.
