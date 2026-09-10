# INFRA-AP1: Production → Preview, erneute Verifikation

10.09.2026. **Kein Datenrefresh durchgeführt. Mindestziel noch BLOCKED.**
Dieser Bericht ergänzt den Stand vom 07.09.2026 mit aktuellen Provider- und
Datenbanknachweisen. Er ist weder ein Backup- noch ein Restore-Erfolgsnachweis.

## Abschlussstatus

| Bereich | Ergebnis |
| --- | --- |
| Production-Inventar | ✅ Runtime-Release, Provider, Endpoint, Counts und Migrationen aktuell gelesen |
| Preview Code Baseline | ✅ main und Preview exakt derselbe SHA; kein Push erforderlich |
| Preview DB Refresh | **BLOCKED**: wirksame Credential-/Medienisolation nach Reset nicht bewiesen; kein Operations-Zugang für automatisierten Refresh |
| Medienstrategie | **vorbereitet / BLOCKED**: separater Nonprod-Store gefunden; allgemeine Production-Tokenbindung an Preview besteht weiter |
| Refresh Workflow | **vorbereitet / BLOCKED**: bestehender manueller Workflow enthält Guards, aber keinen aktiven Restoreadapter und liegt nicht im Defaultbranch |
| Daily Backup | **vorbereitet / BLOCKED**: dedizierter Leser und Backupsecrets fehlen; kein Dump erzeugt |
| Weekly Retention | **vorbereitet / BLOCKED**: 8 Wochen spezifiziert, nicht technisch eingerichtet |
| Release Backup | **vorbereitet / BLOCKED**: mindestens 6 Monate vorgesehen, kein Releasebackup vorhanden |
| Restore-Test | **BLOCKED**: kein validiertes Backup und kein temporäres Restoreziel; nichts zu bereinigen |
| Operations-Doku | ✅ vorhandene Dokumentation anhand aktueller Nachweise korrigiert |

## Verifizierter Code- und Deploymentstand

`git ls-remote` bestätigt am 10.09.2026 für `main` und
`preview/content-and-quiz-flow` jeweils
`1d4c703e068c0752a10757620d1f7fe03d47b20a`.

Die [Vercel-Projektübersicht](https://vercel.com/just-phil-gud/pubquiz-web)
zeigt weiterhin Production **Ready**, Deployment
`dpl_3Ufmv6QmvYkp712cPjVPXBDJtsN3`, Commit `1d4c703`, Domain
https://pubquiz-web.vercel.app. Preview-Branchdeployment weiterhin **Ready**:
`dpl_6vDGRFr2HePB8Cd9ou5aL4vcFvb9`,
https://pubquiz-8s8c338vw-just-phil-gud.vercel.app.

Kein Runtime-Diff zwischen den Remote-Branches. Im isolierten lokalen Arbeitsbaum
liegen zusätzlich frühere Infrastruktur- und Dokumentationscommits; `app/`,
`prisma/`, `config/`, `lib/`, `public/`, package.json und Lockfile haben gegenüber
Production keinen Diff. Fremde Änderungen des Hauptarbeitsbaums bleiben unberührt.
Kein neuer Preview- oder Production-App-Deploy ausgelöst.

## Neon-Inventar und tatsächliches Recovery-Fenster

Die vorhandene GitHub-SSO-Anmeldung öffnete Neon ohne neue Berechtigungserteilung.
Keine Credentials erzeugt, rotiert oder offengelegt.

Projekt `pubquiz`, ID `sparkling-dust-66487393`, Organisation
`org-red-fog-55598232`, **Launch**, AWS eu-central-1 (Frankfurt).

| Rolle | Neon-Branch | Endpoint | DB / Schema |
| --- | --- | --- | --- |
| Production, Default | br-noisy-art-al7qjmqd | ep-dawn-paper-alws45vx | neondb / pubquiz |
| Preview, Kind von Production | br-gentle-lab-allcaleq | ep-wispy-bird-al4hfg4e | neondb / pubquiz |
| Development, archiviert angezeigt | br-royal-shadow-al4hjwcu | ep-dry-dust-aljik09f | neondb / pubquiz; keine SQL-Verbindung in diesem Auftrag |

Vollständiger Direct-Host: jeweiliger Endpoint plus
`.c-3.eu-central-1.aws.neon.tech`. Pooler: `-pooler` vor diesem Suffix.
Provider zeigt PostgreSQL 17; aktuelle lesende DB-Abfrage bestätigt **17.11**.
Lokaler `pg_dump`/`pg_restore`-Client: PostgreSQL **18.4**.

Projektsettings und Branchübersicht bestätigen **6 Stunden History retention**.
Die Einstellung wurde nicht verändert. Launch unterstützt bis zu sieben Tage;
Branching/Time-Travel/Restore innerhalb des eingestellten Fensters sind laut
[Neon-Projektdokumentation](https://neon.com/docs/manage/projects) und
[Tarifübersicht](https://neon.com/pricing) verfügbar. Das Tarifmaximum ist keine
Zusicherung, dass eine konkrete ältere Änderung wiederherstellbar ist.

Die Branchliste zeigt drei vorhandene Branches und eine technische Obergrenze
von 5000; daraus keine kostenlose Kapazität ableiten. Laut Preisübersicht sind
zehn Branches im Launch-Tarif enthalten, zusätzliche Branches können Kosten
verursachen. Kein Branch angelegt, zurückgesetzt oder gelöscht.

Native Branch-/Resettechnik ist weiterhin bevorzugt. Vor einem Reset muss die
Behandlung von Rollen/Passwörtern konkret nachgewiesen sein. Neon beschreibt die
Erhaltung von Child-Passwörtern beim Reset aus einem **geschützten** Parent unter
[Protected branches](https://neon.com/docs/guides/protected-branches).
Diese Garantie wurde für das tatsächliche Setup nicht nachgewiesen und darf nicht
blind auf einen beliebigen Parent übertragen werden. Standardfallback bleibt
`pg_dump`/`pg_restore`, keine selbstgebaute tabellenweise Kopierengine.

## Lesende Datenbankprüfung

Beide Inventarabfragen liefen im Neon-SQL-Editor in **BEGIN READ ONLY / COMMIT**.
`current_setting('transaction_read_only')` ergab jeweils **on**. Nur technische
Counts, Schema- und Migrationsmetadaten abgefragt; keine Personen-/Antwortinhalte
in diesen Bericht übernommen. SQL-Editor-Historie wurde nicht als Anweisung benutzt.

| Messwert | Production | Preview vor Refresh |
| --- | ---: | ---: |
| Quizze | 5 | 26 |
| Fragen | 122 | 97 |
| Globale Teams | 28 | 94 |
| team_antworten | 242 | 216 |
| Tabellen im Anwendungsschema | 44 | 44 |
| Prisma-Migrationen, nicht zurückgerollt | 41 | 41 |
| Unfertige, nicht zurückgerollte Migrationen | 0 | 0 |

Migrationstabelle: **public._prisma_migrations**, nicht `pubquiz`.
Letzte Migration in beiden DBs: `20260907180000_pixel_stage_history`.
Fingerprint der sortierten Migrationsnamen und Checksummen:
`eb314e7b75da5b97606c086603f12782` in beiden DBs.
Fingerprint der Spaltennamen/-typen/-nullability/-defaults im Schema `pubquiz`:
`c7b50279207fc36ddecce4fa00a1a8bc` in beiden DBs.

Dies belegt gleichen Migrations- und Spaltenstand, **keinen vollständigen
Schema-Diff einschließlich aller Constraints, Indizes, Funktionen und Rechte**.
Ein frischer `prisma migrate status` gegen beide DBs ist mangels CLI-Zugängen
nicht ausgeführt; kein alter Deploymentlog wird als heutiger CLI-Nachweis ausgegeben.
Keine Migration angewandt.

Die wiederholbare, ausschließlich lesende Abfrage liegt unter
[inventory-read-only.sql](../../scripts/operations/inventory-read-only.sql).

## Zugriffsschutz und Medien

Unauthentifizierte GET-Stichprobe für `/quiz`, `/content`, `/admin/teams`:
Production jeweils **307 → /login**, Preview jeweils **302 → Vercel SSO**.
Keine Cookies oder Bypasssecrets verwendet. Der unveränderte Runtime-Code prüft
zusätzlich Rollen-/Quizrechte, auch für die Präsentation. Die Stichprobe zeigt
keine höhere Exposition; sie ersetzt keine vollständige Prüfung aller öffentlichen
Team-/Kalender-/Freigaberouten nach einem tatsächlichen Refresh.

| Store | Zugriff | Befund |
| --- | --- | --- |
| pubquiz-media-public / store_bIx6H2j23vJzi240 | Public | Vercel-Projektbindung Production und Preview |
| pubquiz-media-nonprod / store_VzfNwjccgkzhc9bi | Public | Separate Store-ID; dev/ und preview/ vorhanden; branchspezifischer Preview-Override verweist hierhin |
| pubquiz-media / store_BVRjATGCRBW0fBeF | Private | Vorhanden, aber nicht als dedizierter Backupspeicher mit separatem Zugriff/Retention abgenommen |

Nur die nicht geheime Store-ID wurde eingeblendet und anschließend wieder maskiert.
Keine Blob-Tokens offengelegt. Ein privater Store existiert also entgegen der
früheren unvollständigen Inventarisierung; seine bloße Existenz ist kein nutzbarer
Backupvertrag.

`pubquiz.medien.datei`: Production **93** URLs auf dem Production-Host und **7**
relative Referenzen. Preview bereits vor Refresh **42** Production-Host-URLs,
**8** Nonprod-Host-URLs und **7** relative Referenzen. Weitere JSON-/Template-/
Teamfoto-Referenzen sind damit noch nicht vollständig inventarisiert.

Eine DB-Kopie darf diese URLs nicht als schreibbare Production-Medien behandeln.
Option B (öffentliche Production-Medien nur lesen, neue Uploads ausschließlich
Nonprod) wäre ohne Produktcodeänderung möglich, **wenn** ausschließlich gültige
Nonprod-Schreibcredentials in allen betroffenen Preview-Deployments garantiert
sind. Aktuell bestehen sowohl eine allgemeine Production-und-Preview-Tokenbindung
als auch ein branchspezifischer Override. Nicht stillschweigend auf deren wirksame
Tokenidentität oder Geltung für weitere Branches vertrauen. Option A bleibt eine
vollständige physische Kopie mit Referenzmapping; nicht durchgeführt.

## Fehlende Betriebszugänge und Ausführungsgrenzen

GitHub-Inventar heute: keine Repository-Secrets; je Environment `production` und
`preview` nur `DATABASE_URL` und `VERCEL_TOKEN`. Production verlangt Required
Reviewer und erlaubt nur `main`. Schutzregeln unverändert.

Neon zeigt auf Production und Preview jeweils nur `neondb_owner`; keine dedizierte
Production-Leserrolle. In den vorhandenen lokalen Projektkonfigurationen und
Prozessvariablen keine `PRODUCTION_BACKUP_DATABASE_URL`, `NEON_API_KEY`,
`BACKUP_BLOB_READ_WRITE_TOKEN` oder `RESTORE_TEST_DATABASE_URL` gefunden.
Eine bestehende Browsersitzung ist kein unbeaufsichtigter Operations-Zugang.

Es wurde insbesondere **kein** vorhandener Production-Ownerzugang als Ersatz für
einen read-only Backupbenutzer exportiert und **kein** öffentlicher Store als
Backupziel benutzt. Kein neues Credential ohne den vorgesehenen Einrichtungsweg.

Konkrete nächste Einrichtungsschritte:

1. Effektive Nonprod-Blob-Token-/Storebindung für Preview nachweisen und die
   allgemeine Production-Tokenvererbung an weitere Preview-Branches beseitigen;
   Anwendung darf nur Nonprod-Schreibrechte erhalten.
2. Autorisierten Operations-Zugang für Neon-Clone/Reset bereitstellen oder
   dedizierten Production-Leser (`PRODUCTION_BACKUP_DATABASE_URL`) plus
   Preview-only Zielzugang (`PREVIEW_DATABASE_URL`) für Dump/Restore provisionieren.
   Rollen-/Passwortverhalten beim Clone vorab verifizieren.
3. Privaten, zweckgebundenen Backupbereich mit gesondertem Token und technisch
   eingerichteter Retention abnehmen: `BACKUP_BLOB_READ_WRITE_TOKEN`,
   `BACKUP_PRIVATE_BLOB_HOST`; Daily 14 Tage, Weekly 56 Tage, Release mindestens
   6 Monate. Vorhandenen privaten Medienstore nicht ungeprüft umwidmen.
4. Temporäres Restoreziel mit exakter verifizierter Kennung und Cleanuprecht
   bereitstellen; weder Production noch reguläres Preview/Development verwenden.
5. Erst danach Mutationsadapter fertigstellen/abnehmen und Ops-only-Integration
   der Workflows in main ermöglichen, ohne ein Production-App-Deployment auszulösen.
   Die bestehenden Workflows sind **noch keine ausführbare Refreshlösung**.
6. Reales Backup prüfen, isoliert wiederherstellen und Counts/Relationen/Schema/
   Prisma validieren. Erst nach Erfolg Zeitpläne aktivieren. Danach Preview
   kontrolliert erneuern und vollständigen Smoke durchführen.

Secretwerte nicht im Chat oder Repository übergeben; im vorgesehenen Secretmanager
bereitstellen. Keine Backups in Git oder öffentlichen GitHub-Artefakten.

## Verworfene Daten, Restore und Sicherheit

**Keine Preview-Testdaten verworfen.** Quiz 34 und frühere Abnahmedaten bleiben
erhalten. Der neue Auftrag erlaubt ihren späteren Ersatz ausdrücklich. Nach
einem späteren Refresh wäre der LOVD-Regressionsaufbau bei Bedarf anhand seiner
Dokumentation neu anzulegen; Production-Demo 9 käme mit der Baseline mit.

Kein Dump, kein Upload, kein Restore, kein temporäres Ziel, kein Cleanup nötig.
Production war niemals Refresh-/Restore-Ziel. In diesem Auftrag ausschließlich
lesende Production-Zugriffe; keine fachlichen DB- oder Provideränderungen.
Die unveränderte Deployment-/Gitidentität und lesende Abfragen sind die Nachweise;
kein unbelegter vollständiger Daten-Checksumvergleich behauptet.

## Prüfungen und Änderungen

- Vorhandene Infrastrukturguards: **11/11 bestanden** (Richtung, gleiche/fremde
  Ziele, Pooler-Aliasse, Restore-Ausschlüsse, Secret-Masking, fehlerhafte Dumps).
- Vollständige vorhandene Suite: **1095 Tests bestanden**, 0 Fehler.
- TypeScript: erfolgreich. Repositoryweiter ESLint `--max-warnings=0`: erfolgreich.
- Prisma-Schema: lokal mit eindeutig synthetischer Verbindungsvariable validiert;
  dabei keine Datenbankverbindung. Alle sechs YAML-Workflows erfolgreich geparst.
- Kein Buildpfad geändert; kein neuer Production-Build/Deploy erforderlich.
- Kein neuer Remote-CI-Lauf für die Dokumentation behauptet. Früherer CI-Nachweis
  für den vorhandenen Infrastrukturcode steht im Bericht vom 07.09.2026.
- Geändert: Operations-Dokumentation, dieser Bericht, wiederverwendbares
  read-only Inventar-SQL. Keine App-Komponenten, Abhängigkeiten oder Migrationen
  geändert. Verantwortlichkeiten verbleiben in den bestehenden Betriebswerkzeugen.

**AP9-Empfehlung:** Noch nicht als frisch aus Production baselined freigeben.
Codebasis und Migrationsstand stimmen überein, Datenbestand jedoch bewusst noch
nicht. Bestehende Preview-Tests können weiter genutzt werden, sind aber kein
Nachweis für einen gelungenen Refresh oder Restore.
