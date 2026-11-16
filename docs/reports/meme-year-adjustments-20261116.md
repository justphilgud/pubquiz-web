# Meme und Fakten des Jahres

Basis: a0d4d9941911c52ffe5a62f6d278742125cd2696. Auf diesem Stand neu
umgesetzt, da die vorbereiteten Commits und der genannte Remote-Branch
nicht verfügbar waren.

- Meme-Standard: vier Beiträge und 120 Sekunden. Die bestehende Auswahl,
  Moderation und serverseitige Deadline werden weiterverwendet.
- Pro Caption sind bis zu 80 Zeichen möglich. Die Vorschau warnt bei
  Überlauf. Abgabe und Auto-Finalisierung verwenden den bestehenden
  Payload-Vertrag. Der Archivexport kann vollständigen Text verkleinern.
- Fakten-Jahr bietet eine gemeinsame Jahresauswahl von 1 bis 9999.

## Migration und Rückweg

Die Migration aktualisiert gültige Version-1-Konfigurationen in
unarchivierten Quizvorbereitungen ohne Start-/Stopzeit und ohne Runs.
Sie verwendet den Quiz-Lock des Lifecycle und prüft Runs nach dem Lock
erneut. Ein lokaler PostgreSQL-18-Test mit synthetischen Tabellen und Daten
änderte drei von neun Zuweisungen. Die zweite Ausführung änderte null.
Ein zweiter Test hielt den Quiz-Lock, legte in derselben Transaktion einen
Run an und bestätigte, dass die wartende Migration diese Konfiguration
nach Commit ausließ.

Vor Production die tatsächlich betroffenen und die wegen Runs geschützten
Zuweisungen im autorisierten Leseweg inventarisieren. Für den Rückweg
Zuweisungs-ID, Quiz-ID und vollständiges Vorher-/Nachher-JSON der tatsächlich
geänderten Zeilen privat sichern. App-Rollback allein setzt keine Werte
zurück. Eine separat geprüfte Rückmigration darf unter dem Lifecycle-Lock
ausschließlich Zeilen ohne Start-/Stopzeit und ohne Runs zurücksetzen, deren
vollständiges JSON noch dem gesicherten Nachher-Zustand entspricht. Bei
zwischenzeitlicher bewusster Bearbeitung gilt der aktuelle Wert. Ohne
Nachweis, dass keine Bearbeitung stattgefunden hat, die Zeile zur manuellen
Prüfung auslassen.

## Prüfstand

Der gezielte Poll-Vertragstest erwartet weiterhin take: 12. Die Stelle
fehlt bereits auf der verifizierten Basis. Der Test blieb unverändert.
Production-Preflight, Backup, Migration auf Production, Preview- und
Production-Abnahme stehen aus.

## Isolierte Preview für PR 169

Der manuelle Workflow Deploy Preview erwartet für diesen Branch
isolated_pr169=true. Er prüft erfolgreiche Push-CI für den exakten Commit,
verlangt branchspezifische Vercel-Secret-Metadaten und bindet die Migration
an den dedizierten Neon-Endpunkt ep-lucky-tooth-baxy5bhy und pr169_review.
Bei fehlendem GitHub-Secret PR169_DATABASE_URL bricht er vor Migrationen ab.

Im Vercel-Projekt pubquiz die beiden Secrets DATABASE_URL und AUTH_SECRET
nur für Preview und nur für den Git-Branch codex/meme-facts-year-release
hinterlegen. DATABASE_URL verbindet die Laufzeit per gepooltem Neon-Endpunkt
mit pr169_review. AUTH_SECRET erhält einen eigenen kryptografisch zufälligen
Wert. Die zentralen Nonproduction-Medienvariablen werden geerbt.
