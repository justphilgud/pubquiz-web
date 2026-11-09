# Bingo Matching UX – Production-Preflight für PR #160

Dieses Operations-Paket ergänzt ausschließlich das geprüfte No-Delta-Paar
`b50a88e47d3c7ec7261f4e9fd3563a5e73995a58` →
`c184d231c03dab71972e6c98cd2e78c29c5a6d8e`. Der Kandidat enthält den produktiven main-Stand und den fachlich
abgenommenen Head `a6c24d0a` von PR #160. Der Binärdiff von PR #160 gegen seine Basis ist vor und nach dem regulären Abgleich bytegleich. Am 9. November 2026 zeigten beide Production-Aliasse
und das Projektziel auf dasselbe READY-Deployment des Ausgangscommits.

Prisma-Schema und der gesamte Migrationsbaum sind bytegleich. Der Vertrag bindet
alle 72 Migrationen einschließlich `20261107150000_bingo_matching` über den
Manifest-Hash und das Schema über seinen eigenen SHA-256. Der Preflight muss
vollständige, eindeutige, erfolgreich abgeschlossene Historie ohne ausstehende,
unerwartete oder fehlgeschlagene Migrationen nachweisen. Kein neues SQL-Delta,
kein vollständiger Live-DDL-Abgleich und kein neuer Bootstrap-Nachweis.

Der vorhandene Main-only-Workflow, Environment-Regeln, Reader-/TLS-Prüfungen
und bestehende Releasepaare bleiben erhalten. Kandidatenanwendung wird im
geheimnistragenden Job nicht ausgeführt. Keine neuen Secrets, Rechte, Backups,
Restores, Baselines oder Reparaturen. Die zusätzlichen Tests prüfen das exakte
Paar, falsche Paare, veränderte Schemabytes und fehlende, zusätzliche oder
abweichende Migrationen. Die Safety-CI prüft das Paar mit dem bestehenden
isolierten Nachweisweg.

Der Operations-Diff muss mit dem unveränderten Deployment-Scope `false` liefern.
Erst nach regulärer Integration und bestätigtem Ausbleiben eines
Anwendungsdeployments folgt der geschützte Read-only-Preflight. Vor dem Merge von
PR #160 Production und Kandidat erneut gegen den erfolgreichen Nachweis prüfen;
der Mergebaum darf nur den geprüften Kandidaten plus dieses Operations-Paket
enthalten. Nach Main-CI reguläres Production-Deployment und lesender Smoke-Test.
