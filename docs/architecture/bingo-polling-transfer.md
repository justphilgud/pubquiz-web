# Bingo: schlanke Statusabfragen

Stand 6. November 2026. Getrennter Transfer-Fix vor den Druckdesignänderungen.
Keine Schema-/Migrationsänderung und keine Änderung des Pollintervalls (1.500 ms nach Abschluss).

## Ursache und Verantwortlichkeiten

`EventModerationPanel` → `/api/bingo/live/[gameId]` → `readLive` →
`selectedRun` / `readEventModeration` → `readPreparation` lud bisher zuerst
`r.*`, dann sämtliche Durchläufe mit `SELECT *`, darunter `visual_assets`, und
zusätzlich vollständige `print_snapshot`-Werte. Die HTTP-Projektion enthielt die
Bytes nicht, der Datenbanktransfer war trotzdem bereits entstanden.
`readEventAudience` hatte dasselbe `r.*`-Problem; der stabile Spieleinstieg ruft
diesen Reader ebenfalls auf. Der alte AP3-Reader ließ Liveassets bereits weg,
lud aber die Snapshots aller historischen Durchläufe.

SQL wählt jetzt explizite Felder. Die Protokollauswahl braucht ausschließlich
ID/Status/Protokoll. Durchlaufübersichten enthalten nur ID/Status/Startzeit;
Details werden nur für den ausdrücklich ausgewählten bzw. neuesten Lauf geladen.
Vorbereitungsdaten für die Moderation projizieren Versions-/Namens-/Hash-Metadaten
in PostgreSQL, keine eingebetteten Druckassets. Vorbereitung/Export behalten die
vollständige Snapshotvalidierung. Asset-Endpunkte bleiben separat und autorisiert.

`pollVersion.server.ts` liest nur mutable Identität, Revision, Vorbereitung und
Archivmetadaten. Es verwendet dieselbe aktuelle `gameSeriesForActor`-Policy wie
`preparationContext`: aktive Anmeldung, Bingo-Freischaltung und Verwaltungsrolle.
Ein ETag ersetzt niemals die Berechtigungsprüfung. Ein passender Validator liefert
304 ohne Körper; Datenbankzeit steht im Header `X-Bingo-Server-At`. Vor Start bzw.
bei expliziter neuer Vorbereitung wird das veränderliche Design weiterhin aufgelöst.
Es gibt keinen globalen Benutzer-/Rechte-/Zustandscache.

Änderungen laden den bisherigen fachlich geprüften Zustand neu. Das Replay des
gewählten Laufs mit seinen gestarteten Runden, zugeordneten Karten und Journal
bleibt vollständig: Historische Rufgrenzen, Hash-/Revisionsprüfung, bestätigte
Gewinne, Korrekturen und geschlossene Runden dürfen nicht durch einen unvalidierten
Kurzstatus ersetzt werden. Details anderer Durchläufe werden nur nach ihrem
Direktlink geladen. Bei unverändertem Status findet kein Replay und kein Lesen
von Karten, eingefrorenen Runden oder Journal statt.

`liveViewReader.ts` besitzt ausschließlich den flüchtigen Abrufzustand eines
montierten Fensters. Dieselbe Queue serialisiert Timer- und Nach-Schreib-Abrufe;
vorher konnten diese trotz seriellen Timers überlappen. Achtsekunden-Timeout,
Abort, Cleanup aktiver/noch wartender Requests, Neuaufsetzen nach Cleanup und
vollständiges Wiederlesen nach Verbindungsfehler bleiben geprüft. Alle drei
Polling-Komponenten behalten genau einen rekursiven Timer; Cleanup stoppt Timer
und Queue. UI-Entwürfe, CAS, Request-IDs, Schreibregeln und Animationen bleiben
in den bestehenden Komponenten/Fachdiensten. Aus der Datenbankzeit werden nur
angezeigte Laufzeiten fortgeschrieben; Pausen zählen nicht als aktive Zeit.

## Reproduzierbarer lokaler Nachweis

`node --import tsx scripts/testing/bingo-polling-transfer.measure.mjs before|after`
verlangt explizit `BINGO_TRANSFER_DATABASE_URL` zu Loopback und einer eigens
angelegten `bingo_ap2_qa_<Zeitstempel>`-Datenbank mit ausschließlich synthetischen
Konten. Keine .env-Datei wird eingelesen. Der exakte Baseline-Commit kommt aus
`BINGO_TRANSFER_BASELINE_COMMIT` (Vorgabe `192f27848f723559e3e18a0b9fdbbeb169a10ed3`).
Vorher wird Anwendungscode ausschließlich aus diesem Gitstand gebündelt.
Die Fixture `Large-asset polling regression` entsteht im bestehenden isolierten
PostgreSQL-Test. Weder Messlauf schreibt Spielzustand; ein Fingerprint der
betroffenen Laufzeilen muss vor/nach gleich bleiben.

Gemessen werden echte eingehende PostgreSQL-TCP-Socketbytes aller Poolverbindungen
vor der Dekodierung, einschließlich PostgreSQL-Protokollrahmen, nach Warm-up.
HTTP-Server-Socketbytes und unkomprimierte Körperbytes werden separat gezählt.
Die echten drei Route Handler laufen über einen lokalen HTTP-Server; nur die
Sessionauflösung wird für diese Messung auf synthetischen Admin 1 gebunden.
Die zusätzliche Browserabnahme verwendet echte frische Passwortanmeldungen.
Kein Neon-/Production-Verkehr, kein TLS, keine Hochrechnung als Messwert.

### Bingo-Matching (Vertragsversion 2)

Die neue gezielte Erweiterung ist in [bingo-matching.md](./bingo-matching.md) beschrieben: unabhängige Medien-/Kartenantwort, unveränderliche spielgebundene Fassung, 90 Verwaltungszeilen bei unverändertem 75er-Regelkern und aktuelle Berechtigungsprüfung. Bestehende V1-Karten-/Laufzeitverträge bleiben erhalten. Vollständige Zuordnungen und Medienbytes gehören ausdrücklich nicht in regelmäßige Statusabfragen. Praktische Nachweise und Grenzen stehen im zugehörigen Matching-Abnahmebericht.
