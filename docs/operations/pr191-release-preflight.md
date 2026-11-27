# PR191 – Production-Release ohne neues Backup

Freigabe vom 27.11.2026: „So, dann hau es jetzt auf Prod ohne Backup“.
Fachliche Abnahme und Merge-/Releasefreigabe gelten für PR191. Kein neues Backup
starten oder anfordern; keine historische Sicherung als aktuell verifiziert ausgeben.

| Eingabe | Exakter Wert |
| --- | --- |
| Erwartete aktuelle Production-Basis | `e144cfc931c695423c28f20e1a3dd83409732c1c` |
| Regulärer PR191-Merge / Releasekandidat | `cd074a985aa3e91c0c917b8a96bb19768e337657` |
| Grüner freigegebener PR-Head | `062821fe8bd50e121009c4c7de4b04b97a00790e` |
| Migrationen vorher/nachher | 81/81 |
| Letzte Migration | `20261126120000_event_ceremony` |
| Manifest SHA256 | `85646ef7090288ee7f848dc32a289a9af7cf40a250cbc60d3569ff80e728e9a8` |
| Schema SHA256 vorher/nachher | `26cc4d670ef3c954731a14250b580c33667e51869c9edc176b238cbf7f6127b1` |
| SQL-/Schema-Delta | keines |
| Neues Backup | ausdrücklich ausgenommen |

## Architektur und Prüfungen

Nur die exakte bestehende No-Delta-Registry wird um dieses Paar erweitert;
alle bisherigen Paare und Fail-Closed-Prüfungen bleiben erhalten. Keine neuen
Schalter, Wildcards oder Schutzmaßnahmen-Ausnahmen. Die bestehende geheimnisfreie
PostgreSQL17-Safety-Matrix erhält eine zusätzliche exakte Paarzeile.
Tests vergleichen unveränderliche Git-Stände, 81 Manifesteinträge, Schema,
Abstammung und Identität des Mergebaums mit dem grünen PR-Head. Falsche SHAs,
fehlende/doppelte/geänderte/umsortierte Dateien sowie unvollständige oder
fehlgeschlagene Migrationshistorie bleiben gesperrt. Operations-only Änderungen
dürfen keinen zusätzlichen Anwendungsdeploy erzeugen.

## Geschützter Ablauf

1. Operations-PR technisch prüfen, sämtliche Checks und reguläre main-CI abwarten.
2. Einen nur auf Owner-Review wartenden Kandidaten-Deploy bei Bedarf regulär
   abbrechen, um die gemeinsame Concurrency für den Preflight freizugeben.
   Keinen fremden oder bereits gestarteten Deploy unbesehen abbrechen.
3. `production-read-only-preflight.yml` auf main mit exakt obigem Paar starten.
   Tatsächliche Owner-Freigabe bleibt beim Nutzer. Nur nach Gesamt-PASS fortsetzen:
   Projekt/Alias/SHA/READY stimmen, Reader READ ONLY, 81 abgeschlossene Migrationen,
   keine pending/failed/drift. Kein behaupteter neuer Live-DDL-Bootstrap.
4. Kein Backup gemäß expliziter Freigabe. Vor Deployment Basis und Preflight
   nochmals prüfen. Ursprünglichen Kandidatenlauf regulär neu starten, ohne SHA-
   Überschreibung. Owner bestätigt Production erneut; kein direkter Vercel-Deploy.
5. Bestehenden geschützten Workflow unverändert ausführen lassen. 81 Migrationen
   vorher/nachher, keine neue ausgeführte Migration. READY, URL, Aliasse und
   authentifizierten Runtime-Commit prüfen.
6. Nur lesender Smoke: Bingoübersicht, Intro/Runden/Outro in Vorbereitung,
   Moderationsicons, Eingaben, Historie, Runden-/Deck-/Codeanzeige und Präsentation
   mit Fortschritt, Logos und rechter Zweispaltenliste. Keine Ziehung, Sortierung,
   Kartenprüfung, Entscheidung oder sonstige Datenänderung ausführen.

## Grenzen und Rückweg

Neue `config.outro`-Werte werden von älteren Readern nicht verstanden. Nach neuen
Schreibvorgängen kein blindes Code-Rollback, keine Journalreparatur oder automatische
Rückmigration. Ein Rückweg benötigt separat geprüfte kompatible Reader und die
aktuelle Datenlage. Reale Beamer-/Numpad-/Akustikprüfung bleibt offen; schreibende
Fälle sind lokal synthetisch belegt. Bei CI-, Preflight- oder Deployfehler anhalten.
Lauf-IDs und tatsächliche Smoke-Ergebnisse am Release-PR dokumentieren.

## CI-Browsertestkorrektur im selben PR

Der CI-Lauf 46012079486 scheiterte im unveränderten Matching-Template-Browsertest
mit `Invalid URL` beim Chrome-WebSocket-Start. Der Fix wartet auf zwei vollständig
validierte Zeilen in Chromes `DevToolsActivePort`: Port 1–65535 und lokaler
`/devtools/browser/...`-Pfad. Fehlende/leere/teilweise Dateien werden nur bis zum
Timeout erneut gelesen; echte Lesefehler und vorzeitiger Browserexit bleiben Fehler.
Die fachlichen Combobox-/Modal-Assertions bleiben unverändert. Unit-Tests simulieren
das mehrstufige Schreiben, ungültige Daten, Timeout und Browserexit; der bestehende
Vorbereitungstestbefehl führt sie regulär mit aus. Keine neue Abhängigkeit.

Dieser PR enthält deshalb neben der Operationsregistrierung auch Testdateien und
eine Testskript-Erweiterung in package.json. Die unveränderte Scope-Prüfung stuft
diesen gemischten Commit konservativ als deploymentrelevant ein. Ein dadurch
entstehender zusätzlicher Owner-wartender Deploy wird vor jedem Production-Schritt
gemäß obigem Ablauf beendet. Er wird nicht freigegeben oder als Anwendungskandidat
verwendet. Veröffentlicht wird weiterhin ausschließlich `cd074a98...`; kein
Scopefilter oder Schutzgate wird geändert, um diese Prüfung zu umgehen.

## Weitere reine Testkorrekturen nach main-CI 46029362315

Der Präsentations-Browserharness verwendet ebenfalls die gemeinsame validierte
Chrome-Endpunktprüfung. Das bisherige 20-Sekunden-Startlimit wird durch ein
explizites 45-Sekunden-Startup-Budget innerhalb des unveränderten 120-Sekunden-
Gesamttestlimits ersetzt. Fehlender Start, Prozessende, Spawnfehler, echte
Lesefehler und ungültige Endpunkte bleiben Fehler mit Diagnose und Ursache.
Kein Neustart-/Retry-Loop für fachlich fehlgeschlagene Tests, kein Überspringen
von Assertions. Ein zusätzlicher Unit-Test simuliert verzögerten Prozessstart.

Die Bingo-Abendfixture verwendet `currentEventRound` statt `rounds.at(-1)` zur
Suche einer freien Zahl. Sie navigiert ausdrücklich zur ersten Runde zurück,
zieht dort deterministisch die 1 und prüft, dass die nächste freie Zahl diese
Ziehung berücksichtigt, obwohl eine andere Runde zuletzt geöffnet wurde.
Die Gewinnlinie wird ohne doppelte Ziehungen ergänzt. Der Produktionsschutz
`DUPLICATE_DRAW_NUMBER`, Karten-, Prüf-, Wertungs- und Journalcode bleiben unverändert.

Nur eigene lokale synthetische Fixtures und Browserprofile. Typecheck, ESLint,
Browser-/Startup-Tests und vollständiger PostgreSQL-Harness werden vor dem Push
geprüft; tatsächliche CI-Läufe und Release-Ergebnisse stehen am Folge-PR.
Der exakte Anwendungskandidat bleibt `cd074a985aa3e91c0c917b8a96bb19768e337657`.
Kein neues Backup und kein Production-Eingriff vor vollständig grüner CI und
vorgeschriebenem Owner-Review des geschützten Preflights/Deployments.

Lokaler finaler Nachweis: vier Browser-/Startup-Tests bestanden; Typecheck und
ESLint der geänderten TypeScript-Dateien ohne Warnungen bestanden. Vollständiger
PostgreSQL-Harness mit deterministischer Rückwechsel-Regression bestanden
(rund 92 Sekunden); eigener Cluster `127.0.0.1:56574` danach gestoppt.
Die vorhandenen synthetischen Dump-/Restore-Regressionen erstellen kein
Production-Backup. Generierte Beispiel-PDFs und Prisma-Nebenartefakte zurückgesetzt.
