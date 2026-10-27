# PR #138: exakter Read-only-Preflight ohne Migrationsdelta

Ergänzung zum bestehenden [geschützten Preflight](production-read-only-preflight.md), 27.10.2026.
Keine Änderung der bisherigen SQL-Delta-Verträge oder Environment-Schutzregeln.

## Vertrag und Ablauf

Nur das unabhängig bestätigte Paar Production
`a4c5a9fd9adb182776afcfae38a977a12805a9ea` → Kandidat
`c50e56a0308276d16bc19681f3e6a7600c41682f` wird durch
`approvedNoDeltaPreflightPlan` zusätzlich zu `approvedPreflightPlan` erlaubt.
Andere Kandidaten, Merge-SHAs und vertauschte Paare bleiben abgewiesen.

Der geheimnisfreie Referenzjob vergleicht über Git exakt dasselbe Prisma-Schema
und dieselben 64 Migrationsdateien samt SHA256, einschließlich
`20261026210000_shared_game_design`. Er führt weder Kandidatenanwendung noch SQL aus.
Im geschützten Datenbankjob wird dieser Beleg erneut aus Git erzeugt und gegen das
Artefakt verglichen. Danach gelten die vorhandenen Produktionsidentitäts-, TLS-,
Session-, Leserrechte-, Historien- und EOL-Checksumregeln unverändert.
PASS verlangt zusätzlich genau die 64 eindeutigen abgeschlossenen Migrationen,
keine fehlgeschlagene, ausstehende, unerwartete oder geänderte Migration.
Fehlende Leserechte bleiben BLOCKED; keine Rechtevergabe oder Reparatur.

Dieser Pfad belegt die aktuelle Migrationshistorie und das fehlende
**Repository-Schema-/Migrationsdelta**, keinen neuen vollständigen Live-DDL-Abgleich.
Ein historischer Bootstrap-/Neuinstallationsfehler wird nicht erneut ausgeführt
oder als behoben ausgegeben: `NOT_RUN / HISTORICAL_BOOTSTRAP_LIMITATION_UNCHANGED`.
Die bisherigen isolierten SQL-/Schema-/Bootstrapprüfungen für alte Releasepaare
bleiben unverändert. Keine Baseline, kein resolve, migrate deploy, Backup oder Restore.

## Scope und Abnahme

Tests prüfen erlaubte/verbotene Paare, geänderte/fehlende/zusätzliche Migrationen,
Schemaänderungen, doppelte Historieneinträge, fehlende Gates sowie den Scope.
Die sechs Operationsdateien benötigen laut `needsApplicationDeployment` keinen
Anwendungsrelease; eine zusätzliche Anwendungsdatei aktiviert ihn weiterhin.
Der aktuelle Datenbanknachweis kann erst nach regulärer Integration dieses
Betriebs-PRs im main-only Workflow und den bestehenden Environmentfreigaben entstehen.
Unmittelbar vor dem anschließenden Release beide Aliasse und den Kandidaten erneut
gegen den Beleg prüfen. Kein Export von Datenbankcredentials aus Vercel.
