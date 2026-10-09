# Production – Read-only Preflight

Dieser eigenständige Operations-Workflow prüft Production vor einer Releasefreigabe.
Er startet weder Backup noch Migration, Reparatur, Import, Build oder Deployment.
`deploy-production.yml` und die vorhandenen Backup-/Restoreworkflows bleiben unverändert.

## Ausführung und Rollen

Manueller Trigger nur auf `main` im Repository `justphilgud/pubquiz-web`.
Eingaben sind exakter Release-Kandidaten-SHA und unabhängig erwarteter aktuell
laufender Production-SHA. Kandidaten-Code wird niemals ausgecheckt/ausgeführt;
Git liest ausschließlich versionierte SQL-Dateien und deren SHA256. Der aktuelle
Production-SHA muss ein Vorfahr des Kandidaten sein. Andere Releaseformen sind
bewusst BLOCKED und erfordern eine gesonderte Prüfung.

1. `deployment-metadata` verwendet das bestehende reviewer-geschützte Environment
   `production`, dessen `VERCEL_TOKEN` und `VERCEL_ORG_ID`/`VERCEL_PROJECT_ID`.
   Ausschließlich feste GET-Endpunkte für Alias, Projekt und Deployment; Redirects
   sind ausgeschlossen. Erwarteter SHA, tatsächliche Aliasbindung, Projektziel,
   Productiontarget und READY müssen übereinstimmen. Alias wird erneut aufgelöst.
   Responsebodies werden nie geloggt/gespeichert; Bericht enthält nur freigegebene
   Metadaten. Fehlender Commitnachweis oder widersprüchliche API-Metadaten blockieren.
2. Nur nach erfolgreichem Metadatenjob liest `migrations` im bestehenden
   `operations-backup` die vorhandene `PRODUCTION_BACKUP_DATABASE_URL`.
   Fest erwarteter Productionendpoint/DB/Schema und TLS mit Channelbinding;
   tatsächlich angemeldete Rolle muss `pubquiz_backup_reader` sein.
   `BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY`, 30s Statementtimeout,
   explizite read-only-Sessionprüfung und feste SELECT-Abfrage der Prismahistorie,
   abschließend immer ROLLBACK. Keine frei wählbaren SQL-Statements.

Der Workflow erhält nur `contents: read`, weder Schreibrechte noch OIDC.
Es gibt keinen Zugriff auf das Production-Anwendungs-DB-Credential und keine
Writerumgebung. Bestehendes Vercelcredential kann umfangreichere API-Rechte haben;
der Code verwendet ausschließlich GET und ruft keine Environment-/Secret-API auf.
Datenbank-SELECT-Rechte sollten zusätzlich rollenbedingt eingeschränkt bleiben;
eine privilegiertere Rolle wird abgewiesen und fehlende Rechte nicht automatisch
erweitert. Für `pubquiz._prisma_migrations` werden USAGE auf Schema und SELECT auf
die Historientabelle benötigt; keine INSERT/UPDATE/DELETE/DDL-Rechte. Keine neue
Rolle, Credentialkopie oder Secretrotation in diesem PR.

## Einmalige offene Konfiguration

`production` benötigt zusätzlich die nicht geheime Variable `PRODUCTION_ALIAS`
mit dem tatsächlich zu prüfenden Hostnamen, ohne Protokoll/Pfad. Sie war bei der
Metadateninventur am 09.10.2026 noch nicht vorhanden. Das historisch bekannte Ziel
`pubquiz-web-just-phil-gud.vercel.app` vor Einrichtung unabhängig bestätigen.
Vorhandene Secrets wurden nur anhand ihrer Namen inventarisiert, nie ausgelesen.
Keine Environment-/Branchpolicy wurde geändert. Die bestehenden main-only-Regeln
und Reviewer bleiben erhalten; Integration und erster Productionlauf benötigen
separate Freigabe. Fehlende Variable ergibt BLOCKED und verhindert DB-Prüfung.

## Migrationsvergleich und Ergebnis

SQL-Dateien des Kandidaten werden bytegenau über Git gehasht. Erfolgreiche aktuelle
Historieneinträge müssen existieren und checksumidentisch sein. Entfernte/geänderte
historische Migrationen ergeben FAIL. Erwartete neue Migrationen ergeben sich aus
Kandidat minus SQL-Dateien des verifizierten laufenden Releases. Pending Migrationen,
die bereits zum laufenden Release gehören, sind unerwartet und FAIL. Unbeendete,
nicht zurückgerollte Prismaeinträge sind failed und FAIL. Bereits erfolgreich
angewendete Kandidatenmigrationen dürfen nicht nochmals pending erscheinen.

- PASS: alle Metadaten/Identitäten vollständig bestätigt; Historie vollständig
  lesbar und nur erwartete pending Migrationen, ohne Drift/failed Einträge.
- BLOCKED: fehlende Credentials/Variable, Readerrechte, Connection/Metadata,
  unbekannte Identität/Transport, unerwarteter SHA oder nicht prüfbarer Releasepfad.
- FAIL: bestätigte unerwartete pending Migrationen, failed Historie oder Drift.

Jede BLOCKED-/FAIL-Prüfung beendet den Job nicht erfolgreich. Fehlgeschlagene
Voraussetzungen lassen Folgejobs überspringen; übersprungene Prüfungen sind niemals
PASS. JSON-Artefakte und Jobsummary enthalten Statuscodes, SHA/Deployment-/Alias-
Metadaten sowie applied/pending/failed/expected Namen und Zeitpunkte. Keine
Migrationlogs, Secrets, DB-Strings, API-Responsebodies oder Teilnehmerdaten.
Ein erfolgreicher Workflow ist notwendig, aber keine Deploymentfreigabe.
Snapshots können veralten: nach Backup und unmittelbar vor Deployment Alias/SHA
und Migrationsplan erneut bestätigen; parallele externe Vercel-Promotions sind
nicht durch GitHub-Concurrency gesperrt.

## Abnahme und Integration

`production-preflight-ci.yml` verwendet PostgreSQL17 ausschließlich auf einem
festen disposable localhost-Ziel `preflight_ci`. Fixtures werden im Testsetup
angelegt; die getestete Produktionsfunktion sendet nur BEGIN/SET/SELECT/ROLLBACK.
SELECT-only Leser, wirklicher Read-only-Transaktionsschutz selbst für privilegierte
Session, unveränderte Historienhashes und Fixturewerte, fehlende SELECT-Rechte,
Migrationdrift/-fehler und Vercel-Metadatenwidersprüche werden geprüft.
Keine reale Preview-/Production-Verbindung oder Deployment zur CI-Abnahme.
Die volle vorhandene CI und Bridge-Prüfung laufen zusätzlich.

Der reine Operations-PR basiert auf main und beinhaltet keine PR95-Inhalte.
Deployment-Scope schließt ausschließlich die beiden neuen Operationsworkflows aus;
Mischänderungen an App/Schema/Paket triggern weiter reguläres Deployment.
Productionworkflow selbst ist unverändert. Später diesen Operations-PR nach eigener
Freigabe integrieren; Scope-only Integration darf keine Anwendung deployen. Dann
Aliasvariable prüfen/einrichten und Workflow separat auf main freigeben.
Danach Reihenfolge: aktueller Preflight → separates geschütztes Backup → Backup-
Integritätsnachweis → explizite Releasefreigabe → bestehender Migration-/Deploymentjob.
Ein optionaler isolated Restore bleibt eigener geschützter Vorgang.

API-Verträge: https://vercel.com/docs/rest-api/aliases/get-an-alias,
https://vercel.com/docs/rest-api/projects/find-a-project-by-id-or-name,
https://vercel.com/docs/rest-api/deployments/get-a-deployment-by-id-or-url.

## Expliziter Berechtigungsnachweis vor Historienzugriff

Nach READ ONLY und Sessionidentit�t werden PostgreSQL-Kataloge gepr�ft: Relation
vorhanden, Schema-USAGE und wirksames SELECT; keinerlei INSERT/UPDATE/DELETE/TRUNCATE/
REFERENCES/TRIGGER, erh�hte Rollenattribute, direkte/transitive Rollenmitgliedschaft
oder Eigent�merrechte. Fehlende oder unbekannte Nachweise sind BLOCKED und verhindern
den Historien-SELECT. Nur freigegebene boolesche Rechtebelege werden gespeichert.
Keine GRANT/REVOKE-Anweisung wird im Production-Code ausgef�hrt. Integrationstests
pr�fen jede Schreibberechtigung, Rollenmitgliedschaft, privilegierte Eigent�merrolle,
fehlendes SELECT sowie unver�nderte Daten. Der kombinierte Migrations-/Deploymentjob
bleibt bei s�mtlichen neun PR97-Dateien durch required=false �bersprungen; der reine
Scope-Workflow darf starten. production/PRODUCTION_ALIAS ist ausdr�cklich auf
pubquiz-web.vercel.app best�tigt; keine Credentials wurden ge�ndert.

## Einzelne Vercel-Identit�tsgates

Jeder feste GET-Endpunkt erh�lt einen API-Gate: fehlende Berechtigung, Not Found,
Netzwerkfehler und ung�ltige Antwort sind getrennt BLOCKED. Aliasname, Projekt,
Deployment-ID, Projekt-Productiontarget, Environment, READY, vollst�ndiger SHA und
wiederholte Aliasbindung erhalten eigene Gates. Fehlende Daten BLOCKED; best�tigte
Abweichungen FAIL. Gesamt-PASS erfordert alle Nachweise. Keine fehlende SHA wird
akzeptiert und der DB-Job bleibt durch needs: deployment-metadata gesperrt.
Artefakte enthalten nur Codes und syntaktisch gepr�fte IDs/SHA sowie den konfigurierten
Alias; keine Rohantworten, Namen, E-Mails oder frei w�hlbare API-Strings.
GitHub-Environment-Deploymentrecords von Preflightjobs belegen keinen Vercel-Apprelease
und werden nicht als Ersatz f�r den Vercel-SHA verwendet.
Die bisherigen generischen Artefakte erlauben keine r�ckwirkende Bestimmung des
fehlenden Einzelnachweises. Erst die neue reale Ausf�hrung kann diesen best�tigen.
