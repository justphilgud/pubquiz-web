# Geschützte Sicherung der PR116-Meme-Archive

Die ausdrücklich genehmigte Erweiterung verwendet den bestehenden Backup- und
Restorekern. Keine neue Ablage, Credentialkopie, Production-Schreibabfrage oder
Restore-Zielkonfiguration. Retention und Reviewer-Gates bleiben unverändert.

## Eng geprüfte ausführbare Objekte

`schema-reference/meme-archive-migration.sql` ist die unveränderte Migration aus
PR116-Commit `41f3c2a87fd320757f158c2854e76cab3dac8d6a`, SHA256
`99a4b9d18e55d2294383a31cf35fb30973e6a30f9750c3c5da752f102818f641`.
Der danebenliegende Routine-Nachweis bindet die exakten drei PL/pgSQL-Bodies,
Argument-/Rückgabetypen, Sprache und sicherheitsrelevanten Attribute. Keine
SECURITY-DEFINER-, Suchpfad-, strikte oder parallele Variante wird akzeptiert.
Nur LF/CRLF desselben Funktionsbodys werden gleich behandelt. Der Trigger muss
exakt als aktivierter AFTER-INSERT-Row-Trigger auf `team_answer_submissions` auf
die geprüfte Funktion zeigen. Fehlende/zusätzliche Routinen, Teilinstallation,
deaktivierter/geänderter Trigger und unbekannte Attribute blockieren vor dem
Lesen von Tabellenzeilen und vor pg_dump. Fremde Schemas/Server, Publikationen,
Partitionen und unbekannte Credentials bleiben wie bisher gesperrt.

Ein gewöhnlicher Bestand ohne Archivtabellen und ohne eigene ausführbare
Objekte bleibt kompatibel. Bestehende Manifeste ohne Archivnachweis sind nur
für einen ebensolchen Bestand gültig. Neue Archive erhalten einen zusätzlichen
Fingerprint; bei Restore muss er unverändert wieder erscheinen.

## Daten und Medien

Die beiden Tabellen werden vollständig im privaten Dump gesichert, einschließlich
Basisbildbytes, Layout-/Textsnapshots, AES-GCM-Schlüsseln, Prüfsummen und eventuell
noch ausstehenden verschlüsselten Dateien. Das sind ausschließlich Archivdaten;
Benutzer-/Teampasswörter bleiben nach bestehendem Vertrag ausgeschlossen. Keine
Schlüssel gelangen in Evidence, Logs oder Reports. Binärfelder und Zustände werden
auf das tatsächlich implementierte Format und feste Größen geprüft.

READY-Einträge referenzieren ausschließlich die deterministische verschlüsselte
Datei unter dem bekannten Production-Blobhost und `prod/meme-archive/<UUID>.bin`.
Diese Bytes werden durch den bestehenden begrenzten Mediencapture privat kopiert
und nach Upload/Readback per SHA256 geprüft. Es gibt keine öffentliche PNG-Kopie.
Bei pending Uploads ist die verschlüsselte Datei bereits Bestandteil des Dumps;
bei DELETING/DELETED ist eine externe Datei keine benötigte Restore-Abhängigkeit.

Ein gesichertes Basisbild braucht den ursprünglichen, möglicherweise inzwischen
gelöschten Blob nicht mehr. Seine URL wird weiterhin vollständig auf Credentials,
Host und Format geprüft, aber nicht nochmals heruntergeladen. Noch ungesicherte
aktive Quellen bleiben benötigte Medien; fehlen sie, blockiert das Backup. Keine
Quelle wird nachträglich verändert oder eine fehlende Datei als vorhanden gemeldet.

## Restore und Tests

Bestehende Empty-/Lease-/Berechtigungs- und Single-Transaction-Gates bleiben
verbindlich. Der Dump wird in pre-data → data → redigierte Auth-Overlays → post-data
geladen. Der Capture-Trigger entsteht erst nach den Daten und erzeugt dabei keinen
Backfill oder zusätzliche Archivversionen. Danach werden alle Daten-/Schemahashes,
der neue Executable-Fingerprint und die Medienbytes verglichen.

Zusätzlicher realer PostgreSQL17-Test: tatsächliche bytegebundene Migration,
bestätigte Abgabe, echte PNG → AES-GCM → Mediencapture → pg_dump → geschützter
Restore → unveränderte Daten und Routinen → Entschlüsselung mit restauriertem
Schlüssel und identischer PNG-SHA256. SQL-Fehler rollt den gesamten Restore zurück.
Unbekannte Routine, SECURITY DEFINER und deaktivierter Trigger blockieren erneut.
Das ist ein synthetischer CI-Restore, kein ausgeführter Production-Restore.

## Tatsächlicher Vorab-Backup-Lauf 38918685948

Der Backupschritt und seine Evidence-Erzeugung sind erfolgreich. Gesicherter
Anwendungscode `baedd479615d33a7eb7b5e15f18f36450061dc5b`, Backup-ID
`production/acceptance/run-38918685948-1`, Manifest-SHA256
`2667f36ed4a7ccf64b958e0da08f1d502b86d3fff315d6d8b40e2f81442b9c08`.
Evidence bestätigt Manifest, privaten Readback und Integrität. Der Gesamtlauf ist
trotzdem FAIL: nachfolgender Retention-Dry-Run `INVENTORY_RESPONSE_INVALID`.
Es fand kein Restore und keine Retention-Löschung statt. Der bestehende
Restore-only-Provenienzschutz verlangt einen insgesamt erfolgreichen Lauf und
wird nicht stillschweigend geändert. Dieses verbleibende Betriebsgate muss vor
einem als vollständig wiederherstellbar abgenommenen Release geklärt werden.
