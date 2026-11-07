# Medien-Uploads nach Umgebung

Stand: 17. Juli 2026

## Verbindliches Modell

Alle aktiven Upload-Routen verwenden dieselbe serverseitige Auflösung für
Umgebung, Blob-Credential und Pfade. Das Credential ist in jeder Umgebung ein
explizit gesetzter `BLOB_READ_WRITE_TOKEN` des jeweils zugeordneten Stores.
`VERCEL_OIDC_TOKEN` und `BLOB_STORE_ID` werden von der Anwendung nicht als
Blob-Credentials verwendet; insbesondere gibt es lokal keinen OIDC-Fallback.

| Umgebung | Blob-Store | Präfix für neue Dateien |
| --- | --- | --- |
| Development | `pubquiz-media-nonprod` | `dev/` |
| Preview | `pubquiz-media-nonprod` | `preview/` |
| Production | `pubquiz-media-public` | `prod/` |

Die fachliche Kategorie folgt direkt auf das Environment-Präfix:

- Fragenmedium: `dev/question-media/image/...`
- Antwortbild: `preview/answer-media/image/...`
- Präsentationstemplate-Asset: `dev/template-media/<template-id>/<assetrolle>/...`
- Intro-/Outro-Medium: `prod/media/audio/intro/...`

Bereits vorhandene Blobs und gespeicherte URLs werden weder verschoben noch
umbenannt. Die neue Regel gilt ausschließlich für neu erzeugte Pfade.

## Serverseitige Auflösung

Die logische Umgebung ist genau `development`, `preview` oder `production`.
Die Priorität lautet:

1. `MEDIA_UPLOAD_ENV` als expliziter serverseitiger Override für kontrollierte
   lokale Tests,
2. `VERCEL_ENV` auf Vercel,
3. `NODE_ENV` als Fallback (`production` → Production, sonst Development).

`NEXT_PUBLIC_APP_ENV` ist nur ein sichtbares Label und niemals Eingabe für
Credential-, Datenbank- oder Pfadentscheidungen.

Der Browser erhält nur das nicht geheime Präfix `dev`, `preview` oder `prod`.
Die gemeinsame `MediaUploadSlot`-Komponente baut daraus einen Pfad; die Route
berechnet die erlaubte Umgebung unabhängig erneut und prüft den vollständigen
Pfad. Tokens, Cookies, signierte URLs und andere Secrets werden weder als Props
übergeben noch in Diagnose-Logs ausgegeben.

## Aktive Upload-Routen

| Route | Verwendung | Status |
| --- | --- | --- |
| `/api/question-media-upload` | gemeinsamer signierter Upload für `QuestionMediaSlot`, `AnswerMediaSlot`, Quiz-Intro/Outro und freigegebene Template-Assets | aktiv; Template-Assets zusätzlich opt-in |
| `/api/upload-medium` | altes Fragenformular | aktiv, Legacy-API |

Intro- und Outro-Medien verwenden denselben authentifizierten Presigned-Upload
wie Fragen- und Template-Medien. Der Uploadkontext bindet den Pfad an das Quiz,
den Medienslot und die aktuelle Umgebung. Alle Routen beziehen ihren
`BLOB_READ_WRITE_TOKEN` ausdrücklich aus derselben zentralen Serverfunktion;
das Blob-SDK darf kein Credential implizit auswählen.

Template-Assets verwenden dieselbe Route, Credential-Auflösung und
Environment-Präfixlogik. Weil sich die konkrete Store-Zuordnung nicht allein
aus einem Tokenstatus ableiten lässt, bleibt dieser Teil ohne die zusätzliche
serverseitige Bestätigung `TEMPLATE_MEDIA_UPLOAD_ENABLED=true` deaktiviert.
Repository-relative Assets und sämtliche Designvorschauen funktionieren davon
unabhängig. Die Route akzeptiert Template-Bilder ausschließlich für
administrativ autorisierte, persistierte Entwürfe; aktive, archivierte und
Systemtemplates bleiben unveränderlich.

## Optionale Validierung

Die Basisvalidierung prüft `DATABASE_URL`, `AUTH_SECRET` (oder den erlaubten
Alias `NEXTAUTH_SECRET`), die logische Umgebung und das daraus folgende Präfix.
Uploadfunktionen prüfen bei ihrem Aufruf zusätzlich `BLOB_READ_WRITE_TOKEN`.
Der Presigned-Upload prüft außerdem `BLOB_WEBHOOK_PUBLIC_KEY`.

Diagnosen melden ausschließlich Status, Phase, Fehlerklasse, bereinigte
Fehlermeldung, internen Code, erwartete Authentifizierungsart und das
Vorhandensein der Variablen. Werte, Hosts und Secrets bleiben verborgen.

## Smoke-Test je Umgebung

1. `npm run env:check` beziehungsweise die gleichwertige Vercel-Prüfung ohne
   Ausgabe von Werten durchführen.
2. Je ein kleines Fragenbild und Antwortbild hochladen, speichern und neu laden.
3. Intro-Audio oder Intro-Video über die Legacy-Oberfläche hochladen.
4. Prüfen, dass der neue Blobpfad mit `dev/`, `preview/` beziehungsweise
   `prod/` beginnt.
5. Function-Logs auf Fehlerphasen prüfen; keine Secretwerte kopieren.


## Zentrale Preview-Konfiguration und Branch-Pfade (2026-10-09)

Vorbereiteter Vertrag für vertrauenswürdige Branches desselben Repositorys:
Die sechs Medienvariablen gelten ausschließlich global für Preview. Branch-
Overrides sind nicht erlaubt. `MEDIA_UPLOAD_ENV=preview`,
`MEDIA_UPLOAD_STORE_ENV=nonproduction`, `TEMPLATE_MEDIA_UPLOAD_ENABLED=true`.
Die Blob-Integration muss `pubquiz-media-nonprod` zugeordnet sein; Token und
Store-ID müssen laut nicht entschlüsselten Metadaten auf
`store_VzfNwjccgkzhc9bi` zeigen. Production behält
`store_bIx6H2j23vJzi240`. Sensitive-Werte werden weder ausgegeben noch gezogen.

Der Git-Preview-Guard fordert zentrale Variablen statt sechs Kopien je Branch.
Er inventarisiert die Preview-Metadaten und sperrt jeden Medien-Override, der
für den tatsächlich deployten Branch gilt. Andere Branches können dessen
zentrale Vererbung nicht überschreiben. So bleibt die zentrale Abnahme möglich,
während alte Overrides bis zum Funktionsnachweis erhalten bleiben. Er prüft Typen, ausschließlich Preview als Scope,
Integration und unveränderte Git-SHA. `--check-only` erzeugt kein Deployment
und wird vor Migrationen ausgeführt. Die manuelle Preview-Auswahl erlaubt
nur extern ausdrücklich freigegebene Nicht-main-Branches; erfolgreiche Push-CI aus dem freigegebenen Repository
für exakt Branch und SHA bleibt Voraussetzung. Automatische Deployments
bleiben auf den bestehenden Preview-Branch begrenzt; `vercel.json` deaktiviert
weiterhin automatische Git-Deployments. Production-Workflow und DB-Guard
werden nicht geändert.

In Vercel Preview lautet das serverseitige Präfix
`preview/<vollständiger SHA-256 von VERCEL_GIT_COMMIT_REF>/`. Es bleibt über
Deployments desselben Branches stabil. Fehlende Branch-Identität, falsche
Store-ID/-Klassifizierung und ein Token eines anderen Stores sperren den
Medienzugriff. Der Browser bekommt nur das berechnete Präfix. Uploadfreigaben,
Finalisierung und Teamfoto-Cleanup verwenden dieses Präfix. Dev und Prod
behalten `dev/` beziehungsweise `prod/`.

Bestehende URLs werden nicht migriert und bleiben lesbar. Fremde Branch-
Medien und ältere ungetrennte Preview-Medien werden nicht als neue Uploads
oder als Kopierquelle für neue feste Templates akzeptiert. Teamfoto-Cleanup
löscht solche Dateien nicht. Es gibt keine automatische storeweite Bereinigung.

Diese Pfade verhindern normale App-Konflikte, sind aber keine Blob-ACL:
Ein Server mit dem gemeinsamen RW-Token kann grundsätzlich den gesamten
Nonprod-Store ändern. Preview-Datenbankinhalte bleiben ebenfalls gemeinsam.
Für nicht vertrauenswürdigen Code oder harte Branch-Isolation sind getrennte
Stores (und bei Bedarf getrennte Datenbanken) mit automatisierter Provisionierung
erforderlich. Öffentliche Blob-URLs, auch Production-URLs, bleiben öffentlich
lesbar; die Trennung betrifft Credentials und verändernde Operationen.

Die einmalige Vercel-Umstellung und Live-Abnahme benötigen Freigabe. Bis zur
Umstellung sperrt der neue Guard bestehende Medien-Overrides absichtlich.


## Explizite Branch-Vertrauensprüfung (freigegebener Rollout)

`TRUSTED_PREVIEW_BRANCHES` ist eine JSON-Liste exakter Branch-Namen in der
GitHub-Umgebung Preview, keine Liste aus dem zu deployenden Branch und keine
Wildcard. Neue Namen werden erst nach menschlicher Vertrauensprüfung separat
aufgenommen. Erfolgreiche CI allein erteilt keine Freigabe. Beide Scripts
sperren fehlende/ungültige Listen sowie nicht enthaltene Branches vor Vercel-
Anfragen. Die externe GitHub-Environment-Branch-Policy beschränkt zusätzlich,
welche Workflow-Refs überhaupt Preview-Secrets erhalten. Auch main ist ausgeschlossen.
Damit bleibt workflow_run vom main-Controller gesperrt; Abnahmen werden per
workflow_dispatch auf einem der drei ausdrücklich freigegebenen Branches gestartet.
Direkte administrative Vercel-Deployments müssen dieselbe geprüfte Auswahl
beachten; keine pauschale Freigabe fremder PRs oder Branches.

## Isolierte Launch-Preview für PR154 (7. November 2026)

Ausdrücklich autorisierte, ausschließlich synthetische Abnahmeumgebung für
`codex/bingo-print-templates-ui`:

- Organisation `justphilgud`, `org-red-fog-55598232`, bestehender Launch-Tarif.
- Projekt `pubquiz-nonprod-pr154-bingo-print`, `falling-sky-48140800`, Frankfurt,
  PostgreSQL 17; Branch `br-dry-tooth-bac6tr7o`.
- Datenbank `bingo_print_v4_review`; Endpoint `ep-holy-term-baa881iq`.
  Anwendung nutzt dessen gepoolten Host, Schemaoperationen den direkten Host.
- Tatsächlich erneut gelesene Compute-Konfiguration: genau ein Read-write-Compute,
  Minimum = Maximum **0,25 CU**, Suspendierung nach **300 Sekunden** Inaktivität.
  Keine Replikate, Functions, Auth-/Storage-Zusatzdienste; Retention ein Tag.
  Compute-Suspendierung beendet nicht die Speicherabrechnung. Kein Tarifwechsel
  und keine Änderung des organisationsweiten Ausgabenlimits.

Nur die exakten Preview-Branch-Overrides für `DATABASE_URL` und die drei
`EXPECTED_DATABASE_*`-Werte werden zugeordnet. Der bestehende Datenbankvalidator
bindet diesen Branch zusätzlich an genau Host, Datenbank und Endpoint; er weist
auch passend umkonfigurierte fremde Ziele sowie die Nutzung dieses Testziels in
Production oder anderen Branches ab. Gemeinsames Development und Production
bleiben unverändert. Die zentrale Medienkonfiguration bleibt geerbt, ausschließlich
das eigene bestehende SHA256-Branchpräfix ist zulässig. Keine neue Medienausnahme.

Das alte Free-Projekt `polished-snow-55356911` in
`org-sparkling-forest-86747503` bleibt gesperrt und unangetastet. Diese Einrichtung
setzt dessen Kontingent nicht zurück und migriert/löscht dort nichts.

Die neue leere Datenbank erhält ausschließlich die bereits lokal geprüfte
synthetische `pubquiz`-Fixture. Deren Prisma-Historientabelle existiert nicht;
das ist ausdrücklich **kein erfolgreicher historischer Neuinstallationsreplay**
und keine Baseline/resolve an einer vorhandenen Datenbank. Die bekannte historische
0_init-/Draft-Kollision bleibt offen. Die vollständigen leeren/befüllten
V4-Migrationsprüfungen bleiben in CI erhalten. Zusätzlich wurde der exakte V4-SQL
im gehosteten synthetischen Ziel erneut erfolgreich ausgeführt; Karten-,
Druckversions- und Spielhashes bleiben bei kanonischer UTC-Auswertung identisch.
Keine Produktionsdaten als Quelle. Aktuelle CI-, READY-/Alias-/Runtime- sowie
gehostete Browser-/PDF-Nachweise werden in PR154 dokumentiert; die Einrichtung
allein behauptet diese nachfolgenden Nachweise noch nicht.

## Isolierte Matching-Preview (7. November 2026)

Der Benutzer hat ausschließlich `codex/bingo-matching-table` ausdrücklich für die bestehende Vertrauensliste und die exakte Preview-Environment-Branch-Policy freigegeben. Vorhandene Einträge und Schutzregeln bleiben erhalten. Der gemeinsame Nonprod-Store wird ausschließlich mit dem aus diesem Branch abgeleiteten eigenen SHA-256-Präfix verwendet. Keine Production-Medien oder fremden Präfixe verändern.

Eigene synthetische Datenbank `bingo_matching_review` auf dem bestehenden Launch-Nonprod-Endpunkt `ep-holy-term-baa881iq` (Projekt `falling-sky-48140800`). Nur diese Preview erhält genaue Branch-Overrides; Production und gemeinsame Development-Konfiguration bleiben unverändert. Der Deployment-Guard bindet Branch, direkten/gepoolten Host, Datenbankname und Endpointmarker. Der Branch ist ausdrücklich vom gemeinsamen Migrationsjob ausgeschlossen. Migration und Seed erfolgen ausschließlich nach Identitätsprüfung im eigenen isolierten Ziel. Tatsächlicher Compute: ein Read/Write-Endpunkt, 0,25 CU Minimum/Maximum, Suspendierung nach 300 Sekunden; keine zusätzliche Compute oder Replikate. Die aus einer geprüften lokalen synthetischen V4-Modellbasis erzeugte Datenbank ist keine behauptete Wiedergabe sämtlicher historischer Bootstrap-Migrationen.
