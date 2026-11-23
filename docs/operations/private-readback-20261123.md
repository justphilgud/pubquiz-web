# Private Readback: HTTP-500-Befund und begrenzte Wiederholung

## Befund und Grenze der Aussage

Backup-Lauf [45065929496](https://github.com/justphilgud/pubquiz-web/actions/runs/45065929496)
auf `f5dfedc4506b38277669fdd743523bae0fae3c34` scheiterte am 22.11.2026 um
21:49:24 Europe/Berlin. Die secretsicher ausgewerteten Ereignisse belegen:

| Ereignis | UTC | Ergebnis |
| --- | --- | --- |
| Upload Medienobjekt 704 von 914 | 20:49:22.520 | erfolgreich |
| Upload Medienobjekt 705 von 914 | 20:49:24.003 | erfolgreich |
| Anschließender privater Readback | 20:49:24.607 | GET, HTTP 500 |

Die frühere Grant-403-Meldung um 20:22:28 gehört zu den vorgeschalteten,
erfolgreich abgeschlossenen Prüfungen, nicht zu diesem fatalen GET. Der Fehler
entstand nach der Grant-Ausgabe beim privaten Blob-GET. Der Client unternahm dafür
bislang genau einen Versuch. Es gibt keinen Beleg für einen Berechtigungsfehler,
einen abgelaufenen Grant oder einen SHA-256-Konflikt an dieser Stelle. Die interne
Ursache des HTTP 500 und seine tatsächliche Behebbarkeit durch Wiederholung sind
nicht belegt; eine erfolgreiche Wiederholung wird nicht behauptet.

Der Versuch `production/acceptance/run-45065929496-1` bleibt fehlgeschlagen und
unverifiziert. Teilobjekte werden weder gelöscht noch als gültiges Backup
ausgegeben. Diagnose aus vorhandenen GitHub-Logs, ohne Zugriff auf Backupinhalte,
Production-Datenbank oder neue Grants. Keine signierten URLs, Tokens, Header,
Providertexte oder Mediennamen im Bericht.

## Änderung des bestehenden Vertrags

Die [Diagnose vom 23.10.2026](private-readback-20261023.md) führte bewusst noch
keine Wiederholungen ein. Diese gezielte Erweiterung ersetzt diesen Teilvertrag
nur für `BridgeClient.read` mit Rolle `backup`:

| Fall | Verhalten |
| --- | --- |
| Privater GET antwortet 429 oder 500–599 | insgesamt höchstens vier GET-Versuche |
| Erneuter Versuch | neuer Grant, gleiche Rolle, gleicher Run/Attempt und Objektname; sämtliche Grantprüfungen erneut |
| Wartezeit | 500/1000/2000 ms plus weniger als 250 ms Jitter, oder vorhandenes gültiges Retry-After, maximal 60 s |
| Vierter transienter Fehler | Abbruch mit bisherigem Fehlercode und Phase |
| Grantfehler, auch 429/5xx auf dem Grant-Endpunkt | unverändert sofortiger Abbruch |
| GET mit anderen Statuscodes, inklusive 401/403/404 und Redirect | unverändert sofortiger Abbruch |
| Netzwerkfehler ohne Antwort, Bodyfehler, Größenüberschreitung | unverändert sofortiger Abbruch |
| Falsche Länge oder SHA-256 nach erfolgreichem GET | unverändert sofortiger Integritätsabbruch, kein erneuter Upload/Read |
| Restore und Retention | unverändert; keine neue Wiederholung |

Die Retryentscheidung und Wartezeit liegen im kleinen Policy-Modul
`readback-retry.ts`. `BridgeClient` behält Grantbezug/-validierung, feste Zielbindung,
GET mit `redirect:error`, `cache:no-store`, 120-s-Timeout und begrenztes Lesen.
Die vorhandene injizierbare Transportuhr wird für Upload und Readback verwendet.
`PrivateArtifacts` behält die unabhängige Längen-/SHA-256-Prüfung vor Erfolg.
Kein neuer Tokenpfad, keine Wildcard, kein Overwrite und keine Schutzänderung.

Fehlende Erreichbarkeit oder Integrität bleibt fail-closed. Erfolgsnachweise,
Manifest, Authausschluss und anonymer Zugriffsnegativtest bleiben Pflicht. Die
neuen Retryereignisse enthalten nur Versuchszahl, maximale Versuche, feste Stufe,
HTTP-Status und Wartezeit. Providerantworten werden nicht gelesen oder geloggt;
verworfene Antwortstreams werden vor dem nächsten Versuch geschlossen.

## Regressionen und weiterer Ablauf

Die bereits im echten Backupworkflow ausgeführten Bridge-Tests prüfen 500 → 200
und weitere transiente Statuscodes, frische Grants, begrenztes Retry-After,
Backoff und Abbruch nach vier Versuchen. Negative Tests schützen nicht wiederholte
Auth-/Grant-/Redirect-/Netzwerk-/Body-/Größenfehler, unveränderte Restorepolicy,
unveränderte Integritätsprüfung nach Erholung und Secret-Canaries in Logs.
Die bestehenden Grant-, TLS-/Ziel-, Token-, Rollen- und Uploadregressionen bleiben
aktiv. Isolierte Tests sind kein Nachweis eines erfolgreichen echten Backups.

Separater Operations-PR; nur Client, Policy, Tests und dieses Runbook. Der
unveränderte Deployment-Scope muss für diese Pfade false ergeben. Kein neues
Paket, keine App-, Schema-, Bridge-Server-, Workflow- oder Environmentänderung.
Kein Merge oder Production-Deployment in dieser Vorbereitung.

Nach eigener Prüfung und Integration des Operations-PRs: main-CI und übersprungenen
Anwendungsdeploy bestätigen, Production-/PR177-Identitäten erneut prüfen und einen
frischen geschützten Backupversuch im bestehenden Workflow ausführen. Nur ein
vollständig verifizierter neuer Readback samt Manifest/Integrität erlaubt die
Fortsetzung des freigegebenen PR177-Releases. Bei erneutem Fehler anhalten;
kein Restore, Löschen alter Objekte oder Bypass als Ersatz.
