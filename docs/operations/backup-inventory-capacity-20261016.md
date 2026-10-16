# Vorschlag: begrenzte Backup-Inventarkapazität

Noch keine Freigabe zur Integration oder Ausführung mit erhöhter Grenze.
Dieser kleine Folge-PR ist eine prüfbare Entscheidungsgrundlage für den konkret
nachgewiesenen Betriebspunkt nach dem genehmigten Operations-PR117.

## Nachgewiesener Fehler

Der ausschließlich lesende Retention-Diagnoselauf
[38928231862](https://github.com/justphilgud/pubquiz-web/actions/runs/38928231862)
meldet `OBJECT_BOUND`, `pages=33`, `objects=33000`, `maximumPages=64`,
`maximumObjects=32000`. Das ist eine Kapazitätsüberschreitung des gewachsenen
Bestands, kein Nachweis einer ungültigen Datei. Die tatsächliche Gesamtzahl ist
noch unbekannt, weil der bestehende Schutz genau dort abbricht. Keine Löschung,
kein Restore und keine erneute Datenbank-/Medienkopie in diesem Diagnoselauf.

Die frische Sicherung 38918685948 war zuvor vollständig geschrieben, privat
zurückgelesen und auf Integrität geprüft worden; ihr Gesamtlauf bleibt wegen des
Retention-Fehlers fehlgeschlagen. Der bestehende Restore-only-Provenienzschutz
verlangt einen insgesamt erfolgreichen Sicherungslauf und bleibt unverändert.

## Konkreter Änderungsumfang

Nur die zusammengesetzte Inventarobergrenze steigt von 32.000 auf 64.000 Objekte.
Die bestehende Grenze von 64 Seiten und 1.000 Objekten je Seite bleibt erhalten.
Damit bleibt jede Antwort auf 1 MiB begrenzt; auch der gesamte Lauf bleibt endlich.
Der maximal mögliche Speicherbedarf des zusammengesetzten Inventars verdoppelt
sich. Bei mehr als 64 Seiten oder 64.000 Objekten wird weiterhin abgebrochen,
statt ein abgeschnittenes Inventar auszuwerten.

Unverändert: fester privater Store und Prefix, geprüfte GitHub-OIDC-Identität,
Cursorprüfung und Schleifenerkennung, strikte Metadatenvalidierung, Größen-,
Timeout- und Workflowgrenzen, Retention-Policy, aktuelle/geschützte Sicherungen,
ETag-Vergleich und Löschbedingungen. `BACKUP_RETENTION_VERIFIED` bleibt `false`.
Keine Löschfreigabe, Credentialänderung, neue Berechtigung, Schemaänderung oder
Anwendungsveröffentlichung. Die Server-Bridge verwendet diese Gesamtgrenze nicht;
die Änderung betrifft ausschließlich den Runner und benötigt keinen Bridge-Deploy.

Die Policy bleibt im bestehenden Wire-Contract; der bestehende Client übernimmt
weiterhin vollständige Seitensammlung und Validierung. Keine zweite Architektur.

## Prüfung und weiterer Ablauf nach ausdrücklicher Freigabe

Zusätzliche Tests führen den echten Client mit synthetischen Inventarseiten aus:
vollständige 33.000 und 64.000 Objekte; 64.001 Objekte, zu viele kleine Seiten,
zu große Seite, Cursor-Schleife und fremder Pfad werden abgelehnt. Bestehende
Retention-Tests weisen weiterhin nach, dass ein Dry-Run keine Löschung anfordert.
61 gezielte Tests und Changed-file ESLint lokal bestanden; vollständige CI folgt.

Nach Freigabe und grüner CI regulär integrieren, ausschließlich den erzwungenen
Retention-Dry-Run wiederholen und sein vollständiges Ergebnis prüfen. Sollte
auch die neue endliche Grenze überschritten werden, erneut stoppen. Erst danach
eine neue, insgesamt erfolgreiche geschützte Vorab-Sicherung erstellen. Keine
Umdeutung des fehlgeschlagenen alten Gesamtlaufs in einen Restore-PASS.

PR116-Migration und App-Release bleiben bis zu diesen Nachweisen angehalten.
Die KI-Integration beginnt gemäß Auftrag erst nach erfolgreichem Release1.
