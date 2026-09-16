# AP9.4 – Echter Backup-Abnahmelauf #16

16.09.2026. Fortsetzung nach vollständig erfolgreicher synthetischer Providerabnahme
in Run #15 und regulärer GitHub-Zugangsbestätigung durch den Betreiber.

- Operations-Main: `4ac84083c0af78b319fb2f9e944e3c7467f69645`.
- Production-Release vor Start erneut lesend bestätigt:
  `1d4c703e068c0752a10757620d1f7fe03d47b20a`, READY,
  Deployment `dpl_3Ufmv6QmvYkp712cPjVPXBDJtsN3` unverändert.
- Beide GitHub-Environments: AP94_OIDC_TRANSPORT_ACCEPTED=true gespeichert/verifiziert.
- BACKUP_AUTOMATION_ENABLED=false, BACKUP_RETENTION_VERIFIED=false unverändert.
- Separates Operations-Deployment im acceptance-Modus READY:
  `dpl_8BcywbVyiGBG7xDaZEWHNRCGQFmY`, gleicher Main-Code.
- Keine App-, Schutzregel-, Credential- oder Trusted-Source-Änderung.

Run: https://github.com/justphilgud/pubquiz-web/actions/runs/35096150165

Run #16, manuell, main, mode acceptance, attempt 1.
Backupjob 104793892035. Regression und OIDC-Claims erfolgreich. Echter Backupschritt
nach 1m 58s mit PRIVATE_UPLOAD_REJECTED fehlgeschlagen. Kein Restore gestartet.

## Nachweis und Diagnosegrenze

Im privaten Store ist unter production/acceptance/run-35096150165-1 ausschließlich
database.dump sichtbar (UI gerundet 282 kB). Keine auth-redacted.json, keine Medien,
kein Manifest. Nichts gelöscht oder überschrieben. Teilstand ist kein gültiges Backup.

Aus dem Codeablauf folgt: Leserrollen-/Rechteprüfung, konsistenter Snapshot,
Authausschlussprüfung, Dumpprüfung, lokale Medienerfassung und Upload/Hash-/Größen-
Readback des Datenbankarchivs sind passiert. Der nächste Upload ist auth-redacted.json;
dort trat die Providerablehnung auf. Originale password_hash/team_passwort wurden
weder exportiert noch hochgeladen. Vollständiger Auth-Overlay-/Medien-/Manifestnachweis
und Snapshotzeit/gesamte Backupgröße sind mangels erfolgreichem Ergebnis nicht verfügbar.

Der alte generische Uploadfehler verwirft HTTP-Status und Providerkategorie. Die konkrete
Providerursache ist daher noch NICHT belegt. Insbesondere keine spekulative Änderung
an MIME-Erlaubnis, Dateinamen, Größenlimits, OIDC oder Signed-URL-Sicherheitsgrenzen.

Minimaler Diagnosefix: Uploadfehler enthalten nur feste Artefaktklasse, HTTP-Status und
eine erlaubte Providerkategorie. Antworttext auf 4096 Bytes begrenzt; bekannte
Meldungsformen gemäß installiertem @vercel/blob 2.4.0 werden nur in feste Kategorien
übersetzt. Keine Providertexte, Dateipfade, URLs, JWTs oder Ursachenobjekte ausgeben.
Keine Retries, kein zweiter echter Lauf vor regulärer Main-Integration.

60 Operations-/Bridge-/Scope-Regressionstests, Typecheck und ESLint ohne Warnungen
erfolgreich; neuer PR am Merge-Freigabegate. Providerabnahme aus Run #15 bleibt dokumentiert,
R04 unverändert Ja; echte Backup-/Restore-Gesamtabnahme weiterhin offen.

## Festgelegtes Restoreziel

- Projektname pubquiz-restore-test-20260914, Projekt-ID icy-leaf-46256271.
- Branch production, Branch-ID br-bitter-paper-b20sx4lu.
- Endpoint-ID ep-small-poetry-b2jfzg9w.
- Direct Host ep-small-poetry-b2jfzg9w.c-6.eu-central-1.aws.neon.tech.
- Datenbank neondb, Owner neondb_owner, PostgreSQL 17.

Host sowohl gegen Production/Preview/Development-Ausschlussliste als auch feste
RESTORE_TARGET-Konstante geprüft. Auch konfigurierbare URL und Expected Host müssen
exakt diesem Host entsprechen. Kein Restore gegen ein alternatives Ziel möglich.
Restore verlangt leeres Ziel und schreibt ausschließlich in einer Transaktion.
Required Reviewer unverändert; kein echter Restore vor ausdrücklicher Freigabe.

R03 Nein; R04 Ja; AP9.4 vollständig Nein.
