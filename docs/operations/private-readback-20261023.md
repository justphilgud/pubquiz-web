# Private Readback – gezielte Diagnose vom 23.10.2026

Run 39920641414 scheiterte am 23.10.2026 um 10:44:32 MESZ nach dem erfolgreichen
Upload des Medienobjekts 503 von 840. Der vorhandene Phasenfilter meldet nur
`PRIVATE_READBACK_FAILED`; er fasst auch Grant-, Netzwerk- und Lesefehler unter
derselben Phase zusammen. Der historische konkrete HTTP-Status ist nicht erhalten.
Der Restore eines älteren Backups ist kein Nachweis eines frischen Backup-Readbacks.

Der Client ergänzt ausschließlich die feste Stufe `GRANT`/`GET`/`BODY` und den
numerischen HTTP-Status beziehungsweise `null`, wenn keine Antwort vorliegt.
Eine abgewiesene Read-Grant-Antwort erhält zusätzlich ihren HTTP-Status. Keine
URLs, Tokens, Header, Providertexte, Dateinamen oder Exception-Causes werden geloggt.
Fehlercodes, Berechtigungen, Fail-closed-Verhalten und Integritätsprüfungen bleiben
unverändert. Noch keine pauschalen Retries und keine behauptete Providerursache.

Das bekannte unzureichende Backup-Jobbudget wird von 45 auf 90 Minuten erhöht,
identisch zur bereits geprüften Änderung in PR #125. Der Wochenplan wird in diesem
Operations-PR nicht vorgezogen. Es werden keine Anwendung, Datenbank oder Bridge
deployt und keine Daten zurückgesetzt.

Für den realen Nachweis muss der Client im bestehenden, auf `main` gepinnten
OIDC-Workflow verfügbar sein. Daher separater Operations-PR mit vollständiger CI
und nachfolgendem frischem manuellen Backup vor der Mergebewertung von PR #125.
Operations-only Deployment-Scope muss einen Anwendungsdeploy ausschließen.
