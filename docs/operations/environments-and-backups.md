# Umgebungen, Preview-Refresh und Backups

Stand: 10. September 2026. **Teilweise vorbereitet, kein DB-Refresh und kein aktiver Backupbetrieb.**
Der [aktuelle Verifikationsbericht](../reports/infra-ap1-production-preview-2026-09-10.md)
ergänzt den [ersten INFRA-AP1-Bericht](../reports/infra-ap1-preview-backup.md) und trennt reale Nachweise
von noch nicht ausführbaren Schritten. Ein Dump oder erfolgreicher Upload allein
ist ausdrücklich kein Restore-Nachweis.

## Umgebungsvertrag und Inventar

Production ist Referenz und beim Refresh ausschließlich lesende Quelle.
Preview ist erneuerbare Arbeitsumgebung; Development bleibt unabhängig.
Es gibt keine Rücksynchronisation. Vor jedem Refresh muss die laufende
Preview-Arbeit beendet und der aktuelle Production-Release abgenommen sein.

| Umgebung | Git | Neon-Endpoint ohne Pooler | Datenbank / Schema |
| --- | --- | --- | --- |
| Production | `main` | `ep-dawn-paper-alws45vx.c-3.eu-central-1.aws.neon.tech` | `neondb` / `pubquiz` |
| Preview | `preview/content-and-quiz-flow` | `ep-wispy-bird-al4hfg4e.c-3.eu-central-1.aws.neon.tech` | `neondb` / `pubquiz` |
| Development | lokaler Arbeitsstand | `ep-dry-dust-aljik09f.c-3.eu-central-1.aws.neon.tech` | `neondb` / `pubquiz` |

Neon-Konsole und GitHub-Variablen bestätigen die Endpoints. Projekt **pubquiz**:
`sparkling-dust-66487393`, Organisation `org-red-fog-55598232`, Tarif **Launch**.
Production: `br-noisy-art-al7qjmqd` (Default); Preview: `br-gentle-lab-allcaleq`;
Development: `br-royal-shadow-al4hjwcu` (in der Branchliste als archiviert angezeigt).
Preview und Development sind Kinder von Production. GitHub bezeichnet
`wispy-bird`/`dawn-paper` als erwartete Branchkennung; technisch sind dies
Endpointbestandteile, keine Neon-Branch-IDs. Poolerhost = Endpoint plus `-pooler`.
Für Dump/Restore direkte Verbindung und PostgreSQL-Client gleicher oder neuerer
Hauptversion verwenden. Keine Poolerkennung als eigenständige Isolation behandeln.

Vercel-Projekt `pubquiz-web`, Team `just-phil-gud`; GitHub orchestriert Deployments.
Die Environments `preview` und `production` besitzen jeweils `DATABASE_URL` und
`VERCEL_TOKEN`. Keine Repository-Secrets vorhanden (Inventarzeitpunkt).
Production erlaubt ausschließlich `main` und verlangt einen Required Reviewer.
Dieses Gate wird weder für Backups abgeschaltet noch umgangen. Neue reine
Betriebszugänge müssen separat eingerichtet werden.

## Provider-Recovery

Aktuelle offizielle Neon-Dokumentation beschreibt zeitpunktbezogene Branch-Restores
innerhalb des konfigurierten Restore-Fensters ohne Supportanfrage. Planlimits laut
[Neon](https://neon.com/faqs/databases-recover-accidental-data-deletion): Free bis
6 Stunden/1 GB Änderungen, Launch bis 7 Tage, Scale bis 30 Tage. Das konfigurierte
Fenster gilt projektweit; siehe [Projektverwaltung](https://neon.com/docs/manage/projects).
Am 10.09.2026 über die bestehende GitHub-Anmeldung in Neon verifiziert: **Launch,
History window 6 Stunden**, drei vorhandene Branches. Das Fenster wurde nicht
verändert. Sieben Tage sind das Tarifmaximum, nicht das konfigurierte Fenster.
Die UI zeigt 3/5000 Branches als technische Grenze; dies ist keine Aussage über
kostenlose Branches. Ein echter historischer Restore wurde nicht ausgeführt.
Provider-Recovery ersetzt keinen unabhängig gelagerten PostgreSQL-Dump.

## Preview-Refresh: derzeit bis zum Guard vorbereitet

Bevorzugt wird ein provider-nativer Clone, sobald Projekt-/Branch-IDs,
Credential-Isolation und Medienvertrag nachgewiesen sind. Ohne verifizierbaren
Providerzugang ist der standardisierte Fallback `pg_dump`/`pg_restore` vorgesehen;
kein tabellenweises Eigenbau-Kopieren. Die endgültige Auswahl ist noch offen.

Der Workflow **Refresh Preview from Production** ist ausschließlich manuell.
Er prüft die feste Richtung und exakt bekannte Hosts/DB-Namen. Er bricht aktuell
vor jeder Mutation ab. Es gibt bewusst noch keinen ausführbaren Restore nach
regulärem Preview. Ein grüner Guard allein wäre keine Refresh-Freigabe.

Zur Fertigstellung sind in dieser Reihenfolge notwendig:

1. Production-Commit, Ready-Deployment, Smoke und Migrationstatus bestätigen;
   keine offene Rollbackentscheidung. Preview-Datenverlust bewusst einplanen.
2. Source/Target gegen das feste Inventar prüfen, einschließlich Pooler-Aliassen;
   keine Credentials ausgeben. Optional kurzlebige private Preview-Sicherung.
3. Authentifizierung und öffentliche/teambezogene Routen auf gleiche Exposition
   wie Production prüfen; private Inhalte dürfen nicht breiter erreichbar werden.
4. Medienisolation technisch nachweisen. Erst danach Clone/Dump erzeugen.
5. Preview für Schreibzugriffe sperren, Standard-Restore transaktional durchführen
   bzw. isolierten Clone validieren und kontrolliert umschalten. Nur Preview mutieren.
6. Migrationstabelle, Schemas, zentrale Tabellen/Relationen und Prisma prüfen.
   Keine spätere Featuremigration anwenden. Erst nach erfolgreichem Smoke freigeben.
7. Login/Quizliste/Bilder/Audio/Renderer lesen; optional eigenes klar markiertes
   Preview-Testobjekt schreiben. Production bleibt unverändert.

Fehlschlag: Preview gesperrt lassen, technischen Stand sichern, keine Production-
Reparatur und keine best-effort-Fortsetzung. Bei interaktiver Authentifizierung
`BLOCKED – interactive auth required` dokumentieren. Kein nächtlicher Refresh.
Regeltermin: bewusst nach einem Production-Release oder ausdrücklich bei Bedarf.

## Medienvertrag und noch offene Isolation

App-Uploads verwenden `prod/`, `preview/`, `dev/`. Datenbankreferenzen können
absolute Blob-URLs sein (`medien.datei`, Teamfoto-URLs, Template-/Medienkonfiguration);
repositoryeigene Assets verwenden relative Pfade. Eine DB-Kopie schreibt absolute
URLs nicht automatisch um. Vollständiges Produktionsreferenzinventar ist noch offen.

Vercel zeigt den **öffentlichen** Store `pubquiz-media-public`
(`store_bIx6H2j23vJzi240`), angebunden an Production und Preview. Zusätzlich bestehen
branchspezifische Preview-Overrides für Store-ID/Token/Webhook. Die Store-ID des
Preview-Branches verweist auf den separaten öffentlichen Store **pubquiz-media-nonprod**
(`store_VzfNwjccgkzhc9bi`) mit `dev/`- und `preview/`-Präfixen. Die tatsächliche
Tokenzuordnung und die Isolation für andere Preview-Branches sind nicht vollständig
verifiziert. Die allgemeine Production-und-Preview-Tokenbindung ist weiterhin vorhanden.
Keine Tokenwerte
enthüllen, kopieren oder im Bericht veröffentlichen.

Präfixprüfungen im Anwendungscode (z. B. Teamfoto-Löschung) sind vorhanden,
ersetzen jedoch keine Credential-Isolation. Vor dem Datenrefresh Option A prüfen:
physische Kopie in separat berechtigten Preview-Store mit vollständigem,
transaktionalem Referenzmapping. Option B (öffentlich lesbarer Production-Fallback)
ist nur nachgewiesen sicher, wenn Preview keinerlei Production-Schreibrechte besitzt.
Ein gemeinsamer Read/Write-Token genügt nicht. Bisher keine Medien kopiert oder
Referenzen geändert; kein Architekturumbau im Produkt.

## Unabhängige Backups

`scripts/operations/backup.ts` implementiert den vorbereiteten Dump-/Uploadweg:

- feste Production-Identität, dedizierter `pubquiz_backup_reader`, TLS `verify-full`;
- Prüfung auf Superuser-/DDL-/Tabellenschreibrechte; bei Fund Abbruch;
- `pg_dump --format=custom --no-owner --no-acl`, gesamte Datenbank einschließlich
  Migrationstabelle, mit read-only Session; keine Passwörter in Prozessargumenten;
- neue temporäre private Arbeitsdirectory je Lauf; anschließend lokale Bereinigung;
- Exitcode, Größe, `pg_restore --list`, SHA-256; Toolausgaben gelangen nicht in Logs;
- ausschließlich `access: private`, separat provisionierter Backup-Store, eindeutige
  UTC-/Environment-/Release-/UUID-Schlüssel, kein Überschreiben/Löschen;
- authentifizierter Readback mit Checksumme; Manifest erst als Abschlussmarker;
- Manifest enthält `restoredAndValidated: false`, bis ein separater Restore belegt ist.

Ein fehlerhafter Dump/Upload lässt alle älteren Backups unverändert. Ein eventuell
verwaister neuer Upload ohne Manifest zählt nicht als gültig. Bei einem Fehler
schlägt der Job sichtbar fehl; niemals alte Backups löschen, um Platz zu schaffen.
Größe/Prüfsumme sind technische Metadaten, Datensätze bleiben privat.

### Speicher, Verschlüsselung und Rechte

Es existiert ein privater Store **pubquiz-media** (`store_BVRjATGCRBW0fBeF`),
aber **kein verifiziert eingerichteter dedizierter Backupzugang mit Retention**.
Sein bestehender Zweck darf nicht stillschweigend umgewidmet werden. GitHub hat
weiterhin keine Repository-Backupsecrets; Production besitzt in Neon nur die
angezeigte Rolle `neondb_owner`, keinen `pubquiz_backup_reader`.
Öffentliche App-Blob-Stores werden abgewiesen. GitHub-Artefakte des öffentlichen
Repositories sind ungeeignet: Nutzer mit Repository-Lesezugriff können sie laden
([GitHub](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/download-workflow-artifacts)).

Vorbereiteter Adapter nutzt die bereits installierte Vercel-Blob-Bibliothek und
[Private Storage](https://vercel.com/docs/vercel-blob/private-storage); kein neuer
Cloudanbieter und keine Paketabhängigkeit. Einrichtung eines dedizierten privaten
Stores und Retention stehen aus. Vercel dokumentiert
[AES-256-Verschlüsselung im Ruhezustand](https://vercel.com/docs/vercel-blob/security).
Keine alleinige Behauptung durch eine Variable ersetzt diese Abnahme. Keine
clientseitige Verschlüsselung ohne belastbares externes Schlüsselmanagement.

Benötigte Secrets, nur in einem auf autorisierte Betriebsjobs begrenzten Kontext:

| Name | Minimale Berechtigung / Zweck |
| --- | --- |
| `PRODUCTION_BACKUP_DATABASE_URL` | dedizierter Leser, CONNECT/USAGE/SELECT, nötige Sequenz-Leserechte; kein Owner/DDL/DML/CREATEROLE; zukünftige Tabellen berücksichtigen |
| `BACKUP_BLOB_READ_WRITE_TOKEN` | ausschließlich privater Backup-Store, niemals App-Runtime; Vercel-R/W-Token ist storeweit, engeren Speicheradapter prüfen wenn append-only zwingend benötigt wird |
| `PREVIEW_DATABASE_URL` | nur dediziertes Preview-Ziel; spätere Refreshadapter-Einrichtung |
| `RESTORE_TEST_DATABASE_URL` | nur zuvor verifizierter temporärer Restore-Endpoint; niemals reguläre Umgebungen |

Variablen: `BACKUP_PRIVATE_BLOB_HOST`, `BACKUP_RETENTION_VERIFIED`,
`RESTORE_TEST_EXPECTED_HOST`. Keine automatische Credential-Erzeugung. Der jetzige
Workflow greift nicht auf das geschützte Production-Deployment-Environment zurück.
Auch zukünftige Bereitstellung muss Branch-/Workflow-Rechte begrenzen; keine Secrets
an untrusted PRs weiterreichen. PostgreSQL-Clientversion separat kompatibel provisionieren.

### Zeitplan und Retention: noch nicht aktiviert

| Klasse | Vorgesehener UTC-Termin | Mindestaufbewahrung |
| --- | --- | --- |
| Daily | täglich 03:17 | 14 Tage |
| Weekly | Sonntag 03:47, separater Dump | 56 Tage / 8 Wochen |
| Release | manuell vor Release | 186 Tage, mindestens 6 Monate |

Der Workflow ist manuell vorbereitet; Cron ist bewusst noch kein aktiver Trigger.
Retention wird **nicht durch Manifestfelder technisch durchgesetzt**. Es fehlt
ein geprüfter Speicher-Lifecycle bzw. separater Retentionjob. Erst nach Einrichtung,
Kostenprüfung und realem Restore darf `BACKUP_RETENTION_VERIFIED=true` gesetzt und
der tägliche/wöchentliche Trigger samt automatischer Klassifikation ergänzt werden.
Keine Löschrechte im Dump-Prozess benutzen. Release-Backups unabhängig aufbewahren.

## Restore-Test: separater, derzeit blockierter Prozess

Ein Restore-Guard verweigert Production, Preview und Development einschließlich
Pooler-Aliassen. Unbekannte Targets ohne exakt freigegebenen temporären Neon-Host
werden ebenfalls verweigert. Provisionierung, Restoreadapter und Cleanup werden
erst ergänzt, wenn ein autorisierter nicht-interaktiver Providerzugang besteht.
Der aktuelle Workflow bricht vor Restore ab, statt eine erfolgreiche Abnahme vorzutäuschen.

Vorgesehener Ablauf: temporären Branch/DB erstellen, Identität und Leerzustand
prüfen, privates Backup + Manifest laden, SHA-256/Format prüfen, `pg_restore`
mit Fehlerabbruch in isoliertes Ziel ausführen. Schema-/Migrationstabellen,
Quiz-/Fragen-Counts und FK-Relationen prüfen; Prisma-Verbindung, Schema-Kompatibilität
und lesenden App-Smoke bestätigen. Nur technische Counts dokumentieren. Danach
genau diesen temporären Endpoint entfernen; bei Authblocker ID und Cleanup offenhalten.
Niemand darf reguläres Preview oder Development als bequemen Restore-Test verwenden.

## Veröffentlichung der Betriebsworkflows

Die Änderungen liegen im Infrastrukturbranch. Neue `workflow_dispatch`-Workflows
müssen zuerst im Defaultbranch existieren; Schedules laufen ebenfalls dort.
Ein einfacher Push nach `main` würde nach CI den bestehenden Productionworkflow
auslösen. Deshalb hier **kein Main-Merge und keine Production-Neuveröffentlichung**.
Vor Aktivierung einen geprüften Ops-only-Integrationsweg festlegen, ohne das
Production-Reviewgate auszuschalten. Die Preview-Codebaseline ist davon unabhängig.

Vor zukünftigen Releases: erfolgreiches frisches Release-Backup mit Restore-Nachweis
oder eindeutig verfügbares projektspezifisches Provider-Restore-Fenster prüfen.
Ein vorbereiteter Workflow oder allgemeines Planlimit erfüllt diesen Vertrag nicht.
Bei Ausfall des geplanten Backups GitHub-Fehler prüfen, Ursache beheben, neuen Lauf
mit neuem Schlüssel starten. Frühere gültige Backups bleiben unangetastet.

B10b, System-E2E und fachliche Run-Historisierung bleiben separate Arbeitspakete.
