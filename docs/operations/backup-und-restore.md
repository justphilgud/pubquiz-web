# Backup und Restore

Das vollständige Production-Backup und der isolierte Restore wurden in AP9.4 real
abgenommen. Datenbank und referenzierte Production-Medien werden mit Manifest,
SHA-256 und privatem Readback gesichert; gespeicherte Authentifizierungswerte sind
ausgeschlossen. Restore bleibt manuell und durch `operations-restore` samt Required
Reviewer geschützt.

Der vorbereitete AP9.6-Regelbetrieb ist im
[Runbook zur Backup-Automatisierung und Retention](./ap96-backup-automation.md)
dokumentiert. Schedule und Retention bleiben bis zu ihren getrennten Abnahmegates
deaktiviert.
