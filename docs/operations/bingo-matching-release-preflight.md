# Bingo-Matching: exakter Releasepreflight für PR #158

Am 7. November 2026 separat ausdrücklich autorisiert: Operations-PR, technische
Review und regulärer Merge ohne Anwendungsdeployment, anschließend Matching-Release.
Production `338887775389567fd2703cf177f3927cf89a1086` → ausschließlich
Kandidat `6915ec447bde62a8b7d2a63efb53633c8edb44fd`. Beide Production-Aliasse und
das Projektziel wurden unabhängig als dasselbe READY-Productiondeployment bestätigt.

## Unveränderliche Basis und Delta

71 historische SQL-Dateien unverändert, Manifest SHA256
`522f034347f0899994f056eafbf997fb80340b07b10d19f384b5c228172f6bb4`.
Basis-Schema SHA256 `df7cd584585ca2fab7fab2926a63f5c90790d461bbc1ac7270733efdc4dab7e8`,
Kandidaten-Schema SHA256 `9d7d5860b8cd5a6fb497b880c283fe61e26993018200912fe6a71997803e6ac9`.
Nur Migration `20261107150000_bingo_matching`, SQL SHA256
`7a5998e3b027ad002112c12f948e9f8435b462308858d85efcc495cb26c2447f`.
Neue Assettabelle, nullable config_hash, genau zwei erweiterte CHECKs, zwei neue
Hash-CHECKs und zwei Immutable-Trigger; keine Updates/Backfills bestehender Daten.

Der bestehende geheimnisfreie PostgreSQL17-Referenzaufbau bleibt erhalten. Der neue
Deltatest prüft eine befüllte Basis mit alten Karten, Kennungen, individuellen
Druckwerten, Begriffssatz und laufendem Legacy-Durchlauf samt Journal. Rollback muss
vollständige Zeilen und Katalog erhalten. Nach Migration bleibt die alte Projektion
identisch, config_hash NULL und neue Assettabelle leer. Neue Tabelle/Indizes werden
gegen unabhängig formulierte DDL geprüft, die vier benannten CHECKs separat exakt;
Triggerdefinitionen und tatsächliche Update-/Löschsperren werden geprüft. Nur die
ausdrücklich geprüften Objekte werden für den restlichen vollen Katalogvergleich
zurückprojiziert. Bytes und SHA256 einer synthetischen Testdatei bleiben erhalten.
2s Sperr-/30s Statementbudget im isolierten Test ist keine Produktionszeitgarantie.

## Geschützter Ablauf und Rückfall

Negative Tests erhalten falsche/vertauschte/unbekannte Paare, geänderte Schemas,
fehlende/zusätzliche/geänderte Migrationen, frühere Pläne und alle Readergates.
Kandidatenanwendung wird nicht im geheimnistragenden Job ausgeführt. Der feste
Productionreader prüft Least-Privilege, READ ONLY, Default-SELECT für neue Tabellen,
71 abgeschlossene Historieneinträge mit bekannten EOL-äquivalenten Checksummen und
vollständigen Baseline-Sollkatalog. Nur die 72. Migration darf erwartet pending sein.
Historischer Neuinstallationsfehler bleibt separat FAIL/HISTORICAL_BASELINE_OVERLAP.

Operations-Scope mit tatsächlicher Dateiliste muss ohne Änderung der Scope-Regeln
false ergeben, App-/Schema-/SQL-Mischungen weiter true. Nach regulärem Operations-
Merge und nachgewiesenem Deployment-Skip geschützten main-only Preflight für genau
dieses Paar ausführen. Vor App-Merge Production und Kandidat erneut prüfen; Mergebaum
darf zusätzlich zum abgenommenen Kandidaten nur diese geprüften Operationsdateien
enthalten. Dann Main-CI, regulärer Production-Migrations-/Deploymentjob, saubere
72er-Historie, READY, beide Aliasse und tatsächlichen Runtime-Commit verifizieren.

Keine weiteren manuellen Backups/Restores; bestehende spezifische Bingo-Release-
verträge verlangen diese nicht. Bestehende Daten, Rechte und Sessions erhalten.
Nach neuen Matching-V2-Fassungen ist alter Code nicht automatisch kompatibel:
kein unbedachter Anwendungsrollback, keine Downmigration, keine Datenlöschung.
SQL-Transaktionsrollbackprobe ist kein späterer Anwendungsrollbacknachweis.
Production-Smokes bleiben rein lesend, ohne Initialisierung schreibender Liveflächen.
Historisches PRIVATE_READBACK_FAILED und echter Wochenlauf bleiben separat offen.
