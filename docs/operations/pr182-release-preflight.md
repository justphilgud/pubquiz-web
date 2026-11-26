# PR182 – exakter Production-Releaseplan

Der Benutzer hat den Production-Release von PR182 angefordert. Dieser getrennte
Operations-Stand bereitet den bestehenden geschützten Weg vor. Der Anwendungs-
kandidat bleibt unverändert; der Plan allein führt weder Migration noch Deployment aus.

## Unveränderliche Eingaben

### Exakte Release-Nachfolge nach dem CI-Fixturefix (26.11.2026)

PR182 wurde als `5bfcb5fd0c5788c520fb0602a1c1f5f41f316bdf` regulär integriert.
Dessen main-CI `45839456456` scheiterte im echten Bingo-Integrationstest an
`DUPLICATE_DRAW_NUMBER`. Deploy Production #1430 (`45840829931`) war deshalb
SKIPPED, einschließlich beider Jobs; kein Production-Release.

Der separat geprüfte Testfix PR184 wurde regulär als
`6fa37aa5114eabeb9fa6c58f6fd30bd6a295d67a` integriert. Seine vollständigen
Push-/PR-CI-Läufe `45895300870` und `45895340228` sind erfolgreich.
Nur `scripts/testing/bingo-event.acceptance.ts` und die zugehörige Living
Specification ändern sich gegenüber dem PR182-Merge. Feste Zusatzziehungen 73/74
werden durch tatsächlich ungezogene Zahlen ersetzt. Eine ausdrückliche echte
PostgreSQL-Dublettenprobe erhält Revision/Ziehungen unverändert. Keine
Produktionsregel, Timeoutgrenze oder Pflichtprüfung wird abgeschwächt.

Der neue **exakte Releasekandidat ist der Fix-Merge `6fa37aa5...`**. Gegen den
gehostet geprüften Preview-Head bleiben `app`, `public`, `prisma`, `package.json`
und Lockfile bytegleich. Die neue Planregression beweist dies aus unveränderlichen
Git-Objekten und begrenzt den Fixdiff auf genau die zwei geprüften Dateien.
Die lokale vollständige PostgreSQL-Abnahme besteht einschließlich Druck,
Bestandsdatenerhalt und Dump/Restore (147,8 s). Ein vorheriger lokaler Timeout in
unverändertem PR182-Code wird getrennt geführt, nicht durch neue Limits verdeckt.

Die ursprüngliche Preview-Paarregistrierung bleibt unverändert erhalten. Der neue
Datensatz erlaubt ausschließlich `93f07497... → 6fa37aa5...`; der rote ursprüngliche
Merge `5bfcb5f...`, der Fix-PR-Head und andere Nachfolger bleiben abgewiesen.
Manifest, Schemas, einziges SQL-Delta und vollständiger isolierter Deltatest sind
unverändert gebunden. Die zusätzliche PostgreSQL17-Matrixzeile erhält wegen der
gleichen Baseline einen Kandidaten-Suffix im Artefaktnamen; alte Artefaktnamen und
alle bisherigen Matrixzeilen bleiben erhalten.

Preflight #35 (`45839837797`) prüfte tatsächlich `93f07497... → 2d1fce...`, nicht
den neuen Releasekandidaten. Er wird ausdrücklich **nicht** wiederverwendet.
Nach Integration dieses Operations-Standes ist ein frischer geschützter main-only
Preflight für `93f07497... → 6fa37aa5...` erforderlich. Erst nach dessen vollständigem
PASS folgt ein frisches geschütztes Backup einschließlich Manifest, privatem
Readback und Integrität; kein Restore, keine Reparatur produktiver Daten.

Preflight und Deployment teilen die Concurrency-Gruppe `production-deployment`.
Falls der automatische Production-Lauf des Fix-Merges bereits vor diesen Gates
auf Owner-Review wartet, wird ausschließlich dieser **noch unfreigegebene** Lauf
nach Prüfung seiner SHA und nicht gestarteten Production-Schritte regulär
abgebrochen. Logs bleiben erhalten. Das löst keine Migration/Deployment aus und
ändert keine Schutzregel. Nach Planprüfung, grüner exakter main-CI, frischem
Preflight und verifiziertem Backup kann genau dieser Workflowkontext mit
`workflow_run.head_sha=6fa37aa5...` gezielt erneut ausgeführt werden. Er benötigt
weiterhin einen neuen regulären GitHub-Environment-Owner-Review. Keine blinde
Wiederholung von #1430, kein manuelles Vercel-Deployment und kein SHA-Override.
Aktuelle Lauf-IDs und Ergebnisse werden am Operations-PR dokumentiert.

| Feld | Wert |
| --- | --- |
| Erwartete laufende Production-Basis | `93f074973c4bf73ed4bf6c489d375682f510ba82` |
| Ursprünglicher geprüfter Preview-Head | `2d1fce671ad7d670a015dd6f7abd91cfa231926f` |
| Exakter Releasekandidat nach PR184 | `6fa37aa5114eabeb9fa6c58f6fd30bd6a295d67a` |
| Anzahl Migrationen vorher / nachher | 80 / 81 |
| Baseline-Manifest SHA256 | `54a307058df8a29a9ab214cb4b76f57e04112be631cfbc308514e9074d8df6a4` |
| Baseline-Schema SHA256 | `53ce29a7a086bca7d22e9b46657b1b112190cf03404942a53093e85ffc5e484d` |
| Kandidaten-Schema SHA256 | `26cc4d670ef3c954731a14250b580c33667e51869c9edc176b238cbf7f6127b1` |
| Einziges SQL-Delta | `20261126120000_event_ceremony` |
| SQL SHA256 | `d352c4b66ed8b031fe6d678709ee4c6c0f65fd24c9705eb5e6525a52867a1da1` |

Die letzte erfolgreiche Production-Bereitstellung war beim Vorabcheck
[45781228816](https://github.com/justphilgud/pubquiz-web/actions/runs/45781228816).
Der geschützte Live-Preflight muss den tatsächlichen aktuellen Alias und SHA erneut
bestätigen; Main oder ein GitHub-Environment-Record ersetzen diese Prüfung nicht.

## Architektur und Invarianten

Die vorhandene Bingo-Planregistry und der isolierte Schema-Builder behalten die
Verantwortung für Paarvergleich, Historie, vollständigen Katalog und Evidenzprüfung.
Ein eigener enger Plan bindet genau dieses Paar, alle alten SQL-Bytes und beide
Prisma-Schemas. Ein eigener Deltatest prüft ausschließlich die neue Tabelle.
Eine getrennt formulierte DDL-Referenz beschreibt deren Spalten, Defaults,
Primärschlüssel, JSON-Objekt-Check und restriktiven Fremdschlüssel.

Der vollständige Katalog nach der Migration muss dieser Referenz entsprechen;
neue Objekte werden nicht pauschal ausgeblendet. Befüllte synthetische Altbestände
enthalten Benutzer, Reihe, Quiz, Bingoabend, Runde, Kartenkennung/-layout,
Live-Lauf und Journal. Alle alten Tabellenzeilen bleiben vor/nach Migration und
zurückgerollten Constraintproben bytegleich. Die neue Tabelle bleibt zunächst leer.

Gültige Objekte werden akzeptiert; JSON-Array/-Skalar/-null, SQL-NULL, doppelter
Primärschlüssel und fremde Spielreferenz werden abgewiesen. Ein ausschließlich
von der neuen Konfiguration referenziertes Spiel darf nicht gelöscht werden;
dadurch beweist diese Probe gerade den neuen RESTRICT-Fremdschlüssel. Der
Rollback der noch unbefüllten Tabellenerstellung erhält Schema und Altzeilen.
Lockbudget 2 s und Statementbudget 30 s sind Testgrenzen, keine Zusage zur
Production-Dauer. Keine Reparatur, Backfills, Historienänderung oder Downmigration.

Die neue Paarzeile läuft zusätzlich unter isoliertem PostgreSQL17 in der
vorhandenen Preflight-CI. Alle bisherigen Paarzeilen und Read-only-Grenzen bleiben
erhalten. Operations-Scope schließt diese Dateien vom Anwendungsdeployment aus;
gemischte App-/Prismaänderungen bleiben deploypflichtig. Der historische lineare
Neuinstallationsfehler bleibt separat `FAIL / HISTORICAL_BASELINE_OVERLAP` und wird
nicht als erfolgreiche Neuinstallation ausgegeben.

## Nachweise

- Neuer Plan-/Manifest-/Evidenztest und Operations-Scope-Test lokal bestanden.
- Typecheck und strenger ESLint für die geänderten TypeScript-Dateien bestanden.
- Vollständiger lokaler Deltatest auf einer neuen Datenbank unter PostgreSQL18
  bestanden: vollständiger Katalog, alte Zeilen/Journal unverändert, gültige und
  ungültige Konfigurationen, Foreign Key/RESTRICT, leere neue Tabelle und Rollback.
  Das ist kein behaupteter Nachweis für den Production-Major; CI prüft PostgreSQL17.
- Lokale Referenz-Bytes stammen direkt aus Git und erfüllen den unveränderten
  Provenienz-Hash; die Windows-Arbeitskopie hat abweichende Zeilenenden.
- Die endgültigen CI- und Live-Nachweise stehen im Operations-PR. Noch kein
  Live-Preflight, Production-Backup oder Anwendungsrelease durch diesen Plan allein.

## Releasefolge und Rückweg

1. Den Operations-Stand technisch prüfen, dessen vollständige CI einschließlich
   isoliertem PostgreSQL17 abwarten und regulär integrieren. Scope-only darf kein
   Anwendungsdeployment auslösen.
2. Geschützten main-only Read-only-Preflight für die neue exakte Release-Nachfolge
   `93f07497... → 6fa37aa5...` ausführen, nicht den alten Preview-Head.
   Alle Alias-/SHA-, Historien- und Kataloggates müssen PASS sein. Bestehende
   GitHub-Environment-Reviews bleiben erhalten.
3. Frisches AP9.4-Backup im Modus `acceptance`, Typ `pre-deployment`, geschützt,
   `restore_after_backup=false`. Manifest, privates Readback und Integrität prüfen.
   Aktuellen Alias/SHA und Migrationsplan vor Deployment erneut bestätigen.
4. PR182 und PR184 sind bereits regulär integriert. Die vollständige main-CI für
   den exakten Release-Merge muss grün sein. Erst nach den vorherigen Gates den
   bestehenden geschützten Migration-/Productionworkflow gezielt für diesen Commit
   fortsetzen; siehe die oben dokumentierte Concurrency- und Owner-Review-Folge.
5. Migrationsstatus, READY, tatsächlichen Runtime-SHA und Production-Aliasse sowie
   ausschließlich lesende Smoke-Tests prüfen. Keine Testkarten, Ziehungen,
   Gewinnerentscheidungen oder Bewertungen in Production anlegen.

Nach neuen Druckständen versteht alter Code das neue Rundennummer-Metadatum nicht;
ein Code-Rollback braucht einen kompatiblen Reader. Neue Konfigurationen und
Gewinner dürfen nicht durch Tabellenlöschung verloren gehen. Bei Fehlern anhalten
und das geprüfte Backup bewahren; keine automatische Datenbank-Rücksetzung.
