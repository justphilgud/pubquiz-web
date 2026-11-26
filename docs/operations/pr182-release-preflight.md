# PR182 – exakter Production-Releaseplan

Der Benutzer hat den Production-Release von PR182 angefordert. Dieser getrennte
Operations-Stand bereitet den bestehenden geschützten Weg vor. Der Anwendungs-
kandidat bleibt unverändert; der Plan allein führt weder Migration noch Deployment aus.

## Unveränderliche Eingaben

| Feld | Wert |
| --- | --- |
| Erwartete laufende Production-Basis | `93f074973c4bf73ed4bf6c489d375682f510ba82` |
| Geprüfter PR182-Kandidat | `2d1fce671ad7d670a015dd6f7abd91cfa231926f` |
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
2. Geschützten main-only Read-only-Preflight für das obige Paar ausführen.
   Alle Alias-/SHA-, Historien- und Kataloggates müssen PASS sein. Bestehende
   GitHub-Environment-Reviews bleiben erhalten.
3. Frisches AP9.4-Backup im Modus `acceptance`, Typ `pre-deployment`, geschützt,
   `restore_after_backup=false`. Manifest, privates Readback und Integrität prüfen.
   Aktuellen Alias/SHA und Migrationsplan vor Deployment erneut bestätigen.
4. Erst dann PR182 regulär integrieren, Main-CI für den tatsächlichen Merge-Commit
   abwarten und den bestehenden geschützten Migration-/Productionworkflow nutzen.
5. Migrationsstatus, READY, tatsächlichen Runtime-SHA und Production-Aliasse sowie
   ausschließlich lesende Smoke-Tests prüfen. Keine Testkarten, Ziehungen,
   Gewinnerentscheidungen oder Bewertungen in Production anlegen.

Nach neuen Druckständen versteht alter Code das neue Rundennummer-Metadatum nicht;
ein Code-Rollback braucht einen kompatiblen Reader. Neue Konfigurationen und
Gewinner dürfen nicht durch Tabellenlöschung verloren gehen. Bei Fehlern anhalten
und das geprüfte Backup bewahren; keine automatische Datenbank-Rücksetzung.
