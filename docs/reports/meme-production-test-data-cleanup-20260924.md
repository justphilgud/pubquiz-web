# What the Meme! – Production-Testdateninventur und Bereinigung

Stand: 24. September 2026

## Trennung vom Produktrelease

Diese Maßnahme betrifft ausschließlich eindeutig identifizierte Testdaten. Sie
ist kein Deployment und enthält keine Migration, keinen Produktcode und keine
Änderung an realen Quiz- oder Teamdaten.

## Read-only-Inventur vor der Bereinigung

Zwei Production-Quizze sind anhand von Name, Eventreihe, Laufzeitdaten,
Teilnahmezeitraum und den bekannten Smoke-/Lasttest-Namensmustern eindeutig als
Testquizze der Kategorie A klassifiziert:

| Quiz | Name | Eventreihe | Zustand | Teams | Befund |
| --- | --- | --- | --- | ---: | --- |
| 15 | Meme Production-Smoke 2026-09-24 | Phliipps Testwiese | beendet | 21 | 19 Performance- und 2 Smoke-Teams; Meme-Submission, Vote und Ergebnis |
| 16 | Meme Production-Smoke Tie & Last 2026-09-24 | Phliipps Testwiese | beendet | 122 | 40 Load-, 2 Probe- und 80 Voting-Load-Teams; 5 Submissions, 40 Votes, reproduzierter Gleichstand |

Die Teamverwaltung enthält exakt 143 Suchtreffer für `Meme`. Sie verteilen sich
vollständig und ohne zusätzliche Verwendung auf diese beiden Testquizze:

- `Meme Load 1790223020412 T01` bis `T40`: 40
- `Meme Perf 20 T02` bis `T20`: 19
- `Meme Probe 1790223394202` und `Meme Probe 1790223457390`: 2
- `Meme Smoke Team A` und `Meme Smoke Voter B`: 2
- `Meme Voting Load 1790223511788 T01` bis `T40`: 40
- `Meme Voting Load 1790223534672 T01` bis `T40`: 40

Alle 143 Konten wurden am 24. September 2026 erstellt und zuletzt verwendet,
haben genau eine Teilnahme und gehören ausschließlich zur Eventreihe
`Phliipps Testwiese`. Die übrigen 20 globalen Teams stimmen mit keinem dieser
exakten Inventareinträge überein und bleiben unberührt. Kategorie-B-Kandidaten
wurden nicht gefunden.

## Abhängigkeiten und Löschplan

Die bestehenden Anwendungservices werden verwendet:

1. Quiz 15 und 16 über `Quiz zurücksetzen` leeren. Der Service löscht die
   Quiz-Team-Sessions, Interaktionsläufe, Blockfreigaben, Quiz-Team-Zuordnungen
   und die daran kaskadierenden Antworten, Meme-Reviews, Kandidaten, Votes,
   Ergebnisse und Punkte transaktional.
2. Beide leeren Testquizze archivieren. Die Oberfläche bietet für bestehende,
   gelaufene Quizze keinen physischen Quiz-Delete-Service; deshalb wird kein
   improvisiertes SQL verwendet.
3. Die anschließend nicht mehr verwendeten 143 globalen Testteamkonten einzeln
   über den bestehenden Admin-Teamservice löschen. Dieser entfernt Sessions,
   Antworten, Bewertungen, Punkte und Zuordnungen referenziell sauber.
4. Nachkontrolle auf Teams, Zuordnungen, Submissions, Kandidaten, Votes,
   Ergebnisse, Scores und sonstige Runtime-Daten.

Globale Contentfragen werden nicht gelöscht.

## Frisches Sicherheitsbackup

Der erste auf diese Bereinigung bezogene Lauf `35984868438` scheiterte beim
Upload des privaten Medienobjekts 498 von 690 nach einem clientseitigen
120-Sekunden-Timeout. Drei vorherige HTTP-503-Antworten wurden von der vorhandenen
Retry-Logik aufgefangen; die anschließende Transportexception wurde nicht erneut
versucht. Die möglicherweise unvollständige Referenz
`production/acceptance/run-35984868438-1` wird weder verändert noch als
Restore-Basis verwendet.

Ein weiterer Lauf `35971417759` übertrug alle 690 Medienobjekte, scheiterte aber
am nachgelagerten Retention-Dry-run mit `BRIDGE_UNAVAILABLE`. Auch dieser Lauf
erfüllt das vollständige Cleanup-Gate nicht.

Der kontrollierte neue Lauf verwendet:

- GitHub-Run: `35987903865`
- Backup-Referenz: `production/acceptance/run-35987903865-1`
- Production-/Main-SHA: `67d89934a4f12f4dfd4243fcc3ae6f99063c85c4`
- Backupart: manuell, geschützt, ohne Restore
- Retention: weiterhin ausschließlich Dry-run
- Snapshot: `2026-09-24T10:34:15.556304+00:00`
- Gesamtgröße: `442604452` Bytes
- Manifest-SHA-256:
  `c4ead618c98c2e982cfafa1e873e9c4c0d044da1131d70f6969e767625e2c685`
- Backupdauer: `1859188` ms
- Bridge-Aufrufe: `1397`
- OIDC-Tokenanforderungen: `8`, Cache-Treffer: `1389`, Refreshes: `7`
- OIDC-Retries: `0`, finaler OIDC-Fehler: keiner

Der Schritt `Verified Production backup` war erfolgreich. Damit sind
Production-Identität, read-only Leser, DB-Dump, 687 private Medienobjekte,
Authausschluss, Manifest, SHA-256, privater Readback, Größen-/Hashintegrität und
abgewiesener anonymer Manifestzugriff bestätigt. Alle 690 Artefakte einschließlich
DB-Dump, Auth-Overlay und Manifest wurden vollständig hochgeladen.

Der nachgelagerte Retention-Dry-run scheiterte anschließend reproduzierbar mit
`BRIDGE_UNAVAILABLE`. Der GitHub-Run ist deshalb insgesamt fehlgeschlagen. Die
Retention blieb deaktiviert und es wurde nichts gelöscht. Weil der Auftrag ein
vollständig grünes Sicherheitsgate vor dem ersten Production-DELETE verlangt,
wurde die Production-Testdatenbereinigung nicht ausgeführt und kein weiterer
Backup-Run gestartet.

## Ursachenanalyse

Die exakten Gruppen entsprechen voneinander getrennten Production-Smoke-,
Performance-, Probe- und Voting-Lastläufen. Der aktive Repositorybestand enthält
keinen Cleanup-Adapter und kein versioniertes Harness, das diese Namen erzeugt
und nach Erfolg oder Abbruch wieder entfernt. Die vorhandenen sicheren
Reset- und Team-Löschservices wurden nach den externen Testläufen daher nicht
aufgerufen. Ein Browserabbruch, Timeout oder fehlgeschlagener Test konnte die
bereits angelegten globalen Teams dauerhaft zurücklassen.

Eine kleine, sichere Korrektur innerhalb dieses Repositorys ist nicht möglich,
ohne einen neuen Production-Cleanup-Endpunkt oder eine unsichere namensbasierte
Löschregel einzuführen. Künftige Production-Harnesses müssen deshalb zwingend:

- eine Run-ID sowie alle erzeugten Quiz- und Team-IDs protokollieren;
- den bestehenden Quiz-Reset und Team-Löschservice in einem `finally`-Pfad
  idempotent aufrufen;
- Cleanup auch nach Teilfehlern erneut versuchen;
- bei Cleanup-Fehlern den Gesamttest fehlschlagen lassen und die verbleibenden
  IDs deutlich ausgeben.

Prefix-Löschung und stilles Ignorieren eines Cleanup-Fehlers bleiben verboten.

Unabhängig von der Datenbereinigung zeigt der erste Backupfehler eine begrenzte
Operations-Robustheitslücke: HTTP-Statusfehler werden wiederholt, eine vom
120-Sekunden-Abbruchsignal ausgelöste Transportexception beim PUT jedoch nicht.
Dieser Befund wird als separates Operations-Folgethema dokumentiert; der laufende
Produktbranch erweitert weder Backup- noch Löschrechte.

## Nachkontrolle

Eine Nachkontrolle nach Löschung entfällt, weil kein Löschschritt ausgeführt
wurde. Der read-only Vorzustand bleibt maßgeblich: zwei eindeutig klassifizierte
Testquizze, 143 ausschließlich dort verwendete Testteams und keine Kandidaten der
Kategorie B. Production-Daten blieben unverändert.
