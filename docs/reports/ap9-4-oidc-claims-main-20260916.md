# AP9.4 – Main-Integration und tatsächliche GitHub-OIDC-Claims

Stand: 16.09.2026. Beide claims-only-Jobs erfolgreich; STOP vor manueller Vercel-Einrichtung.

## Integration und CI

- PR #8 regulär gemergt, ohne Override oder Änderung von Schutzregeln.
- Freigegebener Commit: `dd9b73c9933c3fa3485989d7d796c6bf6171a9c7`.
- Main-Mergecommit: `e85b2b2fa179862e6b7884c591d8212447b444ba`.
- Beide Git-Trees sind identisch; keine zusätzlichen Codeänderungen.
- [Main-CI #208 erfolgreich](https://github.com/justphilgud/pubquiz-web/actions/runs/35072876232).
- [Main-Bridge-CI #3 erfolgreich](https://github.com/justphilgud/pubquiz-web/actions/runs/35072876226).
- [Production-Scope #208](https://github.com/justphilgud/pubquiz-web/actions/runs/35073044631):
  deployment-scope erfolgreich, **Approve, migrate and deploy Production übersprungen**.
- Preview-Deployment-Workflow #214 übersprungen.

## Tatsächlich verifizierte Backup-Claims

Quelle: [Run #10, Backupjob, Schritt Record verified identity claims only](https://github.com/justphilgud/pubquiz-web/actions/runs/35073143022/job/104719162093#step:7:5).
Der Workflow prüfte Signatur, Issuer, Audience, Zeitgrenzen und Claims mit JOSE,
bevor ausschließlich diese erlaubten Identitätsfelder ausgegeben wurden.
Keine JWTs, Signaturen, Signed URLs, Passwörter oder Backupinhalte gespeichert.

```json
{
  "iss": "https://token.actions.githubusercontent.com",
  "aud": "urn:pubquiz:ap94:blob-bridge",
  "sub": "repo:justphilgud/pubquiz-web:environment:operations-backup",
  "repository": "justphilgud/pubquiz-web",
  "repository_id": "1253336192",
  "repository_owner": "justphilgud",
  "repository_owner_id": "288915542",
  "ref": "refs/heads/main",
  "environment": "operations-backup",
  "workflow_ref": "justphilgud/pubquiz-web/.github/workflows/ap94-acceptance.yml@refs/heads/main",
  "sha": "e85b2b2fa179862e6b7884c591d8212447b444ba",
  "event_name": "workflow_dispatch",
  "run_id": "35073143022",
  "run_attempt": "1"
}
```

## Tatsächlich verifizierte Restore-Claims

Der Betreiber justphilgud hat operations-restore am 16.09.2026 um 10:24 Uhr (Europe/Berlin)
regulär freigegeben. Keine Umgehung des Reviewer-Gates. Restorejob `104719412295`
erfolgreich in 55 Sekunden; Backupjob erfolgreich in 47 Sekunden; gesamter Run erfolgreich.
Quelle: [Restorejob, Record verified identity claims only](https://github.com/justphilgud/pubquiz-web/actions/runs/35073143022/job/104719412295#step:6:5).

```json
{
  "iss": "https://token.actions.githubusercontent.com",
  "aud": "urn:pubquiz:ap94:blob-bridge",
  "sub": "repo:justphilgud/pubquiz-web:environment:operations-restore",
  "repository": "justphilgud/pubquiz-web",
  "repository_id": "1253336192",
  "repository_owner": "justphilgud",
  "repository_owner_id": "288915542",
  "ref": "refs/heads/main",
  "environment": "operations-restore",
  "workflow_ref": "justphilgud/pubquiz-web/.github/workflows/ap94-acceptance.yml@refs/heads/main",
  "sha": "e85b2b2fa179862e6b7884c591d8212447b444ba",
  "event_name": "workflow_dispatch",
  "run_id": "35073143022",
  "run_attempt": "1"
}
```

Alle gemeinsamen ausgegebenen Claims stimmen überein. Ausschließlich environment und
sub unterscheiden die Rollen. Beide Ausgaben wurden im jeweiligen Job signaturgeprüft.
Die Transport-/Backup-/Restore-Steps waren im Modus claims-only ausgeschlossen.
Die GitHub-Annotation zur Node-20-Deprecation von checkout/setup-node@v4 ist eine
bestehende Aktionsversionswarnung; beide Jobs liefen erfolgreich unter erzwungenem Node 24.

## Historische Vercel-Anleitung – durch Variante 2 ersetzt

Die nachfolgenden früheren Forderungen nach zwei Regeln und Raw Claims sind überholt.
Maßgeblich ist ausschließlich Abschnitt 5 des aktuellen Setup-Runbooks (eine Regel).
Die tatsächlichen Claims und CI-Nachweise dieses Berichts bleiben gültig.


Die [vollständige Klickanleitung](../operations/ap94-oidc-bridge-setup.md) bleibt maßgeblich.
PR/Integration, Main-CI und beide tatsächlichen Claims-Nachweise sind abgeschlossen.
Die folgende Konfiguration erfolgt ausschließlich manuell durch den Betreiber.

1. Vercel-Team `just-phil-gud` → Add New → Project → Repository
   `justphilgud/pubquiz-web` importieren → neuer Name `pubquiz-backup-operations`.
   Root Directory `scripts/operations/bridge`, Framework Other, Node 24.x,
   Install `npm ci`, Build `npm run typecheck`, Output `public`.
   Dateien außerhalb der Root Directory nicht einschließen; keine Appvariablen importieren.
2. Nur neue Operations-Production: `AP94_GITHUB_REPOSITORY_ID=1253336192`,
   `AP94_GITHUB_OWNER_ID=288915542`, `AP94_BRIDGE_MODE=synthetic`,
   `AP94_OPERATIONS_PROJECT_ID=<neue prj-ID>` setzen; Systemvariablen verfügbar halten.
   Keine Datenbankcredentials oder statischen Blob-Tokens eintragen.
3. Storage → pubquiz-backups (`store_BVRjATGCRBW0fBeF`, Private/FRA1)
   → Projects → Connect Project → ausschließlich neues Operations-Projekt,
   ausschließlich dessen Production → OIDC, Standardprefix BLOB.
4. Neues Projekt → Settings → Security → OIDC Federation: Team-Issuer.
   Deployment Protection muss auch die Operations-Production-URL schützen.
   Keine Ausnahmen, keine Bypass-Secrets, keine kostenpflichtige Aktivierung ohne Entscheidung.
5. Deployment Protection → Trusted Sources → External Services → Add → GitHub Actions.
   Backup-Regel: Account `justphilgud`, Repository `pubquiz-web`, Branch `main`,
   Environment `operations-backup`, Ziel ausschließlich Operations-Production,
   Custom Audience `urn:pubquiz:ap94:blob-bridge`.
   Raw Claims exakt entsprechend obiger verifizierter Werte: `repository`,
   `repository_owner`, `repository_id`, `repository_owner_id`, `ref`, `environment`,
   `workflow_ref`, `event_name`, `sub`, `aud`. Keine Wildcards.
   `sha`, `run_id` und `run_attempt` sind Laufnachweise, keine dauerhaft festzuschreibenden
   Trusted-Source-Werte; die Bridge validiert sie und bindet Objektpfade an den Lauf.
6. Zweite Regel mit denselben gemeinsamen Claims anlegen, aber Environment
   `operations-restore` und exakt verifiziertem sub
   `repo:justphilgud/pubquiz-web:environment:operations-restore`.
   Keine gemeinsame kontoweite Regel. Ziel ebenfalls nur Operations-Production.
7. Nur Operations neu deployen. In beiden GitHub-Environments
   `AP94_BRIDGE_ORIGIN=<neue HTTPS-Origin>` und `AP94_OIDC_TRANSPORT_ACCEPTED=false` setzen.
   Die zwei bestehenden Automatisierungs-/Retentionsflags bleiben false;
   bestehende Secrets/Reviewer/Branchregeln bleiben unverändert.
8. Nicht geheime Projekt-ID, Team-ID, Deployment-URL/ID/SHA und Claims-Run-URL
   zurückmelden. Noch keinen Transportlauf starten.

## Grenzen und Status

Keine Vercel-Konfiguration vorgenommen. Kein Backup-/Restore-/synthetischer Blob-Transport.
Keine Production-Datenbankoperation, Credentialrotation oder Secret-/Flagänderung.
Diese Dokumentation ist eine lokale Nachweisergänzung und nicht Teil des freigegebenen
Merge-Diffs; kein zusätzlicher Commit nach main veröffentlicht.

R03 geschlossen: Nein. AP9.4 vollständig abgenommen: Nein.
Bestehender R04-App-Nachweis unverändert; neue Operations-Isolation extern noch offen.
