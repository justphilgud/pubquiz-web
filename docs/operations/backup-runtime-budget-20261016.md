# Bedingter Vorschlag: endliches Zeitbudget für Vollsicherungen

Noch nicht zur Integration freigegeben. Der aktuelle Lauf 38930389548 bleibt
unverändert auf main 72929e18 und seinem bestehenden Limit von 45 Minuten.
Er wird für diesen Vorschlag weder abgebrochen noch neu gestartet. Falls er
vollständig erfolgreich endet, ist diese Erweiterung nicht erforderlich.

## Beobachtung, kein vorweggenommener Fehler

Die geschützte Sicherung umfasst 782 Objekte. Der reguläre GitHub-Live-Viewer
zeigte nach 22 Minuten 9 Sekunden im Backupschritt zuletzt Objekt 288 als
hochgeladen. Bisher keine Fehlermeldung; Upload und privater Readback sind
sequentiell. Der frühere Lauf mit gleichem Umfang benötigte rund 29 Minuten
insgesamt. Die wechselnde Laufzeit begründet noch keine behauptete konkrete
Providerursache oder einen bereits eingetretenen Timeout.

## Konkrete, getrennt zu genehmigende Änderung

Nur `jobs.backup.timeout-minutes` des bestehenden AP9.4-Workflows steigt von 45
auf 75 Minuten. Der isolierte Restore-Job bleibt bei 45 Minuten. Das neue Limit
gilt für manuelle und bereits aktivierte planmäßige Backup-Läufe; es aktiviert
keinen Schedule und keine Retention. Der Runner kann
damit maximal 30 Minuten länger laufen und mit denselben autorisierten Rechten
arbeiten; entsprechend können zusätzliche Runnerkosten entstehen. Die Grenze
bleibt endlich. Kein neuer Zugang, kein neuer Store und kein Bridge-Deployment.

Der bestehende Workflow bleibt für das Gesamtzeitbudget verantwortlich. Der
Backupkern behält unverändert Snapshot, Dump, Upload und Integritätsprüfung;
keine neue Komponente und keine Auslagerung von Datenverantwortung.

Unverändert bleiben insbesondere:

- Production-Datenbank ausschließlich per bestehendem Reader und READ ONLY.
  Der Snapshot endet weiterhin vor Mediencapture und Upload.
- Fester Store, Prefix und unveränderliche Workflow-/Branch-/Environmentbindung.
- Kurzlebige OIDC-Tokens, Pfad-/Größen-/MIME-Grenzen, Overwrite-Verbot,
  HTTP-Timeouts und begrenzte Upload-Retries.
- Strikt sequentielle Datenübertragung mit privatem Readback und Prüfsumme vor
  dem nächsten Objekt; Fehler veröffentlicht kein gültiges Manifest.
- Manifest zuletzt, anonymer Zugriff abgelehnt, insgesamt erfolgreicher Lauf
  für die unveränderte Restore-only-Provenienz erforderlich.
- Restore-Ziel, Lease-, Empty-, Reviewer- und Single-Transaction-Gates.
- Inventargrenzen 64 Seiten / 64.000 Objekte sowie sämtliche Retentionregeln.
  `BACKUP_RETENTION_VERIFIED` bleibt `false`; keine Löschfreigabe.

Dieser Operations-only-Vorschlag verändert keinen Anwendungscode oder Schema,
löst keinen Anwendungsdeploy aus und ändert keine Vercel-Einstellung.

## Abnahmebedingung

Bestehende Backup-, Restore-, Bridge-, Retention- und Workflow-Schutztests sowie
Typecheck/Lint und vollständige CI am endgültigen Head prüfen. Keine neuen
Dependencies und kein Test, der nur die einzelne YAML-Zahl nachschreibt.

Erst wenn das bestehende 45-Minuten-Limit nachweislich den aktuellen Lauf
beendet, die genaue Abbruchursache dokumentieren und die ausdrückliche Freigabe
für diese begrenzte Erweiterung einholen. Danach nach grüner CI regulär
integrieren und eine neue geschützte Vorab-Sicherung mit verifiziertem aktuellen
Production-SHA starten. Keine Übernahme eines unvollständigen alten Laufs als
Restore-PASS und keine Löschung seiner Teilobjekte. PR116 bleibt bis zum
vollständigen neuen Sicherungserfolg vor Migration und App-Release angehalten.
