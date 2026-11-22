# PR177: exakter No-Delta-Plan für die Siegerehrung

## Zweck und Status

Der Auftraggeber hat am 22.11.2026 die gemeinsame Preview von PR177 fachlich
abgenommen und dessen Merge und Production-Release freigegeben. Die Vorprüfung
bestätigte sechs grüne PR-Checks für den abgenommenen Dokumentationsstand und
unveränderte Production-Aliasse. Die main-only Preflight-Registry enthält noch keinen
Plan für dieses Release. Dieser separate Operations-PR bereitet die erforderliche
Registrierung vor und bleibt bis zur eigenen Prüfung und Freigabe ungemergt.
Die Freigabe von PR177 ersetzt weder diese Planprüfung noch Environment-Reviews.

## Unveränderliche Eingaben

| Feld | Wert |
| --- | --- |
| Laufender Production-SHA | `e75c47cb4a2167a09303dad2540a252ea6860b1f` |
| Fachlich abgenommener PR177-Kandidat | `ec8a9fe0c73cb9fc17ffba69e73fc6c94d6f740c` |
| Anzahl Migrationen | 79 |
| Letzte Migration | `20261119150000_add_quiz_mode` |
| Manifest-SHA256 | `8af6aff9799497bf6415f2e235bf5f74e7d2807c449d0872761d5e70fc0adb35` |
| Schema-SHA256 | `c285d05ddb25bebba4314e74afd075f480462b816fb3ba0da468780e515727f8` |

Beide Production-Aliasse wurden am 22.11.2026 um 19:50 UTC lesend als READY und
production auf `dpl_4zEvSreKWw5PmCqCRCWpsJgbDgcp` bestätigt. Git bindet die
Schema- und SQL-Bytes, nicht die lokale Arbeitskopie oder ein Live-Katalog als
Sollzustand. Das Schema, alle Migrationen und das Lockfile sind unverändert.
Die Abstammung der Basis vom Kandidaten wird im Test geprüft. Ein anderer
Kandidaten- oder Basis-SHA bleibt gesperrt und benötigt eine neue Prüfung.

Der ursprüngliche PR177-Head `7c6c895f74258905338359515129039b717c931b`
enthielt den Operations-Merge von PR176 noch nicht. Deshalb wurde main regulär in
den Feature-Branch integriert: neuer Kandidat `ec8a9fe0c73cb9fc17ffba69e73fc6c94d6f740c`.
Der Diff ergänzt ausschließlich die vier Operationsdateien aus PR176;
`app`, `public`, Prisma und Paketdateien sind bytegleich zur abgenommenen Preview.
Dieser Synchronisationscommit muss erneut die vollständige CI bestehen. Die
fachliche Preview-Abnahme wird dadurch nicht auf geänderten Anwendungscode übertragen.

## Verantwortung und unveränderte Invarianten

Die bestehende `approvedNoDeltaPreflightPlan`-Liste erhält einen exakten Datensatz.
Paarvergleich, gepinnte Schema-/Manifestprüfung und vollständige Historienprüfung
bleiben in den bestehenden Funktionen. Es gibt keine neue Komponente, Wildcard,
Defaultänderung oder Änderung am geschützten Deploymentworkflow.

Der geheimnisfreie Referenzjob erzeugt `NO_SCHEMA_MIGRATION_DELTA` aus Git, ohne
Kandidatenanwendung oder SQL auszuführen. Im geschützten Historienjob wird der
Beleg erneut erzeugt und verglichen. PASS verlangt alle 79 eindeutigen,
abgeschlossenen, checksumgültigen Migrationen ohne pending/failed/drift. READ ONLY,
Readeridentität, TLS, Rollenrechte und getrennte Environment-Reviews bleiben
erhalten; keine Grants, Reparaturen oder Credentialkopien.

Dieser Nachweis ist kein neuer vollständiger Live-DDL-Abgleich. Die historische
Neuinstallationsgrenze bleibt `NOT_RUN / HISTORICAL_BOOTSTRAP_LIMITATION_UNCHANGED`.
Das Release benötigt keine neue Migration; ein Rückweg wäre ein gesondert
freigegebener Anwendungsrollback ohne Downmigration oder Datenrestore.

## Tests und Scope

Regressionen verwenden das echte immutable Git-Paar und prüfen falsche,
vertauschte, verkürzte oder mit alten Plänen gemischte SHAs; fehlende, zusätzliche,
doppelte, umsortierte und geänderte Migrationen; auch beidseitig gleich verfälschte
Hashes/Schemabytes; unvollständige oder fehlerhafte Historie. Alle alten Pläne
bleiben gültig. Eine zusätzliche Safety-CI-Matrixzeile prüft das Paar isoliert,
ohne Production-Secrets und mit disposable PostgreSQL17.

Nur Plan, Plantests, Safety-CI-Matrix und dieses Dokument ändern sich. Der
unveränderte Deployment-Scope muss dafür false liefern; zusätzliche App-, Schema-
oder Migrationsdateien müssen weiterhin true liefern. Lokale und CI-Ergebnisse
werden am Operations-PR dokumentiert, ohne sie als Live-Preflight auszugeben.

## Releasefolge nach eigener Prüfung

1. Operations-PR regulär integrieren; CI grün und Anwendungsdeployjob SKIPPED
   bestätigen. PR177 bleibt bis zu den folgenden Gates ungemergt.
2. Production-Aliasse und den unveränderten PR177-Kandidaten erneut bestätigen.
   main-only Read-only-Preflight für das exakte Paar ausführen. An erforderlichen
   Owner-Environment-Freigaben anhalten; kein Self-Approval oder Schutzbypass.
3. Nach vollständigem PASS geschütztes AP9.4-Backup: `mode=acceptance`,
   `backup_type=pre-deployment`, `protect_backup=true`, `restore_after_backup=false`.
   DB und referenzierte Medien mit Manifest, Hashes, privatem Readback und
   Integritätsnachweis verifizieren. Keine Authwerte oder Secrets veröffentlichen.
4. Erst dann PR177 regulär mergen, exakte main-Push-CI abwarten und den bestehenden
   geschützten Production-Workflow mit erforderlicher Owner-Freigabe nutzen.
   Mergebaum gegen Kandidat plus Operationsänderungen prüfen. Keine manuellen
   Migrationen oder Reparaturen.
5. Migrationstatus, READY, Runtime-SHA, beide Aliasse und risikoarmen lesenden
   Smoke-Test bestätigen. Keine Quiznavigation, Reveal-Zähler, Punkte oder
   Bewertungen in Production ändern. Nicht sicher lesend prüfbare Interaktionen
   bleiben durch die abgenommene isolierte Preview belegt und werden so benannt.

Bei Fehlern anhalten. Dieser Vorbereitungs-PR startet weder Live-Preflight noch
Backup, Restore, Merge, Migration oder Production-Deployment. Die fachliche
Abnahme der Siegerehrung bleibt gültig; Beamer/Safari und die dokumentierten
P0-Restgrenzen werden dadurch nicht neu als geprüft ausgegeben.
