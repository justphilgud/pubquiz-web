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

Der CI-Lauf 46012079486 scheiterte im unver�nderten Matching-Template-Browsertest
mit `Invalid URL` beim Chrome-WebSocket-Start. Der Fix wartet auf zwei vollst�ndig
validierte Zeilen in Chromes `DevToolsActivePort`: Port 1�65535 und lokaler
`/devtools/browser/...`-Pfad. Fehlende/leere/teilweise Dateien werden nur bis zum
Timeout erneut gelesen; echte Lesefehler und vorzeitiger Browserexit bleiben Fehler.
Die fachlichen Combobox-/Modal-Assertions bleiben unver�ndert. Unit-Tests simulieren
das mehrstufige Schreiben, ung�ltige Daten, Timeout und Browserexit; der bestehende
Vorbereitungstestbefehl f�hrt sie regul�r mit aus. Keine neue Abh�ngigkeit.

Dieser PR enth�lt deshalb neben der Operationsregistrierung auch Testdateien und
eine Testskript-Erweiterung in package.json. Die unver�nderte Scope-Pr�fung stuft
diesen gemischten Commit konservativ als deploymentrelevant ein. Ein dadurch
entstehender zus�tzlicher Owner-wartender Deploy wird vor jedem Production-Schritt
gem�� obigem Ablauf beendet. Er wird nicht freigegeben oder als Anwendungskandidat
verwendet. Ver�ffentlicht wird weiterhin ausschlie�lich `cd074a98...`; kein
Scopefilter oder Schutzgate wird ge�ndert, um diese Pr�fung zu umgehen.
