# Restore-only für vorhandene Production-Backups

Der manuelle Modus `restore-only` im bestehenden Workflow
`.github/workflows/ap94-acceptance.yml` startet ausschließlich Provenienzprüfung
und den separat reviewer-geschützten Restorejob. Der Backupjob ist übersprungen.
Die gleiche Workflow-Identität bleibt Voraussetzung der GitHub-OIDC-Bridge.
Kein neues Workflow-Trust, Token oder frei wählbares Datenbank-/Speicherziel.

Eingaben: `existing_backup_id` und unabhängig bestätigter
`existing_manifest_sha256`. Beispiel nach separater Integration, Bridge-
Bereitstellung und ausdrücklicher Ausführungsfreigabe:

```
mode=restore-only
existing_backup_id=production/acceptance/run-37971426600-1
existing_manifest_sha256=5dfa4924e283a354376716f6e03c8924fb401eaa28d5580dc572afdd006d6720
restore_after_backup=false
```

## Herkunft und Berechtigungen

Der secretsfreie Provenienzjob braucht `contents:read` und `actions:read` für
Run-Metadaten und das kleine `external-import-backup-evidence`-Artefakt. Exakter
Repository-/main-/Workflow-/Attempt-Bezug und erfolgreicher abgeschlossener
Backup-Lauf, Produktionsquellidentität und alle Integritäts-/Readbackflags sind
Pflicht. Abgelaufene/fehlende Evidence oder unbekannte IDs blockieren.
Legacy-Backups ohne diese Evidence werden vom Restore-only-Einstieg nicht
akzeptiert; der vorhandene gemeinsame Restorekern bleibt legacy-kompatibel.

Nur `operations-restore`, main, workflow_dispatch und der unveränderte OIDC-
Workflow dürfen bestehende Production-Backup-Pfade GET lesen. Backup-Schreib-
und Readback-Zugriffe bleiben an ihren eigenen Run gebunden. Kein Restore-PUT,
keine Löschung und keine Blobänderung. Die gezielte Bridge-Änderung muss vor
realer Ausführung im isolierten Operations-Projekt separat bereitgestellt werden;
ein main-Merge aktualisiert diesen Bridge-Service nicht automatisch.

## Ziel und Abbruch

Das bisherige feste neondb-Ziel ist nicht leer und bleibt gesch�tzt. Reale
Restores ben�tigen jetzt einen gesch�tzten tempor�ren Datenbanknachweis;
Provisionierung, Laufzeit und Bereinigung siehe [tempor�re Restore-Ziele](temporary-restore.md).
Der Modus `restore-preflight` nutzt denselben Kern und stoppt vor der Schreibgrenze.

Festes Nonprod-Projekt/Transport: Projekt icy-leaf-46256271, Branch br-bitter-paper-b20sx4lu,
Endpoint ep-small-poetry-b2jfzg9w, Rolle neondb_owner/PostgreSQL17.
Zieldatenbank ausschlie�lich ap94_restore_<freigegebene zuf�llige Test-ID>.
`RESTORE_TEST_EXPECTED_HOST` muss zum Code-Pin passen, Transport TLS mit SCRAM-
Channel-Binding, Environment-Label isolated-test. Production/Preview/Development-
Hosts sind verboten. Keine Eingaben für Ziel-URL oder Datenbankrolle.
Nach vollständigem Download/Hash-/Medien-/Manifestcheck prüft eine READ-ONLY-
Transaktion Identität, Leerzustand und wirksame Restore-Berechtigungen.
Tabellen, Typen, Routinen, weitere Schemas und unerwartete Extensions blockieren.
Die Leerprüfung wird in der einzigen Schreibtransaktion unter Advisory Lock
nochmals ausgeführt. Kein Bereinigungsmodus, keine automatische Reparatur.
Unterbrechung oder SQL-Fehler rollt die single-transaction-Wiederherstellung zurück.
Fehler nach Commit/bei Validierung bleiben erfolglos und erfordern separate
Prüfung des isolierten Zielzustands, niemals automatisches Löschen/Wiederholen.

## Nachweise und Grenzen

Bestehender Restorekern prüft Datenbankstruktur, Tabellen-Digests/Anzahlen,
Constraints, Sequenzen, Migrationen, redigierte Auth-Platzhalter, Medienbytes,
SHA256, Referenzzuordnung und persistierte Ergebnis-/Ranking-Rekonstruktion.
Referenzielle Integrität wird durch wiederhergestellte Foreign Keys validiert.
Medien werden als Originalbytes lokal im isolierten Runner geprüft, nicht in
Production/Preview neu publiziert. Auth-Geheimnisse sind bewusst ausgeschlossen;
der Restore enthält inert redigierte Platzhalter. Kein Browser-Spiel-Smoke.

`isolated-restore-evidence` meldet tatsächlichen PASS erst nach erfolgreicher
Wiederherstellung und vollständiger Validierung; separates BLOCKED-Fehlerartefakt
enthält nur festen Code. Keine Rohdaten, Credentials, SQL oder Providertexte.
Backup-PASS ist ausdrücklich kein Restore-PASS. Fehlende Evidence blockiert.

Tests: echte PostgreSQL17-Dumps, atomarer Restore, Abbruch/Rollback, nicht leeres
Ziel und unveränderte unerwartete Bestandsdaten, fehlende Rechte, Struktur/
Tabellen/Constraints/Resultate sowie synthetische Medien mit fehlenden/korrupten
Bytes. Die CI-Datenbank ist fest auf den lokalen CI-Service begrenzt; keine
Production-Daten/Secrets werden für Tests verwendet.

Vor Merge vollständige CI und Operations-only-Deploy-Scope abnehmen. Main-Merge,
Operations-Bridge-Bereitstellung und realer isolierter Restore benötigen jeweils
gesonderte Freigabe. Keine Production-App-Migration, Deployment oder Import.
