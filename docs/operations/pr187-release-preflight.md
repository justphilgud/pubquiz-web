# PR187 – exakter Production-Release ohne Schema-Delta

Der Nutzer hat die Änderungen aus PR187 mit „Ok, brings auf Prod“ fachlich und
für Merge/Release freigegeben. Beide vollständigen PR-/Push-CI-Läufe waren grün;
PR187 wurde regulär integriert. Diese separate Operationsregistrierung bereitet
den vorhandenen geschützten Ablauf vor. Sie deployt keine Anwendung und ändert
keine Schutzmaßnahmen. Ein tatsächliches Environment-Owner-Review bleibt zwingend.

## Unveränderliche Eingaben

| Feld | Wert |
| --- | --- |
| Erwartete aktuelle Production-Basis | `6fa37aa5114eabeb9fa6c58f6fd30bd6a295d67a` |
| Regulärer PR187-Merge / exakter Releasekandidat | `3b8fc6f1f1427504e1191004ffc8e37e94410a2e` |
| Grüner fachlich freigegebener PR-Head | `6e7591cd44e461c6a98a79b9d8a6cadb8098fd68` |
| Anzahl Migrationen vorher/nachher | 81 / 81 |
| Letzte bereits vorhandene Migration | `20261126120000_event_ceremony` |
| Vollständiges Manifest SHA256 | `85646ef7090288ee7f848dc32a289a9af7cf40a250cbc60d3569ff80e728e9a8` |
| Schema SHA256 vorher/nachher | `26cc4d670ef3c954731a14250b580c33667e51869c9edc176b238cbf7f6127b1` |
| Erwartetes SQL-/Schema-Delta | keines |

Die Production-Basis wurde im zuvor abgeschlossenen geschützten Release
`45897460440`, Versuch 2, durch Provider READY/Current und authentifiziertes
Runtime-Monitoring bestätigt. Vor diesem Merge wurde der öffentliche Alias erneut
lesend auf dieselbe Deployment-ID `dpl_F1yXo1gkqmnZWYcqwDFxVe1Xtv5v` geprüft.
Diese Beobachtung ersetzt nicht den neuen geschützten Live-Preflight.

Git belegt vollständige Abstammung, unveränderte SQL-/Prisma-Bytes und einen mit
dem grünen PR-Head identischen Mergebaum. Nur dieses exakte Paar ist erlaubt;
der PR-Head, andere main-/Operations-SHAs oder verkürzte SHAs sind keine Ersatzwerte.

## Architektur, Tests und Grenzen

Die bestehende No-Delta-Registry erhält einen weiteren separat benannten Datensatz.
Paarvergleich, vollständiger Manifestvergleich, gepinnte Hashes und vollständige
Historienprüfung bleiben unverändert. Die vorhandene geheimnisfreie PostgreSQL17-
Safety-Matrix erhält eine eigene Paarzeile. Kein Kandidatenanwendungscode oder SQL
wird vom No-Delta-Referenzjob ausgeführt; dieser erstellt nur Git-Nachweise.

PASS im geschützten Live-Preflight erfordert den tatsächlich aktuellen Alias/SHA,
READY, das richtige Projekt und alle 81 eindeutigen abgeschlossenen Migrationen
mit gültigen Prüfsummen, ohne pending/failed/drift. Readeridentität, READ ONLY, TLS
und bestehende Reviewer bleiben unverändert. Kein Live-DDL-Vollvergleich wird
für diesen bestehenden No-Delta-Pfad behauptet. Der historische Bootstrap bleibt
`NOT_RUN / HISTORICAL_BOOTSTRAP_LIMITATION_UNCHANGED`, keine Reparatur.

Tests prüfen das unveränderliche echte Git-Paar und falsche/vertauschte/verkürzte
SHAs, PR-Head statt Merge, falsche Basis, fehlende/zusätzliche/doppelte/geänderte/
umsortierte Migrationen, beidseitig gleich verfälschte Bytes und unvollständige oder
fehlgeschlagene Historien. Alte Pläne bleiben unverändert gültig. Operations-only
Scope muss false, gemischter App-/Prisma-/Package-Scope weiterhin true liefern.

## Releasefolge

1. Diesen Operations-Stand technisch prüfen, seine vollständige CI einschließlich
   Safety-Matrix abwarten und regulär integrieren. Anwendungsbytes müssen gegenüber
   dem exakten Kandidaten unverändert bleiben. Auch dessen neue main-CI muss grün sein.
2. Ein durch den PR187-Merge automatisch erzeugter Production-Lauf darf vor den
   folgenden Gates nicht freigegeben werden. Falls er auf Owner-Review wartet,
   SHA und null gestartete Production-Schritte prüfen und ausschließlich diesen
   noch unfreigegebenen Lauf regulär abbrechen. Das bewahrt Logs und den exakten
   `workflow_run.head_sha`-Kontext und gibt die gemeinsame Concurrency frei.
3. Den geschützten main-only Read-only-Preflight exakt für `6fa37aa5 → 3b8fc6f1`
   starten. Am vorgeschriebenen Owner-Review anhalten; nicht selbst freigeben.
4. Nach Gesamt-PASS ein frisches geschütztes AP9.4-Backup der Production-Basis:
   `mode=acceptance`, `production_commit=6fa37aa5...`, `backup_type=pre-deployment`,
   `protect_backup=true`, `restore_after_backup=false`. Datenbank und referenzierte
   Medien, Manifest, privates Readback und Integrität verifizieren. Keine Authwerte
   veröffentlichen, kein Restore. Das frühere Vorab-Backup für PR182 wird nicht
   wiederverwendet: es liegt vor der bereits ausgeführten Ceremony-Migration.
5. Unmittelbar vor Deployment Alias/SHA und den No-Delta-Plan erneut bestätigen.
   Nur den vorhandenen exakten Kandidatenworkflow gezielt regulär wieder starten;
   erneutes echtes Production-Owner-Review. Keine manuelle Vercel-Bereitstellung,
   keine SHA-Überschreibung und kein Deployment des Operations-Nachfolgers.
6. Vor-/Nach-Migrationsstatus im bestehenden Workflow: alle 81 aktuell, kein neues
   SQL erwartet. READY, Runtime-SHA, Aliasse und lesender Smoke von Bingoübersicht,
   Buchstaben-/Deckoberfläche, Historie und Präsentationsdesign prüfen. Keine echte
   Ziehung/Korrektur/Kartenprüfung/Entscheidung auslösen, nichts speichern. CI-/lokale
   synthetische Nachweise decken diese schreibenden Funktionen ab.

## Rückweg: Journalformat beachten

Kein SQL-Delta bedeutet hier nicht automatisch einen sicheren Rücksprung auf den
alten Anwendungscode. Neue V2-Korrekturen speichern eine tatsächlich leere
Begründung. Der alte V2-Reader aus `6fa37aa5` verlangt dafür noch einen Text und
kann solche neu geschriebenen Journale nicht lesen. Nach solchen Korrekturen
erfordert ein Code-Rollback einen ausdrücklich kompatiblen Reader. Alte manuelle
Schreib-/Abschlusssperren würden im alten Code ebenfalls wieder wirksam.

Deshalb kein blindes Rollback, keine Journaländerung, Löschung, Downmigration oder
automatischer Restore. Bei Fehlern anhalten, Logs und verifiziertes Backup bewahren
und den konkreten Rückweg separat entscheiden. Ein Restore wäre ein eigener
geschützter, freizugebender Vorgang und dürfte zwischenzeitliche Daten nicht
unbemerkt überschreiben.

Aktuelle Lauf-IDs und tatsächliche Ergebnisse werden am Operations-PR dokumentiert.
Dieser vorbereitete Plan allein ist weder Live-Abnahme noch Backup oder Deployment.
