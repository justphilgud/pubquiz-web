# Binglöckchen: Moderation und Veranstaltungsdramaturgie

Basis: `main` `93f074973c4bf73ed4bf6c489d375682f510ba82`, PR180 und PR181 gemergt. Eigener Branch `codex/bingo-evening-dramaturgy`. Main vor Veröffentlichung erneut lesend geprüft und unverändert. Der bisherige Production-Lauf [45781228816](https://github.com/justphilgud/pubquiz-web/actions/runs/45781228816) war am Beginn dieses Auftrags bereits erfolgreich abgeschlossen. Dieser Auftrag hat keinen Production-Lauf ausgelöst.

## Ergebnis und Architektur

Die Moderation verwendet Eingabe links / aktuelle Zahl rechts, eine editierbare Historie mit vier Sortierungen, einen einzigen regulären Kartenprüfarbeitsplatz und kompakte Live-Wahrscheinlichkeit. Offene Rufe und Nachprüfungen blockieren keine weiteren Ziehungen. Manuelle Pause und frische Rechte-/Verbindungs-/CAS-Prüfung bleiben wirksam; Karten prüfen funktioniert auch während einer Pause.

Zehn zentrale Rundenfarben steuern neue Druckstände, Kennzeichnungen und das öffentliche Board. Die vorhandene individuelle WOFF-Schrift setzt Zahl, Raster und B/I/N/G/O; beide Original-Partnerlogos haben einen reservierten Bereich. Gezogene Zahlen sind vollflächig eingefärbt, die letzte Zahl erhält zusätzlich eine mehrfache helle Kontur. Ein optionales explizites `roundNumber`-Metadatum verhindert Änderungen historischer Exporte durch heuristische Erkennung alter Rundenbezeichnungen.

Gemeinsame Preisenthüllung, vorhandener Medienplayer, Kalenderfunktion, Buchungsfolie und vorhandene Siegerehrung werden wiederverwendet. Bingo erhält konfigurierbare Intro-/Outrofolien einschließlich optionalem Wartevideo, Intro-/Outro-Musik und physischer Abschlussverlosung. Eine additive Tabelle hält diesen Veranstaltungsrahmen getrennt von Quiz und Bingo-Regeljournal. Lose werden stabil aus bestätigten Journalentscheidungen rekonstruiert; Korrekturen/Widerrufe erzeugen keine stille Neunummerierung.

Verbindlicher Detailvertrag mit Zuständigkeiten, Persistenz, Eingaben/Ausgaben, Invarianten, Annahmen und Rückweg: [Bingoabend und Veranstaltungsdramaturgie](../architecture/bingo-evening-dramaturgy.md). Geänderte Dateigruppen: `app/bingo/live`, `app/bingo/preparation`, `app/rendering/ceremony`, Pubquiz-Moderation/Präsentationsstatus und bestehender Renderer, neue Migration/Prisma-Client, Backup-Zeilenvalidator, gezielte Regressionen und diese Nachweise. Keine neue Abhängigkeit.

## Lokale Nachweise

| Prüfung | Tatsächliches Ergebnis |
| --- | --- |
| Prisma Generate / Validate | bestanden; Schema gültig |
| TypeScript | `npm run typecheck` bestanden |
| ESLint | geänderte und neue handgeschriebene TS/TSX/MJS-Dateien, `--max-warnings=0`, bestanden |
| Build | `npm run build` mit Next 16.2.5 / Turbopack bestanden; lokales Buildartefakt, kein Deployment |
| Vollständige Bingo-Suite | 51 Tests bestanden, einschließlich Board-, Kartenkachel-, Matching- und neuer Browserregression |
| Druck-/Vorbereitungssuite | 40 Tests bestanden, einschließlich SRA3, alter Versionen, Text-/Musik-Bingo und beider Marken |
| Gemeinsame Pubquiz-Preisenthüllung | tatsächlicher Renderer: feste und Flow-Folie × Phil Gud / Editorial × 0–3 Reveal-Schritte bestanden; Hauptpreis vorher nicht im gerenderten Inhalt |
| PostgreSQL-Gesamtabnahme | vollständig bestanden, einschließlich Alt-/Neubestand, frischer Autorisierung, CAS/Nebenläufigkeit, Matching, neuer Migration/Rollback und echtem isolierten Dump/Restore |
| Sechs Runden × 100 Karten | 600 gespeicherte Karten, sechs getrennte Spielrunden und 120-seitiger SRA3-Duplex-Abenddruck bestanden |
| Zehn Runden | zehn gespeicherte Runden, Serverabwehr von Runde 11, zehn echte SRA3-Rückseitenbögen mit je zwölf Karten bestanden |
| Wahrscheinlichkeit | 0/100 Prozent, Überschneidungen, weitere Muster derselben Karte und unabhängige Brute-Force-Referenz für sechs/zehn × 100 Karten bestanden |
| Lose | einfach/doppelt/dreifach, wiederholte Prüfung, mehrere Runden, Korrektur/Widerruf, 90/91 Lose, ungültige Nummern, verborgener Gewinner vor Reveal und Erhalt beim Folienwechsel bestanden |
| Browserdarstellung | Moderation 1366×768 / 1920×1080, alle vier Sortierungen und echte Korrektursteuerung; zehn Farben 1920×1080 mit Originalfonts/-logos; Musik-Inhalt getrennt vom Board bestanden |
| Echter HTTP-End-to-End-Test | tatsächlicher Next-Server, Anmeldung, Event-/Kartenanlage, Bestätigung, keine doppelten Lose, Pause/Prüfung/Fortsetzen, frühere Korrektur, weitere Ziehung trotz Nachprüfung, ausdrückliche erneute Bestätigung, Runden-/Eventabschluss, physische Losnummer, verborgenes/aufgedecktes Ergebnis und Siegerehrung bestanden |

Der PostgreSQL-Test erzeugt ausschließlich eigene lokale `bingo_ap2_qa_*`-Datenbanken auf `127.0.0.1:55438`. Vorhandene synthetische Karten-IDs, Zellen, Kennungen und Layoutchecksummen bleiben nachweislich identisch. Keine produktive Datenbank wurde verbunden. Die neue Tabelle ist im vollständigen Snapshot-/Restorevergleich enthalten. [PostgreSQL-Protokoll](assets/bingo-evening/postgres.log), [Bingo-Tests](assets/bingo-evening/bingo-tests.log), [Drucktests](assets/bingo-evening/print-tests.log), [Build](assets/bingo-evening/build.log), [HTTP-Ergebnis](assets/bingo-evening/http-results.json).

Die reine Komponenten-Browserprüfung ersetzt ausdrücklich keinen HTTP-Test. Der separate HTTP-Test arbeitet ohne Action-Mocks mit der laufenden Anwendung und PostgreSQL. Sein synthetischer Abend bleibt zur Inspektion erhalten. Aktuelle lokale Vorschau: `http://localhost:3068/bingo/5753294f-fa8b-44e2-ae1a-fa869fa3bd47/moderation`. Lokale Anmeldedaten liegen ausschließlich in der ignorierten `.env.bingo-evening-accounts.json` und werden nicht veröffentlicht.

## Screenshots

| Ansicht | Nachweis |
| --- | --- |
| Tatsächliche HTTP-Moderation, Laptop | [1366×768](assets/bingo-evening/http-moderation-1366.png) |
| Tatsächliche HTTP-Moderation, Full HD | [1920×1080](assets/bingo-evening/http-moderation-1920.png) |
| Kompakter regulärer Arbeitsplatz | [1366×768](assets/bingo-evening/moderation-1366.png), [1920×1080](assets/bingo-evening/moderation-1920.png) |
| Musik-Bingo | [Begrenzter Medienbereich](assets/bingo-evening/musik-bingo.png) |
| Preisvorstellung | [Drei aufgedeckte Platzierungen](assets/bingo-evening/preise-aufgedeckt.png) |
| Physische Abschlussverlosung | [Gewinnerkarte](assets/bingo-evening/abschlussverlosung.png) |
| Tatsächliche Siegerehrung nach HTTP-Abend | [Vorhandene Pubquiz-Animation](assets/bingo-evening/http-siegerehrung.png) |

| Runde | Farbe | Öffentliche Präsentation |
| --- | --- | --- |
| 1 | LOVD-Rot `#74291D` | [Full HD](assets/bingo-evening/praesentation-runde-01.png) |
| 2 | Ozeanblau `#174A75` | [Full HD](assets/bingo-evening/praesentation-runde-02.png) |
| 3 | Waldgrün `#24553A` | [Full HD](assets/bingo-evening/praesentation-runde-03.png) |
| 4 | Aubergine `#59335E` | [Full HD](assets/bingo-evening/praesentation-runde-04.png) |
| 5 | Goldocker `#99600E` | [Full HD](assets/bingo-evening/praesentation-runde-05.png) |
| 6 | Petrol `#12666B` | [Full HD](assets/bingo-evening/praesentation-runde-06.png) |
| 7 | Himbeere `#9B295A` | [Full HD](assets/bingo-evening/praesentation-runde-07.png) |
| 8 | Nachtindigo `#363979` | [Full HD](assets/bingo-evening/praesentation-runde-08.png) |
| 9 | Kupfer `#A04A23` | [Full HD](assets/bingo-evening/praesentation-runde-09.png) |
| 10 | Schiefer `#45545D` | [Full HD](assets/bingo-evening/praesentation-runde-10.png) |

Alle zehn Farb-/Schriftpaare erreichen mindestens 4,5:1. Bei der ersten Messung unterschritt das zunächst gewählte Goldocker diesen Wert und wurde vor der Abnahme abgedunkelt. Die Bühne bleibt neutral; ungezogene, gezogene und letzte Zahl unterscheiden sich zusätzlich durch Fläche, Helligkeit und Kontur.

## PDF-Beispiele

- [Zehn farbige Rückseitenbögen, SRA3, je zwölf Karten](../../output/pdf/bingo-zehn-runden-rueckseiten-sra3.pdf).
- [Vollständiger SRA3-Duplex-Abenddruck, sechs Runden × 100 Karten](../../output/pdf/bingo-sechs-runden-abenddruck-sra3.pdf).

Beide Dateien stammen aus dem produktiven vorhandenen Renderer mit synthetischen gespeicherten Karten. Größenprüfung: 320×450 mm, lange-Kante-Duplex, unveränderte Kennungen und Rundentrenner. Poppler-Renderkontrolle ergänzt die strukturellen PDF-Prüfungen. Physischer Druck, Schnitt-/Duplexregistrierung und reale Beamerwirkung bleiben Bestandteil der fachlichen Abnahme.

## Annahmen und fachliche Grenzen

1. Der bestehende Regelkern bleibt Bingo 75; die physische Abschlussverlosung verwendet Kugeln 1–90.
2. Die vorhandenen Gewinnstufen zählen kumulativ 1/2/3 bestätigte Muster und Lose je Karte/Runde. Keine zusätzliche vierte Gewinnstufe. Die Wahrscheinlichkeit berücksichtigt trotzdem weitere geometrische Linien.
3. Ohne einzeln bekannte ausgegebene Karten zählen alle generierten, der Runde zugeordneten Karten. Ein Ausgabe-Gesamtwert erlaubt keine Auswahl konkreter Karten.
4. Neue Abende unterstützen maximal zehn Runden. Bestehende Events werden nicht gekürzt. Die Rundenreihenfolge soll vor dem Druck feststehen; bestehende wiederverwendete Karten werden nicht heimlich umgefärbt. Ein farbkonsistenter neuer Abend erzeugt neue Rundendecks.
5. Ungültige Lose bleiben als Lücken erhalten; die Moderation sieht diese Nummern und nimmt entsprechende Kugeln aus. Übersteigt der erforderliche Kugelbereich 90, bleibt die Ziehung gesperrt. Alternative Ziehungsmethode offen für fachliche Abstimmung.
6. Intro-/Outrotexte und optionale Medien sind frei konfigurierbar. Browser-Autoplay kann weiterhin eine ausdrückliche Publikumsaktivierung erfordern; die vorhandene Medienkomponente behandelt das.

## Unabhängige Befunde und noch erforderliche gehostete Abnahme

Die lokale Gesamtsuite `npm test` besteht in ihren Vorprüfungen; im 828-Tests-Hauptblock bestehen 827 Tests. Ein unveränderter, schon in PR180 dokumentierter Windows-CRLF-Hash des historischen Production-Importplans schlägt fehl. Der Plan und seine erwartete Prüfsumme wurden nicht verändert. Die Linux-CI im PR ist für die vollständige plattformunabhängige Gesamtabnahme maßgeblich. npm meldet zudem bereits im unveränderten Lockfile vorhandene Sicherheitsmeldungen; kein unbestelltes Dependency-Upgrade. Ein bestehender `pg`-Hinweis zu gleichzeitigem `client.query` stammt aus der vorhandenen Matching-Abnahme und bleibt separat sichtbar.

Der Benutzer hat den konkreten Branch aus PR182 ausdrücklich für Preview freigegeben. Die externe `TRUSTED_PREVIEW_BRANCHES`-Liste und die exakte Preview-Environment-Branch-Policy wurden um ausschließlich `codex/bingo-evening-dramaturgy` ergänzt; vorhandene Einträge und Schutzregeln bleiben erhalten. Die erste Push-CI auf `8c5e33e` ist vollständig erfolgreich, einschließlich der unter Windows abweichenden historischen Hashprüfung. Die abschließende Revision und die gehosteten Nachweise werden im PR geführt. Kein Merge und kein Production-Release; die fachliche Abnahme der endgültigen Preview bleibt erforderlich.

Die eigene Datenbank `bingo_evening_review` liegt auf dem bestehenden Nonprod-Endpunkt `ep-holy-term-baa881iq` im Projekt `falling-sky-48140800`. Keine zusätzliche Compute, keine Änderung bestehender Datenbanken. Ausschließlich die lokale synthetische Schema-Basis ohne Daten wurde in die leere Datenbank übernommen; anschließend wurde die genaue committed Ceremony-Migration ausgeführt und ein synthetischer Admin mit zwei Testreihen angelegt. Keine echten Veranstaltungs-/Quiz-/Bewertungsdaten als Quelle, kein behaupteter historischer Bootstrap-Replay, keine Baseline oder Reparatur bestehender Migrationshistorien.

Der bestehende Preview-Workflow enthält einen gesonderten manuellen, exakt an Branch/Projekt/Datenbank gebundenen administrativen Job (`isolated_bingo_evening`). Der gemeinsame Migrationsjob schließt diesen Branch aus. Die optionale administrative Konfiguration (`configure_bingo_database`) setzt ausschließlich die vier genauen Preview-Branch-Overrides für Datenbank und Identitätsmarker; sie vergleicht alle übrigen Environment-Metadaten vor/nachher. CI, Trust-, Git-HEAD-, Projekt-/Repository-, zentrale Medien- und READY-Prüfungen bleiben erhalten. Der eigentliche Deploymentpfad erzeugt keine Variablen und migriert keine gemeinsame Datenbank. Zugangswerte liegen nur als Preview-Secrets und in ignorierten lokalen Dateien. Der gehostete Browserlauf prüft vor Änderungen den authentifizierten tatsächlichen Runtime-SHA und nutzt ausschließlich einen bereits vorhandenen Preview-Automationszugang.

Unabhängiger erster PR-CI-Befund: Der unveränderte gemeinsame Design-Browsertest (`shared-design.visual.browser.test.ts`) las eine noch unvollständige Chrome-DevTools-Startdatei und brach mit `Invalid URL` ab. Die separate Push-CI desselben Commits einschließlich dieses Tests war erfolgreich; Bingo-, Druck- und PostgreSQL-Prüfungen des PR-Laufs bestanden. Kein Anwendungscode oder fremder Test wurde dafür verändert. Abschließende CI bleibt erforderlich.
