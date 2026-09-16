# AP9.4 Run #19: RESTORE_CATALOG_MISMATCH — lesende Diagnose

Stand: 2026-09-16. Kein erneuter Restore, keine Zielbereinigung, kein neues Backup.

## Ursache und Klassifikation

Run https://github.com/justphilgud/pubquiz-web/actions/runs/35102025962,
Restorejob 104815481004, meldete RESTORE_CATALOG_MISMATCH nach der vom Betreiber
freigegebenen Wiederherstellung. Auslöser ist compareSnapshots in snapshot.ts:
JSON.stringify(expected.catalog) !== JSON.stringify(actual.catalog).
Der vorgeschaltete Vergleich aller 460 Spaltendefinitionen war erfolgreich.

**Klassifikation: falsche textuelle Erwartung im Validator bei einer PostgreSQL-
DDL-Deparse/Reparse-Darstellung.** Kein nachgewiesener Backupdefekt, kein Befund
für ein zuvor nicht leeres Ziel, keine nachgewiesene Neon-Sonderbeschränkung.
Eine unterschiedliche PostgreSQL-Version der Quelle wird nicht als Ursache behauptet.
Das tatsächlich lesend geprüfte Ziel meldet PostgreSQL 17.11 (c4ba6b8).

Genau sieben CHECK-Definitionen und ein partieller Unique-Index weichen ab.
Die einzige Änderung ist die Verteilung eines varchar-Array-Casts auf die Elemente:

```sql
-- Manifest / Quelle
(ARRAY['PENDING'::character varying, 'PROCESSING'::character varying])::text[]
-- restaurierter Katalog
ARRAY[('PENDING'::character varying)::text, ('PROCESSING'::character varying)::text]
```

PostgreSQL beschreibt pg_get_constraintdef ausdrücklich als rekonstruierte, nicht
ursprüngliche SQL-Darstellung; ein Cast des Array-Konstruktors wirkt wie die einzelnen
Elementcasts. Quellen:
- https://www.postgresql.org/docs/17/functions-info.html
- https://www.postgresql.org/docs/17/sql-expressions.html#SQL-SYNTAX-ARRAY-CONSTRUCTORS

Zusätzlicher realer SELECT-Nachweis im Ziel, ausschließlich BEGIN READ ONLY:
Alle sieben unterschiedlichen Literal-Arrays beider Schreibweisen sind identisch.
50 ANY-/ALL-Vergleiche über alle enthaltenen Werte plus NULL, UNEXPECTED und Leerstring
liefern identical_arrays=true, identical_any=true, identical_all=true.
Die weiteren Booleschen Bedingungen der vollständigen Definitionen sind bytegleich.
Die vollständigen acht Vorher-/Nachher-Definitionen ohne Nutzdaten liegen als
Regressionsevidenz in scripts/operations/fixtures/run19-catalog-casts.json.

| Tabelle | Constraint / Index | Unterschied |
| --- | --- | --- |
| medien_generator_laefe | chk_generator_lauf_status | Array-Cast |
| medien_generator_lauf_medien | chk_generator_medium_rolle | Array-Cast |
| presentation_templates | presentation_templates_status_check | Array-Cast |
| quiz | chk_quiz_aufloesungsstrategie | Array-Cast |
| quiz_ablauf_elemente | chk_quiz_ablauf_fragebezug | Array-Cast in ANY und ALL |
| quiz_abschnitte | chk_quiz_abschnitt_aufloesungsstrategie | Array-Cast; NULL-Logik unverändert |
| story_element_revisionen | ck_story_element_type | Array-Cast |
| medien_generator_laefe | uq_generator_lauf_active | Array-Cast im partiellen Unique-Prädikat |

Alle betroffenen CHECKs sind weiterhin validiert. Namen, Typen, Spalten, Werte,
Reihenfolgen, Operatoren, NULL-Bedingungen und Unique-Eigenschaft sind unverändert.

## Schreibzugriffe und tatsächlicher Zielzustand

Ja, vor diesem Fehler fand ein vollständiger Schreibdurchlauf statt:
acceptanceRestore ruft psql --single-transaction --file=- mit ON_ERROR_STOP=1 auf.
Diese synchrone Ausführung beendet zuerst erfolgreich ihre Transaktion. Erst danach
öffnet der Adapter eine neue READ ONLY-Transaktion für collectSnapshot/compareSnapshots.
Der Katalogfehler kann den bereits abgeschlossenen Restore daher **nicht zurückrollen**.
Dokumentation: https://www.postgresql.org/docs/17/app-psql.html (single-transaction).

Geschrieben wurden im isolierten Ziel: public/pubquiz-Schemaobjekte, Tabellen samt
Backupdaten, redigierte users/teams-Daten, Enum-Typen, Sequenzen samt Zuständen,
Indizes, Constraints/FKs sowie Migrationstabellendaten. Das vorher leere public-Schema
wurde im selben Durchlauf ersetzt. Der Leere-Ziel-Guard wurde vor dem Restore passiert;
es gibt keinen Befund eines durch diesen Lauf überschriebenen Bestands.

Bestätigtes einziges Ziel:
- Projekt pubquiz-restore-test-20260914 / icy-leaf-46256271
- Branch br-bitter-paper-b20sx4lu (projektlokaler Name production)
- Endpoint ep-small-poetry-b2jfzg9w
- Host ep-small-poetry-b2jfzg9w.c-6.eu-central-1.aws.neon.tech
- neondb / neondb_owner; Diagnose transaction_read_only=on

| Katalogbereich | Manifest | Ziel | Vergleich |
| --- | ---: | ---: | --- |
| Schemas | 2 | 2 | exakt |
| Tabellen | 45 | 45 | identisches Inventar und alle Zeilenzahlen |
| Spaltendefinitionen | 460 | 460 | ursprünglicher Validator passiert |
| Constraints | 165 | 165 | 158 exakt; 7 bewiesen äquivalente Cast-Darstellungen |
| Indizes | 158 | 158 | 157 exakt; 1 bewiesen äquivalente Cast-Darstellung |
| Sequenzdefinitionen | 41 | 41 | exakt |
| Sequenzzustände last_value/is_called | 41 | 41 | lesend gegen Manifest geprüft, exakt |
| Enum-Labels (21 Typen) | 63 | 63 | exakt, einschließlich Reihenfolge |
| Views | 0 | 0 | exakt |

45 Tabellen enthalten insgesamt **1717 Zeilen**, darunter 42 Migrationen, 122 Fragen,
242 Teamantworten, 8 Benutzer und 29 Teams. Alle 45 einzelnen counts stimmen überein.
Authentifizierungsprüfung nur als Aggregate: 0 Benutzer mit einem password_hash
abweichend vom leeren Platzhalter; 0 Teams mit nicht-NULL team_passwort.
0 ungültige oder nicht bereite Indizes. Keine Passwortwerte ausgegeben.
Ein bereits im Manifest enthaltenes NOT VALID-Constraint (chk_medien_exactly_one_owner)
ist auf dem Ziel ebenfalls NOT VALID; das ist unverändert und kein neuer Unterschied.

Die Diagnose bestätigt keine vollständige Abnahme: Der ursprüngliche Validator brach
vor tables/media/resultRows-Vergleich und den nachfolgenden Smokes ab. Vollständige
Zeilenhash-/Stichproben-/Ergebnisvalidierung und Anwendungssmoke bleiben offen.
Die Medienartefakte wurden vom Restorejob vor dem Datenbankschreibaufruf heruntergeladen
und geprüft; kein Upload/Delete und keine Änderung der ursprünglichen Medien.

## Backup unverändert

Kennung production/acceptance/run-35102025962-1.
Snapshot 2026-09-16T13:28:18.907504+00:00.
Das bestehende Manifest wurde nur heruntergeladen; 259377 Bytes, SHA-256 erneut bestätigt:
d60a86f750a9c6f80ec7e66f7c37c54f87cd779986b1783b13474f3feb76581b.
Kein Backup neu erstellt, ersetzt oder gelöscht. Kein technischer Grund dafür gefunden.
Production, Preview, Development und Providerkonfiguration wurden nicht verändert.

## Minimaler Fix und Tests

snapshot.ts behält alle Vergleichsgates. catalog-comparison.ts übersetzt ausschließlich
(ARRAY[enumartige varchar-Literale])::text[] in die entsprechende Elementcast-Form.
Nur constraints.definition und indexes.indexdef werden dafür auf Kopien betrachtet.
Keine Felder, Objekte oder Prüfungen entfernt; keine allgemeine Entfernung von Casts,
Whitespace, Operatoren, Quotes oder Reihenfolgen. Quoted Strings/Identifiers werden
nicht umgeschrieben; komplexere/escaped Formen bleiben strikt unverändert.

Regression aus allen acht gemessenen Definitionspaaren; negative Fälle für Werte,
Typen, Operatoren, Unique-Eigenschaft, Indexspalten, validated, Schema, Zusatzfelder,
NULL-Bedingungen, Literalreihenfolge, quoted/escaped Texte und die übrigen Snapshotgates.
Der gesamte heruntergeladene Ist-Katalog stimmt mit dem gesamten Manifestkatalog
nach exakt dieser Transformation überein. Rohdaten und Manifest bleiben unverändert.

- Operations-/Bridge-/Deployment-Scope-Regression: 65/65 erfolgreich.
- npm run typecheck: erfolgreich.
- ESLint der drei geänderten TypeScript-Dateien: erfolgreich, keine Warnungen.
- Keine neuen Dependencies; keine Anwendungs-, Schema-, Workflow- oder Bridgeänderung.
- Kein lokaler/entfernter erneuter Datenbankrestore für diese Diagnose ausgeführt.

## Nächster sicherer Schritt / Stopp

PR prüfen und vor Main-Integration Betreiberfreigabe abwarten.
**Nicht Run #19 erneut ausführen.** Ein einfacher Retry scheitert am nicht leeren Ziel.
Der Befund erfordert derzeit kein Löschen oder Neuprovisionieren: zuerst die noch
fehlende vollständige lesende Validierung des vorhandenen Zielzustands gegen dasselbe
unveränderte Backup mit dem korrigierten Validator vorbereiten. Der bestehende Workflow
kombiniert Schreiben und Validieren und ist hierfür nicht als Retry geeignet.
Eine spätere eigenständige Validierung muss dieselben Ziel-/Manifest-/OIDC- und
Reviewer-Gates bewahren; keine Fremd-Run-Pfadfreigabe stillschweigend erweitern.

R03 Backup/Restore geschlossen: Nein.
R04 Preview-/Production-Isolation: durch diese Diagnose nicht verändert.
AP9.4 vollständig abgenommen: Nein.

## Tabelleninventar (separater Read-only-COUNT-Vergleich)

| Tabelle | Backup | Ziel |
| --- | ---: | ---: |
| public._prisma_migrations | 42 | 42 |
| pubquiz.antworten | 256 | 256 |
| pubquiz.antworttyp | 7 | 7 |
| pubquiz.benutzer_rollenzuweisungen | 8 | 8 |
| pubquiz.eventreihe_benutzerrollen | 0 | 0 |
| pubquiz.eventreihen | 4 | 4 |
| pubquiz.frage_antwortfeld_loesungen | 38 | 38 |
| pubquiz.frage_antwortfelder | 45 | 45 |
| pubquiz.frage_story_elemente | 0 | 0 |
| pubquiz.frage_vorlage_antwortfelder | 10 | 10 |
| pubquiz.frage_vorlagen | 16 | 16 |
| pubquiz.fragen | 122 | 122 |
| pubquiz.fragen_eventreihen | 0 | 0 |
| pubquiz.fragen_kategorien | 124 | 124 |
| pubquiz.fragen_relationen | 4 | 4 |
| pubquiz.fragenkategorie | 56 | 56 |
| pubquiz.live_poll_responses | 10 | 10 |
| pubquiz.live_poll_revisions | 4 | 4 |
| pubquiz.live_polls | 3 | 3 |
| pubquiz.live_text_response_publications | 0 | 0 |
| pubquiz.medien | 100 | 100 |
| pubquiz.medien_generator_laefe | 13 | 13 |
| pubquiz.medien_generator_lauf_medien | 42 | 42 |
| pubquiz.medientyp | 3 | 3 |
| pubquiz.presentation_templates | 3 | 3 |
| pubquiz.public_question_rate_limits | 0 | 0 |
| pubquiz.public_question_submissions | 0 | 0 |
| pubquiz.public_text_replacement_rules | 1 | 1 |
| pubquiz.quiz | 5 | 5 |
| pubquiz.quiz_ablauf_elemente | 64 | 64 |
| pubquiz.quiz_abschnitte | 17 | 17 |
| pubquiz.quiz_block_freigaben | 6 | 6 |
| pubquiz.quiz_fragen | 53 | 53 |
| pubquiz.quiz_interaction_runs | 84 | 84 |
| pubquiz.quiz_praesentation_status | 4 | 4 |
| pubquiz.quiz_team_sessions | 20 | 20 |
| pubquiz.quiz_teams | 20 | 20 |
| pubquiz.story_element_revisionen | 0 | 0 |
| pubquiz.story_elemente | 0 | 0 |
| pubquiz.team_answer_submissions | 61 | 61 |
| pubquiz.team_antwort_auswahlen | 141 | 141 |
| pubquiz.team_antworten | 242 | 242 |
| pubquiz.team_antwortfelder | 52 | 52 |
| pubquiz.teams | 29 | 29 |
| pubquiz.users | 8 | 8 |
