# Externe Fragen – Production-Importprozess

## Sicherheitszustand

Der aktuelle Stand unterstützt Planexport, SHA-256, read-only
Production-Preflight und Guardauswertung. Er enthält keinen ausführbaren
Production-Writer. Preview, Development und unbekannte Umgebungen bleiben für
Production-Schreibzugriffe gesperrt.

## Vorbereitung

1. Kandidaten außerhalb von Production recherchieren, lokalisieren und prüfen.
2. Nur bewusst ausgewählte Kandidaten in den finalen Plan aufnehmen.
3. `READY_FOR_REVIEW` und `REVIEW_REQUIRED` getrennt erhalten.
4. Plan als kanonisches JSON unter `external-import-plans/` in einem
   unveränderlichen Repository-Commit ablegen.
5. Den vom Export gelieferten SHA-256 unabhängig dokumentieren.

Der Plan darf nach diesem Punkt nicht mehr durch KI-Recherche, Übersetzung,
Distraktorerzeugung oder Kandidatenerweiterung verändert werden.

## Read-only Preflight

Der Workflow **External Question Production Preflight** läuft ausschließlich auf
`main` im geschützten Environment `operations-backup`. Er verwendet den
vorhandenen `pubquiz_backup_reader`, materialisiert den Plan aus einem exakten
Commit und prüft dessen Digest vor der Datenbankverbindung.

Eingaben:

- vollständiger Plan-Commit-SHA,
- Pfad unter `external-import-plans/`,
- Plan-SHA-256,
- tatsächlich laufender Production-SHA.

Der Datenbankzugriff erfolgt in `REPEATABLE READ READ ONLY`. Der Report enthält
nur Batch, Digest, Zählwerte und sichere Gatezustände. Credentials und
Connection-Strings werden nicht ausgegeben.

## Entscheidung

- `CONFLICT > 0`: Plan nicht freigeben; kein Überschreiben.
- `REVIEW_REQUIRED > 0`: fachlich klären und neuen Plan mit neuem Digest
  einfrieren.
- `CREATE = 0` und alle `ALREADY_PRESENT`: kein Schreibjob erforderlich.
- Nur `CREATE` und `ALREADY_PRESENT`: frisches Backup planen.

## Backup-Gate

Unmittelbar vor einem später freigegebenen Schreibjob wird das bestehende
AP9.4/AP9.6-Backupverfahren verwendet. Akzeptiert werden ausschließlich
abgeschlossene Production-Backups mit Manifest, Manifest-SHA-256, privatem
Readback, Integritätsnachweis, passender Production-Datenbankidentität und
identischem Production-SHA. Für externe Contentimporte darf der Snapshot bei
Importbeginn höchstens zwei Stunden alt sein.

## Späteres Schreibgate

Vor dem ersten echten Import ist ein separater AP erforderlich. Dieser muss den
Writer an den bestehenden Guardvertrag anbinden und nachweisen:

- aktiver globaler Admin aus dem bestehenden Rollenmodell,
- exakter Batch und Digest,
- exakte Production-Identität,
- einmalige Required-Reviewer-Freigabe,
- serieller, je Kandidat auditierter Import,
- kein automatisches Publish,
- Wiederaufnahme über `ALREADY_PRESENT`,
- geschlossenes Gate nach Erfolg, Fehler oder Abbruch.

Ein reiner Contentimport erfordert keine Migration und kein Deployment. Benötigt
der konkrete Import Codeänderungen, wird zuerst ein separater Software-Release
durchgeführt.
