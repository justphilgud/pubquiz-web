# Analyse-Nachbearbeitung – Preview-Auftrag

Basis: main 71984aa702756ec3d27e545c014775e20442d7a1, am 16.10.2026 erneut abgeglichen.

Die älteren TTS- und Intro-Korrekturen aus PR #114 sind enthalten. Kein Merge und kein Production-Deployment dieses Auftrags.

## Änderungen

- Standardregeln werden beim ausdrücklichen Speichern transaktional im Legacy-Feld und in der Standard-Ablauffolie aktualisiert. Zusatz-Regelfolien bleiben unabhängig. Introeditor und Vorschau lesen den gespeicherten Ablauf; bestehende Abweichungen werden angezeigt, nicht automatisch migriert. Auch der allgemeine Ablaufeditor und der Legacy-Speicherweg synchronisieren.
- Gemeinsame Suche lädt Seiten mit 50 Treffern nach. Sortierung: unveränderliches Anlagedatum absteigend, Typ und ID als stabile Tie-Breaker. Cursor sind an die angewandten Filter gebunden. Kein globaler Vergleich von IDs verschiedener Tabellen als vermeintliches Datum.
- Länderanzeige/ISO-Codes und explizite Länderaliase, korrekte klassische und akzeptierte strukturierte Lösungen sowie IDs werden gesucht. Private Notizen und beliebiges JSON werden nicht durchsucht. Zugriffsfilter bleiben erhalten.
- Kompakte Treffer mit sichtbarer Lösung, optionaler Bildvorschau und aufklappbaren Details. Eigene Entwürfe und nicht freigegebene Fragen sind getrennte Filter.
- Inline-Freigabe nutzt unverändert die vorhandene Berechtigungs-, Validierungs- und Konkurrenzkontrolle. Frisch freigegebene Treffer bleiben an ihrer Position; anschließend ist die berechtigte Quizzuordnung ohne Seitenwechsel möglich.
- Rückkehrpfad, geladene Seitenzahl, Trefferanker und Fokus werden je Tab und Suchsignatur wiederhergestellt. Rückkehr-URLs sind auf interne Bibliotheksrouten begrenzt. Verspätete Antworten anderer Suchen werden verworfen.
- TTS-Renderer und Moderation wählen dasselbe vorbereitete TTS-Medium bzw. Browser-Sprache. Keine Ersatzwiedergabe eines als Originalsong markierten Mediums.
- Meme-Navigation benennt Abstimmung öffnen/schließen und blockiert doppelte laufende Weiter-Schritte. Keine unbewiesene Änderung der Teilnehmer-Fragenidentität oder des Snapshot-Revisionsvertrags.
- Berechtigter Diagnosebericht `/quiz/<id>/diagnose`: feste parametrisierte Aggregatabfragen innerhalb PostgreSQL REPEATABLE READ / READ ONLY. Keine Teilnehmerkennungen oder Antwortinhalte im Ergebnis. Vergleich von gespeicherten Zählern, Bewertungsstatus, Vorhandensein finaler Einreichungen und globalem Wert.

## Architektur und Auswirkungen

Bestehende Server-Actions bleiben für Autorisierung und Schreibregeln zuständig. Pure Hilfsfunktionen übernehmen Cursor, Suchbedingungen, Rückkehrvalidierung und Diagnoseberechnung. Der Client orchestriert Anzeige und Navigation. Keine neue Abhängigkeit, keine Migration, kein Daten-Backfill.

Story-/Umfragetreffer werden in begrenzten Datenbankbatches gelesen; für exakte Gesamtzahlen und Filter auf der neuesten Revision ist weiterhin ein Scan nötig. Es wird keine p95-Laufzeit behauptet. Ein vollständiger historischer Suchsnapshot bei parallelen externen Änderungen ist nicht implementiert. Bereits geladene Treffer werden dedupliziert; Neuanlage nach dem Cursor bleibt bis zur Aktualisierung außerhalb älterer Seiten.

## Tests und Abnahme

- Pure Tests: 187 gemischte Treffer, identische Zeitpunkte/überlappende IDs, vollständiges Paging, Filterlücken, ungültige Cursor und Rückkehr-URLs, Länder-/Lösungssuche.
- Isolierter echter Chromium-Test mit synthetischen Server-Actions: Nachladen, gehaltene Freigabezeile, neue Quiz-Eignung, Zuordnung, Rückkehranker, abgelehnte Freigabe und alte Suchantwort.
- Tatsächliche Speichermodule mit isolierter Persistenz: nach Materialisierung ändern, neue Zeilen, leerer Fallback, deaktiviert, zusätzliche individuelle Regeln, Rollback, verweigerter Zugriff.
- PostgreSQL-CI-Test: tatsächliche Materialisierung, Reload, Rückrollverhalten und technisch erzwungene Schreibverweigerung bei READ ONLY; ausschließlich positiv identifizierte lokale CI-Datenbank.
- Bestehende Präsentations-, Meme-, Status-, Flow- und Moderationsregressionen.
- Typecheck und ESLint der geänderten Dateien werden vor dem Commit ausgeführt; finale CI/Preview-Nachweise folgen im PR.

## Offene fachliche Entscheidungen und echte Geräteprüfungen

Die bestehende Schwierigkeit bleibt unverändert: PARTIAL zählt vollständig zur nicht vollständig richtigen Seite; UNANSWERED/REVIEW_REQUIRED ausgeschlossen; Test-/Archiv-Verwendungen weiterhin enthalten. Änderungen daran erfordern separate Entscheidung. Meme-Popularität und Umfragen benötigen eine konsistente Eignungsregel über alle Wege; keine vorhandenen Werte automatisch korrigieren. Kleine Stichproben werden im Diagnosebericht sichtbar, ohne neue verbindliche Schwierigkeitsklassen.

Paule II #30 ist vom Nutzer als betroffenes Quiz bestätigt. Im aktuellen gespeicherten Quiz sind zwei Meme-Fragen, aber keine TTS-Frage mehr enthalten. Eine ursprüngliche TTS-Störung lässt sich damit nicht allein aus dem heutigen Quiz beweisen. Production wird nicht gestartet, zurückgesetzt oder fortgeschaltet. Der dort eingesetzte Deployment-Identifier ist weiterhin dpl_4SB9VgZgznxhBXuvMsMknSSKsKdG (PR #114).

Offen bis zur dokumentierten Abnahme: Preview mit tatsächlichen gespeicherten Daten; drei und fünf physische Smartphones einschließlich Offline/Reload/Selbststimme/Schließen; tatsächlich hörbare TTS-Ausgabe auf dem Veranstaltungsrechner. Native Sprachereignisse oder Test-Doubles ersetzen keinen Hörtest.
