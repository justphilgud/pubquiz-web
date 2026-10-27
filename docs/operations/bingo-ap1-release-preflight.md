# PR #141: exakter AP1-Preflight ohne Schema-/Migrationsdelta

Zusätzlich zum unveränderten Layout-Paar aus PR #139 wird ausschließlich
Production `3ade18d276d7ead2cc43008a3d887e3d8feaae48` → Kandidat
`0c23f07ecb263805482ef9bd75277d94f0eac718` freigegeben. Keine Wildcards,
Merge-SHA-Freigabe oder allgemeine Kandidatenfreigabe. Alle bisherigen
SQL-Delta-Freigaben und Sicherheitsprüfungen bleiben erhalten.

Vor der Erweiterung wurden beide Aliasse `quiz.philgud.events` und
`pubquiz-web.vercel.app` unabhängig über feste authentifizierte Vercel-GETs
auf `dpl_BvDyH4nzGm34DSxmHnWMgyRASKxR`, Production/READY und den erwarteten
vollständigen SHA geprüft. PR-Head und Main wurden über GitHub erneut bestätigt.
Git-Objektvergleich unabhängig vom Plan: Prisma-Schema und alle 64 SQL-Dateien
sind bytegleich; SHA256 des geordneten Pfad-/Checksum-Manifests:
`99da850634911bc935b76b4b28871c748cdce4fc5b4446ef7ce98fc5c476583e`.
Dieser Repository-Vergleich allein ist kein aktueller Datenbanknachweis.

Der bestehende main-only Read-only-Workflow prüft nach Integration dieser reinen
Operationsänderung das exakte Paar. Kandidatenanwendung wird im geheimnistragenden
Job nicht ausgeführt; ausschließlich Git-Schema und SQL-Hashes werden gelesen.
Der No-Delta-Vertrag und geschützte Reader prüfen weiterhin die richtige
Productionidentität, Leserrechte, READ ONLY, historische Checksummen und genau
64 abgeschlossene Migrationen einschließlich
`20261026210000_shared_game_design`, ohne offene Fehler, fehlende, unerwartete
oder ausstehende Migrationen. Keine Secrets-/Rechte-/Environmentänderung.

Kein vollständiger Live-DDL-Abgleich behauptet. Historischer Bootstrap bleibt
`NOT_RUN / HISTORICAL_BOOTSTRAP_LIMITATION_UNCHANGED`; kein Ursachenfix behauptet.
Kein Backup, Restore, Baseline, resolve oder Migration im Preflight.

Tests prüfen beide exakten No-Delta-Paare, falsche/vertauschte/gekürzte und
überkreuzte Paare, Schemaänderungen, fehlende/zusätzliche/geänderte Migrationen,
unvollständige/fehlerhafte Historie und bestehende Freigaben. Die CI-Matrix baut
zusätzlich den neuen No-Delta-Beleg ohne Productionzugang. Der tatsächliche
Operations-Diff besteht nur aus Plan, Tests, CI-Matrix und diesem Dokument;
`needsApplicationDeployment` liefert dafür false. Gemischte Appänderungen bleiben
true; kein neuer Scope-Ausschluss und keine Änderung der Deployment-Automatik.

Nach erfolgreichem geschütztem Preflight unmittelbar vor AP1-Merge beide Aliasse
und den exakten Kandidaten erneut prüfen. Das AP1-Mergeergebnis darf gegenüber
dem Kandidaten ausschließlich die separat geprüften Operationsdateien ergänzen.
Main-CI und regulärer Productionprozess inklusive Environmentfreigabe bleiben
Pflicht. Nur lesende Smokes; keine Liveinitialisierung, Daten- oder Sessionänderung.
AP1 integriert nur den isolierten Regelkern, Bingo bleibt nicht spielbar.
