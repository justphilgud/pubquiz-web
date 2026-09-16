# AP9.4 – Echtes Backup erfolgreich / echtes Restore-Reviewer-Gate

16.09.2026. Nach vollständiger synthetischer JSON-/Binärproviderabnahme Run #18
einschließlich regulär vom Betreiber freigegebenem Restore-Lesetest.

## Stand und Sicherheitsgrenzen

Main `1fa95180a19424120c1e754bb97ef82d8adf0adb` (PR #14), Main-/Bridge-CI grün,
PubQuiz-App-Deployment übersprungen. Operations-Deployment im acceptance-Modus
`dpl_3R2iS7bY5MWUyi8BybGaXEqL3VUg` READY auf exakt diesem SHA.
PubQuiz-Production erneut vor Start unverändert bestätigt:
`dpl_3Ufmv6QmvYkp712cPjVPXBDJtsN3`, READY,
Release `1d4c703e068c0752a10757620d1f7fe03d47b20a`.

Keine Credential-Rotation, keine Schutzregeländerung, keine statischen Blob-Credentials.
BACKUP_AUTOMATION_ENABLED=false und BACKUP_RETENTION_VERIFIED=false unverändert.
Productionzugriff ausschließlich über fest geprüfte pubquiz_backup_reader-Rolle,
read-only Repeatable-Read-Transaktion, TLS und channel_binding=require.
Keine Production-Schreiboperation und noch kein echter Restore.

## Erfolgreiches Backup

Run https://github.com/justphilgud/pubquiz-web/actions/runs/35102025962
(#19, attempt 1, acceptance, main).
Backupjob `104813570136` erfolgreich in 5m08s, Regression/OIDC-Claims erfolgreich.

- Backupkennung: `production/acceptance/run-35102025962-1`.
- Snapshot: `2026-09-16T13:28:18.907504+00:00`
  = 16.09.2026, 15:28:18.907504 Europe/Berlin.
- Artefaktbytes: **209290150** (Dump + redigiertes Auth-Overlay + alle Medien;
  Manifest nicht in dieser Summe enthalten).
- Gemeldete Backupdauer: **259497 ms** = 4m19.497s. Dieser Messpunkt liegt gemäß
  Implementierung vor abschließendem Manifestupload und anonymem Zugriffsnegativtest;
  daher nicht als komplette End-to-End-Recoveryzeit interpretieren.
- Manifest SHA-256:
  `d60a86f750a9c6f80ec7e66f7c37c54f87cd779986b1783b13474f3feb76581b`.
- Privater Readback: erfolgreich für jedes Artefakt und Manifest; SHA-256 und Größe
  jeweils gegen die vor Upload berechneten Werte geprüft.
- Anonymer Zugriff auf das private Manifest abgewiesen.

Vercel-Metadaten am exakten Laufpräfix lesend geprüft: auth-redacted.json und
manifest.json application/json; database.dump und Medien application/octet-stream.
Gerundete UI-Einzelgrößen: Dump 282 kB, Auth-Overlay 11.8 kB, Manifest 259 kB.
Diese UI-Werte sind ausdrücklich keine exakten Bytezahlen.

## Validierungsumfang vor Restore

- Authausschluss bestätigt: Ja. pubquiz.users.password_hash und
  pubquiz.teams.team_passwort nie im Original exportiert; beide Tabellen aus den
  Dumpdaten ausgeschlossen, fachliche Daten über geprüfte redigierte Projektion.
  Zusätzlicher Spalten-/Werte-/Schemaaudit blockiert unreviewte Secretformen.
- Datenbankbackup vollständig: Ja im geprüften AP9.4-Scope public/pubquiz,
  konsistenter Export, pg_restore-Lesbarkeit/Datenprüfung, Sequenznachweise,
  erforderliches redigiertes Auth-Overlay vorhanden, alle Bytes readbackverifiziert.
- Medienbackup vollständig: Ja für sämtliche vom Source-Audit erfassten
  Production-Blob-Referenzen. Originalbytes erfasst, privat gespeichert und
  Hash-/Größenreadback erfolgreich; Referenzzuordnung im Manifest.
- Manifestintegrität/Readback: Ja. JSON erstellt, privat gespeichert,
  Größe und SHA-256 nach Readback verglichen. Die separate parseManifest-Prüfung
  von Struktur, Ziel, Quellidentität, Inventar und Authpolicy läuft zu Beginn des
  freizugebenden Restorejobs, noch vor jedem Datenbankschreibzugriff.
- Tatsächliche Wiederherstellbarkeit/Datenvergleich/RPO/RTO-Gesamtabnahme:
  noch offen bis zum echten Restore. Kein vollständiger Restoreerfolg behauptet.

## Echtes Reviewer-Gate und einziges Restoreziel

Run #19 Status **Waiting**, operations-restore waiting for review.
Restorejob `104815481004` wurde nicht gestartet oder vom Agenten freigegeben.

- Projektname: pubquiz-restore-test-20260914.
- Project-ID: `icy-leaf-46256271`.
- Branch-ID: `br-bitter-paper-b20sx4lu` (Branchname production in diesem isolierten Projekt).
- Endpoint-ID: `ep-small-poetry-b2jfzg9w`.
- Direct Host: `ep-small-poetry-b2jfzg9w.c-6.eu-central-1.aws.neon.tech`.
- Datenbank neondb, Rolle neondb_owner, PostgreSQL 17.

Technische Ausschlüsse: assertRestoreTarget verbietet die festen Production-,
Preview- und Development-Hosts; pinnedRestoreConnection verlangt zusätzlich den
festen RESTORE_TARGET-Host und identischen RESTORE_TEST_EXPECTED_HOST, neondb und
neondb_owner. TLS und Channel Binding werden geprüft. Unmittelbar am einzigen
Schreibaufruf erfolgt erneute Zielprüfung. Keine freie Zielwahl und kein automatisches
Ausweichen auf eine andere Datenbank.

Nach ausdrücklicher Reviewer-Freigabe wird der Job ausschließlich im isolierten
Neon-Ziel schreiben: zunächst Manifest prüfen, sämtliche Artefakte privat lesen und
Hash/Größe sowie Medien verifizieren; dann Zielidentität und leeres Ziel verlangen.
Eine einzelne psql-Transaktion mit ON_ERROR_STOP entfernt dort das leere public-Schema
und rekonstruiert public/pubquiz, Tabellen/Daten, inerte Auth-Platzhalter, Sequenzen,
Indizes, Constraints/FKs und Migrationstabellendaten aus dem Backup. Ein nicht leeres
Ziel wird abgewiesen; kein Löschen vorhandener Nutzdaten als Ausweichstrategie.
Anschließend lesender Vergleich von Schema/Katalog/Zeilen/Hashes/Stichproben,
Sequenzzuständen, Migrationen und gespeicherten Ergebnissen sowie Domain-Smoke
(Punkteformatierung/Ranking), Mediennachweis und Zeitmessung. Kein Blob-Upload/Delete
im Restorejob, keine App-/Domainverbindung, keine Credentials aus Production restauriert.
Browser-Smoke wird vom aktuellen Adapter ausdrücklich nicht ausgeführt.

R03 Backup/Restore geschlossen: Nein (echter Restore ausstehend).
R04 Preview-/Production-Isolation geschlossen: Ja.
AP9.4 vollständig abgenommen: Nein.

## Aktualisierung nach Betreiberfreigabe: Diagnose, kein Retry

Der oben dokumentierte Wartezustand ist historisch. Der Betreiber hat den echten
Restore freigegeben; Job 104815481004 scheiterte nach erfolgreichem Commit bei
RESTORE_CATALOG_MISMATCH. Das Ziel enthält die restaurierten Daten. Kein erneuter
Restore gestartet. Konkreter Vergleich, Transaktionsnachweis und minimaler Validatorfix:
[Lesende Run-19-Diagnose](ap9-4-run19-catalog-diagnosis-20260916.md).
R03 und AP9.4 bleiben offen; das bestehende Backup bleibt erhalten.
