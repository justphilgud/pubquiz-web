# AP9.4 – PR #12 integriert, Live-Identitätsabnahme Lauf #15

Stand 16.09.2026. Providerabnahme vollständig grün; echter Lauf noch am GitHub-Reauthentifizierungsgate.

## Integration und Isolation

- Freigegebener PR-Commit: `1fa5af088bdda7918470cf7931c7e7fbd1e3ba77`.
- Regulärer Merge ohne Override: Main `4ac84083c0af78b319fb2f9e944e3c7467f69645`.
- Main-Dateibaum identisch zum freigegebenen PR-Commit.
- Main-CI erfolgreich: https://github.com/justphilgud/pubquiz-web/actions/runs/35090326727
- Bridge-CI erfolgreich: https://github.com/justphilgud/pubquiz-web/actions/runs/35090326736
- Production-Scope erfolgreich, Deployjob ausdrücklich skipped:
  https://github.com/justphilgud/pubquiz-web/actions/runs/35090500698
- Preview skipped: https://github.com/justphilgud/pubquiz-web/actions/runs/35090500813
- Nur Operations deployed: `dpl_9dXYC5LvieB4RgsF6QwP5TepXkgp`, READY,
  gitSource.sha exakt Main. Stabile Origin `https://pubquiz-backup-operations.vercel.app`.
- Deployment: `pubquiz-backup-operations-iwwbhv2bq-just-phil-gud.vercel.app`.
- Providerkonfiguration API-seitig gelesen: Root scripts/operations/bridge,
  All Deployments, OIDC Team-Issuer aktiv, genau eine GitHub-Regel mit unveränderten
  Audience/Repository/main/Workflow-Name und ausschließlich Operations-Production.
- GitHub operations-backup weiterhin main-only; beide Automatisierungs-/Retention-
  Flags false. Transportfreigabe false.
- operations-restore weiterhin main-only, Required Reviewer justphilgud, kein
  Administrator-Bypass, Transportfreigabe false, erwarteter j-Host unverändert.
- PubQuiz-Production weiterhin READY: `dpl_3Ufmv6QmvYkp712cPjVPXBDJtsN3`,
  Release `1d4c703e068c0752a10757620d1f7fe03d47b20a`,
  `pubquiz-duckwlqkj-just-phil-gud.vercel.app`. Kein Appdeployment ausgelöst.

## Synthetischer Lauf

https://github.com/justphilgud/pubquiz-web/actions/runs/35090660296

Run #15, main, synthetic, attempt 1. Backupjob 104775931747.
Keine DB-Secrets in synthetischen Steps. Kein echter Backup-/Restorelauf gestartet.
Identitätsnachweise unterscheiden echte GitHub-signierte falsche Audience von
elf absichtlich signaturungültigen Payload-Manipulationen; keine Behauptung echter
GitHub-signierter Fremdrepository-/Fremdbranch-Identitäten. Deren Claim-Semantik ist
in der bestehenden lokalen signierten RSA/JOSE-Regression geprüft.

Backupjob erfolgreich: 5m 58s, synthetischer Transportschritt 5m 11s.
Der strukturierte Nachweis meldet:

- signedWrongAudience: rejected; missingCredentials: rejected.
- tamperedClaimCases: 11; semanticForeignClaims: local-signed-regression-only.
- Acht Operationsnegativfälle erfolgreich; Methoden-/Pfadabweichungen abgewiesen.
- Provider-Größenbegrenzung und Overwrite-Replay abgewiesen.
- Privater Upload und Readback erfolgreich; echter URL-Ablauf abgewiesen.
- Testobjekt `synthetic/acceptance/run-35090660296-1/probe.bin`, fester Inhalt 65 Bytes.
- SHA-256 `67cc2bd923130a64c1617b6786462afc1d6c1cf5c9ab3b10ff7e99081433b9f3`.
- deletion false; keine Testobjekte gelöscht, keine echten Backupdaten übertragen.

## Aktuelles Required-Reviewer-Gate

Restorejob 104777683381 wartet auf operations-restore Review durch den Betreiber:
https://github.com/justphilgud/pubquiz-web/actions/runs/35090660296

Dies ist noch der synthetische Restore-Lesetest. Er erhält keine Datenbankcredentials
und greift auf kein Neon-Projekt zu. Nach Freigabe prüft er die Identitätsgrenze
mit der Restoreidentität, liest ausschließlich das obige Probeobjekt, verifiziert
Hash, Rollen-/Pfad-/Methodennegativfälle und den echten URL-Ablauf. Kein Delete.
Die frühere Freigabe von Run #14 ersetzt nicht die runbezogene Freigabe dieses Jobs.
Kein Reviewer-Override vorgenommen, keine Schutzregel geändert.

Transportfreigabe bleibt false, Bridge-Modus synthetic. Ein echter Backuplauf wird
erst nach erfolgreichem Abschluss dieser Providerabnahme gestartet. Deshalb sind
noch keine echte Snapshotzeit, Backupgröße, Medienbackup- oder Authausschlussnachweise
dieses Abnahmelaufs vorhanden. R03 Nein; R04 einschließlich Operations-Erweiterung
noch nicht geschlossen; AP9.4 vollständig Nein. Schutzregeln/Credentials unverändert.

## Fortsetzung nach Betreiberfreigabe (ersetzt den vorigen Zwischenstand)

Der Betreiber hat operations-restore am 16.09.2026 gegen 14:08 Europe/Berlin
regulär freigegeben. Restorejob 104777683381 erfolgreich, synthetischer Schritt 5m 11s.
Strukturierter Nachweis: signedWrongAudience rejected, missingCredentials rejected,
tamperedClaimCases 11, semanticForeignClaims local-signed-regression-only,
readback verified, expiry rejected, negatives 9, signedMethodAndPath rejected,
deletion false. SHA-256 identisch zum Backupteil.

Damit ist die vereinbarte mehrschichtige Provider-/OIDC-/Blob-Abnahme bestanden:
semantische Claimprüfung lokal mit signierten RSA/JOSE-Tokens, echte GitHub-signierte
Audience-Negativprüfung an Edge und Bridge, echte manipulationssichere unabhängige
JWT-Prüfung sowie positive Backup-/Restoreidentitäten und Live-Transportrechte.
Keine Behauptung, GitHub-signierte Tokens eines fremden Repositorys erzeugt zu haben.

Store erneut in der Provideroberfläche geprüft: Private, FRA1, genau eine Verbindung,
pubquiz-backup-operations / Production, ausschließlich OIDC. Keine PubQuiz-App-,
Preview- oder Development-Verbindung. Operations enthält nur die vier AP94-Werte,
BLOB_STORE_ID und BLOB_WEBHOOK_PUBLIC_KEY, keine DB- oder statischen Blob-Credentials.
Der bestehende App-Isolationsnachweis bleibt unverändert; die Operations-Erweiterung
ist nun bestanden. R04 wieder geschlossen: Ja.

Gemäß Betreiberauftrag AP94_BRIDGE_MODE im separaten Operations-Projekt auf acceptance
gesetzt und ausschließlich Operations mit identischem Main-Code erneut deployed:
`dpl_8BcywbVyiGBG7xDaZEWHNRCGQFmY`, READY,
`pubquiz-backup-operations-8n2ezs52z-just-phil-gud.vercel.app`.
Stabile Origin unverändert. Keine Autorisierungs-/Provider-/Schutzregel geändert.

GitHub verlangt beim Speichern von AP94_OIDC_TRANSPORT_ACCEPTED eine erneute
Zugangsbestätigung (Confirm access). Beide GitHub-Environmentwerte sind noch false,
die Änderung wurde nicht gespeichert. Betreiber um eigene Anmeldung gebeten;
keine Credentials gelesen/gesetzt, keine Umgehung. Ein echter Workflow wurde nicht
gestartet. BACKUP_AUTOMATION_ENABLED und BACKUP_RETENTION_VERIFIED bleiben false.

Aktuell: R03 Nein; R04 Ja; AP9.4 vollständig Nein. Kein echter Snapshot, DB-/Medienbackup
oder Restore dieses Abnahmelaufs. Nach GitHub-Anmeldung beide Transportnachweise
speichern/verifizieren und echten manuellen Backup-Lauf starten; am echten
operations-restore Reviewer-Gate erneut stoppen.
