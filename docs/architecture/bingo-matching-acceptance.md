# Bingo-Matching: Abnahme und Lieferstand

Stand: 7. November 2026. PR [#158](https://github.com/justphilgud/pubquiz-web/pull/158),
Branch `codex/bingo-matching-table`, Basis `338887775389567fd2703cf177f3927cf89a1086`.
Kein Merge, keine Production-Migration und kein Production-Deployment.

## Architektur und betroffene Dateien

Der bestehende Begriffssatz erhält Version 2 mit getrennten Medien- und Kartenantworten.
AP1 bleibt unverändert die einzige Grundlage für Zahlen, Freifeld und Gewinnprüfung.
Der Bearbeitungsbereich 1–90 aktiviert keinen 90er-Spielmodus. Bibliothek und Fassung
bleiben spielgebunden; Wiederverwendung ist innerhalb desselben Spiels möglich.

- `app/bingo/preparation/matching.ts`, `termSet.ts`: Vertrag, tatsächliche Antwortfelder,
  unabhängige Auswahl, Dubletten und 75er-Grenze.
- `app/bingo/matching/`, `app/bingo/[gameId]/matching/page.tsx`,
  `PreparationPanel.tsx`: Tabelle, Bereiche, Quellen, Vorschau, Rechte und CAS.
- `app/api/bingo/matching/`: frisch autorisierte Quellen-/Assetabrufe und einzelne
  aktuelle Zuordnung. Bytebereiche werden bereits in PostgreSQL projiziert.
- `pdfModern.server.ts`, `pdfReference.server.ts`: vorhandene Druckregeln und Fonts,
  numerische Identität erhalten; Text nur an ausdrücklich zugeordneten Stellen.
- `eventRun.ts`, `eventRepository.server.ts`, `roundSnapshot.ts`, `MatchingModeration.tsx`,
  `MatchingPresentation.tsx`, `BingoBoard.tsx`: kleine Fassungreferenz und persistierte
  Medienbefehle. Der bestehende Quiz-`SynchronizedMedia` wird unverändert verwendet.
- `readPreparation.server.ts`: keine vollständigen V2-Zuordnungen im Moderationsabruf.
- Prisma-Schema, generierter Client und eine additive Migration; exakte
  Backup-/Restore-Inventur sowie Regressions- und Browserprüfungen ergänzt.

Es werden keine Quizvorlagen, Quizfragen, alten Karten, Druckfassungen oder Läufe umgebaut.
Die Quellfrage und ihre Originaldatei bleiben bei der Übernahme unverändert. Eine
rechtmäßig eingefrorene Kopie bleibt Bestandteil des berechtigten Spiels; spätere
Quelländerung, Archivierung oder Löschung verändert diese Fassung nicht. Neue Übernahme
prüft die aktuellen Quellenrechte erneut. Entzug der Spielrechte sperrt auch bekannte
Asset-UUIDs. Details: [Fachvertrag](./bingo-matching.md).

## Nachweise

| Prüfung | Tatsächlicher Nachweis |
| --- | --- |
| Datenbank | PostgreSQL 18, vollständige isolierte AP2/AP3/V3/V4-Regressionskette sowie Matching; keine Production-Verbindung |
| Migration | Nur `20261107150000_bingo_matching`; leere vollständige V4-Schemabasis und repräsentativ befüllte synthetische Datenbank; Transaktionsrollback geprüft |
| Bestand | Alte Karten, Druckversionen und Läufe vor/nach Matching-Migration vollständig verglichen |
| Restore | Echter isolierter Dump/Restore einschließlich Matching-Bytes, tatsächlicher SHA-256-Werte, Schema, Trigger, Referenzen und Snapshotvergleich bestanden |
| Auswahl | Original/Rückwärts × Interpret/Titel/Kombination getrennt gültig gespeichert; tatsächliche Feldreihenfolge Titel vor Interpret; ausgeschlossene und falsche Antworten bleiben ausgeschlossen |
| Weitere Medien | Bitcrush, Flagge, Umriss, synthetische Audiodatei im Vorlese-Slot und synthetisches Video tatsächlich gespeichert und abgespielt/angezeigt |
| Rechte | Admin/Manager, Editor, reine Reihenverwaltung, ohne Zugriff; fremde Reihe, falsche IDs, entzogene Rolle und deaktiviertes Produkt; Lesen und Schreiben serverseitig abgewiesen |
| Versionen | Quellbearbeitung, Archivierung und Löschung ändern ausgegebene Fassungen nicht; Manipulation fremder Asset-ID und konkurrierendes Speichern abgewiesen |
| Druck | 36 echte PDF-Kombinationen: V3/V4 × drei Formate × sechs Varianten/Antworten; alte Druckprüfungen erhalten |
| Browser lokal | Frische Anmeldung, sechs Kombinationen, Variantenwechsel ohne Antwortverlust, Bereich 15–26, Reload, nativer Abbruch, Zwei-Fenster-CAS und Rollen bestanden |
| Browser gehostet | Dieselben Editorfälle und frische getrennte Rollensitzungen bestanden; kein Auth-Stub |
| Live lokal/gehostet | Getrennte Moderation/Präsentation, echte Audio-/Videowiedergabe, Freigabe, Pause, Resume, Replay, Auflösung, Bilder, Kartenruf, Bestätigung, historische Korrektur/Nachprüfung, Rundenwechsel, Reload und Abschluss bestanden |
| Offline | Jeweils tabbezogenes CDP-Offline/Online für Moderation und Publikum: sichtbarer Fehler, Zustand erhalten, keine alte Wiedergabe beim Wiederverbinden |
| PDF im Browser | Echter lokaler und gehosteter Duplex-Download mit gemischten Text-/Zahlenfeldern; gespeicherte Zellen geprüft; Vorder-/Rückseite gerendert und visuell geprüft |
| Quiz | Bestehende Auswahl-, Reihenfolgen-, Kontrast-, Artwork-, Meme- und synchronisierte Medienregressionen; keine Änderung am Quizplayer |

Die Browserprüfungen sind automatisierte Chrome-Prüfungen mit echten Formularen,
Server Actions, Anmeldung, Datenbank, Medien und PDF-Download. Sie sind keine menschliche
Gestaltungsabnahme. Viewports: Verwaltung/Moderation 1366×768, Matching auch 1280×720
und 390×844; Publikum 1366×768, 1920×1080 und 390×844. Auf schmalen Publikumsflächen
bleibt der bestehende Hinweis auf zu wenig Platz für das vollständige 75er-Board erhalten.
Die Matching-Tabelle scrollt auf schmalen Geräten innerhalb ihrer Tabellenfläche.

Eine echte visuelle Abweichung wurde gefunden und behoben: Der wiederverwendete
Audio-Countdown benötigte einen eigenen Bingo-Container für `cqw` und eine scrollfreie Medienfläche. Die Schrift wurde
am Fenster statt am verfügbaren Feld bemessen. Lokale Containerbegrenzung und eine
Geometrieprüfung ergänzen den unveränderten Quizplayer. Eine weitere kleine Korrektur
trennt fehlende Mediendateien vom Hinweis auf Browser-TTS ohne Aufnahme. Das gekoppelte Karten-Eingabefeld zeigt ebenfalls den tatsächlich abgeleiteten Text; die manuelle Alternative bleibt gespeichert.

## Gemessener Transfer

Nur Loopback-PostgreSQL, keine Neon-/Production-Lastmessung. Pro Messung zehn Abrufe
je drei bestehenden Statuswegen (Moderation, Präsentationskennung, Spielpräsentation),
30 Abrufe in etwa 13,56 Sekunden, 1.500-ms-Takt. Derselbe synthetische Datenbestand und
derselbe Lauf-Fingerprint im Vorher-/Nachher-Vergleich; bereits vorhandene ETags in beiden
Varianten. Gezählt wurden tatsächliche PostgreSQL-TCP-Serverbytes einschließlich
Protokollrahmen sowie HTTP-Socketbytes und Nutzdaten getrennt. Authentifizierung nur in
diesem lokalen Messserver auf synthetischen Admin 1 festgelegt; kein TLS.

| Messung | DB-Abfragen | DB → Anwendung | HTTP mit Headern | HTTP-Nutzdaten |
| --- | ---: | ---: | ---: | ---: |
| Basis `33888777`, identischer numerischer Bestand | 380 | 60.405 B | 8.430 B | 0 B |
| Matching-Implementierung, derselbe numerische Bestand | 380 | 60.406 B | 8.430 B | 0 B |
| Neuer Matching-Lauf, eigener zusätzlicher Nachweis | 380 | 60.356 B | 8.430 B | 0 B |

Der numerische Vergleich enthält vier historische Läufe mit zusammen 8.156.356 B
eingebetteten Assets. Die Datenbank enthält zusätzlich sieben eingefrorene Matching-
Medien mit 219.011 B. Unveränderte Antworten sind 304. Kleine Protokollschwankungen
werden nicht als Optimierung ausgegeben. Es gibt keine behauptete neue Einsparung;
die bestehende schlanke Abfrage bleibt erhalten.

Beim ersten vollständigen Matching-Refresh wurden 62.030 B DB-/13.280 B HTTP-Nutzdaten
für Moderation sowie 54.423 B/2.426 B bzw. 57.004 B/2.426 B für die beiden Publikumswege
gemessen. Dieser Lauf hat mehr Karten/Journalinhalt und ist kein identischer Vergleich
zum numerischen Basislauf. SQL-Regressionen belegen zusätzlich die einzelne JSON-Zeile
und das Fehlen von Medien-, Drucksnapshot- und vollständigen Matching-Abfragen im
Statusweg. Medienabrufe sind getrennte, bedarfsweise Operationen.

Wiederholbar mit `scripts/testing/bingo-matching-transfer.measure.mjs before`, `after`
und `after --matching`, expliziter eigener Loopback-URL und Basis-SHA. Der alte Code
kann den neuen Matching-Vertrag nicht lesen; deshalb wird kein erfundener identischer
Matching-Vorherlauf behauptet. Die Tabelle enthält keine Hochrechnung.

## Isolierte Preview und Betrieb

[Matching-Tabelle](https://pubquiz-web-git-codex-bingo-matching-table-just-phil-gud.vercel.app/bingo/19b8f759-e82d-434d-960b-fb145c5f558f/matching?round=fea7275c-c5ad-45ee-b32c-9d034704ccdf)
für den ungestarteten eigenen Abnahmefall;
[geprüfte Moderation](https://pubquiz-web-git-codex-bingo-matching-table-just-phil-gud.vercel.app/bingo/72034f46-d3a8-470d-8d7f-3d6d85da0301/moderation)
und [Präsentation](https://pubquiz-web-git-codex-bingo-matching-table-just-phil-gud.vercel.app/bingo/72034f46-d3a8-470d-8d7f-3d6d85da0301/praesentation).
Der geprüfte Durchlauf ist abgeschlossen; neue Durchläufe werden ausdrücklich angelegt,
vorhandene werden nicht zurückgesetzt. Der erste Fall bleibt ungestartet und bearbeitbar.

Der vollständige gehostete Ablauf wurde zunächst auf `036003a3fc60adcd9498920f01961779105c6eaa`
geprüft. Der finale Head, CI-, READY-, Alias- und tatsächliche Runtime-Nachweis werden in
der PR-Abschlussnotiz aktualisiert. Nachfolgende kleine Korrekturen werden dort mit ihren
betroffenen Nachprüfungen ausgewiesen; ein älterer Nachweis gilt nicht automatisch für
veränderte Funktionen.

Eigene Datenbank `bingo_matching_review` im vorhandenen Launch-Nonprod-Projekt
`falling-sky-48140800`, Endpoint `ep-holy-term-baa881iq`. Bestehender einzelner Compute,
0,25 CU Minimum/Maximum und Suspendierung nach 300 Sekunden; keine neue Compute,
Replikate, Tarife oder Dienste. Andere Datenbanken und Branch-Zuordnungen unverändert.
Vertrauensfreigabe ausschließlich für `codex/bingo-matching-table`; eigene Medien im
Branch-Präfix `preview/b31e91b477a106650af3698e63081dcfa5a4faa9432e7d7e5852fa8aa9d5f979`.
Synthetische Audiodateien/Bilder wurden über den vorhandenen authentifizierten Upload
importiert. Keine manuelle Freigabe generierter Quiz-Slots oder neuen TTS-Erzeugung.
Die Vorlese-Testdatei ist ein synthetischer Testton, keine neu erzeugte TTS-Stimme. Das synthetische Video wird als unveränderliche vorbereitete Kopie geprüft; eine neue
Filmvorlage oder Video-Uploadoberfläche wird nicht behauptet.

Der bestehende autorisierte Preview-Automationszugang wird ausschließlich als Header
an den exakten Preview-Host gesendet; keine Änderung an Vercel-Schutzregeln und keine
Weitergabe an Blob-Hosts. Kontopasswörter bleiben in einer ignorierten privaten lokalen
Zugangsdatei, nicht im Repository, PR oder in Logs. Kein Production-Zugang verwendet.

## Prüfgrenzen und Entscheidungen

- Kein physischer Drucker-, Duplexregistrierungs-, Beamer- oder echtes Mobilgerätetest.
- Lange Beschriftungen bleiben vollständig oder werden vor Kartenproduktion abgewiesen.
  Konkret passt „Bob Dylan – Blowin’ in the Wind“ bei der geprüften kleinen Karte und
  vorhandenen Mindestschrift 10 pt nicht. Keine Kürzung, heimliche Verkleinerung oder
  neue Geometrie. Für positive PDF-Kombinationen werden kurze synthetische Antworten
  „Nina“, „Song“, „Nina – Song“ verwendet; die sechs langen fachlichen Auswahlen werden
  separat gespeichert und die unzulässige Produktion ausdrücklich abgewiesen.
- Lokale Quelldateien werden im serverlosen Betrieb, falls nicht gebündelt, nur vom
  eigenen statischen Deployment geladen. Deploymentprotection kann diesen internen
  Abruf einer geschützten Preview abweisen. Fehlende Dateien bleiben dann ausdrücklich
  nicht auswählbar; weder beliebige Remotehosts noch Schutzumgehung werden ergänzt.
- Die vollständige historische Prisma-Bootstrapkette wurde nicht als neue Installation
  erfolgreich ausgegeben: Die isolierte Modellbasis besitzt keine nachträglich erfundene
  Prisma-Historie. Die neue additive Migration und leere/befüllte Modellbasis sind geprüft.
- Ein lokaler Gesamttest stieß auf eine vorhandene Windows-`DevToolsActivePort`-Dateisperre;
  der betroffene bestehende LOVD-/Such-Browsertest bestand bei gezielter Wiederholung.
  Die erforderliche Linux-Head-CI muss abschließend vollständig erfolgreich sein.
- Historische Backup-Readback-Ursache und Wochenlauf sind separate Betriebspunkte.
  Die isolierte Wiederherstellung ersetzt keinen echten geplanten Wochenlauf.

## Abnahme in höchstens acht Schritten

1. Preview als synthetischer Admin oder Manager anmelden; Zugang aus der privaten
   lokalen Datei. Die gehostete Preview behält ihren Vercel-Zugangsschutz.
2. Obige Matching-Tabelle öffnen. Zeile 1: „Aus Quizbestand auswählen“,
   „Matching QA Musik“ suchen und die vorhandene Quelle wählen.
3. Unter „Medium und Variante“ Original oder Rückwärts wählen. Unter „Bingokarte“
   unabhängig Interpret, Titel oder Interpret + Titel wählen. „Gedruckt“ kontrollieren,
   „Zuordnung übernehmen“ und „Zuordnungssatz speichern“ betätigen; danach neu laden.
4. „Von“ 15 und „Bis“ 26, „Bereich auswählen“ und die Sammelaktionen ausprobieren.
   Andere Zuordnungen bleiben gespeichert. „1–90“ zeigt 76–90 als außerhalb des Modus.
5. In der Vorbereitung ausdrücklich Karten erzeugen. Bestehende Karten werden nicht
   automatisch ersetzt. Für den vorbereiteten Vergleichsfall „Karten und PDF“ öffnen
   und „Duplex-PDF“ herunterladen; Vorder-/Rückseite und Beschriftungen vergleichen.
6. Moderation und „Präsentation öffnen“ in getrennten Fenstern öffnen. Beim abgeschlossenen
   synthetischen Vergleichsfall „Neuen Eventdurchlauf vorbereiten“, dann „Erste Runde
   starten“ und „Bestätigen“. Alte Durchläufe bleiben erhalten.
7. Zahl 1 „Zahl veröffentlichen“, im Publikum „Präsentation freigeben“ und in der
   Moderation „Präsentationsmedium starten“. Pause und erneute Wiedergabe über die
   vorhandenen beschrifteten Iconbuttons; „Begriff auflösen“ zeigt die Kartenantwort.
8. „Pausieren“/„Fortsetzen“, Rufe, Korrektur und „Nächste Runde starten“ im synthetischen
   Fall prüfen. Nach Reload/Offline Publikum erneut freigeben und einen frischen
   Wiedergabebefehl geben. Kein Reset und keine Production-Ansicht verwenden.
