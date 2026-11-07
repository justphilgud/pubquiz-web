# Bingo-Druckvorlagen V4: exakter Production-Preflight für PR154

Ausdrücklich autorisierte Fortsetzung am 7. November 2026:
Production `e877959f12d6d9ba4cb07a43dc273516b577f4cf` →
Kandidat `0143de26461070d08b701ffee01a8ca4b7db3eac`.
Beide Production-Aliasse wurden unabhängig als READY auf e877959f bestätigt.
Keine andere Paarung, kein verkürzter SHA und keine Wildcard wird zugelassen.

## Unveränderliche Basis und geprüfter Deltaumfang

70 historische Migrationen bleiben bytegleich (Manifest SHA256
`069b34755e9e5eb309c770ffcd17783e1f5bd8ca914096e803ac7d007d5325de`).
Prisma-Schema vor/nach identisch (SHA256
`df7cd584585ca2fab7fab2926a63f5c90790d461bbc1ac7270733efdc4dab7e8`).
Ausschließlich neue Migration `20261106210000_bingo_print_templates_v4`, SQL-SHA256
`4a79c784a0faa372d238da36ad9e10852651f239dfbe3e4378e6b0764e64420c`.
Sie erweitert genau vier bestehende CHECKs auf Drucksnapshot V4/Auswahl V2.
Keine Tabellen, Spalten, Trigger, Datenmigration oder automatische Neugestaltung.

Der bestehende geheimnisfreie, netzwerkisolierte PostgreSQL17-Referenzaufbau bleibt
unverändert. Der neue Deltatest erfasst alte Karten, Kennungen, Druckversionen,
individuelle Auswahlen sowie einen laufenden Legacy-Durchlauf mit Journal vor dem
SQL. Er prüft transaktionalen Rollback, unveränderte vollständige Tabellenzeilen,
alle übrigen Katalogobjekte, unabhängig formulierte exakte Definitionen der vier
validierten CHECKs, akzeptierte V4-/V2-Werte und weiterhin abgewiesene falsche Werte.
Nur diese vier benannten alten CHECKs werden im Katalogvergleich durch ihre alten
Definitionen ersetzt; keine breite Ausnahme. 2s/30s sind Test-Sperr-/Statementbudgets,
keine Garantie für die tatsächliche Productiondauer.

Alle vorhandenen Freigaben und Sicherheitsprüfungen bleiben bestehen. Kandidaten-
anwendung wird nicht im geheimnistragenden Job ausgeführt. Der Reader prüft live
richtige DB/Session/Least-Privilege, vollständige 70er-Historie/Prüfsummen und den
vollständigen Baseline-Sollkatalog; nur obige 71. Migration darf pending sein.
Der bekannte historische 0_init-/Draft-Neuinstallationsfehler bleibt ausdrücklich
separat FAIL/HISTORICAL_BASELINE_OVERLAP; keine Baseline, resolve oder Reparatur.

## Integration und Freigabereihenfolge

Nur Operationsdateien und die bestehende Safety-Matrix werden ergänzt. Der
unveränderte Deployment-Scope muss für den tatsächlichen Diff false und für
Mischungen mit App/Schema/Migration weiter true liefern. Kein Anwendungsdeployment
beim regulären Operations-Merge. Erst nach erfolgreicher separater Review/CI und
nachgewiesenem Scope-Skip den bestehenden geschützten main-only Read-only-Preflight
für genau das Paar ausführen. Die gehostete isolierte Abnahme in PR154 und dessen
Head-CI bleiben zusätzlich erforderlich, sie werden durch diese Freigabe nicht ersetzt.

Vor dem App-Merge Production/Aliasse/Kandidat erneut prüfen. Das Mergeergebnis darf
neben dem Kandidaten nur diese separat geprüften Operationsdateien enthalten.
Regulärer Main-CI-/Production-Workflow, ausschließlich obige erwartete Migration,
READY, beide Aliasse und tatsächlicher Runtime-SHA sind anschließend nachzuweisen.
Keine zusätzlichen manuellen Production-Backups/Restores, Spielstarts, Rechte-,
Daten- oder Session-Resets. Kleine Production-Smokes bleiben ausschließlich lesend.

Nach neuen V4-/Auswahl-V2-Schreibvorgängen ist ein unbedachter Rückfall auf alte
Parser/Renderer unsicher; nur separat geprüften kompatiblen Anwendungscode nutzen.
Keine Downmigration oder Datenlöschung. Die isolierte SQL-Rollbackprobe ist kein
Nachweis für einen späteren Anwendungsrollback nach neuen fachlichen Änderungen.
