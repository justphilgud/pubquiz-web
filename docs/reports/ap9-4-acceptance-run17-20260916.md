# AP9.4 – Run #17: belegte MIME-Ablehnung und minimaler Fix

16.09.2026. PR #13 ist regulär integriert, Main
`f831b54caeee2d1e618a215ec57ce8f357f7a869`; Tree identisch zum freigegebenen
PR-Head `12ca59d137a790961cf1e45be9d95aa89db6a26a`.

- [Main-CI](https://github.com/justphilgud/pubquiz-web/actions/runs/35097610359): erfolgreich.
- [Bridge-CI](https://github.com/justphilgud/pubquiz-web/actions/runs/35097610322): erfolgreich.
- [Production-Workflow](https://github.com/justphilgud/pubquiz-web/actions/runs/35097764880):
  Scopeprüfung erfolgreich, „Approve, migrate and deploy Production“ übersprungen.
- Operations-Deployment `dpl_84M5Dw7JW6WBuGeUeZtbq4rtm5fZ`, READY, Main-SHA wie oben,
  stabiler Alias https://pubquiz-backup-operations.vercel.app.
- PubQuiz-Production vor Start lesend bestätigt: `dpl_3Ufmv6QmvYkp712cPjVPXBDJtsN3`,
  READY, Release `1d4c703e068c0752a10757620d1f7fe03d47b20a`, unverändert.

## Echter Lauf und Diagnose

[Run #17](https://github.com/justphilgud/pubquiz-web/actions/runs/35098119649),
attempt 1, manuell main, acceptance, gestarteter Zeitpunkt 14:49 Europe/Berlin.
Backupjob `104800457398` scheitert nach insgesamt 1m51s, Backupschritt 1m01s:

`PRIVATE_UPLOAD_AUTH_OVERLAY_HTTP_403_CONTENT_TYPE_NOT_ALLOWED`

Damit ist die MIME-Ablehnung des Auth-Overlays belegt. Die bisherige pauschale
application/octet-stream-Vorgabe passt auf diesem Providerpfad nicht zur JSON-Datei.
Welcher interne Providermechanismus (Header-/Dateinamenauswertung) den Typ bestimmt,
wurde nicht beobachtet und wird nicht als bewiesen dargestellt.

Aus dem sequenziellen Ablauf folgt: Source-Identität/Leserrechte, read-only Snapshot,
Authausschluss, Dumpprüfung und lokale Medienerfassung erfolgreich; database.dump
wurde hochgeladen und mit SHA-256 sowie Größe wieder eingelesen, bevor das Overlay
gesendet wurde. Dies ist noch KEIN vollständiges Backup. Manifest-/Medienupload und
abschließende Validierung wurden nicht erreicht. Snapshotzeit und vollständige Größe
liegen mangels erfolgreicher Zusammenfassung nicht vor. Keine Originalpassworthashes
oder Team-Passwörter exportiert. Kein Restore gestartet.

Backupkennung: `production/acceptance/run-35098119649-1`.
Teilobjekte bleiben privat erhalten; kein Löschen, kein Overwrite, keine Rotation.

## Korrektur und Sicherheitsgrenzen

Gemeinsamer statischer Artefaktvertrag: Auth-Overlay und Manifest ausschließlich
application/json; Dump, Medien und Binärprobe ausschließlich application/octet-stream.
Die serverseitige Autorisierung bestimmt den Typ aus dem bereits erlaubten Objektnamen.
Delegation und Signed URL enthalten jeweils genau diesen einen Typ; der Runner setzt
den gleichen HTTP-Header. Anfragen mit eigener MIME-/Allowlist-Eigenschaft werden
weiterhin vor Providerzugriff abgewiesen. Keine Wildcard, keine allgemeine zweite
MIME-Erlaubnis, keine veränderten Bytes, Pfade, TTLs, Größen- oder Rollenrechte.

Die [offizielle Signed-URL-Dokumentation](https://vercel.com/docs/vercel-blob/vercel-signed-urls)
beschreibt MIME-Beschränkungen in Delegation und URL sowie dazu passende PUT-Header.
Installiertes SDK @vercel/blob 2.4.0 signiert diese Vorgaben; keine neue Abhängigkeit.

Die synthetische Providerprobe wird um die fest benannte, kleine probe.json ergänzt.
Beide Proben durchlaufen Upload/Readback/SHA-256/Größe und Restore-Lesen sowie
Overwrite-/Größen-/Methoden-/Pfad-/Ablaufprüfungen. Keine Production-Daten oder
DB-Credentials in diesem Lauf. Bestehende Identitätsnegativtests bleiben erhalten.

## Lokale Prüfungen und nächstes Gate

- 62 Operations-/Bridge-/Deployment-Scope-Tests erfolgreich, einschließlich echter
  JOSE-Verifikation und SDK-Signierung für sechs Artefaktfälle.
- App-Typecheck und separater Bridge-Typecheck erfolgreich.
- ESLint aller geänderten TS-Dateien und Bridge ohne Warnungen erfolgreich.
- Nur Operations-Code/Tests und AP9.4-Dokumentation; keine App-/Schema-/Runtimeänderung
  an PubQuiz, kein neuer Dependency-Eintrag.

Nächster Schritt: regulärer PR/Merge-Freigabepunkt. Nach Integration Main-CI und
Operations-Deployment prüfen, dann vollständige synthetische Abnahme einschließlich
JSON durchführen. Required Reviewer des synthetischen Restorejobs bleibt wirksam.
Erst nach grünem Providerlauf wieder echter Backupversuch. Kein Reviewer-Bypass.
Beim echten Restore weiterhin explizite Betreiberfreigabe vor DB-Schreibzugriff.

BACKUP_AUTOMATION_ENABLED=false und BACKUP_RETENTION_VERIFIED=false unverändert.
Production/Preview/Development bleiben als Restoreziele ausgeschlossen. Festes Ziel
ist Projekt icy-leaf-46256271, Branch br-bitter-paper-b20sx4lu, Endpoint
ep-small-poetry-b2jfzg9w, Host ep-small-poetry-b2jfzg9w.c-6.eu-central-1.aws.neon.tech.

R03 Backup/Restore geschlossen: Nein.
R04 Preview-/Production-Isolation geschlossen: Ja (keine neue Isolationsöffnung;
Live-MIME-Abnahme des vorbereiteten Operations-Fixes noch ausstehend).
AP9.4 vollständig abgenommen: Nein.
