# Production-Schreibpfad fuer den redaktionellen PR-95-Batch

Der vorhandene External Question Production Import wird um den ausdruecklichen
Modus editorial_pr95 erweitert. Standard bleibt dry_run=true. Der generische
OpenTDB-Pfad bleibt getrennt und verwendet unveraendert seine bisherigen Gates.
Keine HTTP-Schreibschnittstelle und kein Import beim Anwendungsdeployment.

Quelle: feste bestehende 79er-Allowlist und bytegebundene Quelldateien.
Der Read-only-Preflight verwendet operations-backup und den bestehenden Leser.
Er prueft Schema, Bestand, Kategorien, Journal und aggregierte Integritaet.
Er berichtet zusaetzlich katalogbasiert die erforderlichen Writer-Leserechte
und INSERT-Spalten. Fehlende Rechte werden nicht automatisch vergeben.

Ein Writerlauf erfordert main, workflow_dispatch, die feste Workflowdatei,
den bestaetigten Production-SHA, operations-content-import und eine echte
GitHub-Environment-Freigabe. Der bestehende Reviewerpruefer bindet die exakte
Kommentarfreigabe an Dry-Run-Digest, konkrete konfliktfreie Kandidaten und
Backup-ID. Die einmalige Capability wird vor Netzwerkzugriff verbraucht.
Das Bereitstellen dieses Codes ist keine Importfreigabe.

Der gemeinsame Importkern bleibt verantwortlich fuer Validierung, Dubletten,
Journal, Idempotenz, Persistenzvergleich und vollstaendiges ID-Manifest. Der
Writer muss der bestehende nicht erhoehte pubquiz_external_import_writer sein.
Ein vorhandener aktiver globaler Admin muss als Importoperator angegeben sein.
Bestandsfragen haben keine UPDATE-, DELETE- oder TRUNCATE-Berechtigung.

Production verwendet SERIALIZABLE und denselben Advisory Lock. Der vorhandene
Preview-Tabellenlock verlangt auf allen Tabellen weitergehende Rechte; er wird
Production nicht durch neue UPDATE-/DELETE-Rechte ermoeglicht. SERIALIZABLE
liefert den konsistenten Bestand und laesst Serialisierungsfehler abbrechen;
keine automatische Wiederholung. Integritaetsvergleich erkennt eigene
Trigger-Nebenwirkungen, nicht unabhaengige spaetere Benutzeraktionen.
Preview behaelt den bisherigen Lock unveraendert.

Backup und Restore sind exakt auf die bereits geprueften Laeufe 37971426600
und 37985816031 gebunden, einschließlich Manifesthash und 24h-Frischegrenze.
Das Backup ist vor der additiven nullable Migration entstanden. Ein App-
Rollback benoetigt keinen Datenbank-Restore. Kein Backup wird erneut erstellt.

Der aktuelle Production-Dry-Run vom 09.10.2026 ermittelt 65 konfliktfreie
Kandidaten (33 Anagramme, 32 Schaetzfragen) und 14 manuell zu pruefende
Bestandsueberschneidungen. Diese 14 werden nicht durch die Allowlist ueberstimmt.
Die 20 urspruenglich zurueckgestellten Kandidaten und ANA-15 bleiben ausgeschlossen.
Neue Fragen bleiben DRAFT, freigegeben=false. Keine Quizzuordnungen.

Tests: authentische Reviewerbindung, falscher Kontext/Digest, einmalige
Capability, feste Quelldateien, Default-Dry-Run. Echte PostgreSQL-Tests pruefen
79er-Schreiben in einer isolierten Datenbank, genaue Freigabeliste, unveraenderte
Bestandsdaten, Wiederholung, Rollback, Trigger und vorhandenen Previewpfad.
