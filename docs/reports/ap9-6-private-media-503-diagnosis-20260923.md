# AP9.6 – Diagnose Private-Media-Upload 503 (2026-09-23)

## Ergebnis

`PRIVATE_UPLOAD_MEDIA_HTTP_503_SERVICE_UNAVAILABLE` entstand beim direkten,
kurzlebig signierten PUT zu Vercel Blob. GitHub OIDC, Trusted Source, Operations
Bridge, objektgenaue Grant-Erteilung und private Readbacks der zuvor vollständig
hochgeladenen Objekte funktionierten. Der Befund ist ein transienter Fehler auf
dem Provider-Transportpfad eines einzelnen PUTs; es gibt keinen Nachweis für eine
fehlerhafte Authentifizierung, Storebindung, Objektregel oder parallele Überlastung
durch den Workflow.

## Verglichene Läufe

| Lauf | Ergebnis | Transportbefund |
| --- | --- | --- |
| `35702011936` | erfolgreich | gleicher Main-SHA, Node 24, `@vercel/blob` 2.4.0, Bridge-Deployment und serieller Uploadpfad |
| `35829788144` | fehlgeschlagen | 44 erfolgreiche Bridge-Zugriffe; anschließender direkter Media-PUT erhielt 503 |
| `35830620425` | fehlgeschlagen | 12 erfolgreiche Bridge-Zugriffe; anschließender direkter Media-PUT erhielt 503 |
| `35830448647` | synthetische Kontrolle fehlgeschlagen | Oversize-Probe erreichte die ältere Bridge und wurde dort als generisches 403 klassifiziert; kein Nachweis eines Blob-PUT-Fehlers |

Beide echten Fehler liefen gegen dasselbe READY-Deployment
`dpl_F7RaiJ58BYpFbSZFxHenWk2F6JnN` des separaten Projekts
`pubquiz-backup-operations` in FRA1. Die Bridge antwortete im Fehlerfenster mit
HTTP 200 und stellte die erwarteten Grants aus. Der erste Lauf hatte vor dem
Fehler wesentlich mehr Artefakte vollständig verarbeitet als der zweite. Damit
scheidet ein einzelnes deterministisch fehlerhaftes Medienobjekt als gemeinsame
Ursache aus. Der Workflow lädt seriell und hatte gegenüber dem letzten Erfolg
keine Änderung an Node-Version, Blob-Client, Uploadmethode oder MIME-Vertrag.

Der öffentliche Vercel-Status meldete Blob zum Diagnosezeitpunkt als operational
und keinen passenden flächendeckenden Vorfall. Das schließt einen kurzzeitigen
Request- oder regionalen Fehler nicht aus. Die belastbare Klassifikation lautet
daher: transienter Providerfehler auf Request-Ebene, ohne öffentlich bestätigten
plattformweiten Incident.

## Warum die bisherigen Präfixe ungültig bleiben

Der Ablauf speichert zuerst `database.dump`, dann `auth-redacted.json` und danach
die Medien seriell. Jedes Objekt erhält unmittelbar einen privaten Readback mit
Größen- und SHA-256-Prüfung. `manifest.json` wird erst erstellt und hochgeladen,
wenn alle Datenartefakte erfolgreich sind. Die fehlgeschlagenen Läufe besitzen
daher kein gültiges Abschlussmanifest und sind keine Restore-Basis. Ihre Objekte
werden durch diese Änderung weder überschrieben noch gelöscht.

## Härtung

- Höchstens vier PUT-Versuche, nur nach HTTP 429 oder 5xx.
- Exponentieller Backoff ab 500 ms mit kleinem Jitter; `Retry-After` wird bis
  maximal 60 Sekunden beachtet.
- Keine Wiederholung nach 400, 401 oder 403.
- Jeder Wiederholungsversuch erhält einen neuen OIDC-vermittelten, objektgenauen
  Grant und eine neue Signed URL.
- Nach jeder transienten Antwort erfolgt zuerst ein privater Readback. Stimmen
  Bytezahl und SHA-256, gilt der möglicherweise nur antwortseitig verlorene PUT als
  erfolgreich. Ein abweichendes Objekt bricht hart ab; es wird nie überschrieben.
- Das Manifest bleibt das letzte Objekt. Ein teilweise erfolgreicher Lauf kann
  weiterhin nicht als vollständiges Backup erscheinen.
- Secretsichere Diagnose umfasst Position/Gesamtzahl, logischen Typ, Größe,
  MIME-Typ, SHA-256, Versuch, Status, Endpunktklasse, begrenztes `Retry-After` und
  allowlist-geprüfte Request-/Trace-IDs. Namen, Pfade, URLs, Token und Providertexte
  bleiben verborgen.
- Ein optionaler synthetischer Workflowtest prüft sequenziell 1 KB, 100 KB, 1 MB,
  5 MB und eine repräsentative 2-MB-Mediendatei, jeweils mit Upload, privatem
  Readback, Größe und SHA-256.

## Sicherheitsgrenzen

Die Bridge-Autorisierung, Rollen- und Environmentgrenzen, Pfadbindung,
Overwrite-Verbot, private Storebindung, Authausschluss, Restore-Reviewer-Gate und
Retention-Policy bleiben unverändert. Es gibt keine Änderung am Produktcode, an
Production-Daten, Credentials, Secrets, Environmentvariablen oder Deployments.

## Noch erforderliche reale Abnahme

Der Code muss regulär nach `main` integriert und das separate Operations-Bridge-
Deployment auf diesen Stand gebracht werden. Danach ist zuerst die synthetische
Diagnosematrix auszuführen. Nur wenn Upload, Readback, Größen-/Hashprüfung und die
bestehenden Negativtests vollständig grün sind, darf ein neuer vollständiger
Production-Backup-Lauf gestartet werden. Erst dessen validiertes Manifest macht
den Backup-Pfad wieder nachweislich restore-fähig. Der Länderumriss-Import bleibt
bis dahin gesperrt.
