# AP9.4 – Lauf #14: synthetischer Backuptransport und Restore-Lesetest erfolgreich

16.09.2026. Lokaler Nachtrag nach Main-Integration, noch keine vollständige Providerabnahme.

## Integration und Deployment

- PR #11 regulär integriert; freigegeben 2d9aec4d1eeed5a6d7e205137228d004028310b1.
- Main `0a6b95b3ba01edfb88fa86059bdf4e475872d9df`, Dateibaum identisch zum freigegebenen Commit.
- Main-CI erfolgreich: https://github.com/justphilgud/pubquiz-web/actions/runs/35086964938
- Bridge-CI erfolgreich: https://github.com/justphilgud/pubquiz-web/actions/runs/35086964956
- App-Production-Workflow: Scope grün, Approve/migrate/deploy Production skipped:
  https://github.com/justphilgud/pubquiz-web/actions/runs/35087126720
- Preview skipped: https://github.com/justphilgud/pubquiz-web/actions/runs/35087126726
- Nur Operations auf diesem Main deployed, READY:
  https://vercel.com/just-phil-gud/pubquiz-backup-operations/6YeiqpG3A2L9RPNdgviuEfHvkYgC
- Deploymentdomain pubquiz-backup-operations-oe3imluqp-just-phil-gud.vercel.app.
- Trusted Source, OIDC-/Bridge-Vertrag, Schutzregeln und Flags unverändert.

## Echter synthetischer Transport

Run https://github.com/justphilgud/pubquiz-web/actions/runs/35087282468
Modus synthetic, Branch main, attempt 1.
Backupjob 104764989184 erfolgreich, 5m 56s; Transportschritt 5m 11s.

- Genaues Testobjekt: synthetic/acceptance/run-35087282468-1/probe.bin
- Privater Store pubquiz-backups, store_BVRjATGCRBW0fBeF.
- Größe 65 Bytes im Store gesehen, entspricht dem festen Testinhalt.
- SHA-256 67cc2bd923130a64c1617b6786462afc1d6c1cf5c9ab3b10ff7e99081433b9f3;
  unabhängig aus festem Testinhalt berechnet, stimmt mit Readbackprüfung überein.
- Acht Bridge-Negativfälle erfolgreich: fremder Store, fremder Runpfad, Traversal,
  unzulässige Objektart, Delete, Overwriteflag, Backup→Restore, Übergröße.
- Legitime Signed-URL-Ausgabe, Upload und privater Readback erfolgreich.
- Provider verweigert zu großen PUT und direkten Overwrite-Replay; weiterer
  Uploadgrant für vorhandenes Objekt ebenfalls verweigert.
- GET-URL erlaubt keine PUT-/DELETE-Operation und keinen veränderten Pfad.
- Nach tatsächlichem Ablauf wird URL abgewiesen; kein künstlicher Zeit-/TTL-Ersatz.
- Kein Delete/Cleanup gemäß Testvertrag. Keine Production-Daten/DB-Credentials in diesem Modus.
- Keine Signed URLs/JWTs im strukturierten Erfolgsnachweis.

## Freigegebener Restore-Lesetest und offene Abnahme

Restorejob 104766677884 wurde vom Betreiber regulär freigegeben und ist erfolgreich:
5m 48s Jobdauer, 5m 6s Transportschritt, Abschluss am 16.09.2026 gegen 13:05 Europe/Berlin.
Er las ausschließlich das obige Probeobjekt. Hash identisch, privater Readback verified,
neun Negativfälle erfolgreich, Signed-URL-Methoden/Pfade rejected, echter Ablauf rejected,
deletion false. Kein Neon-Zugriff, kein echter Datenbankrestore. Schutzregeln unverändert.

Transportfreigabe bleibt false, bis der vollständige synthetische Vertrag bestanden ist.
Die semantische Negativmatrix für falsche Repo-/Branch-/Workflow-/Audience-/Environment-/
sub-/ID-Claims ist lokal mit JOSE geprüft; erfolgreiche Operationstests sind kein Ersatz
für zusätzliche Live-Identitätsnegativnachweise. Diese Abgrenzung bei Abschluss beachten.

Kein echtes Production-Backup, kein Medienbackup, kein Neon-Restore, keine RPO/RTO-Messung.
R03 Nein; R04 inklusive Operations-Erweiterung Nein (bisherige App-Isolation unverändert);
AP9.4 vollständig Nein.

## Ergänzung des Testprogramms

Der bisherige Live-Lauf enthält keine Identitäts-Negativproben. Minimaler Testfix:
echte GitHub-Signatur mit falscher Audience am Vercel-Eingang und separat an der
Bridge; fehlende Credentials; elf Payload-Manipulationen bei gültigem Edge-Token.
Manipulationen werden ausdrücklich nicht als semantisch gültige fremde GitHub-
Identitäten ausgegeben. Semantische Claimprüfungen bleiben lokal signierte Regressionen.
Bridge-Runtime, Autorisierung, Trusted Source und Appcode unverändert.
Nächster Schritt: reguläre PR-Freigabe für das ergänzte Testprogramm, anschließend
erneuter synthetischer Lauf. Keine echten Backupdaten vor abgeschlossener Abnahme.

Lokale Prüfung des Testfixes: 59 Operations-/Bridge-/Deployment-Scope-Tests grün;
Root-Typecheck, separater Bridge-Typecheck und ESLint ohne Warnungen grün.
Der zusätzliche native Loopback-Integrationstest konnte nicht ausgeführt werden:
psql ist in dieser Shell nicht verfügbar, kein lokaler Testcluster auf Port 55439.
Er brach mit LOCAL_INTEGRATION_FAILED ab; kein externer Datenbankzugriff.
Dieser Lauf wird nicht als bestandene PostgreSQL-Integration gezählt. Der Testfix
ändert weder PostgreSQL-Adapter noch Restore-/Snapshotlogik.
