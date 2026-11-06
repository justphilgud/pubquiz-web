# Bingo-Karten V3: exakter Release-Preflight fuer PR #152

Separat menschlich autorisiert am 06.11.2026: Production
`f0a5b0643312b33a4387ad09872e358d8dab8ccd` -> Kandidat
`94f442cedad38f67973f3f4e1714758e1c4f99bd`.
Beide Aliasse und der unveraenderte PR-Head wurden unabhaengig bestaetigt.
Keine weitere Kandidatenfreigabe, keine Wildcards, Secrets-/Rechte-/Environmentaenderung.

## Vertrag

Der neue Plan bindet beide Schemas, alle 69 unveraenderten historischen SQL-Dateien
und ausschliesslich `20261106180000_bingo_card_design_v3`.
SQL-SHA256: `10a2d3fc57e285a5540ee235b08fe2f97f4e603ac03df804d0de6871a4d9537c`.
Der vorhandene CLI-, READ-ONLY-, Least-Privilege-, Default-SELECT-, Identitaets-,
Historien- und vollstaendige Baselinekatalogvertrag bleibt unveraendert.
Kandidatenanwendung wird niemals im geheimnistragenden Job ausgefuehrt.

Der geheimnisfreie Deltatest laeuft ausschliesslich im bestehenden disposable
PostgreSQL17-Container ohne Netzwerk. Unabhaengige historische Modellreferenz plus
alle unveraenderten Inkremente bauen den alten Sollkatalog. Der Test prueft
repräsentative alte V2-Karten, Runde, Zuordnung und laufenden AP3-Durchlauf mit
Journal. Alle alten Tabellenzeilen bleiben nach Projektion der nullable Spalte
exakt erhalten. Erwartet sind genau `bingo_term_sets`, `bingo_rounds.term_snapshot`,
ein neuer Rundenshape-CHECK und zwei erweiterte Snapshot-CHECKs.
Die drei CHECK-Definitionen werden unabhaengig aus festen Erwartungen deparst und
vollstaendig verglichen; nur diese exakt benannten alten CHECKs werden im
alten Katalogvergleich durch ihre vorherigen Definitionen ersetzt. Alle uebrigen
alten Objekte bleiben im vollstaendigen Vergleich. FK-/Versions-/Revisionsfehler
werden abgewiesen; V3-Snapshot und Begriffsbindung werden isoliert akzeptiert.
Transaktionale Rollbackprobe muss alten Katalog und Zeilen exakt erhalten.
2s lock_timeout/30s statement_timeout sind Testbudgets, keine Productiongarantie.

Historischer New-install-Replay bleibt getrennt FAIL/HISTORICAL_BASELINE_OVERLAP
an der bekannten Draft-/0_init-Kollision. Keine Baseline, resolve, Reparatur,
Datenloeschung oder Behauptung eines erfolgreichen historischen Neuinstallationsreplays.

## Integration und Release

Operations-Diff ausschliesslich in scripts/operations, docs/operations und der
bestehenden Safety-CI. Der tatsaechliche Pfaddiff muss mit dem unveraenderten
Deployment-Scope false liefern; App-/Prismapfade bleiben true. Erst nach Review
und erforderlichen Checks regulaer integrieren; nur Scopejob, kein Appdeploy.
Danach geschuetzten main-only Read-only-Preflight fuer exakt obiges Paar ausfuehren.
Erwartet: 69 angewendete Migrationen und nur die neue V3-Migration pending,
keine Fehlmigration oder historische Drift. Fehlender Nachweis bleibt BLOCKED.
Keine Migration, Sicherung oder Restore im Preflight; keine zusaetzlichen
manuellen Production-Backups. Die bestehenden dynamischen Sicherungsvertraege
und der privilegienarme Default-SELECT-Nachweis bleiben erforderlich.

Nach PASS Production, Aliasse und Kandidat unmittelbar erneut pruefen.
Mergeergebnis darf ausser dieser separat geprueften Operations-Erweiterung keine
ungeprueften Aenderungen enthalten. PR #152 regulaer mergen; Main-CI und den
regulaeren geschuetzten Migration-/Deploymentprozess pruefen. READY, beide Aliasse
und Runtime-SHA verifizieren; ausschliesslich kleine schreibfreie Smokes.
Keine Spielstarts, Teambeitritte, Antworten, Rechteaenderungen oder Session-Resets.

## Rueckfall

Die Migration ist additiv, ohne Backfill/Reset. ALTER TABLE und neue FKs brauchen
Sperren. Ein unbedachter Rueckfall auf alte Parser ist nach V3-Snapshots oder
Aufloesungsereignissen nicht sicher: nur geprueft kompatiblen Anwendungscode
verwenden. Keine Downmigration, Datenloeschung oder automatische Wiederherstellung.
Die SQL-Rollbackprobe vor dem Release ist kein Nachweis fuer einen spaeteren
Anwendungsrollback nach neuen fachlichen Schreibvorgaengen.
