# LOVD November · AP 5: Analyse der manuellen Auswertung

## Ergebnis

Quiz **37 · Knowvember · 18.11.2026 · zwölf Teams**, Production-Branch
`br-noisy-art-al7qjmqd`, Datenbank `neondb`. Aggregation am
**19.11.2026, 12:13:55 MEZ** (`2026-11-19T11:13:55.645Z`). Basis: main `d9804c59`.

**112 gespeicherte manuelle Bewertungen, ein heute offener Prüffall, konservativ
sechs einsparbare Freitext-Einzelentscheidungen.** Gruppierung der heute noch
Offenen spart null Entscheidungen. AP 5 implementiert keine Sammelbewertung.

## Welche Fälle bleiben nach den vorhandenen Filtern?

| Schritt | Team-Frage-Fälle | Bedeutung |
|---|---:|---|
| 50 Zuweisungen × zwölf Teams | 600 | vollständiger Quizumfang |
| Meme-Voting separat | −12 | keine normale Antwortbewertung |
| Standardfilter: gespielt, alle Teams | 588 | 49 auswertbare Fragen, alle gespielt |
| Zusätzlich nur falsche Antworten | 316 | schließt automatisch richtige aus, NICHT manuell bereits entschiedene |
| Zusätzlich nur offene Fragen, unbeantwortete aus | 126 | beantworteter Arbeitsvorrat im stärksten bestehenden Filter |
| Davon manuell bewertet | 112 | gespeicherte Quelle MANUAL, bereits erledigt |
| Davon REVIEW_REQUIRED, nicht MANUAL | 1 | tatsächlich heute offen: Position 13, Zuweisung #431 |
| Übrige sichtbare Fälle | 13 | automatisch bewertet, aber nicht CORRECT; kein belegter manueller Bedarf |

Alle 49 Fragen sind gespielt. 559 wirksame Antworten und 29 unbeantwortete Zellen
ergeben 588. Es gibt keine ausstehenden Basisbewertungen. Vier vorhandene Drafts
haben keinen wirksamen Submission-Snapshot und zählen als unbeantwortet; kein
Legacy-Fallback wurde benötigt. Das Meme hat zwölf weitere wirksame Einreichungen.

112 + 1 = 113 ist der **belegte manuelle Umfang** (erledigt oder noch offen),
nicht die Zahl noch zu erledigender Klicks. Die 126 sichtbaren Fälle sind ebenfalls
kein Beleg für 126 manuell notwendige Entscheidungen. Historische Filterzustände,
frühere manuelle Zustände und ein vollständiger Klickverlauf fehlen. Die Zahl der
am Abend tatsächlich ausgeführten Einzelentscheidungen ist daher nicht rekonstruierbar.
Keine rückwirkende Neuberechnung wurde ausgeführt.

## Identische vollständige Antworten je Frage

„Im Filter“ = gespielt + offen + nicht automatisch richtig + beantwortet.
„Gleiche Texte“ = Gruppengrößen identischer ganzer TEXT-/STRUCTURED_TEXT-Payloads
innerhalb genau einer Zuweisung. Einzelgruppen sind ausgelassen. Nummern sind die
persistierten Positionen; die Lücken 25 und 34 werden nicht umnummeriert.

| Position | Zuweisung | Vorlage | Im Filter | Manuell gespeichert | Noch offen | Gleiche Texte | Einsparung Freitext |
|---|---|---|---:|---:|---:|---|---:|
| 1 | 497 | anagramm | 0 | 0 | 0 | – | 0 |
| 2 | 496 | wahr_falsch | 0 | 0 | 0 | – | 0 |
| 3 | 392 | standard | 0 | 0 | 0 | – | 0 |
| 4 | 385 | standard | 0 | 0 | 0 | – | 0 |
| 5 | 326 | standard | 9 | 9 | 0 | – | 0 |
| 6 | 475 | musik_rueckwaerts | 6 | 6 | 0 | – | 0 |
| 7 | 469 | musik | 11 | 10 | 0 | 6 | 4 |
| 8 | 481 | uebersetzt_vorgelesen | 9 | 9 | 0 | – | 0 |
| 9 | 328 | standard | 0 | 0 | 0 | – | 0 |
| 10 | 395 | standard | 0 | 0 | 0 | – | 0 |
| 11 | 378 | paare_bilden | 7 | 0 | 0 | – | 0 |
| 12 | 391 | standard | 0 | 0 | 0 | – | 0 |
| 13 | 431 | standard | 2 | 1 | 1 | – | 0 |
| 14 | 485 | pixelbild | 5 | 5 | 0 | – | 0 |
| 15 | 400 | standard | 0 | 0 | 0 | – | 0 |
| 16 | 393 | standard | 0 | 0 | 0 | – | 0 |
| 17 | 494 | reihenfolge | 0 | 0 | 0 | – | 0 |
| 18 | 376 | standard | 0 | 0 | 0 | – | 0 |
| 19 | 444 | standard | 0 | 0 | 0 | – | 0 |
| 20 | 453 | standard | 9 | 9 | 0 | 2 | 1 |
| 21 | 486 | fakten_land | 5 | 5 | 0 | 2 + 2 | 0 |
| 22 | 406 | standard | 0 | 0 | 0 | – | 0 |
| 23 | 327 | standard | 0 | 0 | 0 | – | 0 |
| 24 | 499 | standard | 3 | 3 | 0 | – | 0 |
| 26 | 452 | standard | 1 | 1 | 0 | – | 0 |
| 27 | 379 | standard | 0 | 0 | 0 | – | 0 |
| 28 | 434 | standard | 0 | 0 | 0 | – | 0 |
| 29 | 388 | standard | 0 | 0 | 0 | – | 0 |
| 30 | 476 | face_morph | 12 | 12 | 0 | – | 0 |
| 31 | 463 | musik_rueckwaerts | 7 | 7 | 0 | – | 0 |
| 32 | 480 | musik | 9 | 9 | 0 | 2 | 1 |
| 33 | 390 | standard | 0 | 0 | 0 | – | 0 |
| 35 | 408 | standard | 0 | 0 | 0 | – | 0 |
| 36 | 493 | paare_bilden | 5 | 0 | 0 | – | 0 |
| 37 | 382 | standard | 0 | 0 | 0 | – | 0 |
| 38 | 394 | wahr_falsch | 0 | 0 | 0 | – | 0 |
| 39 | 488 | standard | 0 | 0 | 0 | – | 0 |
| 40 | 377 | fakten_person | 3 | 3 | 0 | – | 0 |
| 41 | 387 | standard | 7 | 7 | 0 | – | 0 |
| 42 | 423 | standard | 1 | 1 | 0 | – | 0 |
| 43 | 371 | reihenfolge | 0 | 0 | 0 | – | 0 |
| 44 | 386 | standard | 0 | 0 | 0 | – | 0 |
| 45 | 495 | fakten_jahr | 7 | 7 | 0 | – | 0 |
| 46 | 403 | standard | 0 | 0 | 0 | – | 0 |
| 47 | 401 | standard | 0 | 0 | 0 | – | 0 |
| 48 | 491 | standard | 0 | 0 | 0 | – | 0 |
| 49 | 396 | standard | 0 | 0 | 0 | – | 0 |
| 51 | 498 | standard | 0 | 0 | 0 | – | 0 |
| 52 | 484 | pixelbild | 8 | 8 | 0 | – | 0 |

Die verbleibende Zuweisung #398 (Position 50, Meme) ist bewusst separat und hat
kein normales Freitext-Gruppenpotenzial.

### Einsparung nachvollziehbar gerechnet

| Zuweisung | Ganze gleiche Antworten im Filter | Davon belegte manuelle Fälle | Ganze Gruppenentscheidungen | Einsparung |
|---|---:|---:|---:|---:|
| #469, Position 7, Musik | 6 | 5 | 1 statt 5 | 4 |
| #453, Position 20, Standard | 2 | 2 | 1 statt 2 | 1 |
| #480, Position 32, Musik | 2 | 2 | 1 statt 2 | 1 |
| Summe Freitext | 10 | 9 | 3 statt 9 | **6** |
| #486, Position 21, Länderwerte | 2 + 2 | 2 + 2 | 2 statt 4 | **2 separat** |

Unter 113 belegten Fällen sind 13 Pixel-, sieben Zahlen- und fünf Länderfälle.
Damit bleiben **88 Freitextfälle**. Sechs statt mehrfach derselben Prüfung würden
diesen Umfang von 88 auf 82 Entscheidungen senken: **6,8 %**. Das ist eine
konservative modellierte Einsparung, keine gemessene Zeitersparnis. Länderwerte
erweitern das allgemeine Gruppierungspotenzial auf acht von 113 (7,1 %), gehören
aber nicht zur freien Texteingabe. Bei #469 enthält die sichtbare Sechsergruppe nur
fünf manuelle Fälle; sie darf nicht als fünf eingesparte manuelle Entscheidungen
gezählt werden. Über alle sichtbaren Textgruppen ist die theoretische Reduktion
neun, für belegte manuelle Fälle acht, für Freitext sechs.

Verglichen wird exakt: keine Kleinschreibung, kein Trim, keine unscharfen Treffer.
Strukturierte Antworten vergleichen die gesamte Feld-ID/Text-Kombination; JSON-
Schlüsselreihenfolge ist bedeutungslos. Feldbelegung und Inhalt bleiben bedeutsam.
Punkte-/Statuskonflikte innerhalb einer Gruppe liefern keine Einsparung (hier null).
Pixel-/Risikokontexte, Zahlen und Länder werden nicht als freie Text-Gruppenaktion
empfohlen. Mehrere Submission-Versionen und neuere ungesendete Drafts erzeugen
keine zusätzlichen Antworten.

## Nächster Ausbauschritt, noch nicht implementiert

1. Einen eindeutigen Arbeitsvorrat **Noch zu prüfen** ergänzen: REVIEW_REQUIRED,
   nicht bereits MANUAL, ausstehende Bewertung getrennt; unbeantwortete Fälle separat.
   Der bestehende Filter „nur falsche“ erzeugt heute einen irreführend großen Vorrat.
2. Danach streng gleiche Freitextantworten je Zuweisung mit Vergleich, Anzahl und
   bewusster Bestätigung gruppieren. Revisionsprüfung unter bestehender Quiz-Sperre,
   bestehende Einzelbewertung und zentrale Punkteberechnung wiederverwenden;
   keine Erfindung eines neuen Score- oder Submission-Systems. Konfliktgruppen und
   kontextabhängige Fälle einzeln lassen. Noch offene Fälle gegenüber erledigten trennen.
3. **44 gespeicherte manuelle Bewertungen** betreffen Musik und Face-Morph
   (#475: 6, #469: 10, #463: 7, #480: 9, #476: 12). Deshalb als nächste Analyse
   einzelne Antwortfelder und akzeptierte Schreibvarianten untersuchen. Ein weiteres
   Einsparpotenzial daraus ist hier nicht quantifiziert; keine automatische
   Ähnlichkeitsbewertung und keine zusätzlichen akzeptierten Lösungen ausgerollt.

## Architektur, Reproduktion und Datengrenzen

- SQL: `scripts/analysis/lovd-manual-review.sql`, ein reines SELECT mit einem
  MVCC-Statement-Snapshot. Der Query-Target ist ausdrücklich Quiz 37; keine Tabellen
  geändert, keine Deadline- oder Backfill-Serveraktion aufgerufen.
- Bei Runs nur die höchste Submission-Version desselben Runs (Tie: höchste ID).
  Ohne Submission kein Draftfallback. Legacy nur bei runloser Antwort; im Datensatz null.
  Bewertungs-Vollständigkeit entspricht der gespeicherten Engine-Version 3.
- Nur Frageaggregate verlassen SQL: Zahlen, Gruppengrößen, Vorlagen-/Optionsmerkmale.
  Keine Teamnamen, Session-/Antwort-IDs, Rohantworten, individuellen Punkte oder
  reversiblen Antwort-Hashes gespeichert. Equality-Klassen bleiben innerhalb SQL.
- `docs/reports/assets/lovd-november-ap5/aggregate.json` ist der prüfbare feste
  Aggregatstand. `manualReviewAnalysis.ts` verwendet vorhandenen Answer-Mode-Resolver
  und Filter; er bewertet nichts. Die bestehende Auswertung und ihr Schreibpfad bleiben.
- `/berichte/lovd-november-ap5` ist ein serverseitiger Bericht hinter dem bestehenden
  Admin-Guard, mit derselben Aggregatdatei. Keine Produktionsverbindung und keine
  auslösbare Analyse oder Bewertungsaktion auf der Preview.
- Isolierte Preview nutzt ausschließlich die bereits synthetische Review-Datenbank;
  Branchvariablen und HTTP-Header-Abnahme wurden ausdrücklich freigegeben.

## Abnahme und Prüfungen

- 85 gezielte Unit-/Vertragsregressionen: erfolgreich (Analyse, Filter, Submission,
  Vollständigkeit, Readmodel, Bewertung, Workflow und CI-Verträge).
- Echte PostgreSQL-Fixture in eigener Review-Datenbank: erfolgreich; neues Schema
  und alle Daten innerhalb einer am Ende zurückgerollten Transaktion. Aktueller Run,
  neuere Submission, ungesendeter Draft, exakte Groß-/Kleinschreibung und Leerzeichen,
  strukturierte JSON-Schlüsselreihenfolge, Bewertungskonflikt und Nichtmutation geprüft.
- Neue Unit-Tests sind in `test:analysis` und damit `npm test`; PostgreSQL-Test ist
  im bestehenden PostgreSQL-CI-Job verdrahtet. Keine neue Abhängigkeit oder Migration.
- Typecheck, ESLint der neuen Quellen und Production-Build erfolgreich.
- Push-CI [44513572967](https://github.com/justphilgud/pubquiz-web/actions/runs/44513572967)
  und PR-CI [44513617412](https://github.com/justphilgud/pubquiz-web/actions/runs/44513617412)
  für die deployte Quellrevision vollständig grün, einschließlich aller bestehenden
  Tests und des neuen PostgreSQL-Analysetests.

## Pull Request und isolierte Preview

- [PR #172](https://github.com/justphilgud/pubquiz-web/pull/172), Ziel main.
- [Gehosteter Bericht](https://pubquiz-h3140hsw3-just-phil-gud.vercel.app/berichte/lovd-november-ap5).
- Vercel `READY`: `dpl_9xRZz6S6pprKj49EQreyd3rWchw5`, exakte Quellrevision
  `51190eabc6e225e7c8e3c6641206728878aa54ac`. Erfolgreiche Push-CI und sechs
  zentrale Medienvariablen durch bestehendes Deploymentskript bestätigt.
- Ausschließlich synthetische Datenbank `lovd_november_review_20261119`, bestehender
  eingeschränkter Runtime-Benutzer. Kein Production-Secret und keine Produktions-
  Rohantworten an Vercel übertragen. Branchbezogene Variablen, Preview-Trustliste
  und exakt benannte Branchpolicy ausdrücklich autorisiert; Production unverändert.
- Vercel-Anmeldeschutz bleibt aktiv. Sein bestehender Automation-Zugang wurde nach
  ausdrücklicher Zustimmung ausschließlich per HTTP-Header für diese Abnahme genutzt.
  Lokale temporäre Tokenkopie nach dem Test entfernt, keine Zugangsdaten versioniert.
- Nachfolgende Änderungen betreffen ausschließlich Bericht, Screenshots und Ablauf-
  protokoll. Der deployte Anwendungscode ist identisch; kein Merge ausgeführt.

## Lokale und gehostete Browserabnahme · 19.11.2026

Lokaler Production-Build auf Port 3060 und gehostete Preview, jeweils frisches
isoliertes Chrome-Profil. Synthetischer Admin kann den Bericht öffnen. Die
Kennzahlen sind **112 / 1 / 6**. Erste Tabelle: 18 Fragen mit manuellem Befund;
aufgeklappte Gesamttabelle: 49 Fragen. Deren Spaltensummen ergeben
**126 sichtbar / 112 manuell / 1 offen / 6 Freitext-Einsparungen**, identisch zum
Analysator. Aufklappen funktioniert ohne zusätzliche Datenbank-/Analyseaktion.

1366 × 768, 1920 × 1080 und 390 × 844 lokal und gehostet geprüft. Kein horizontaler
Seitenüberlauf; auf Mobilgröße scrollt ausschließlich der breite Tabellenbereich.
Kennzahlen, Einschränkungen und Empfehlung bleiben lesbar. Visuelle Screenshotprüfung
auf Laptop und Mobilgröße. [Lokal 1366](assets/lovd-november-ap5/local-1366.png),
[lokal 1920](assets/lovd-november-ap5/local-1920.png),
[lokal 390](assets/lovd-november-ap5/local-390.png),
[gehostet 1366](assets/lovd-november-ap5/hosted-1366.png),
[gehostet 1920](assets/lovd-november-ap5/hosted-1920.png),
[gehostet 390](assets/lovd-november-ap5/hosted-390.png).

Unangemeldeter Besuch in separatem Browserkontext landet beim App-Login, ohne
Berichtsinhalt. Ein eigener synthetischer Benutzer ohne Adminzuweisung kann sich
anmelden, wird beim anschließenden direkten Berichtaufruf jedoch abgewiesen
(Redirect zur Startseite, kein Berichtsinhalt). Beide Fälle lokal und gehostet
geprüft. Die bestehende serverseitige `requireAdmin`-Prüfung bleibt maßgeblich.

Zusammenhängender gehosteter Quizdurchlauf in getrennten Fenstern für Moderation
und öffentliche Präsentation: erstes Intro, Begrüßung, Regeln, QR, beide Runden,
Standard-/Spezialfragen mit Auflösungen, Pixel 17, bestehende Meme-Ergebnisse,
Pausen/Zwischenstand, Siegerehrung und finale Tabelle. Das
[Ablaufprotokoll](assets/lovd-november-ap5/hosted-walk.json) enthält **60 Zustände
über 57 unterschiedliche Folien**, keine Abweichung zwischen Moderationsposition
und öffentlichem Folienheader. Folie 56 erscheint viermal: leer plus drei
bewusst getrennte Enthüllungen; erst danach Folie 57. Datenbank-Endkontrolle:
`FINAL_STANDINGS`, `podium_snapshot = null`. Keine Bewertungsaktion durchgeführt.
Ein erster Testskriptlauf las eine während des Ladens kurz ersetzte Toolbar zu
früh. Nach Korrektur nur der Test-Wartebedingung lief die vollständige Aufzeichnung
erfolgreich; keine Anwendungsänderung war dafür nötig.

Dies ist ein zusätzlicher Smoke-Durchlauf des unveränderten Runtime-Vertrags.
Der ausführliche zehnminütige Intro-/Verzögerungsnachweis und die AP1–4-Einzelprüfungen
bleiben im [vorherigen Bericht](lovd-november.md); sie wurden nicht als neue AP5-
Messung ausgegeben. Kein physischer TV oder Handyscan. Historische Klickzahlen,
Zeitersparnis und zusätzliches Feld-/Schreibvariantenpotenzial sind weiterhin nicht
verifiziert; diese Grenzen schränken die dokumentierte Aggregatanalyse nicht heimlich ein.
