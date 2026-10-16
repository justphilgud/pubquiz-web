# PR116: gezielte Releasevorbereitung

Dieser Operations-PR erweitert die vorhandene lesende Production-Prüfung für
den ausdrücklich freigegebenen Archiv-Release. Er verändert keine Anwendung,
Migration oder Zugriffseinstellung und darf selbst keinen App-Deploy auslösen.

## Unveränderlicher Prüfplan

Der bisherige PR95-Plan bleibt erhalten. Zusätzlich wird ausschließlich dieses
Paar akzeptiert:

- Laufender Anwendungscode: `baedd479615d33a7eb7b5e15f18f36450061dc5b`.
- Geprüfter PR116-Kandidat: `41f3c2a87fd320757f158c2854e76cab3dac8d6a`.
- Einzige erwartete Migration: `20261016120000_meme_archive`.
- SQL-SHA256: `99a4b9d18e55d2294383a31cf35fb30973e6a30f9750c3c5da752f102818f641`.

Unbekannte Commitpaare, weitere ausstehende Migrationen, abweichende SQL-Bytes
und nicht zu beiden Commits passende Delta-Nachweise blockieren. Die vollständige
Historien-/Schema-/Readerprüfung und die Environment-Reviews bleiben erhalten.
Es gibt keine frei konfigurierbaren SQL-Statements oder Migration-Allowlist.

Der unabhängige historische Modellreferenzaufbau bleibt die Quelle des erwarteten
Bestandsschemas. Der Anwendungscode des Kandidaten wird nicht ausgeführt. Nur die
oben bytegenau gebundene neue SQL-Migration wird zusätzlich in wegwerfbarem
PostgreSQL17 mit `--network none`, ohne Hostmounts und ohne Production-Credentials
geprüft. Production erhält ausschließlich die bestehenden READ-ONLY-Abfragen.

Die Delta-Prüfung verlangt unveränderte alte Zeilen und das unveränderte gesamte
alte Schema nach Abzug genau zweier neuer Archivtabellen, ihrer Spalten,
Constraints/Indizes und genau dreier Routinen/eines Triggers. Fehlende oder
zusätzliche Objekte blockieren. Reale SQL-Fixtures prüfen: kein Backfill,
gewöhnliche alte Submission-Spalten lösen Capture aus, Reset bleibt ohne
Quellbytes gesperrt, und Archivmetadaten überstehen Runtime-Löschung.
Die dokumentierte alte New-install-Kollision bleibt explizit FAIL und wird nicht
in einen erfolgreichen Neuinstallationsnachweis umgedeutet.

## Rückfallweg und Migrationsfenster

Die neue Migration ergänzt Tabellen/Routinen/Trigger und verändert keine alten
App-Spalten. Alte Lese-/Schreibprojektionen bleiben verwendbar. Der Capture-Trigger
wirkt jedoch schon zwischen Migration und App-Deployment und erzeugt PENDING-
Einträge ohne Netzwerkzugriff. Dauerhafte Quellbytes/PNG-Verarbeitung benötigt die
neue App. Deshalb ist ein reiner App-Rollback kein funktional gleichwertiger
Archivbetrieb: keine Meme-Resets oder vollständigen Quizlöschungen mit dem alten
App-Stand, bis wieder eine archivfähige App läuft. Das alte Reset ruft die neue
Sicherungsbarriere nicht auf. Archive und Schlüssel bei App-Rollback erhalten;
kein automatisches DROP oder DB-Restore. Datenändernder Rückbau bleibt gesondert
zu beurteilen. Keine historische Capture-Aktion auf echten Quizzen ausführen.

## Prüfungen und Betrieb

Die Safety-CI prüft beide unveränderlichen Pläne getrennt mit PostgreSQL17,
zusätzlich echte SELECT-only-Reader, vollständige Schema-Driftfälle und
Operations-only-Deploy-Scope. Die volle Repository-CI bleibt verpflichtend.

Erster tatsächlicher Lauf `38918486225`: Production-Alias/Projekt/READY und
Anwendungscode `baedd479` bestanden; der alte isolierte Schema-Plan blockierte,
der Datenbankjob wurde nicht ausgeführt. Das ist kein Gesamt-PASS.

Vor der App-Migration sind ein erfolgreicher aktualisierter Preflight und ein
frisches geschütztes Backup mit privatem Integritäts-/Readback-Nachweis nötig.
Der bestehende Backup-Audit verweigert eigene Routinen grundsätzlich; die
Kompatibilität der neuen Archivobjekte ist deshalb eine gesondert zu prüfende
Releaseabhängigkeit. Diese Schutzregel wird durch die Preflight-Erweiterung nicht
verändert. Kein Merge von PR116, solange diese Voraussetzung ungeklärt ist.
