# Bingo AP3: exakter geschützter Release-Preflight

Freigegebenes Paar: Production `4f437c17d675cdf027b25cb2c2196f9ef19f5345`
→ Kandidat `6381b8be4e74f47e0267fa8f542d1ac4661759ef` (PR #145).
Die gesonderte menschliche Freigabe umfasst diese eng begrenzte Operations-
Erweiterung, deren regulären Merge und anschließend den AP3-Release.

Der Plan bindet den vollständigen unveränderten 67er-Migrationsmanifesthash
`49944dfe6addacad154ed2cf39cada2ec3809d0c1f8dcfc53c2afa070dfb4ed9`,
beide Prisma-Schemahashes und exakt eine neue Datei:
`20261028090000_bingo_live`, SHA-256
`43b739f502a8f6e556191538f24f368c15ed546b4f38d8639ad55878e6c5bca4`.
Baseline-Schema: `c44b7c2491b4bea5596b57f7aafa6ae0fda565fcfcfd29cad5b4fe2da454e219`.
Kandidaten-Schema: `931dc99fdff6075f80a230f298f497f63b8b1eb04adc5c5fd700857b73331ed6`.
Keine Wildcards, allgemeine Kandidatenfreigabe oder Änderung historischer SQL-Dateien.
Der vorhandene AP2-Vertrag und alle anderen exakten Freigaben bleiben erhalten.

## Zuständigkeit und Prüfungen

Neuer AP3-Plan und isolierter AP3-Deltatest bleiben eigene kleine Module.
Der bestehende CLI-/READ-ONLY-/Least-Privilege-/Default-SELECT-/Identitäts-/
Historien-/Katalogvertrag bleibt verantwortlich; keine Kandidatenanwendung wird
im geheimnistragenden Job ausgecheckt oder ausgeführt. Keine Secrets, Rechte,
Environmentregeln oder Production-Workflowänderung.

Die geheimnisfreie Safety-CI ergänzt das exakte Paar zur bestehenden Matrix.
Nur dort führt ein disposable PostgreSQL17-Container ohne Netzwerk die exakt
hashgeprüfte SQL-Datei aus. Unabhängige historische Modellbaseline plus alle
unveränderten Inkremente des 67er-Migrationsbestands, niemals ein aus Production abgeleiteter Sollkatalog.
Repräsentative alte Karte, Kurzkennung, Runde und Spiel werden vor dem Delta
angelegt und alle bestehenden Tabellenzeilen nach dem Delta vollständig verglichen.
Rückrollprobe bestätigt identischen alten Katalog und Bestand. Tests prüfen
höchstens einen laufenden/pausierten Durchlauf, erneuten neuen Durchlauf nach Ende,
Idempotenz-Unique-Key, FKs sowie unveränderliche Kartenreferenzen/Ereignisse/
Runmetadaten. Projektion entfernt nur drei neue Tabellen, vier exakt benannte
Trigger und den zusätzlichen Index `bingo_cards_identity_series`; alle alten
Spalten, Constraints, Indizes, Sequenzen, Views und Routinen bleiben gleich.

Historischer New-install-Replay bleibt getrennt FAIL an der bekannten
`20260713130000_add_question_draft_fields`-/0_init-Kollision. Keine neue Kollision
akzeptieren; keine Baseline, kein resolve, keine Reparatur oder Behauptung eines
vollständigen historischen Migrationsdurchlaufs.

## Release, Sperren und Rückfall

Der tatsächliche Operations-Diff darf ausschließlich `scripts/operations`, dieses
Dokument und die bestehende Safety-CI ändern. Vor Merge
`needsApplicationDeployment(actualPaths) === false` nachweisen. Gemischte
App-/Prismaänderungen bleiben true. Der unveränderte Deploymentworkflow darf beim
Operations-Merge nur den Scope-Job ausführen, keine Migration/Anwendung deployen.

Danach geschützten main-only Read-only-Preflight mit dem exakten Paar ausführen.
Dieser muss beide Production-Aliasse, aktuelle Identität/Historie, vollständigen
Live-Baselinekatalog, Backupreader und vorhandene Default-SELECT-Rechte bestätigen.
Erwartet: 67 angewendete und nur die eine erwartete neue Migration pending.
Fehlender Nachweis ist kein PASS. Kein GRANT, Backup oder Restore im Preflight.

Die Migration ergänzt drei Tabellen, vier Trigger (bestehende exakt geprüfte
Funktion) und einen Unique-Index auf bestehenden Karten. CREATE INDEX und
FK-Anlage benötigen kurzzeitig Sperren auf Referenztabellen. Isolierte Proben mit
2s lock_timeout und 30s statement_timeout begrenzen Tests, garantieren keine
Productiondauer. Keine Quizruntime-Zeile oder bestehende Session wird geändert.
Kein ungeprüfter Code-Rollback: alter Backupcode kennt die neuen Objekte nicht.
Nach Migration ausschließlich ausdrücklich kompatiblen Code verwenden, keine
Down-Migration oder Datenlöschung. AP3-Backup-/Snapshot-/Restore-Integration ist
separat im Anwendungs-PR geprüft; keine zusätzlichen manuellen Production-Backups.

Unmittelbar vor AP3-Merge erneut beide Aliasse und unveränderten Kandidaten
prüfen. Das Mergeergebnis darf außer dieser separat geprüften Operations-
Erweiterung keine ungeprüften Änderungen enthalten. Dann regulärer Merge,
Main-CI, bestehender geschützter Migration-/Deploymentprozess und ausschließlich
schreibfreie Production-Smokes. Kein Bingo-Start, kein Session-Reset.
PRIVATE_READBACK_FAILED und erster echter Wochenlauf bleiben getrennte
Betriebspunkte. Konkrete Läufe und ausgelieferte SHAs im PR dokumentieren.
