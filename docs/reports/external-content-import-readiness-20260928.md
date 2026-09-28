# Erster Production-Contentimport – Betriebsbereitschaft

Stand: 28.09.2026. Dieses Dokument erfasst ausschließlich die Vorbereitung. Es
belegt keinen Contentwrite, kein neues Backup und kein Deployment.

## GitHub-Environment

- Environment: `operations-content-import`
- Environment-ID: `22920352794`
- Required Reviewer: `justphilgud` (`288915542`)
- Administrator-Bypass: deaktiviert
- Deployment-Branch: exakt `main`
- Environment-Variable `PRODUCTION_RELEASE_SHA`:
  `210313c11a109b1da1de8156688691281a3d0937`
- Environment-Secret `PRODUCTION_IMPORT_DATABASE_URL`: noch nicht gesetzt

GitHub-Environments besitzen keine zusätzliche Workflow-Allowlist. Die
Workflowgrenze ist deshalb Defense in Depth: Nur
`.github/workflows/external-question-import.yml` referenziert dieses Environment;
der Writer verlangt zusätzlich Repository `justphilgud/pubquiz-web`,
`refs/heads/main`, `workflow_dispatch`, den exakten `workflow_ref`, das exakte
Environment und Run-Attempt `1`.

## Writer-Berechtigungen

Die vorbereiteten Skripte erzeugen `pubquiz_external_import_writer` ohne
Superuser, Createdb, Createrole, Inherit, Replication oder BypassRLS. Die
erlaubte SQL-Fläche ist im Runbook und in
`setup-production-writer.psql` spalten- und objektgenau beschrieben.

Status:

- Rollenanlage: ausstehende manuelle Betreiberaktion
- lesende ACL-Verifikation: ausstehend
- Environment-Secret: ausstehend
- Secretwert lokal oder im Repository gespeichert: nein

## Plan und Production-Preflight

Der historische Pilotplan `external-import-plans/opentdb-batch-1.json` und sein
Digest `82bbdbad2125541fb2d28c49ce3f3d4da3311b00c2329f885b78fe2c6febdc87`
bleiben unverändert und sind nicht writerfähig.

Der finale Plan enthält ausschließlich Kandidaten 2, 4 und 6:

- Pfad: `external-import-plans/opentdb-batch-1-production-approved-20260928.json`
- SHA-256: `971fab02b232fe8bac8ec31a6b6901f08415113f2a76cc38a284e3dab139581d`
- Reviewer: bestehender Preview-Benutzer `1`
- Kandidat 2: `APPROVED`, `2026-09-26T17:59:08.666Z`
- Kandidat 4: `APPROVED`, `2026-09-26T18:00:49.513Z`
- Kandidat 6: `APPROVED`, `2026-09-26T18:01:12.177Z`

Die Metadaten stammen direkt aus dem angemeldeten Main-Exporter. Sie wurden
nicht aus UI-Texten abgeleitet. Zwei getrennte Exporte und die versionierte Datei
haben denselben SHA-256. Entfernt man nur `importApproval`, ist der übrige
Payload strukturell identisch zum historischen Plan; damit ist keine fachliche
Änderung seit der menschlichen Prüfung erkennbar. Reviewmetadaten und fachlicher
Inhalt sind gemeinsam vom neuen Plandigest abgedeckt.

Der geschützte read-only Production-Preflight lief als GitHub-Run
`36420627553` auf `main` und materialisierte den Plan aus Commit
`67d289c732e2f0254fc6d32420c12030918460cb`. Ergebnis:

- Production-Identität bestätigt: ja
- Production-Fragenbestand gelesen: 713
- Kandidat 2: `CREATE` (`NO_PRODUCTION_MATCH`)
- Kandidat 4: `CREATE` (`NO_PRODUCTION_MATCH`)
- Kandidat 6: `CREATE` (`NO_PRODUCTION_MATCH`)
- Summen: `CREATE=3`, `ALREADY_PRESENT=0`, `CONFLICT=0`, `REVIEW_REQUIRED=0`
- Preflight-Digest:
  `2f31c77e503749d6eab6669b9c59f5068af450779c90aa391f218bb9a3e9a2d8`
- Production verändert: nein
- Backup-Gate: erwartungsgemäß geschlossen
- `writeAuthorized = false`

## Berechtigungsreport

Der Writer darf ausschließlich neue, unveröffentlichte Fragen samt Antworten,
Kategorienmapping und append-only Importaudit anlegen sowie den Status des
eigenen Batch-Audits fortschreiben. Er darf keine vorhandenen Fragen oder
Antworten ändern oder löschen.

Verboten bleiben insbesondere Schema-/Datenbank-DDL, Auth-Write, Passwort- und
E-Mail-Lesen, Quiz-/Event-/Team-/Submission-/Vote-/Score-/Moderations-Write,
Backup, Restore und Retention. Die Rolle erhält keine Mitgliedschaft,
Default-Privileges oder Administrationsattribute.

Die lokale ACL-Definition verweigert auch `TEMPORARY`. Da Production ein über
`PUBLIC` geerbtes TEMPORARY-Recht besitzen kann, wird die Rolle nicht blind
angelegt: Ein solcher Ist-Zustand bleibt ein explizites Sicherheitsgate und darf
weder stillschweigend akzeptiert noch durch eine breite Änderung an `PUBLIC`
behoben werden.

Der Setup-Precheck wertet die effektive Datenbank-ACL vor `CREATE ROLE` aus und
bricht bei `PUBLIC TEMPORARY` mit Exitcode 5 ab. Ohne eine ausdrückliche
Entscheidung zu diesem datenbankweiten Recht werden daher weder Rolle noch
Secret angelegt.

## Unveränderter Sicherheitszustand

- Production-Deploy-Run `36415196235`: wartet weiterhin vor Migration/Deployment
- Production-Writer-Code neu deployed: nein
- Production-Content verändert: nein
- Content importiert: nein
- neues Production-Backup gestartet: nein
- `writeAuthorized = false`
