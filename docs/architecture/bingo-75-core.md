# Bingo v0.5 – AP1: isolierter 75er-Regelkern

## Zweck und Architekturentscheidung

`app/bingo/core/{cards,round,run}.ts` implementiert ausschließlich synchrone, reine
TypeScript-Fachfunktionen. Bestehende Spielentwürfe, Rechte, Teamzuordnungen,
SharedDesign-Auflösung und Quizlaufzeit bleiben unverändert. `BingoRun.gameId`
referenziert die bestehende dauerhafte Spiel-UUID; `id` bezeichnet einen separaten
Durchlauf. Es entstehen weder Quizdatensätze noch eine universelle Spielengine.
Version 1 bezeichnet den Datenvertrag, keine Datenbank- oder Requestrevision.

Keine Systemzeit, globaler Zufall, generierte IDs oder I/O: Aufrufer liefern IDs,
Zeit in ganzzahligen Millisekunden einer konsistenten monotonen Zeitbasis und eine
Zufallsfunktion mit Werten in [0,1). Alle Funktionen erhalten alte Zustände;
Änderungen liefern neue Objekte mit strukturell geteilten unveränderten Teilen.
`readonly` ist ein TypeScript-Vertrag, keine Laufzeit-Versiegelung aller Ergebnisse.
Ergebnisse dürfen vom Aufrufer nicht nachträglich verändert werden.

## Karten und geometrische Gewinne

`BingoCard` trennt Identität (`id`) von vollständiger Belegung (`cells`).
`validateCard(unknown)` prüft fünf vollständige Zeilen mit je fünf Feldern,
ausschließlich ganzzahlige Werte, keine Dubletten und die Spaltenbereiche
B=1–15, I=16–30, N=31–45, G=46–60, O=61–75. Ausschließlich das Zentrum ist `null`.
`generateCard(id, random)` zieht pro Spalte ohne Zurücklegen. Später muss die
Belegung dauerhaft gespeichert werden; ein Seed allein ersetzt sie nicht.

`evaluateCard(cells, drawn)` prüft genau eine Karte. Freifeld gilt als markiert.
Die stabilen Linien-IDs sind `ROW_1` bis `ROW_5`, `COL_B/I/N/G/O`,
`DIAGONAL_DOWN` (links oben nach rechts unten) und `DIAGONAL_UP`.
Überlappungen zählen als eigene Linien. Das Ergebnis enthält konkrete Linien und
alle erreichten Stufen `BINGO` ab einer, `DOUBLE` ab zwei und `TRIPLE` ab drei
Linien derselben Karte. Keine Summierung mehrerer Karten, automatische
Bestätigung, Preisvergabe oder Beendigung. Ungültige Ziehungswerte und Dubletten
werden auch bei der geometrischen Auswertung abgewiesen.

## Runde, Ziehungen und Gewinnrufe

`createRound(id, plannedDraws=30)` erzeugt Version 1, `PREPARED`, leere Ziehungen,
Gewinnrufe und Korrekturhistorie. Schnellwahlwerte sind 20/30/40; jede Ganzzahl
1–75 ist erlaubt. `setTarget` lehnt ein Ziel unter der aktuellen Ziehungszahl
und Änderungen abgeschlossener Runden ab. `targetReached` ist ausschließlich
ein Hinweis: weitere Ziehungen sind erlaubt, kein automatischer Zustandswechsel.

`appendDraw(round,id,number)` benötigt eine offene Runde und prüft Zahl 1–75,
eindeutige Ziehungs-ID und eindeutige Zahl. Positionen beginnen bei 1 und werden
nur angehängt. `currentNumber` liefert die Zahl an der letzten Position oder null.
`correctDraw(round,drawId,number,{id,reason},cards)` ersetzt die Zahl an derselben
Position mit derselben ID; Kollisionen und wirkungslose Änderungen sind Fehler.
Es liefert `{round,change}` und speichert den Nachweis mit vorheriger/neuer Zahl,
Position, Ziehungs-ID und Begründung zusätzlich in `round.corrections`.
Korrekturen und Entscheidungen sind bewusst auch an abgeschlossenen Runden
fachlich auswertbar. Sie öffnen keine Runde und setzen keinen Durchlauf zurück.
Spätere Berechtigung und zulässige Bearbeitungsphase bestimmt der Dienst.

`recordClaim(round,id,card,stage)` benötigt eine offene Runde, erlaubt auch einen
noch ungültigen Ruf und speichert die feste `throughPosition` sowie die damalige
geometrische Auswertung. `evaluateClaim` wertet ausschließlich Positionen bis zu
dieser Grenze aus, mit aktuell korrigierten Zahlen. Spätere Ziehungen können einen
damals ungültigen Ruf nicht heilen. Die Originalauswertung bleibt als Nachweis
unverändert. Identität von Karte und Runde muss übereinstimmen.

`decideClaim(round,claimId,card,{id,action,reason})` fügt eine Entscheidung an:

- `CONFIRM` benötigt geometrische Deckung der ausdrücklich gerufenen Stufe.
- `REJECT` ist für nicht wirksam bestätigte Rufe möglich.
- `REVOKE` nimmt eine wirksame Bestätigung ausdrücklich zurück.

Nur die letzte Entscheidung bestimmt die wirksame Bestätigung. Pro
Karte × Runde × Stufe darf höchstens ein Ruf wirksam bestätigt sein. Mehrere
Karten können gewinnen; andere Stufen brauchen separate Rufe/Entscheidungen.
Erneute Prüfung desselben Rufs und Bestätigung nach Rücknahme sind möglich;
die Historie wird nicht überschrieben. IDs von Entscheidungen sind innerhalb
der Runde eindeutig. Dies ist keine Request-Idempotenz.

Eine Korrektur prüft alle betroffenen bestätigten Rufe erneut. Dazu muss für jede
betroffene Karten-ID genau eine vollständige Karte mitgeliefert werden; fehlende
oder mehrdeutige Karten führen zum Fehler ohne Teiländerung. Nicht mehr gedeckte
Bestätigungen bleiben wirksam dokumentiert und erhalten `needsReview=true`.
Die Markierung bleibt bis zur ausdrücklichen Entscheidung bestehen, auch wenn
eine weitere Korrektur die Deckung wiederherstellt. Sie bedeutet keinen
automatischen Gewinnerentzug. Ausgabe-/Teilnahmeberechtigung wird durch diese
geometrische Prüfung ausdrücklich **nicht** nachgewiesen.

## Durchlauf und Übergänge

`createRun(id,gameId,now)` erzeugt `PREPARED` ohne Runden. `addRound` fügt eine
vorbereitete leere Runde hinzu; vorhandene Runden, Rufe und Historie bleiben.

| Funktion | Voraussetzung | Wirkung |
|---|---|---|
| `startRun(run,roundId,now,otherRuns)` | vorbereitet, ausgewählte Runde vorbereitet, kein aktiver anderer Lauf desselben Spiels | laufend, Runde offen, aktive Uhr startet |
| `pauseRun(run,now)` | laufend | pausiert, aktive Zeit angesammelt |
| `resumeRun(run,now)` | pausiert | laufend, Uhr läuft weiter |
| `closeRound(run,roundId)` | laufend/pausiert, Runde offen | Runde abgeschlossen, Historie erhalten |
| `openRound(run,roundId)` | laufend, keine offene Runde, Zielrunde vorbereitet | Zielrunde offen |
| `endRun(run,now)` | laufend/pausiert | beendet, offene Runde abgeschlossen, Uhr eingefroren |

Zwischen zwei Runden darf der Durchlauf weiter laufen; diese Zeit zählt als aktiv.
Eine Pause schließt keine Runde. Vorbereitete, noch ungespielte Runden bleiben bei
Durchlaufende vorbereitet, können in diesem Durchlauf aber nicht mehr öffnen.
Beendete Durchläufe können weder neu starten noch fortgesetzt werden. Ein späterer
neuer Durchlauf benötigt eine neue ID. Kein Reset-Vertrag.

`activeElapsedMs(run,now)` schließt sämtliche Pausen aus; rückläufige Zeit gegenüber
dem letzten Zeitübergang und ungültige Zeitwerte sind Fehler. Zeitlesevorgänge
verändern keinen Zustand. `drawNumber(run,roundId,drawId,number)` prüft zusätzlich
zur offenen Runde einen laufenden Durchlauf; Ziehen während Pause ist verboten.
Die tieferen Rundenfunktionen kennen keinen übergeordneten Durchlauf und ersetzen
diese Aggregatprüfung nicht.

`assertSingleActiveRun(runs,gameId)` prüft höchstens einen laufenden oder pausierten
Durchlauf im übergebenen Bestand. `startRun` wendet diese Prüfung auf Kandidat plus
andere Durchläufe an. Der Aufrufer muss den vollständigen relevanten Bestand liefern.

## Vertrauens- und Integrationsgrenze

Karten, Zahlen, IDs und öffentliche Befehlsparameter werden fachlich validiert.
Zustandsobjekte sind vertrauenswürdige, durch diese Funktionen erzeugte Aggregate;
ein Decoder für beliebiges JSON oder manipulierte persistierte Aggregate ist
nicht enthalten. Das Laden solcher Daten braucht später eine eigene Validierung.
Fehler sind `Error` mit stabilen technischen Codes, keine fertigen UI-Meldungen.

Ein späterer Anwendungsdienst muss bei jedem Zugriff unabhängig von Navigation
Authentifizierung, Reihenrolle, freigeschaltetes Produkt und Archivregeln prüfen.
Er muss Kartenbelegungen unveränderlich laden, Ausgabe-/Teilnahmeberechtigung
gegebenenfalls separat feststellen und sämtliche Befehle einschließlich Korrektur
und Gewinnentscheidung gegen den aktuellen Laufzustand autorisieren.
Transaktionen/Sperren, dauerhafte Einmaligkeit, vollständiger Bestand aktiver
Durchläufe, Request-Idempotenz, Revision/CAS, Zeitquelle und dauerhafte Historie
sind **nicht implementiert**. Reine Tests sind kein Nachweis konkurrierender
Datenbanksicherheit. Die neuen Typen ändern keine bestehenden SharedDesign-
Resolver oder Quiz-Snapshots. Spätere Designreferenzen können ergänzt werden.

Keine Schema-, Migrations-, Produkt- oder Datenänderung; daher kein neuer Backup-
oder Restorevorgang. Spätere Tabellen müssen vor Integration in die vorhandene
dynamische Dump-/Integritätsinventur aufgenommen und isoliert geprüft werden.
Kein Browser, keine Preview und noch kein spielbares Bingo.

## Tests und nächste Entscheidungen

`npm run test:bingo` ist über `posttest` Teil von `npm test`/CI. Tests umfassen
Kartenfehler, 100 reproduzierbare Generatorläufe, alle zwölf einzelnen Linien,
Überlappungen, Stufen, leere/volle Ziehungen, Korrekturpositionen/Identitäten,
unveränderte Eingaben, Rufgrenze, Nachprüfung, wirksame Eindeutigkeit und Rücknahme,
Übergänge, mehrfache Pausen, Zielhinweise und Rundenhistorie.

AP2-Empfehlung: zunächst additive Persistenz plus autorisierten transaktionalen
Dienst für diese Verträge, mit isolierten Migrationstests, CAS-/Paralleltests und
dauerhafter Historie. Noch festzulegen: Aufbewahrung/Auditmetadaten, erlaubte
Korrekturphasen und Zeitbasis über Prozessneustarts. Kein öffentliches Spielen
ohne diese Integration. Boardlayout braucht eine eigene Lösung; Messung/Tests
der klassischen Auswahlfolien sind nur eine später nutzbare Referenz.

Die manuell erfasste Ausgabemenge bleibt spätere Anforderung; konkrete ausgegebene
Karten-IDs sind **keine beschlossene Pflicht**. Dauerhaft bytegleiche Aufbewahrung
aller PDF-Exporte ist ebenfalls **nicht beschlossen**. Verbindlich ist die stabile
Belegung derselben Karte. Frühere weitergehende Vorschläge gelten nicht als Auftrag.

AP2 ergänzt jetzt die isolierte Vorbereitung, Kartenpersistenz, manuelle
Ausgabegesamtmenge und Druck-PDFs gemäß [Bingo preparation](bingo-preparation.md).
Der AP1-Regelkern bleibt unverändert; dies integriert noch keinen Live-Ruf-,
Ziehungs- oder Gewinnablauf.

Die neue AP3-Integration ist getrennt in [Bingo Live](bingo-live.md) beschrieben.
Die hier beschriebenen reinen AP1-Verträge bleiben ihre fachliche Grundlage.
