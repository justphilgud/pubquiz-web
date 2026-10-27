# Fehlgeschlagener Wochenlauf 26.10.2026 – Snapshot-Audit

## Befund und nachgewiesene Ursache

Der echte Schedule [40289563849](https://github.com/justphilgud/pubquiz-web/actions/runs/40289563849) lief auf Main/Production `669700e9d1668ce74345dfcc259d8aff37b2c644` (PR #130). Die Automatisierung war aktiviert. Er brach am 26.10.2026 um 08:03:39 UTC bei `SOURCE_CAPTURE` mit `DB_SNAPSHOT_FAILED` ab. Dump, Medienupload, Retention und Restore wurden nicht erreicht. Das ist kein Readbackfehler; der historische `PRIVATE_READBACK_FAILED` bleibt unabhängig ungeklärt.

Die Fehlerausgabe enthielt nur die Phase, nicht den darunterliegenden Schutzcode. Gegen das unveränderte veröffentlichte Schema ist ein deterministischer Widerspruch reproduziert: `reviewMemeArchiveExecutables` erwartete ausschließlich die drei Meme-Routinen und deren einen Trigger. Die beiden freigegebenen Migrationen aus PR #130 fügten aber `guard_legacy_event_roles` und `reject_obsolete_format_role_write` mit drei Triggern hinzu. Deshalb lehnt derselbe Audit die fünf Routinen/vier Trigger bereits nach zwei Schemaabfragen mit `SCHEMA_SECURITY_REVIEW_REQUIRED` ab, noch vor Tabellenzeilenexport. Der reale historische Lauf lieferte keinen detaillierteren Untercode; der Nachweis beruht auf seinen unveränderten Migrationen und derselben ausführbaren Prüfung, nicht auf einer geratenen Transportursache.

## Eng begrenzte Korrektur

Der bestehende Audit bleibt verantwortlich; kein zweiter Backup-/Restorepfad. Eine zusätzliche immutable Referenz `scripts/operations/schema-reference/role-guard-routines.json` bindet die beiden Migrationen an ihre SHA-256 über LF-normalisierte Git-Inhalte. Funktionssignaturen, Körperhashes, Sprache, Security-Invoker, Konfiguration und alle übrigen geprüften Attribute sowie die exakten Triggerbindungen/-zustände werden verglichen. Die fünf zugehörigen Tabellen müssen vollständig vorhanden sein. Unbekannte, fehlende, teilweise oder veränderte Objektmengen bleiben gesperrt; keine Namens-/Prefix-Ausnahme und kein pauschaler SQL- oder Credential-Scanverzicht.

Neue Snapshots enthalten die geprüften Rollen-Migrationsreferenzen zusätzlich zum unverändert versionierten Archivnachweis. Der bisherige Nachweis älterer Backups ohne diese Tabellen/Routinen bleibt bytegleich strukturiert. Der reguläre Nach-Restore-Snapshot muss wieder exakt passen. Keine bestehende Sicherung wird umgeschrieben.

Die Fehlerdiagnose erhält für genau diese Audit-Ablehnung den konstanten Grund `SCHEMA_SECURITY_REVIEW_REQUIRED`. Keine Rohfehlermeldung, Ursache, SQL, Tabellenzeilen, URL, Header oder Zugangsdaten gelangen in Logs. Andere unbekannte Fehler bleiben maskiert.

## Tatsächliche Prüfungen

- Neue isolierte Development-Testdatenbank, keine Productionverbindung: aktuelles vollständiges Schema plus unveränderte Funktionen/Trigger der drei freigegebenen Migrationen. Vorher reproduziert `SCHEMA_SECURITY_REVIEW_REQUIRED` nach zwei Abfragen; danach vollständiger READ-ONLY-Snapshot über 60 Tabellen PASS.
- Positive/negative Unitregressionen für historische und neue Referenz, unveränderte Migrationshashes, Funktionskörper, Security-Definer/Konfiguration, Triggerstatus/-bindung, fehlende/zusätzliche Objekte und secretsichere Diagnose. TypeScript und vollständiges Operations-ESLint erfolgreich; 133 gezielte Tests erfolgreich.
- Bestehender PostgreSQL17-Dump-/transaktionaler Restore-Integrationstest erweitert: tatsächlich unveränderte PR130-Funktionen/Trigger installieren, vollständigen Snapshot und Restore vergleichen und den weiterhin wirksamen Rollen-Schreibschutz prüfen. Ausführung und CI-Ergebnis werden im PR ausgewiesen. Kein Produktionsrestore.
- Keine App-/Quiz-/Migrations-/Zeitplanänderung, keine neuen Abhängigkeiten. Deployment-Scope bleibt Operations-only; ein Anwendungsrelease ist für diese Korrektur nicht erforderlich.

## Betriebsnachweis bleibt getrennt

Es wurde kein manueller Backup-/Restorelauf gestartet und kein alter Schedule gegen einen anderen Commit als erfolgreich umetikettiert. Der echte Wochenlauf-Nachweis ist mit diesem lokalen/CI-Test noch NICHT erbracht. Er kann erst nach regulärer Integration durch einen erfolgreichen GitHub-Lauf mit `event=schedule` auf dem unveränderten Montagsschedule erbracht werden; ein `workflow_dispatch` oder synthetischer Test ersetzt ihn nicht.

Nächster regulärer Termin nach dem 27.10.: **Montag, 02.11.2026, 02:30 UTC / 03:30 Europe/Berlin (MEZ)**, gegebenenfalls GitHub-Verzögerung. Dann müssen Snapshot, Dump, alle Medien, privater Readback, Integrität und anonymer Zugriffsnegativtest vollständig erfolgreich sein. Bei einer weiteren Ablehnung den neuen konstanten Diagnosegrund auswerten; keine Schutzprüfung deaktivieren. Die Datenverlusttoleranz von sieben Tagen kann nach dem ausgefallenen Wochenlauf bereits überschritten werden; bestehende Sicherungen bleiben unangetastet.
