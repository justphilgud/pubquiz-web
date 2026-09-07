# INFRA-AP1 – Baseline und Backup-/Restore-Vorbereitung

7. September 2026. **Teilweise abgeschlossen; kein aktiver Backupbetrieb und kein
DB-Refresh/Restore-Nachweis.** Alle unabhängigen sicheren Arbeiten ohne Rückfrage
ausgeführt. Blockierte Vorgänge wurden nicht durch alternative Credentials oder
abgeschaltete Freigaben erzwungen.

## Hauptstatus

| Bereich | Status / Nachweis |
| --- | --- |
| Production-Release-Gate | ✅ Release `1d4c703`, Deployment success, vorangegangener Production-Smoke erfolgreich, keine offene Migration/Rollbackentscheidung |
| Preview Code Baseline | ✅ Fast-forward `a014c1b` → `1d4c703`, CI und Preview-Deployment erfolgreich |
| Preview DB Refresh | **BLOCKED**: kein unbeaufsichtigter Production-Leser, Providerzugang und Medien-/Zugriffsisolation nicht abschließend belegt |
| Medienstrategie | **vorbereitet / BLOCKED**: Präfixe analysiert, öffentlicher Store und branchspezifische Overrides inventarisiert; keine Kopie/Referenzänderung |
| Manueller Refresh Workflow | **vorbereitet / BLOCKED**: Richtungs-/Identitätsguards implementiert, Mutationsadapter absichtlich noch gesperrt |
| Daily Backup | **vorbereitet / BLOCKED**: Dump-/Integritäts-/Private-Uploadcode vorhanden; Leser/Store/Retention fehlen, Cron nicht aktiv |
| Weekly Retention | **vorbereitet / BLOCKED**: 56 Tage spezifiziert, keine Löschautomatik eingerichtet |
| Release Backup | **vorbereitet / BLOCKED**: manueller Workflow, 186 Tage vorgesehen; kein reales Backup erzeugt |
| Restore-Test | **BLOCKED**: kein Backup und kein autorisierter temporärer Endpoint; nur Targetguard implementiert |
| Operations-Dokumentation | ✅ [Vertrag und Einrichtungsanleitung](../operations/environments-and-backups.md) |

## Ausgangsbasis und Codebaseline

Production: `1d4c703e068c0752a10757620d1f7fe03d47b20a`, Runtime identisch zum
abgenommenen AP8-Commit `a014c1be2f326cd562650c4fd6f4096c542809c4`.
Vor dem ersten Infrastruktur-Schreibschritt wurde
[Production-Workflow 34154225181](https://github.com/justphilgud/pubquiz-web/actions/runs/34154225181)
erneut als completed/success für exakt diesen SHA bestätigt.
Deployment `dpl_3Ufmv6QmvYkp712cPjVPXBDJtsN3`, stabile URL
https://pubquiz-web.vercel.app. Der [Releasebericht](production-release-ap8.md)
belegt beide Migrationen, Schema aktuell, erfolgreichen Smoke und keinen Rollbackbedarf.

Preview wurde ohne Force-Push konfliktfrei auf denselben Commit gesetzt.
[CI 34155667860](https://github.com/justphilgud/pubquiz-web/actions/runs/34155667860)
und [Deploy Preview 34155774114](https://github.com/justphilgud/pubquiz-web/actions/runs/34155774114)
sind erfolgreich. Neues Deployment `dpl_6vDGRFr2HePB8Cd9ou5aL4vcFvb9`:
https://pubquiz-8s8c338vw-just-phil-gud.vercel.app.
Der Workflow bestätigt 41 Migrationen und „Database schema is up to date“ am
direkten Preview-Endpoint. Keine neue Featuremigration erzeugt oder hinzugefügt.
Production-Deploymentfolge zu diesem Preview-Push wurde korrekt übersprungen.

Infrastrukturbranch `codex/infra-preview-backup` basiert auf `885f161` (zusätzlicher
reiner Releasebericht). Fremde Änderungen im Haupt-Worktree und lokal anderweitig
belegtes `main` blieben unangetastet. App-Runtime und Prisma-Schema sind unverändert.

## Inventar, Zugriff und Provider-Recovery

Das vollständige sichere Endpoint-/Workflow-/Secretnameninventar steht in der
[Operations-Spec](../operations/environments-and-backups.md). Nur Hosts, Datenbank-
und Schemanamen ausgegeben; keine Connectionstrings oder Secretwerte.

- GitHub besitzt ausschließlich `DATABASE_URL` und `VERCEL_TOKEN` je Environment;
  keine Repository-Secrets für Neon-API, Backup-Leser oder privaten Speicher.
- Production-Environment: Required Reviewer aktiv, ausschließlich Branch `main`.
  Ein unbeaufsichtigter zusätzlicher Job mit diesen Secrets würde an der Freigabe
  hängen. Kein Job gestartet, der diese Interaktion benötigt.
- Neon-Konsole zeigt Login: **BLOCKED – interactive auth required**. Keine API-
  Credentials in den verfügbaren Projektzugängen gefunden. Projekt-/Branch-IDs,
  Tarif und tatsächlich eingestelltes Restore-Fenster bleiben unbekannt.
- Development-Endpoint ausschließlich aus vorhandenem lokalen Konfigurationswert
  maskiert ermittelt; keine Verbindung oder Mutation an Development vorgenommen.
- Aktuelle offizielle Neon-Dokumentation zu Restore-Fenstern/Branching geprüft;
  allgemeine Planlimits klar vom unverifizierten Projektzustand getrennt.
- Vercel zeigt einen öffentlichen Medienstore und Preview-Overrides. Dieser Store
  ist kein zulässiger Backupablageort. Store-/Tokenisolation der Overrides nicht
  vollständig belegt, daher keine Production-Datenkopie nach Preview.

## Smoke und Datensicherheit

Der neue Preview-Host lädt und führt ohne Sitzung zum Login. Logo geladen.
Login mit einem bereits vorhandenen autorisierten Preview-Redaktions-Testzugang
aus lokaler Projektkonfiguration gelang ohne Nutzerinteraktion; die normale
rollenbegrenzte Startseite erscheint. Keine Production-Zugangsdaten verwendet,
keine Inhalte angelegt. Der CI-HTTP-Smoke ist ebenfalls erfolgreich.

Dies ist ein **Codebaseline-Smoke**, kein Smoke nach DB-Refresh. Produktionsquiz-
Counts, Medienvollständigkeit, Audio und Schreibtest nach Spiegelung konnten nicht
abgenommen werden, weil keine Spiegelung erfolgte. Kein eigener Testinhalt angelegt.
Öffentliche Quiz-/Teamroute-Exposition und vollständige Medienreferenzen müssen vor
einem echten Refresh noch überprüft werden.

## Implementierung und Grenzen

Feste Source/Target-Identitäten, Pooler-Normalisierung, Richtungsprüfung,
Production-/Preview-/Development-Ausschluss für Restore und sichere Fehlercodes
sind implementiert. Backupcode erzwingt Lesebenutzer, TLS, Rechteprüfung, Custom-Dump,
Exitcode/Größe/Format/Checksumme und authentifizierten privaten Readback. Manifest
erst nach vollständiger Integritätsprüfung; zufällige neue Schlüssel, kein
Überschreiben/Löschen älterer Backups. Storeidentität wird vor Export anhand des
Token-Storeanteils abgeglichen und nach Upload nochmals geprüft. Keine Secretwerte
oder Inhalte in Diagnosen. Fremde Fehlerdetails werden unterdrückt.

Der Backupadapter ist mangels Credentials **nicht gegen echte Production-Daten
ausgeführt oder betrieblich abgenommen**. Private Speicherbereitstellung,
Retentiondurchsetzung und PostgreSQL-Clientversion bleiben Einrichtungsschritte.
Ein Retentionfeld im Manifest ist keine automatische Retention. Daily/Weekly-Cron
ist daher noch nicht aktiviert. AES-256 at rest laut offizieller Vercel-Dokumentation;
kein neuer Verschlüsselungsschlüssel erzeugt.

Refresh- und Restore-Workflows enden bewusst mit einem nicht erfolgreichen
Blockerstatus, nachdem ihre Guards geprüft sind. Sie enthalten noch keinen
freigeschalteten Datenersetzungs-/Provisionierungsadapter. Reale Ausführung,
Dumpintegrität, Restore, Relations-/Countprüfung und temporäres Cleanup:
**nicht erfolgt**. Es existiert kein temporärer Restore-Branch, der aufzuräumen wäre.

Neue Workflows bleiben im Infrastrukturbranch. Aktivierung im Defaultbranch
benötigt einen separat geprüften Ops-only-Integrationsweg: Ein normaler Main-Push
würde den bestehenden Productionworkflow starten. Kein Main-Merge, keine
Production-App-Neuveröffentlichung und keine Änderung ihrer Schutzregeln vorgenommen.

## Qualitätsprüfung

- 11 neue automatisierte Tests, darunter ENV-TEST-01 bis ENV-TEST-07: erfolgreich.
- Vollständige bestehende Suite: 1.095 Tests erfolgreich.
- TypeScript und repositoryweiter ESLint ohne Warnungen erfolgreich.
- Prisma-Validierung erfolgreich; keine Schemaänderung.
- Alle sechs Workflowdateien mit vorhandenem `js-yaml` erfolgreich geparst.
- Neue Guardtests als zusätzlicher Schritt in verbindlicher CI eingebunden.
- [Remote-CI 34156498277](https://github.com/justphilgud/pubquiz-web/actions/runs/34156498277)
  für Infrastrukturcommit `181c0bdf857a9ebd482730ef0fd1c562bc67da15` erfolgreich,
  einschließlich Guardtests, vollständigem Repository-Lint und Production-Build.

Veröffentlicht auf `codex/infra-preview-backup`; der nachfolgende reine
Dokumentationscommit ergänzt diesen CI-Nachweis. `main` und Preview verbleiben
beide auf `1d4c703e068c0752a10757620d1f7fe03d47b20a`.

Initiale TypeScript-Probleme in den neuen Helpern wurden behoben; keine bestehenden
Repositoryfehler festgestellt. Bekannte Node-20-Action-Warnung im Previewworkflow
bleibt unverändert. Keine neue Paketabhängigkeit und keine Produktcodeänderung.

## Geänderte Dateien und nächster Betriebsschritt

- `.github/workflows/{refresh-preview,backup-production,restore-backup-test}.yml`
- `.github/workflows/ci.yml` (zusätzliche Guardtests)
- `scripts/operations/{guards,backup,cli,guards.test}.ts`
- `docs/operations/{environments-and-backups,backup-und-restore,README}.md`
- `docs/releases/releaseprozess.md`
- dieser Bericht

Zuerst autorisierte nicht-interaktive Neon-/Leserzugänge, privaten Backupspeicher
mit Retention und technische Medienisolation bereitstellen. Danach einen realen
Dump samt isoliertem Restore abnehmen; erst anschließend Zeitplan aktivieren und
Preview-Daten bewusst ersetzen. Details und minimale Rechte sind in der Spec
aufgeführt. Bestehende Production-Deployment-Credentials bleiben geschützt.

Ohne Nutzerinteraktion erledigt: Release-Gate, Inventar, Providerrecherche,
Preview-Fast-forward samt Deployment/Schema-/Login-Smoke, Skripte, Tests und Doku.
Keine Credentials ausgegeben. Production war niemals Ziel eines Refresh oder
Restore-Tests; Production-Daten wurden von diesem AP nicht verändert.
B10b, A02-Run-Historisierung und AP9 bleiben außerhalb des Umfangs.
