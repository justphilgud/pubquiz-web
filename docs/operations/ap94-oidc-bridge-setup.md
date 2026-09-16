# AP9.4 OIDC Operations Bridge – Einrichtungsgate

Stand: 16.09.2026. Codevorbereitung, **keine externe Transportabnahme**.
Kein Projekt wurde angelegt, kein Store verbunden, keine Trusted Source aktiviert,
kein Backup/Restore gestartet. PubQuiz-Production bleibt unverändert.

## Architektur und Grenzen

Das isolierte Vercel-Projekt `pubquiz-backup-operations` besteht ausschließlich aus
`scripts/operations/bridge` mit eigenem package.json/Lockfile. Framework Other,
Node 24, eine Web-Standard-Function `/api/access`, keine UI, keine Datenbank.
Es verwendet die bereits im Repository verwendeten Bibliotheken @vercel/blob 2.4.0
und jose 6.2.3. Die Root-Pakete, App, Prisma und App-vercel.json bleiben unverändert.

GitHub erhält kurzlebige URLs, niemals Vercel-OIDC oder das Delegations-Signingmaterial.
Trusted Sources prüft den GitHub-Token am Deployment-Eingang; die Function prüft
zusätzlich dieselbe Identität mit JOSE, GitHubs festem JWKS-Endpunkt und RS256.
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
| synthetisch | `synthetic/acceptance/run-<run_id>-<run_attempt>/probe.bin` | 16 KiB |
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

Der vorbereitete PR ist noch nicht gemergt. Erst regulär reviewen und integrieren,
CI abwarten; keine Schutzregel umgehen. Die geprüften Operations-Pfade unterdrücken
den App-Deployjob auch nach Merge. Gemischte App-/Schema-/Root-Paketänderungen tun das nicht.
Vercel-Git-Autodeployment bleibt in beiden Projektkonfigurationen deaktiviert.

Danach kann **ohne Blob-/DB-Zugriff** ein separater Lauf gestartet werden:
GitHub → Actions → AP9.4 Manual Backup and Isolated Restore → Run workflow → Branch
`main` → Mode `claims-only` → Production Commit leer lassen. Die ausschließlich
signaturgeprüften, erlaubten Identitätsfelder stehen in `Record verified identity claims only`.
Der Restorejob wartet weiterhin am Required Reviewer. Auch diesen Claims-Lauf nicht
selbst freigeben; dem Betreiber die konkrete Run-URL nennen.

Die tatsächlichen Claims konnten vor dem Einrichtungsgate noch nicht erhoben werden.
Lokale RSA-signierte Testclaims sind kein GitHub-Provider-Nachweis. Vor Aktivierung
der Trusted Sources sind die Ausgaben beider Jobs mit folgenden Anforderungen abzugleichen:

| Claim | Exakter Sollwert |
|---|---|
| iss | `https://token.actions.githubusercontent.com` |
| aud | `urn:pubquiz:ap94:blob-bridge` |
| repository | `justphilgud/pubquiz-web` |
| repository_owner | `justphilgud` |
| repository_id / repository_owner_id | tatsächlich verifizierte numerische IDs aus dem Claims-Lauf |
| ref | `refs/heads/main` |
| workflow_ref | `justphilgud/pubquiz-web/.github/workflows/ap94-acceptance.yml@refs/heads/main` |
| event_name | `workflow_dispatch` |
| environment | `operations-backup` bzw. `operations-restore` |
| sub | tatsächlicher environmentgebundener Subject des jeweiligen Jobs |

GitHub kennt alte und neue Subjects mit unveränderlichen IDs. Beide dokumentierten
Formen werden gegen die festgelegten IDs geprüft; keine beliebigen Subjects. Keine
Änderung an GitHubs Subject-Konfiguration erforderlich. `sha`, `run_id`, `run_attempt`
werden geprüft; exp/iat/nbf werden validiert, Tokens nie ausgegeben.

### 1. Separates Vercel-Projekt erstellen

Im Team `just-phil-gud`: Add New → Project → Import Git Repository →
`justphilgud/pubquiz-web`. Neuer Projektname **pubquiz-backup-operations**.
Nicht das vorhandene Projekt bearbeiten und nicht dessen Einstellungen kopieren.

- Root Directory: **scripts/operations/bridge** (erst nach regulärem Merge vorhanden).
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
| AP94_GITHUB_REPOSITORY_ID | geprüfte numerische repository_id |
| AP94_GITHUB_OWNER_ID | geprüfte numerische repository_owner_id |
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

### 5. Zwei Trusted Sources – erst nach Claims-Abgleich

Settings → Deployment Protection → Trusted Sources → External Services → Add →
GitHub Actions. Account `justphilgud`, Repository `pubquiz-web`, Branch `main`.
Environment **operations-backup**. Applies to environments: nur **Production** des
Operations-Projekts. Use a custom audience: `urn:pubquiz:ap94:blob-bridge`.

Unter Edit raw claims zusätzlich exakt `workflow_ref`, `repository_id`,
`repository_owner_id`, `repository_owner`, `event_name` und tatsächlichen `sub`
aus obiger Tabelle setzen; vorhandene `repository`, `ref`, `environment`, `aud`
beibehalten. Keine Wildcards und keine kontoweite Freigabe. Alle Claims müssen passen.

Zweite Regel mit denselben Einschränkungen, aber Environment **operations-restore**
und dessen tatsächlichem `sub`. Nicht beide Rollen in eine unspezifische Regel zusammenlegen.
Die Bridge selbst leitet das Recht aus dem erneut verifizierten Environment ab.

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
GitHub repository_id/owner_id, Claims-Lauf-URL, Bestätigung der zwei engen Regeln,
Production-only Storebindung und Deployment-Protection-Abdeckung. Keine Tokenwerte.
Noch keinen acceptance-Lauf starten. Danach technische Verifikation und synthetische
Abnahme durch Codex; beim Restore-Reviewer wieder stoppen.

## Abnahme nach Einrichtung (noch nicht ausgeführt)

Mode `synthetic`: keine DB-Secrets an Steps, nur festes Probeobjekt. Backup prüft
falsche Rollen/Pfade/Store/Größe, Upload, Hash-Readback, direkten Overwrite-Replay,
falsche Signed-URL-Methode und Pfad sowie echte Expiration nach maximal 5 Minuten.
Restore prüft nach Reviewerfreigabe nur Lesen, Hash und Negativfälle/Ablauf.
Probeobjekte bleiben erhalten; kein Cleanup/Delete. Rate Limits und Providerfehler
sind keine erfolgreichen Negativnachweise. Echte falsche Claims sind lokal mit
gültigen synthetischen Signaturen geprüft; Provider-/Trusted-Sources-Abweisung muss
zusätzlich mit kontrollierten ungültigen Identitäten verifiziert werden, ohne Regeln zu lockern.

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
