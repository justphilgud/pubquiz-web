# Bingo-Moderation und Präsentation – 27.11.2026

Basis: `main` `f03fd4912e0e0859f301078c2d329f4202152022`. Eigener Branch
`codex/bingo-moderation-presentation`. Kein Merge und kein Production-Deployment.

## Architektur und bewusste Regeländerungen

`EventModerationPanel` behält Polling, bedingte Reads, CAS, Retries, Rechte-/Archiv-
und Verbindungszustände. `DrawCorrection` verwaltet nur lokalen Entwurf/Sortierung;
seine Speichern-Aktion sendet direkt den bestehenden revisionsgesicherten Befehl.
`CardChecksPanel` bleibt der einzige reguläre V2-Prüf-/Entscheidungsarbeitsplatz.
`RoundDecks` zeigt ausschließlich lesende Metadaten: aktuelle, tatsächlich
eingefrorene Decks und aufklappbare weitere Runden. Mehrere eingefrorene Decks
sind gemeinsam aktiv; keine neue Auswahl oder Kartenänderung.

Neue V2-Befehle `call`, `identify`, `decide` sind am autorisierten Schreibpfad
gesperrt. Parser und Replay lesen vorhandene Journale unverändert; identische
Retries bereits gespeicherter Befehle liefern weiterhin dasselbe Ergebnis.
`HistoricalCalls` hat keine Formulare oder Entscheidungsbuttons mehr und zeigt
historische Nachweise mit Actor und Zeit ausschließlich lesend. Historische
manuelle Bestätigungen verhindern keine neue direkte Kartenentscheidung.
Alte offene Rufe/Nachprüfungen sperren keinen Runden-/Eventabschluss; Nachprüfungen
direkter Kartenentscheidungen bleiben verpflichtend. Ungültige historische Lose
werden weder gültig gemacht noch neu nummeriert. Ihre alte Nachprüfung verhindert
nicht die Auswahl eines anderen gültigen Loses. AP3-Replay und dessen strikte
Begründungsprüfung bleiben unverändert und durch echte Bestands-/Restoretests belegt.

V2-Korrekturen speichern ehrlich `reason: ""`, ohne Pflichtfeld, erfundenen Text
oder zweiten Bestätigungsdialog. Zahlenidentität, Reihenfolge, Alt/Neu, Actor und
Zeit bleiben im Ereignisjournal. Alte Gründe und Entscheidungen werden erhalten.
Die AP1-Korrekturfunktion bleibt standardmäßig strikt; nur V2 verwendet die enge
Option für die leere Begründung. Keine Schemaänderung, Migration oder Datenreparatur.

Die farbige Bühne ist eine ausdrückliche gestalterische Weiterentwicklung der
neutralen Bühne des Designmanifests: genau eine vorhandene Rundenfarbe dient der
Orientierung. Keine gespeicherten Designs, Karten oder Logo-Konfigurationen werden
umgeschrieben. Alle zehn Schrift-/Rundenfarbpaare erreichen mindestens 4,5:1;
ungezogen/gezogen/aktuell unterscheiden sich zusätzlich durch Fläche und Kontur.
Die vorhandene lokale Phil-Gud-Schrift gilt auch für Kopf, Status und Fußzeile.
Logos sind bei üblichen Präsentationsbreiten je 180×84 statt 90×42 CSS-px groß.
Der Rundenname erscheint einmal. Die bestehende Größenmessung wird nach dem
schmalen Fallback wieder auf dem sichtbaren Board ausgeführt.

## Nachgewiesene Prüfungen

| Prüfung | Nachweis |
| --- | --- |
| Zahlen/Buchstaben | Alle zehn Bereichsgrenzen und leere/ungültige Eingaben in Unit- und echten Browserprüfungen; Serverbereich/Dubletten unverändert |
| Kartenprüfung/Entscheidung | Explizite Entscheidung, gleiche Karte/Runde, weitere Prüfungen, Korrektur/Nachprüfung/Widerruf und Losidentitäten |
| Alte manuelle Rufe | Unveränderte Journalbytes einer ausdrücklich wiederhergestellten alten synthetischen Rufzeile; aktueller Schreibpfad abgewiesen, alter Retry idempotent, neue direkte Prüfungen und Abschluss möglich |
| Korrektur | Eine Zahleneingabe, kein Begründungsfeld, kein Bestätigungsdialog; Alt/Neu/Position erhalten; AP3 verweigert weiterhin leere Begründung |
| Decks | Tatsächlich eingefrorene Kartenanzahl je Serie aus separater read-only SQL-Aggregation; aktive und weitere Decks mit Links, ohne Änderungsaktion |
| Desktop-Geometrie | 1280×720, 1366×768, 1920×1080: Veröffentlichen, Check, Pause und Rundenabschluss innerhalb des Viewports, mindestens 44 px hoch, keine horizontale Überbreite |
| Schmale Moderation | 390×844: Umbruch, scrollbar erhaltener Inhalt, feste Hauptaktionsleiste, keine horizontale Überbreite |
| Präsentation | Alle zehn Farben bei Full HD, echte geladene Schrift/Logos, 75 Zellen, unterscheidbare aktuelle Zahl, keine Status-/Logoüberdeckung; zusätzlich 1280×720 |
| Schmale Präsentation | 390×844: ausdrücklicher bestehender Platzhinweis statt unlesbarem Zahlenboard; Rückkehr zur Laptopbreite stellt das Board wieder her |
| Bingo-Gesamtsuite | 55/55 lokal seriell erfolgreich, inklusive Board, Matching, Kartenprüfung, Uhren und Browserregressionen |
| Echte PostgreSQL-Abnahme | Vollständiger lokaler isolierter Lauf erfolgreich (84 s), inklusive AP3-Bestand, alter/neuer Historie, Rechte/CAS/Nebenläufigkeit, Matching, Abenddruck, Snapshot und vollständigem Dump/Restore |
| Typecheck / ESLint | Erfolgreich; keine neue Dependency, kein Prisma-/SQL-Delta |
| Build / abschließende CI | Verbindlicher Ergebnislink und endgültige Head-SHA werden im PR geführt; lokaler Windows-Turbopack-Lauf separat vom CI-Nachweis dokumentiert |

Ein erster paralleler lokaler Bingo-Testlauf bestand fachlich, scheiterte jedoch
beim Windows-Cleanup eines Chrome-Profils (`EPERM` im unveränderten Matching-Test).
Der Einzeltest und die gesamte serielle 55er-Suite bestanden. Keine fachliche
Assertion, Timeoutgrenze oder Aufräumsperre wurde dafür abgeschwächt.

## Screenshots

Die Bilder verwenden produktive React-Komponenten mit ausdrücklich synthetischen
Action-Grenzen und echten lokalen Fonts/Logos. Dies ist kein behaupteter gehosteter
HTTP-End-to-End-Nachweis und keine Production-Sichtprüfung.

| Ansicht | Screenshot |
| --- | --- |
| Laptop | [1280×720](assets/bingo-moderation-2026-11-27/moderation-1280.png), [1366×768](assets/bingo-moderation-2026-11-27/moderation-1366.png) |
| Desktop | [1920×1080](assets/bingo-moderation-2026-11-27/moderation-1920.png) |
| Schmale Moderation | [390×844](assets/bingo-moderation-2026-11-27/moderation-390.png) |
| LOVD-Rot und große Logos | [1280×720](assets/bingo-moderation-2026-11-27/presentation-1280.png), [Full HD](assets/bingo-moderation-2026-11-27/praesentation-runde-01.png) |
| Weitere Runden | [Blau](assets/bingo-moderation-2026-11-27/praesentation-runde-02.png), [Grün](assets/bingo-moderation-2026-11-27/praesentation-runde-03.png), [Goldocker](assets/bingo-moderation-2026-11-27/praesentation-runde-05.png), [Schiefer](assets/bingo-moderation-2026-11-27/praesentation-runde-10.png) |
| Schmale Präsentation | [Platzhinweis](assets/bingo-moderation-2026-11-27/presentation-390.png) |

## Grenzen

Kein Merge, kein Production-Backup/-Deploy, keine Änderungen an Produktionsdaten,
Quizbewertungen, gespeicherten Karten oder Eventkonfigurationen. Eine neue gehostete
Preview wurde nicht eingerichtet; der Auftrag verlangt einen reviewbaren PR mit
Screenshots. Fachliche Nutzerabnahme des Designs bleibt offen. Echte Mobilgeräte,
Systemtastaturen, Beamer und physischer Druck sind nicht durch die lokalen
Browsermessungen ersetzt. Historische AP3-Replays und der bestehende AP3-Adapter
bleiben getrennte Kompatibilität; neue V2-Bedienung verwendet ausschließlich Checks.

Der bereits bekannte historische lineare Schema-Bootstrap wird nicht repariert
oder als bestanden ausgegeben. Die PostgreSQL-Abnahme nutzt dieselbe offen
dokumentierte synthetische Schema-Basis wie die vorhandenen Projektprüfungen.
