# Bingo V3.1: exakter Release-Preflight fuer PR #147

Separat menschlich autorisiert am 30.10.2026: Production
`8fa60b68c0713dfe06e5dd6a203a369e1e73b961` -> Kandidat
`49350af73f6ceb69ff6d903701acd4f4d9ddd5c5`.
Keine weitere Kandidatenfreigabe. Vor Release beide Aliasse und Head erneut lesen.

## Vertrag und isolierte Pruefung

production-preflight-bingo-event-plan.ts bindet exakt beide Schemas, den gesamten
unveraenderten 68er-Bestand und nur 20261030150000_bingo_event_operation.
SQL-SHA256: 5c5b12ce13e0c637444626b681ce7da86a4bd3278dc5491b0f5d1bb4379df3d4.
Das Kandidatenprogramm wird nicht im geheimnistragenden Job ausgefuehrt.
Read-only-, Identitaets-, Leserollen-, Default-SELECT-, Historien- und vollstaendige
Baselinekatalog-Gates bleiben unveraendert. Keine Credentials exportieren.

Die geheimnisfreie Safety-CI baut den unabhaengigen alten Sollkatalog in einem
netzwerkisolierten PostgreSQL17-Container. Sie prueft die konkrete neue Migration
mit bestehendem Spiel, Runde, unveraenderlicher Karte, AP3-Durchlauf und Journal.
Alte Zeilen bleiben nach Projektion der neuen nullable Spalte exakt erhalten.
Fuenf neue Tabellen, fuenf Bindungstrigger und genau zwei Constraints sowie eine
nullable Spalte auf dem alten Journal sind die einzige Schemaaenderung.
FKs, Versionsbindung, Idempotenz und unveraenderliche neue Tabellen werden geprueft.
Eine transaktionale Rollbackprobe muss alten Katalog und Zeilen exakt erhalten.
2s lock_timeout/30s statement_timeout sind Testbudgets, keine Productiongarantie.
Die bekannte Bootstrapkollision bleibt getrennt FAIL/HISTORICAL_BASELINE_OVERLAP;
sie wird niemals als repariert ausgegeben.

## Integration und Rueckfall

Der Operations-PR aendert nur scripts/operations, docs/operations und Safety-CI.
Der echte Pfaddiff muss mit dem unveraenderten Deployment-Scope false liefern;
gemischte App-/Prismaaenderungen bleiben true. Erst nach erfolgreichen Checks
regulaer mergen; nur Scopejob, kein Anwendungsdeploy. Danach geschuetzten main-only
Read-only-Preflight mit obigem Paar ausfuehren. Erwartet: 68 angewendete Migrationen
und ausschliesslich die genannte neue Migration pending. Fehlende Nachweise,
weitere pending oder failed Migrationen blockieren. Keine Baseline, resolve,
Reparatur, Migration, Sicherung oder Restore im Preflight.

Die Migration ist additiv, ohne Backfill/Reset. ALTER TABLE und FK-Anlage brauchen
Sperren auf Referenztabellen. Ein alter Code-Rollback ist nach V2-Ereignissen nicht
sicher: alter Replay-/Backupcode kennt sie nicht. Nur geprueft kompatiblen Code
verwenden; keine Downmigration, Datenloeschung oder automatische Wiederherstellung.
Der Anwendungs-PR integriert neue Tabellen in Snapshot/Backup/Restorevertraege.
Keine zusaetzlichen manuellen Production-Backups oder Restores starten.

Nach PASS Production und Kandidat erneut bestaetigen. Mergeergebnis darf ausser
dieser Operations-Erweiterung keine ungeprueften Aenderungen enthalten. PR #147
regulaer mergen, Main-CI und geschuetzten Migration-/Deploymentprozess pruefen.
READY, beide Aliasse, Runtime-SHA und kleine schreibfreie Smokes bestaetigen.
Keine Liveansicht mit zustandsaendernder Initialisierung oeffnen; keine Starts,
Rechteaenderungen oder Session-Resets. Tatsaechliche Ergebnisse im PR dokumentieren.
