# Externe Fragen – Production-Importprozess

## Sicherheitszustand

Der Production-Writer ist ausschließlich als geschützter GitHub-Operationsjob
implementiert. Die Production-Weboberfläche bleibt read-only; Preview,
Development und unbekannte Umgebungen bleiben für Production-Schreibzugriffe
gesperrt. Die Existenz des Workflows ist keine dauerhafte Schreibfreigabe.

## Vorbereitung

1. Kandidaten außerhalb von Production recherchieren, lokalisieren und prüfen.
2. Nur bewusst ausgewählte Kandidaten in den finalen Plan aufnehmen.
3. `READY_FOR_REVIEW` und `REVIEW_REQUIRED` getrennt erhalten.
4. Plan einschließlich `importApproval.records` als kanonisches JSON unter
   `external-import-plans/` auf `main` ablegen. Jeder Eintrag bindet Kandidat,
   `APPROVED`, Reviewer-ID und Reviewzeitpunkt.
5. Den vom Export gelieferten SHA-256 unabhängig dokumentieren.

Der Plan darf danach nicht mehr durch KI-Recherche, Übersetzung,
Distraktorerzeugung oder Kandidatenerweiterung verändert werden.

## Read-only Preflight

Der Workflow **External Question Production Import** läuft ausschließlich auf
`main`. Sein erster Job verwendet im Environment `operations-backup` den
vorhandenen `pubquiz_backup_reader`, liest den Plan aus dem aktuellen
Main-Commit und prüft dessen Digest vor der Datenbankverbindung.

Eingaben:

- Batch-ID,
- Pfad unter `external-import-plans/`,
- Plan-SHA-256,
- tatsächlich laufender Production-SHA,
- exakter AP9.4-Backup-Run, Attempt, Backup-ID und Manifest-SHA-256,
- `dry_run=true` für die bevorzugte rein lesende Prüfung.

Der Datenbankzugriff erfolgt in `REPEATABLE READ READ ONLY`. Der Report enthält
nur Batch, Digest, Zählwerte und sichere Gatezustände. Credentials und
Connection-Strings werden nicht ausgegeben.

## Entscheidung

- `CONFLICT > 0`: Plan nicht freigeben; kein Überschreiben.
- `REVIEW_REQUIRED > 0`: fachlich klären und neuen Plan mit neuem Digest
  einfrieren.
- `CREATE = 0` und alle `ALREADY_PRESENT`: kein Schreibjob erforderlich.
- Nur `CREATE` und `ALREADY_PRESENT`: frisches Backup und Write-Gate zulässig.

## Backup-Gate

Unmittelbar vor einem Schreibjob wird das bestehende AP9.4/AP9.6-Verfahren
verwendet. Ein erfolgreicher Backup-Run erzeugt zusätzlich ein kleines
`external-import-backup-evidence`-Artefakt. Es enthält ausschließlich Backup-ID,
Run/Attempt, Snapshot, Abschlusszeit, Production-SHA, Manifest-SHA und sichere
DB-Identitätsdaten. Dump, Medien, Credentials und signierte Blob-URLs gelangen
nicht in GitHub-Artefakte.

Der Writer akzeptiert ausschließlich einen erfolgreichen
`ap94-acceptance.yml`-Run auf `main`, dessen Evidence exakt zu den Workflowinputs
passt. Manifest, privater Readback, Integrität, Production-Identität und
Production-SHA müssen bestätigt sein. Der Snapshot darf bei Importbeginn
höchstens zwei Stunden alt sein.

## Einmalige Einrichtung vor dem ersten Import

1. GitHub-Environment `operations-content-import` anlegen.
2. Deployment-Branches auf exakt `main` begrenzen.
3. Required Reviewer aktivieren und Administrator-Bypass deaktivieren.
4. Eine dedizierte Neon-Rolle `pubquiz_external_import_writer` mit LOGIN, ohne
   Superuser/Createdb/Createrole/Replication/BypassRLS anlegen. Sie erhält nur
   die für SELECT sowie INSERT/UPDATE auf Fragen, Antworten, Kategorienmapping
   und External-Import-Audit benötigten Rechte und Sequenz-USAGE. Keine DELETE-,
   DDL- oder Adminrechte vergeben.
5. Die Direct-Endpoint-URL dieser Rolle ausschließlich als Environment-Secret
   `PRODUCTION_IMPORT_DATABASE_URL` hinterlegen. Der Vertrag bleibt
   `sslmode=require&channel_binding=require`.
6. Die Environment-Variable `PRODUCTION_RELEASE_SHA` muss dem tatsächlich
   laufenden Release entsprechen.

Die vorbereitete Rolleneinrichtung liegt unter
`scripts/external-import/invoke-production-writer-role.ps1`. Sie verwendet den
fest geprüften Direct Host, `neondb`, den Owner `neondb_owner`,
`sslmode=require` und `channel_binding=require`. Owner- und Writer-Passwort
werden verdeckt abgefragt. Das für Neon erforderliche Klartextpasswort wird nur
im Prozessspeicher gehalten und über stdin an psql übergeben; es steht weder in
Dateien noch in Prozessargumenten oder der Shell-History.

```powershell
# 1. Production-Ziel, Rollenabwesenheit und PUBLIC TEMPORARY ausschließlich lesend prüfen.
& './scripts/external-import/invoke-production-writer-role.ps1' -Mode Precheck

# 2. Rolle und exakte ACL einmalig anlegen. Bei "already exists" stoppen.
& './scripts/external-import/invoke-production-writer-role.ps1' -Mode Setup

# 3. Mit dem neuen Credential ausschließlich lesend Rolle und ACL prüfen.
& './scripts/external-import/invoke-production-writer-role.ps1' -Mode Verify

# 4. Dieselbe Prüfung wiederholen und erst bei Erfolg das Secret per stdin speichern.
& './scripts/external-import/invoke-production-writer-role.ps1' -Mode Store
```

`Setup` vergibt keine Default Privileges. Neue Tabellen oder Sequenzen sind
damit fail-closed. `Verify` prüft Rollenattribute, Mitgliedschaften, DB-/Schema-
ACL, Spaltenzugriff auf `users`, die erlaubte Importfläche, benötigte Sequenzen
und fremde Domänen. Es führt keine Schreibprobe aus. Ein über `PUBLIC` geerbtes
TEMPORARY-Recht blockiert die Verifikation ebenfalls; die für den Backup-Reader
dokumentierte Ausnahme wird nicht auf den Production-Writer übertragen.
`Precheck` führt Ziel-, Rollen- und PUBLIC-Prüfungen in einer explizit read-only
Transaktion aus und liefert genau einen strukturierten Status an den Wrapper.
Der Wrapper setzt den Prozessstatus selbst: `0` für PASS, `10` für einen
fachlichen Sicherheitsblock, `20` für psql-/Verbindungs-/Ausführungsfehler und
`21` für fehlende oder unerwartete Statusausgabe. `Setup` führt denselben
read-only Precheck erneut aus, bevor es das Writer-Passwort abfragt oder
mutierendes SQL sendet. Die Setup- und Verify-SQL-Skripte verwenden für ihre
eigenen Sicherheitsabbrüche echte SQL-Exceptions mit `ON_ERROR_STOP`; sie
verlassen sich nicht auf `\quit <code>`.

### Read-only Inventur vor einer TEMPORARY-Entscheidung

Solange `PUBLIC` auf `neondb` das Datenbankrecht `TEMPORARY` besitzt, bleibt das
Writer-Setup blockiert. Vor einem möglichen globalen Entzug wird ausschließlich
lesend inventarisiert:

```powershell
& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' `
  "host=ep-dawn-paper-alws45vx.c-3.eu-central-1.aws.neon.tech port=5432 dbname=neondb user=neondb_owner sslmode=require channel_binding=require connect_timeout=30" `
  -X -v ON_ERROR_STOP=1 `
  -f './scripts/external-import/inventory-production-temporary.psql'
```

Das Skript startet `BEGIN TRANSACTION READ ONLY`, prüft Host, Datenbank und
Owner, liest Rollen, Mitgliedschaften, effektive und explizite ACLs, Default
Privileges, aktuell sichtbare temporäre Relationen sowie nur aggregierte
Sessionzahlen und endet mit `ROLLBACK`. Es liest weder Passwörter noch SQL-Texte
laufender Sessions oder Anwendungsdaten.

Ein späterer ACL-Eingriff ist ein eigener, erneut freizugebender
Production-Schritt. Der sichere Plan lautet:

1. alle Rollen und ihren tatsächlichen TEMPORARY-Bedarf eindeutig klassifizieren,
2. erforderliche rollenbezogene `GRANT TEMPORARY` in derselben kontrollierten
   Änderung vorbereiten,
3. `TEMPORARY` von `PUBLIC` entziehen,
4. die vorbereiteten Grants erteilen und effektive Rechte neu prüfen,
5. erst danach den Writer-Precheck und die Rollenerstellung ausführen.

Der Rollback muss die gezielten Grants entfernen und den vorherigen Zustand mit
`GRANT TEMPORARY ON DATABASE neondb TO PUBLIC` wiederherstellen. Vor Ausführung
werden Rollenbestand, bestehende Verbindungen und ein mögliches Wartungsfenster
erneut geprüft; dieses Runbook autorisiert die ACL-Änderung nicht.

Die Read-only-Inventur vom 28. September 2026 ist unter
`docs/reports/external-import-temporary-acl-inventory-20260928.md`
dokumentiert. Im beobachteten Production-Rollenbestand hängt ausschließlich der
`pubquiz_backup_reader` für TEMPORARY allein an `PUBLIC`; dieser Codepfad benötigt
keine temporären Tabellen. Owner und Neon-Providerrollen behalten die Fähigkeit
über explizite, geerbte oder Superuser-Rechte. Daher ist ein späterer Entzug von
`PUBLIC TEMPORARY` ohne zusätzlichen rollenbezogenen Grant möglich, sofern der
Rollen- und Sitzungsbestand unmittelbar davor unverändert bestätigt wird.

Rollenerstellung und Secret-Setup bleiben bewusste Production-
Betreiberaktionen. Nach `Store` darf nur der Secretname
`PRODUCTION_IMPORT_DATABASE_URL` sichtbar werden, niemals sein Wert.

### Effektive Writer-ACL

Erforderliche Leseoberfläche:

- `SELECT` auf Fragen, Antworten, Antworttypen, Kategorien, Kategorienmapping
  und den beiden External-Import-Audittabellen,
- ausschließlich `users.id`, `users.is_active` sowie die drei für den globalen
  Admincheck benötigten Spalten der Rollenzuweisung; kein Zugriff auf
  `users.password_hash` oder `users.email`.

Erforderliche Schreiboberfläche:

- spaltenbeschränktes `INSERT` auf Frage, Antworten, Kategorienmapping und
  External-Import-Audit,
- spaltenbeschränktes `UPDATE` ausschließlich auf Status, Report, Fehler und
  Abschlusszeit des Batch-Audits,
- `USAGE` nur auf den fünf dafür benötigten Sequenzen.

Nicht vergeben werden `DELETE`, bestehende Frage-/Antwort-Updates, Schema-
`CREATE`/`TEMPORARY`, Rollen-/Adminrechte sowie Schreibrechte auf Auth-, Quiz-, Team-,
Antwort-, Vote-, Score-, Moderations-, Backup-, Restore- oder Retentiondaten.

## Geschützter Write

Der Preflight-Report nennt vor dem Gate Batch, Digest, Production-SHA, Backup,
Snapshot und alle vier Entscheidungszahlen. Er zeigt außerdem den exakt zu
kopierenden Freigabekommentar:

```text
APPROVE_EXTERNAL_IMPORT plan=<digest> candidates=<candidate-digest> backup=<backup-id>
```

Nur `dry_run=false` erzeugt den zweiten Job im Environment
`operations-content-import`. Nach Required-Reviewer-Freigabe liest der Writer
die Approval-Historie dieses konkreten GitHub-Runs über die GitHub-API. Eine
allgemeine Environment-Freigabe ohne exakt passenden Kommentar reicht nicht.

Direkt vor dem ersten Write werden Plan, Digest, Production-SHA,
Datenbankidentität, Backup-Evidence und Preflight erneut geprüft. Danach läuft
jedes `CREATE` seriell in einer eigenen `SERIALIZABLE`-Transaktion. Der Writer
publiziert keine Frage; der Zielstatus ist `IN_REVIEW` und `freigegeben=false`.
`ALREADY_PRESENT` wird protokolliert und nicht erneut geschrieben. `CONFLICT`
oder `REVIEW_REQUIRED` blockieren den gesamten Lauf.

Writer-Fehler werden secretsicher als strukturierter Diagnosecode ausgegeben.
Der Code enthält ausschließlich die freigegebene Phase, Operation, Relation,
Kandidaten-ID und gegebenenfalls einen PostgreSQL-SQLSTATE, zum Beispiel
`EXTERNAL_IMPORT_WRITE_PHASE_FAILURE|phase=QUESTION_CREATE|candidate=2|operation=insert|relation=fragen|sqlstate=42501|cause=WITHHELD`.
Verbindungsstrings, Tokens, Passwörter, SQL-Texte, Fehlermeldungen und Stacktraces
werden nicht ausgegeben. Unbekannte oder nicht freigegebene Werte werden als
`WITHHELD` maskiert. Diese Diagnose ändert weder Transaktionsgrenzen noch
Guard-, Reviewer-, Backup- oder ACL-Prüfungen.

Bei einem Teilfehler bleibt der Zustand eindeutig: committed Items sind
`IMPORTED`, der Fehler ist `FAILED`, der Rest `NOT_RUN`. Eine Wiederaufnahme
erfordert einen neuen Workflow-Run, ein erneut gültiges Backup und eine neue
Reviewer-Freigabe. Der Auditreport wird als Workflow-Artefakt gespeichert; die
Autorisierung ist am Ende immer geschlossen.

Ein reiner Contentimport erfordert keine Migration und kein App-Deployment.

## Aktueller OpenTDB-Pilotplan

Der ältere Plan mit Digest `82bbdbad2125541fb2d28c49ce3f3d4da3311b00c2329f885b78fe2c6febdc87`
enthält noch keine dauerhaften `importApproval.records` und ist deshalb
absichtlich nicht writerfähig. Der aus dem bestätigten Preview-Review zweimal
identisch exportierte Nachfolger liegt unter
`external-import-plans/opentdb-batch-1-production-approved-20260928.json`.
Er enthält ausschließlich Kandidaten 2, 4 und 6 samt den bereits gespeicherten
Reviewer-IDs und Reviewzeitpunkten. Sein kanonischer SHA-256 ist
`971fab02b232fe8bac8ec31a6b6901f08415113f2a76cc38a284e3dab139581d`.

Die Items sind bis auf die neu materialisierten `importApproval.records`
inhaltlich identisch zum historischen Plan. Die Freigabedatensätze sind Teil des
kanonischen JSON; jede nachträgliche Änderung an Inhalt oder Reviewmetadaten
ändert dadurch den Plandigest. Der Import erzeugt weiterhin nur Fragen im
Lifecycle `IN_REVIEW` mit `freigegeben=false`.
