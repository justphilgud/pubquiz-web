# AP9.4 – PR #10 integriert, Provider-Gate präzisiert

16.09.2026. Lokaler Dokumentationsnachtrag nach dem angegebenen Main-Commit.

## Integration und Deployment

- Freigegeben: efc66921105b72ce94e8127ee65221c422856d42, regulär über PR #10 gemergt.
- Main: `e903d4dc1d1f0e7b905a14a3e65270070b79c6d5`; Dateibaum identisch zum freigegebenen Commit.
- Main-CI erfolgreich: https://github.com/justphilgud/pubquiz-web/actions/runs/35084920771
- Bridge-CI erfolgreich: https://github.com/justphilgud/pubquiz-web/actions/runs/35084920670
- Production-Workflow: scope erfolgreich, **Approve, migrate and deploy Production skipped**:
  https://github.com/justphilgud/pubquiz-web/actions/runs/35085087027
- Preview skipped: https://github.com/justphilgud/pubquiz-web/actions/runs/35085087069
- Regression auf Main erneut 68/68 bestanden. Typechecks/Lint im freigegebenen PR und CI grün.
- Ausschließlich Operations deployed, READY auf exakt Main:
  https://vercel.com/just-phil-gud/pubquiz-backup-operations/CJfEU1gg9V979FTsF9jz2HqZS95J
- Origin unverändert https://pubquiz-backup-operations.vercel.app
- Deploymentdomain pubquiz-backup-operations-gupcnz5qu-just-phil-gud.vercel.app.

## Echter synthetischer Lauf #12

https://github.com/justphilgud/pubquiz-web/actions/runs/35085247237
Backupjob 104758432714. Fehler:

`SYNTHETIC_CASE_1_HTTP_401_BODY_UNRECOGNIZED`

Fall 1 sendet eine ansonsten korrekte Backup-Readback-Anfrage mit falschem
`store_other`. Erwartet 403 / REQUEST_REJECTED aus der Bridge; tatsächlich 401,
kein erlaubter Bridge-Fehlercode. Handler selbst liefert keine 401-Antworten.
Keine erfolgreiche Provider-/Bridge-Autorisierung nachgewiesen. Abbruch vor Upload;
kein Readback, Signed-URL-Test, Restore oder Zugriff auf Production-Daten.

Der vorangehende signaturgeprüfte Claims-Step besteht: Repository/Owner und feste IDs,
Audience, Environment operations-backup, passendes sub, main-ref, exakter workflow_ref,
event_name workflow_dispatch, SHA e903d4d, run_id 35085247237, attempt 1 stimmen.
Der Claim `workflow` ist nicht in der bisherigen Ausgabe-Allowlist enthalten;
sein Name wird daher nicht als direkt aus dem Token gemessener Wert ausgegeben.

## Ursache: Workflow-Name versus Dateiname

Lesender offizieller Vercel-CLI/API-Aufruf GET /v9/projects/prj_vlY35Hljx5kGaMvEuFixATxn5bzv:
Es werden nur nicht geheime Schutzfelder ausgegeben, keine Envwerte/Credentials.

Gespeicherte einzige externe Regel für https://token.actions.githubusercontent.com:

```json
{"claims":{"aud":["urn:pubquiz:ap94:blob-bridge"],"repository":["justphilgud/pubquiz-web"],"ref":["refs/heads/main"],"workflow":["ap94-acceptance.yml"]},"to":{"slugs":["production"]}}
```

Außerdem ssoProtection.deploymentType=all, OIDC enabled/team. Keine Änderung ausgeführt.

GitHub definiert `workflow` als Workflow-Namen; `workflow_ref` bezeichnet den Dateipfad.
Die Workflowdatei auf diesem SHA hat `name: AP9.4 Manual Backup and Isolated Restore`.
Damit ist die gespeicherte Bedingung workflow=ap94-acceptance.yml falsch. Die frühere
Klickanleitung des Assistenten hat beide Begriffe verwechselt. Kein Bedienfehler des Betreibers.

Quellen:
- https://docs.github.com/en/actions/reference/security/oidc
- https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/trusted-sources

## Exakte manuelle Korrektur und STOPP

Nur pubquiz-backup-operations → Settings → Deployment Protection → Trusted Sources →
Menü der vorhandenen GitHub-Actions-Regel → Edit.

Im Feld Workflow ausschließlich ersetzen:
`ap94-acceptance.yml` → `AP9.4 Manual Backup and Isolated Restore`.

Unverändert: Account justphilgud, Repository pubquiz-web, Branch main,
Audience urn:pubquiz:ap94:blob-bridge, nur Production dieses Operations-Projekts.
Save. Keine zweite Regel, keine Wildcard, kein Entfernen der Workflowbedingung.
All Deployments, Require Log In, projektinterne Regel, OIDC-Verbindung und Flags beibehalten.

Diese Korrektur matcht den vorgesehenen Workflow-Namen. Die Bridge erzwingt weiterhin
den exakten Dateipfad workflow_ref plus IDs, Environment/sub und Operationsrechte.
Ein anderer Workflow mit gleichem Namen kann die Bridge-Dateipfadprüfung nicht bestehen.
Nach Betreiberkorrektur gespeicherten Claim erneut lesend verifizieren und synthetischen
Lauf wiederholen. Keine Providerabnahme behaupten, bevor der gesamte Testvertrag grün ist.

Keine weitere Codeänderung nötig/belegt. Kein neues PR. Kein echtes Backup/Restore.
Flags und Transportfreigabe bleiben false. Keine Credentials geändert/rotiert.
R03 Nein; R04 einschließlich neuer Operations-Providerabnahme Nein (bisherige App-
Isolation unverändert); AP9.4 vollständig Nein. Kein Restore-Reviewer-Gate erreicht.
