# AP9.4/AP9.6 – Retention-Bridge-Reparatur und Production-Cleanup-Gate

Stand: 24. September 2026

## Ergebnis

Der Fehler `BRIDGE_UNAVAILABLE` ist behoben. Der Retention-Dry-run wurde mit dem
bereits validierten Backup `production/acceptance/run-35987903865-1` erfolgreich
erneut ausgeführt. Der Lauf hat keine Backupobjekte oder Production-Daten
gelöscht. Die fachliche Production-Bereinigung bleibt am separaten manuellen
Löschgate gestoppt.

## Ursache

Betroffen war im Workflow `AP9.4 Manual Backup and Isolated Restore` der Schritt
`Retention policy evaluation after verified backup`. Der Retention-Client rief
die OIDC-geschützte Operation `backup-inventory` der separaten Vercel-Bridge im
Projekt `pubquiz-backup-operations` auf.

Der Provider versuchte, alle Objekte unter dem festen Prefix
`production/acceptance/` in einer Antwort zu sammeln und brach nach 4.096
Objekten ab. Jeder aktuelle Vollbackupstand umfasst ungefähr 689 bis 690
Objekte. Nach mehreren vollständigen Backups überschritt der Gesamtbestand die
feste Obergrenze reproduzierbar. Die Bridge lieferte HTTP 503; der Client
übersetzte dies erwartungsgemäß in `BRIDGE_UNAVAILABLE`.

DNS, Netzwerk, Vercel-Deployment, OIDC-Authentifizierung und Berechtigungen waren
funktionsfähig: Der unmittelbar vorherige Backupteil desselben Runs absolvierte
1.397 Bridge-Aufrufe und acht OIDC-Tokenanforderungen ohne finalen OIDC-Fehler.
Ein früher Referenzlauf (`35869326356`) war mit einem kleineren Gesamtinventar
noch erfolgreich; der direkt folgende vollständige Lauf (`35917743571`) traf die
Grenze erstmals reproduzierbar.

## Korrektur

Die feste Gesamtbestandsgrenze wurde durch eine begrenzte Cursor-Paginierung
ersetzt:

- Der Provider liefert maximal 1.000 Objekte je Seite und einen opaken Cursor.
- Bridge-Vertrag und Service validieren Cursor und Seitenantworten strikt.
- Der Client akkumuliert höchstens 64 Seiten und 32.000 Objekte und verweigert
  Cursor-Schleifen sowie ungültige Antworten.
- Die bestehende Retention-Planung mit Manifestprüfung, Schutzlisten,
  Latest-/Current-Guards, zweiter Inventur und ETag-geschützter Löschung blieb
  unverändert.
- Der neue manuelle Modus `retention-dry-run` referenziert ausschließlich bei
  deaktivierter Retention einen vorhandenen validierten Backupstand. Er führt
  weder Production-Backup noch Restore aus und erzwingt
  `BACKUP_RETENTION_VERIFIED=false`.

Geänderte Dateien des Fixes:

- `.github/workflows/ap94-acceptance.yml`
- `docs/operations/ap96-backup-automation.md`
- `scripts/operations/acceptance.test.ts`
- `scripts/operations/bridge-client.ts`
- `scripts/operations/bridge.test.ts`
- `scripts/operations/bridge/lib/contract.ts`
- `scripts/operations/bridge/lib/provider.ts`
- `scripts/operations/bridge/lib/service.ts`
- `scripts/operations/retention.test.ts`
- `scripts/operations/retention.ts`

Es wurden keine Secrets, Credentials oder GitHub-Environment-Zuordnungen
geändert. Die benötigten OIDC- und Environment-Werte waren vorhanden und korrekt
gescoped. Ein vorhandener Legacy-Secretname für einen statischen Blob-Token wird
vom Workflow nicht referenziert und war weder Fehlerursache noch Fallback.

## Tests und Deployment

- Operations-Regression: 88/88 erfolgreich, einschließlich Inventar mit 4.101
  Objekten und Cursor-/Loop-Negativfällen.
- Gesamte Repository-Testläufe: 562 + 14 + 1 + 1 + 1 + 181 erfolgreich.
- TypeScript: erfolgreich.
- ESLint für alle geänderten Dateien: erfolgreich.
- Separater Bridge-Typecheck: erfolgreich.
- Next-Build mit `CI=true`: erfolgreich.
- Deployment-Scope-Regression: erfolgreich.
- Pull Request: #33.
- Fix-Commit: `9d673d565e5e80086f313cfce8612b5f2061b15f`.
- Main-Merge-Commit: `e3cd2f77fe74482edd88a8633387853ef11d8312`.
- Main-CI: Run `35996220284`, erfolgreich.
- Bridge-CI: Run `35996220091`, erfolgreich.
- Operations-Bridge-Deployment: `dpl_9G3RVSrrh592fK3U9k8yMD6hYFmr`, READY.

Das Operations-Deployment betraf ausschließlich
`pubquiz-backup-operations`. Der Production-Job des PubQuiz-Workflows
`35996499003` wurde übersprungen. Es gab kein PubQuiz-Deployment und keine
Migration.

## Echter Retention-Dry-run

- Workflow-Run: `35996831427`.
- Main-Commit: `e3cd2f77fe74482edd88a8633387853ef11d8312`.
- Modus: `retention-dry-run`.
- Wiederverwendetes Backup:
  `production/acceptance/run-35987903865-1`.
- Manifest-SHA-256:
  `c4ead618c98c2e982cfafa1e873e9c4c0d044da1131d70f6969e767625e2c685`.
- Ergebnis: erfolgreich.
- Behaltene Backupstände: 27.
- Zur Löschung ausgewählte Backupstände: 0.
- Bytes vor und nach Planung: jeweils 6.200.162.083.
- Fremde Pfade: 0.
- Restore: übersprungen.
- Reale Retention-Löschung: keine.

Die 27 behaltenen Stände verteilen sich auf zwölf unvollständige oder ungültige
und deshalb sicher zurückgehaltene Stände, zwei Legacy-Schutzstände, fünf
Tagesfenster, sieben explizit geschützte Stände sowie den neuesten gültigen
Stand. Der Dry-run erzeugte keinen zweiten Vollbackupstand.

## Read-only Production-Cleanup-Inventar

Die Production-Oberfläche wurde nach dem erfolgreichen Retention-Dry-run erneut
ausschließlich lesend geprüft:

| Quiz | Name | Zustand | Teams | Antworten |
| --- | --- | --- | ---: | ---: |
| 15 | Meme Production-Smoke 2026-09-24 | beendet | 21 | 1 |
| 16 | Meme Production-Smoke Tie & Last 2026-09-24 | beendet | 122 | 5 |

Die globale Teamverwaltung liefert für den exakten Filter `Meme` weiterhin 143
aktive Teams, ohne unerwartete Treffer:

- `Meme Load 1790223020412 T01` bis `T40`: 40
- `Meme Perf 20 T02` bis `T20`: 19
- die zwei bekannten `Meme Probe`-Teams: 2
- `Meme Smoke Team A` und `Meme Smoke Voter B`: 2
- `Meme Voting Load 1790223511788 T01` bis `T40`: 40
- `Meme Voting Load 1790223534672 T01` bis `T40`: 40

Alle 143 Einträge zeigen genau eine Quizteilnahme, den 24. September 2026 als
letzte Nutzung und ausschließlich die Eventreihe `Phliipps Testwiese`. Der
bereits zuvor vollständig geprüfte Detailbestand ordnet sie ausschließlich Quiz
15 und Quiz 16 zu. Die erneut ermittelten Quiz-Teamzahlen 21 + 122 ergeben exakt
143.

Der vorgesehene Cleanup verwendet ausschließlich bestehende, autorisierte
Anwendungsservices:

1. Quiz 15 und 16 transaktional zurücksetzen. Dadurch werden nur deren Sessions,
   Antworten, Submission-Snapshots, Meme-Reviews/-Kandidaten/-Votes/-Ergebnisse,
   Punkte, Interaktionsläufe, Blockfreigaben und Quiz-Team-Zuordnungen entfernt.
2. Die beiden danach leeren Testquizze archivieren; es gibt keinen improvisierten
   physischen Quiz-Delete.
3. Die nun unbenutzten 143 globalen Testteams mit dem bestehenden Admin-Service
   löschen.
4. Eine read-only Nachkontrolle auf alle genannten Runtime-Tabellen ausführen.

Nicht betroffen sind Fragen, Eventreihen, Nutzer, produktive Quizze, produktive
Teams, Content- oder Medienobjekte. Kategorie-B-Kandidaten wurden nicht
gefunden.

## Sicherheitsstatus

- Das validierte Backup ist weiterhin vorhanden und unverändert.
- Retention bleibt deaktiviert und wurde nur als Dry-run ausgeführt.
- Quiz 15 und Quiz 16 wurden nicht zurückgesetzt oder archiviert.
- Keines der 143 Teams wurde gelöscht.
- Production wurde weder deployed noch migriert.
- Das Meme-Feature wurde nicht geändert.

Das technische und fachliche Löschgate ist damit grün. Der erste destruktive
Schritt bleibt von einer separaten ausdrücklichen Production-Löschfreigabe
abhängig.
