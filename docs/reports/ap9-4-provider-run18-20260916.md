# AP9.4 – PR #14 / synthetische JSON-Providerabnahme Run #18

16.09.2026. Reguläre Integration des ausdrücklich freigegebenen Commits
017a9ca46ef8412608add94bfa2ba3a37baec07d über PR #14, keine Schutzregel umgangen.
Main: `1fa95180a19424120c1e754bb97ef82d8adf0adb`; Git-Tree identisch zum PR-Head.

- Main-CI https://github.com/justphilgud/pubquiz-web/actions/runs/35099925055 erfolgreich.
- Bridge-CI https://github.com/justphilgud/pubquiz-web/actions/runs/35099925045 erfolgreich.
- Production-Workflow https://github.com/justphilgud/pubquiz-web/actions/runs/35100127635:
  Scopeprüfung erfolgreich, App-Deploymentjob ausdrücklich übersprungen.
- Operations auf Main-SHA READY: dpl_xnkG2MVwyATA3pccxM56jV9LpXcR.
  Stabiler Alias https://pubquiz-backup-operations.vercel.app, Modus synthetic.
- PubQuiz-Production nach Integration erneut unverändert bestätigt: READY,
  dpl_3Ufmv6QmvYkp712cPjVPXBDJtsN3, Release 1d4c703e068c0752a10757620d1f7fe03d47b20a.

## Konfiguration und Isolation

Vercel Operations-API: All Deployments weiterhin aktiv. Genau die bestehende
GitHub-Trusted-Source mit Audience urn:pubquiz:ap94:blob-bridge, Repository
justphilgud/pubquiz-web, Branch refs/heads/main, Workflowname
AP9.4 Manual Backup and Isolated Restore, ausschließlich Operations-Production.
Keine Änderung an diesen Regeln oder der JWT-/Rollenautorisierung.

Store pubquiz-backups: weiterhin ausschließlich pubquiz-backup-operations /
Production per OIDC verbunden, BLOB_STORE_ID und BLOB_WEBHOOK_PUBLIC_KEY.
Keine PubQuiz-App-Verbindung und keine statischen Credentials reaktiviert.

GitHub operations-backup: main-only, BACKUP_AUTOMATION_ENABLED=false,
BACKUP_RETENTION_VERIFIED=false, AP94_OIDC_TRANSPORT_ACCEPTED=true.
operations-restore: main-only, Required Reviewer justphilgud aktiv,
Administrator-Bypass deaktiviert, Expected Host weiterhin exakt
ep-small-poetry-b2jfzg9w.c-6.eu-central-1.aws.neon.tech.
Alle Werte lesend kontrolliert, keine Environment-Schutzregel geändert.

## Synthetischer Lauf

Run https://github.com/justphilgud/pubquiz-web/actions/runs/35100309800
(Run #18, attempt 1, mode synthetic, main), Backupjob 104807773766.
Keine Datenbank-Credentials im synthetischen Job, keine echten Backupdaten.

Privater Store-Browser bestätigt am exakten Laufpräfix
synthetic/acceptance/run-35100309800-1/:

- probe.bin: application/octet-stream, 65 Bytes.
- probe.json: application/json, 42 Bytes.

Die MIME-Metadaten wurden direkt im Vercel-Store kontrolliert. Keine Testobjekte
gelöscht oder überschrieben.

Backupjob erfolgreich in 6m02s, synthetischer Transportschritt 5m14s. Regression
(62 Tests) und verifizierte OIDC-Claims erfolgreich. Resultat:

| Objekt | Bytes | SHA-256 | Privater Readback |
|---|---:|---|---|
| probe.bin | 65 | 67cc2bd923130a64c1617b6786462afc1d6c1cf5c9ab3b10ff7e99081433b9f3 | verifiziert |
| probe.json | 42 | 92db5d82b0d99b4663576415e02770821d1b94f90e1be306f7416b52a116c586 | verifiziert |

Identitätsgrenzen: tatsächlich signierte falsche Audience abgewiesen, fehlende
Credentials abgewiesen, 11 manipulierte Claims mit ungültiger Signatur abgewiesen.
Semantische fremde Claims weiterhin ausschließlich lokale signierte Regression,
keine Behauptung echter fremder GitHub-Identitäten. Acht Operationsnegativfälle grün.
Beide Dateitypen: Größen-/Overwrite-Abweisung, Method-/Pfad-Abweisung und tatsächlicher
Ablauf nach fünf Minuten erfolgreich. deletion=false.

## Reguläre Reviewer-Freigabe und vollständiger Abschluss

Run #18 wartete zunächst regulär auf operations-restore. Der Betreiber hat am
16.09.2026 um 15:19 Europe/Berlin freigegeben; keine Freigabe durch den Agenten.
Restorejob 104809963788 erfolgreich in 6m05s, Transportschritt 5m13s.
Der Job führt im Modus synthetic ausschließlich den OIDC-/Security-Test sowie
privaten Readback, SHA-256-/Größenvergleich, Methoden-/Pfad- und Ablaufprüfung
beider Testobjekte aus. Keine DB-Credentials im Testschritt, kein Datenbankzugriff,
keine Änderungen am isolierten Neon-Ziel oder Production, keine Blob-Writes/Deletes.

Restore-Lesetest bestätigt beide oben dokumentierten Größen und SHA-256 identisch,
readback=verified, expiry=rejected, neun Operationsnegativfälle erfolgreich,
signedMethodAndPath=rejected, deletion=false. Identitätsgrenzen ebenfalls grün
(gleiche ausdrücklich begrenzte Aussage zu semantischen fremden Claims wie oben).
Damit ist die erneute synthetische JSON-/Binärproviderabnahme vollständig grün.

Anschließend Operations auf unverändertem Main-Stand im acceptance-Modus READY:
dpl_3R2iS7bY5MWUyi8BybGaXEqL3VUg. PubQuiz-Production und Main erneut lesend
unverändert bestätigt. Autorisierter echter Run #19 gestartet:
https://github.com/justphilgud/pubquiz-web/actions/runs/35102025962.
Beim ECHTEN Restorejob erneut stoppen und die geforderten Backup-/Zielnachweise liefern.

R03 Backup/Restore geschlossen: Nein.
R04 Preview-/Production-Isolation geschlossen: Ja.
AP9.4 vollständig abgenommen: Nein.
