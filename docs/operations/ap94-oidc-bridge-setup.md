# AP9.4 OIDC Operations Bridge – Einrichtungsgate

Variante 2 ist durch den Betreiber ausdrücklich als Architektur freigegeben.
Die frühere Forderung nach GitHub-Environment-Claims bereits in Vercel ist aufgehoben.
**Aktuelles Gate:** Die Bridge-Verschärfung ist regulär über PR #9 in Main-Commit
`4bb6168ebf49a9ed058d7e45360eb0d42db54de1` integriert. Main-CI, Bridge-CI und
Security-Regression sind grün; der Anwendungsdeployjob wurde übersprungen.
PR #10 ist regulär integriert: Main `e903d4dc1d1f0e7b905a14a3e65270070b79c6d5`.
Main-CI/Bridge-CI grün, Appdeployjob skipped, Operations auf diesem SHA READY.
Die Workflow-Bedingung ist durch den Betreiber korrigiert und API-seitig verifiziert.
PR #11 behebt den Node-ESM-Importfehler; Main
`0a6b95b3ba01edfb88fa86059bdf4e475872d9df`, beide CIs grün, kein Appdeploy.
Lauf #14: synthetischer Backuptransport und nach Betreiberfreigabe Restore-Lesetest
erfolgreich, einschließlich Readback/Hash, Rollen-/Pfad-/Methodenprüfungen und echtem
URL-Ablauf. PR #12 ist integriert: Main `4ac84083c0af78b319fb2f9e944e3c7467f69645`.
Run #15 inklusive beider Identitäten/Transportpfade erfolgreich. Transportflags true,
Bridge acceptance; Automatisierung/Retention unverändert false. Run #16 erreicht den
echten Export; nur database.dump ist gespeichert, Uploadphase fehlgeschlagen.
PR #13 regulär integriert: Main `f831b54caeee2d1e618a215ec57ce8f357f7a869`.
Main-CI und Bridge-CI grün; Anwendungsdeployjob skipped, Production unverändert.
Run #17 belegt PRIVATE_UPLOAD_AUTH_OVERLAY_HTTP_403_CONTENT_TYPE_NOT_ALLOWED.
Der vorherige Datenbankupload einschließlich Hash-/Größenreadback ist damit passiert.
Minimaler Fix: exakt application/json für Auth-Overlay/Manifest, exakt
application/octet-stream für Dump/Medien; beide Signaturstufen und Runner konsistent.
Keine frei wählbare MIME-Liste oder Wildcards. Die synthetische Probe ergänzt probe.json
mit Upload, Hash-/Größenreadback, Restore-Lesen, Overwrite-/Größen-/Pfad-/Methoden-
und Ablaufprüfung. Aktuelles Gate: reguläre Main-Freigabe dieses Fixes, danach zuerst
synthetische Providerabnahme beider Dateitypen (Reviewer beibehalten), erst dann echter
Backupversuch. Kein Restore und kein gültiges vollständiges Backup vorhanden.
Siehe [Run #17 und MIME-Korrektur](../reports/ap9-4-acceptance-run17-20260916.md).
Siehe [Run #16](../reports/ap9-4-acceptance-run16-20260916.md) und
[Run #15](../reports/ap9-4-provider-run15-20260916.md).
Siehe [Nachweis Lauf #14](../reports/ap9-4-provider-run14-20260916.md),
[Diagnose Lauf #13](../reports/ap9-4-provider-run13-20260916.md)
und [Diagnose Lauf #12](../reports/ap9-4-provider-run12-20260916.md)
und [Providerbefund](../reports/ap9-4-provider-preflight-20260916.md),
[Integrationsnachweis](../reports/ap9-4-variant2-main-integration-20260916.md)
und [Security Review](../reports/ap9-4-variant2-security-20260916.md).

> Vercel authentifiziert den erlaubten GitHub-Zugangsweg.
> Die Bridge autorisiert anhand des verifizierten GitHub-OIDC-JWTs die konkrete
> Backup- bzw. Restoreoperation.

Die fehlende Environment-Prüfung auf Vercel-Ebene ist eine bewusste Architekturentscheidung.
Eine gemeinsame Trusted Source, keine zweite identische Regel. Kein statischer Ersatzweg.

Stand: 16.09.2026. Codevorbereitung, **keine externe Transportabnahme**.
Das Operations-Projekt existiert inzwischen. In diesem Review wurden keine Provider-
einstellungen verändert, keine Trusted Source angelegt und kein Backup/Restore gestartet.

## Architektur und Grenzen

Das isolierte Vercel-Projekt `pubquiz-backup-operations` besteht ausschließlich aus
`scripts/operations/bridge` mit eigenem package.json/Lockfile. Framework Other,
Node 24, eine Web-Standard-Function `/api/access`, keine UI, keine Datenbank.
Es verwendet die bereits im Repository verwendeten Bibliotheken @vercel/blob 2.4.0
und jose 6.2.3. Die Root-Pakete, App, Prisma und App-vercel.json bleiben unverändert.

GitHub erhält kurzlebige URLs, niemals Vercel-OIDC oder das Delegations-Signingmaterial.
Trusted Sources prüft GitHub-Zugangsweg, Audience und Vercel-Zielumgebung. Die Function
prüft alle Vertragsclaims einschließlich IDs, Environment und Subject erneut mit JOSE,
GitHubs festem JWKS-Endpunkt und RS256 und entscheidet über die konkrete Operation.
Der Runner sendet den Token sowohl als Trusted-Sources-Header als auch als Bearer
Authorization. Die Function verlässt sich nicht auf die Weiterleitung des ersten Headers.
Vercels SDK verwendet die eigene Runtime-OIDC-Identität für den verbundenen Store.
Keine static-token-Fallbackkonfiguration; bekannte DB-/Blob-Token-Envvars blockieren
die Function. VERCEL_PROJECT_ID muss der explizit eingetragenen Operations-ID entsprechen.

Nur Store `store_BVRjATGCRBW0fBeF`, Private, Host
`bvrjatgcrbw0fbef.private.blob.vercel-storage.com`. Keine Liste, kein Delete,
kein Overwrite. `head` prüft nur das konkrete Objekt vor der URL-Ausgabe.
Ein konkurrierender Upload wird zusätzlich durch signiertes `allowOverwrite:false` abgewehrt.

| Modus/Objekt | Pfad/Name | Grenze |
|---|---|---|
| synthetisch | `synthetic/acceptance/run-<run_id>-<run_attempt>/probe.bin` und `probe.json` | jeweils 16 KiB |
| Abnahme Datenbank | `production/acceptance/run-<run_id>-<run_attempt>/database.dump` | 128 MiB |
| Auth-Overlay | gleicher Runpfad, `auth-redacted.json` | 16 MiB |
| Manifest | gleicher Runpfad, `manifest.json` | 16 MiB |
| Medium | gleicher Runpfad, `media-<64 lowercase hex>.bin` | 128 MiB |

Objektart und Name müssen übereinstimmen. Keine freien Prefixe, Wildcards oder zusätzliche
JSON-Felder. Uploadgröße wird zusätzlich auf die angekündigte konkrete Bytezahl begrenzt.
URLs gelten maximal 5 Minuten, nie länger als der geprüfte GitHub-Token. Ein neuer Token
wird je Grant angefordert. Read-URLs dürfen bis zum Ablauf mehrfach gelesen werden;
sie sind **keine Einmal-URLs**. PUT-Wiederholung nach erfolgreichem Upload darf nicht
überschreiben. URL-Manipulation, Methodenwechsel und Ablauf werden separat geprüft.

Backup darf nur `backup-upload` und `backup-readback`; Restore nur `restore-read`.
Beide sind an denselben Run und Attempt gebunden. Ein Restore aus einem beliebigen
älteren Run ist absichtlich nicht Bestandteil dieser Abnahmepipeline. Bei einem neuen
Attempt alle Jobs mit neuem Backup ausführen; nicht einen fehlgeschlagenen Restore
gegen alte Outputs erzwingen. Einen bereits benutzten Restore-DB-Zustand nie automatisch leeren.

Hash, Manifest, Authausschluss, Medienvergleich und alle DB-Guards bleiben erhalten.
Der bisherige Blob-Upload des Restore-Validierungsberichts entfällt: das secretsichere
Ergebnis erscheint im geschützten GitHub-Run. Restore hat keinerlei Blob-Schreibrecht.
Keine Signed URL, kein JWT und keine Providerfehlermeldung wird geloggt. Fehler bestehen
aus festen Kategorien. Signed URLs nur im Arbeitsspeicher, nicht in Outputs/Artefakten/Secrets.

## Reihenfolge am manuellen Gate

### 0. PR und tatsächliche Claims zuerst

PR #8 ist regulär gemergt: main `e85b2b2fa179862e6b7884c591d8212447b444ba`.
Main-CI und Bridge-CI sind erfolgreich; der Production-Deployjob wurde übersprungen.
Die geprüften Operations-Pfade unterdrücken
den App-Deployjob auch nach Merge. Gemischte App-/Schema-/Root-Paketänderungen tun das nicht.
Vercel-Git-Autodeployment bleibt in beiden Projektkonfigurationen deaktiviert.

Der separate Lauf #10 wurde **ohne Blob-/DB-Zugriff** erfolgreich ausgeführt:
GitHub → Actions → AP9.4 Manual Backup and Isolated Restore → Run workflow → Branch
`main` → Mode `claims-only` → Production Commit leer lassen. Die ausschließlich
signaturgeprüften, erlaubten Identitätsfelder stehen in `Record verified identity claims only`.
Der Restorejob wartet weiterhin am Required Reviewer. Auch diesen Claims-Lauf nicht
selbst freigeben; dem Betreiber die konkrete Run-URL nennen.

Beide tatsächlichen Claims wurden signaturgeprüft und sind im
[Claims-Prüfbericht](../reports/ap9-4-oidc-claims-main-20260916.md) dokumentiert.
Restore lief erst nach regulärer Betreiberfreigabe. Kein weiterer Claims-Lauf nötig.
Für Trusted Sources gelten die folgenden abgeglichenen Werte:

| Claim | Exakter Sollwert |
|---|---|
| iss | `https://token.actions.githubusercontent.com` |
| aud | `urn:pubquiz:ap94:blob-bridge` |
| repository | `justphilgud/pubquiz-web` |
| repository_owner | `justphilgud` |
| repository_id / repository_owner_id | `1253336192` / `288915542` |
| ref | `refs/heads/main` |
| workflow_ref | `justphilgud/pubquiz-web/.github/workflows/ap94-acceptance.yml@refs/heads/main` |
| event_name | `workflow_dispatch` |
| environment | `operations-backup` bzw. `operations-restore` |
| sub Backup | `repo:justphilgud/pubquiz-web:environment:operations-backup` |
| sub Restore | `repo:justphilgud/pubquiz-web:environment:operations-restore` |

Nach der vorbereiteten Verschärfung werden ausschließlich die beiden oben tatsächlich
gemessenen Subjects akzeptiert; keine automatische Erweiterung auf andere Formate. Keine
Änderung an GitHubs Subject-Konfiguration erforderlich. `sha`, `run_id`, `run_attempt`
werden geprüft; exp/iat/nbf werden validiert, Tokens nie ausgegeben.

### 1. Separates Vercel-Projekt erstellen

Im Team `just-phil-gud`: Add New → Project → Import Git Repository →
`justphilgud/pubquiz-web`. Neuer Projektname **pubquiz-backup-operations**.
Nicht das vorhandene Projekt bearbeiten und nicht dessen Einstellungen kopieren.

- Root Directory: **scripts/operations/bridge** (auf main vorhanden).
- Framework Preset: **Other**.
- Node.js: **24.x**.
- Install Command: `npm ci`; Build Command: `npm run typecheck`.
- Output Directory: `public`.
- Dateien außerhalb der Root Directory **nicht einschließen**.
- Keine DB-/App-Environmentvariablen importieren; keine eigene Domain zuweisen.

Ein initialer Deploy ohne vollständige Konfiguration ist fail-closed (API 503).
Die `production`-Umgebung dieses separaten Projekts ist **nicht PubQuiz-Production**.
Nur sie wird für die Bridge verwendet. Preview/Development bleiben ohne Storezugriff.
Projekt-ID unter Settings → General notieren; Team-ID ebenfalls notieren.

### 2. Nicht geheime Environmentvariablen

Nur im neuen Projekt, Zielumgebung **Production**:

| Variable | Wert |
|---|---|
| AP94_OPERATIONS_PROJECT_ID | tatsächliche neue `prj_…`-ID |
| AP94_GITHUB_REPOSITORY_ID | `1253336192` |
| AP94_GITHUB_OWNER_ID | `288915542` |
| AP94_BRIDGE_MODE | **synthetic** |

Automatische Systemvariablen müssen verfügbar sein (Settings → Environment Variables →
Automatically expose System Environment Variables). VERCEL_PROJECT_ID nicht selbst vortäuschen.
Keine DATABASE_URL/PRODUCTION_BACKUP_DATABASE_URL/RESTORE_TEST_DATABASE_URL,
kein PGPASSWORD, kein BLOB_READ_WRITE_TOKEN, kein BACKUP_BLOB_READ_WRITE_TOKEN setzen.

### 3. Nur den Backupstore verbinden

Team Storage → **pubquiz-backups** → Identität `store_BVRjATGCRBW0fBeF`, Private/FRA1
prüfen → Projects → Connect Project → **pubquiz-backup-operations** → ausschließlich
**Production** dieses Projekts auswählen → OIDC verwenden → verbinden.
Standardprefix BLOB verwenden, damit BLOB_STORE_ID automatisch bereitsteht.
Keine Verbindung zu pubquiz-web, Development oder Preview. Keine Credentialrotation.
Anschließend Projects-Liste prüfen: genau die neue Operations-Verbindung.
Falls ein statischer Token erzeugt/eingetragen wird, stoppen und die Konfiguration
prüfen; keinen solchen Token in GitHub übertragen.

### 4. OIDC und Deployment Protection

Neues Projekt → Settings → Security → Secure Backend Access with OIDC Federation:
aktiv, Team-Issuer verwenden. Kein manuelles VERCEL_OIDC_TOKEN hinterlegen.
Settings → Deployment Protection: Schutz **auch für die Operations-Production-URL**
aktivieren. Standard Protection, die Production ausnimmt, reicht hierfür nicht.
Wenn der aktuelle Tarif diese Abdeckung nicht bietet: stoppen, keine kostenpflichtige
Option ohne Betreiberentscheidung aktivieren. Keine öffentliche Exception/Bypass-Secret.
Die API bleibt zusätzlich durch ihre eigene JOSE-Prüfung geschützt.

### 5. EINE Trusted Source – erst nach Main-Fix und Schutzprüfung

Settings → Deployment Protection → Add trusted source → External Service → GitHub Actions.
Die aktuell tatsächlich vorhandenen Felder exakt so belegen:

| Feld | Wert |
|---|---|
| Account | justphilgud |
| Repository | pubquiz-web |
| Workflow | AP9.4 Manual Backup and Isolated Restore |
| Branch | main |
| Audience | urn:pubquiz:ap94:blob-bridge |
| Applies to environments | ausschließlich Production von pubquiz-backup-operations |

Kein GitHub-Environment-, sub- oder Raw-Claims-Feld voraussetzen. Nur eine Regel.
**Korrektur nach API-Prüfung am 16.09.:** Das sichtbare Workflow-Feld speichert den
Claim `workflow`, also den YAML-`name`, nicht den Dateinamen. Die frühere Anleitung
mit `ap94-acceptance.yml` in diesem Feld war falsch. Die Bridge prüft zusätzlich
unverändert `workflow_ref=justphilgud/pubquiz-web/.github/workflows/ap94-acceptance.yml@refs/heads/main`.
IDs, event_name, exakter workflow_ref, environment, sub und Operationsrechte prüft
zwingend die Bridge. Die Berechtigung folgt ausschließlich dem verifizierten JWT.
Die UI-Angaben und deren gespeicherte Wirkung sind nach manueller Anlage und vor
Transportfreigabe lesend sowie mit echten Negativzugriffen zu prüfen.

Am 16.09.2026 direkt beobachtet: Require Log In aktiv, **Standard Protection**.
Das Auswahlmenü beschreibt dies als Schutz außer Production Custom Domains.
**All Deployments – Protect all domains** ist verfügbar. Nur im Operations-Projekt
manuell wählen und speichern, um sämtliche Operations-Production-URLs einzuschließen;
bei einem unerwarteten kostenpflichtigen Bestätigungsschritt stoppen. Im Review wurde
keine Auswahl geändert oder gespeichert. PubQuiz-Production bleibt unberührt.

### 6. Isoliertes Deployment und GitHub-Variablen

Nach den Einstellungen ausschließlich das **Operations-Projekt** neu deployen
(Deployments → dessen Deployment → Redeploy). Kein PubQuiz-Deploy, keine Migration.
Die Root-vercel.json der App nicht ändern. Zukünftige Git-Pushes deployen nicht automatisch.

GitHub → Repository Settings → Environments → jeweils operations-backup und
operations-restore → Environment variables:

- `AP94_BRIDGE_ORIGIN`: tatsächliche HTTPS-Production-Origin des neuen Projekts,
  ohne `/api/access`, Query oder Fragment; Name beginnt `pubquiz-backup-operations`.
- `AP94_OIDC_TRANSPORT_ACCEPTED=false`.
- `BACKUP_PRIVATE_BLOB_HOST` bleibt der oben genannte private Host.

Main-only, Required Reviewer und deaktivierten Admin-Bypass unverändert erhalten.
BACKUP_AUTOMATION_ENABLED=false und BACKUP_RETENTION_VERIFIED=false bleiben unverändert.
Vorhandene alte Secrets weder löschen noch rotieren; der neue Workflow referenziert
BACKUP_BLOB_READ_WRITE_TOKEN nicht mehr. Keine JWTs/Signed URLs als Secrets speichern.

### 7. Rückmeldung an Codex und STOPP

Nur nicht geheime Werte melden: neue Projekt-ID, Team-ID, Deployment-URL/ID und SHA,
GitHub repository_id/owner_id, Claims-Lauf-URL, Bestätigung der einen engen Regel,
Production-only Storebindung und Deployment-Protection-Abdeckung. Keine Tokenwerte.
Noch keinen acceptance-Lauf starten. Danach technische Verifikation und synthetische
Abnahme durch Codex; beim Restore-Reviewer wieder stoppen.

## Abnahme nach Einrichtung

Mode `synthetic`: keine DB-Secrets an Steps, nur festes Probeobjekt. Backup prüft
falsche Rollen/Pfade/Store/Größe, Upload, Hash-Readback, direkten Overwrite-Replay,
falsche Signed-URL-Methode und Pfad sowie echte Expiration nach maximal 5 Minuten.
Restore prüft nach Reviewerfreigabe nur Lesen, Hash und Negativfälle/Ablauf.
Probeobjekte bleiben erhalten; kein Cleanup/Delete. Rate Limits und Providerfehler
sind keine erfolgreichen Negativnachweise. Echte falsche Claims sind lokal mit
gültigen synthetischen Signaturen geprüft; Provider-/Trusted-Sources-Abweisung muss
zusätzlich mit kontrollierten ungültigen Identitäten verifiziert werden, ohne Regeln zu lockern.

Der ergänzte Identitätstest läuft vor jedem synthetischen Transport. Er trennt:
- Fehlende Zugangsdaten und eine echt von GitHub signierte falsche Audience am
  Vercel-Eingang (401/403, keine erfolgreiche Bridge-Antwort).
- Gültiger Trusted-Source-Token, aber falsche Audience oder fehlender Bearer im
  Authorization-Header: Bridge muss exakt 403/IDENTITY_REJECTED liefern.
- Elf gezielt manipulierte Payloads (Repository, Owner, beide IDs, Branch, Workflow,
  Audience, Environment, Subject, Issuer, Event) bei gültigem Edge-Token:
  erneute JWT-Prüfung in der echten Function muss jede Manipulation ablehnen.

Diese elf Tokens haben absichtlich ungültige Signaturen. Sie beweisen live die
Unabhängigkeit der Bridge vom Edge-Token, **nicht** die semantische Ablehnung von
GitHub-signierten fremden Repositories/Branches/Workflows. Letztere Claim-Semantik
prüfen die vorhandenen lokalen RSA/JOSE-Regressionen. Ohne entsprechende externe
Workflow-Identitäten keinen vollständigen Live-Fremdidentitätsnachweis behaupten.
Redirects, Rate Limits und Providerfehler bestehen die Probe nicht. Keine Tokens,
Antworttexte oder Signed URLs werden in Diagnosen aufgenommen.

## Prozessinterne GitHub-OIDC-Nutzung

Der Operations-Client bezieht GitHub-OIDC-JWTs direkt über den von GitHub Actions
bereitgestellten Runner-Endpunkt. Ein erfolgreiches JWT bleibt ausschließlich im
Arbeitsspeicher des laufenden Node-Prozesses und wird nach Audience getrennt
gehalten. Der Client liest lokal nur `exp`, erneuert das Token 60 Sekunden vor
Ablauf und überlässt Signatur- und Claim-Prüfung vollständig der Bridge.

Nur der Abruf eines neuen GitHub-Tokens wird höchstens viermal versucht:
Netzwerkfehler, HTTP 429 und HTTP 5xx erhalten begrenztes exponentielles Backoff,
Jitter und ein auf 30 Sekunden begrenztes `Retry-After`. HTTP 400/401/403,
ungültige Antworten und ungültige Ablaufclaims scheitern sofort. Eine 401/403 der
Bridge wird nicht wiederholt. Gleichzeitige Anforderungen derselben Audience
teilen sich genau einen laufenden Abruf.

Die Diagnose nennt ausschließlich Bridge-Aufrufe, OIDC-HTTP-Anforderungen,
Cache-Treffer, zusammengefasste Parallelabrufe, Refreshes, Retries und eine feste
Fehlerklasse. JWTs, Runner-Request-Token und signierte URLs werden weder geloggt
noch persistiert.

Erst wenn alle Nachweise grün sind, separat `AP94_BRIDGE_MODE=acceptance` im
Operations-Projekt und AP94_OIDC_TRANSPORT_ACCEPTED=true in beiden GitHub-Environments
setzen und nur Operations neu deployen. Das sind neue manuelle Freigabeschritte nach
Abnahme, **nicht jetzt ausführen**. Die bestehenden Automatisierungs-/Retentionsflags
bleiben false. Anschließend echter Backup-Lauf und Stop am Restore-Reviewer.

R03: offen. R04: bisheriger Nachweis unverändert; neue Operations-Isolation extern noch
zu verifizieren. AP9.4: nicht vollständig abgenommen. RPO/RTO noch nicht gemessen.

## Quellen

- [Blob-Authentifizierung](https://vercel.com/docs/vercel-blob/using-blob-sdk#authentication)
- [Signed URLs](https://vercel.com/docs/vercel-blob/vercel-signed-urls)
- [Trusted Sources](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/trusted-sources)
- [GitHub OIDC](https://docs.github.com/en/actions/reference/security/oidc)
- [Vercel Node.js Functions](https://vercel.com/docs/functions/runtimes/node-js)
