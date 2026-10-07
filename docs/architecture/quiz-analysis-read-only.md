# Rein lesende Quiz- und Fragenanalyse

Die redaktionelle Planung und Variety-Berechnung benötigen den vollständigen Bestand einschließlich Entwürfen, Review-Status und archivierten Fragen. Die Content-Oberfläche begrenzt Ergebnisse auf 50 Fragen. Bestehende Quizdetailabfragen können außerdem gespeicherte Antwortreihenfolgen reparieren. Diese Lesewege werden für die Bestandsanalyse nicht verwendet.

## Verantwortlichkeiten

- `app/quiz/analysis/quizAnalysisReader.ts`: vollständige Datenprojektion in einer dedizierten PostgreSQL-Verbindung, `REPEATABLE READ READ ONLY`, abschließendes `ROLLBACK`. Der Datenbankzustand `transaction_read_only=on` wird vor dem ersten Inhaltszugriff geprüft.
- `app/quiz/analysis/quizAnalysis.server.ts`: interne Servergrenze. Der vollständige, unveröffentlichte Bestand erfordert die bestehende Adminberechtigung. Keine öffentliche Route und keine Teilnehmerprojektion.
- `app/quiz/analysis/questionInventory.ts`: reine Aggregation von Statusmatrix, Vorlagen, Kategorien, Medienbesitz, Verwendung, Eventreihenbindung und Metadatenabdeckung.
- `scripts/export-quiz-analysis.ts`: expliziter lokaler Export. Erfordert eine separat bereitgestellte Verbindung und den erwarteten Datenbankhost; gibt keine Verbindung oder Zugangsdaten aus.

Bestehende UI, Quizverwaltung, Berechtigungsregeln, Runtime und Reparaturfunktionen bleiben unverändert. Lösungen und kanonische Vorlagen verwenden die vorhandenen reinen Template-Helfer.

## Datenumfang

Die Frageprojektion erhält vollständigen Fragetext, Quelle, getrennten Review-/Freigabe-/Archivstatus, Unfertigstatus, gespeicherte und dynamische Quellvorlage, kanonische Basis, Kategorien mit Status, Antwortoptionen, akzeptierte Antwortfeldlösungen, strukturierte Template-Konfiguration und vorhandene Schwierigkeits-/Gültigkeitsdaten. Die Lösung wird zusätzlich durch das vorhandene Runtime-Modell aufgelöst.

Medien behalten Datei, Typ, Besitzer (Frage/Antwort/Antwortfeld), Slot und Sortierung. Ein Frage-Slot kann ein Generator-Eingang oder Sponsorlogo sein: Medienbesitz allein behauptet keine tatsächliche Sichtbarkeit während der Frage. Eine spätere Erlebnisprojektion muss den vorhandenen Präsentationsvertrag berücksichtigen.

Quizzuordnungen behalten IDs, Abschnitt, gespeicherte Position und unveränderte Antwortreihenfolge. Auch Zuordnungen archivierter Quizze bleiben enthalten. Frageverwendungen sind pro Frage verfügbar und lassen sich mit den Quizabschnitten verbinden. Es werden keine Teams, Teilnehmerantworten, Sitzungen, Runs oder Präsentationszustände geladen.

Vorlagen-Aliase werden durch den bestehenden Registry-Helfer aufgelöst. `multiple_choice` zählt in der Analyse zur Standardfamilie. Individuelle dynamische Vorlagen verwenden ihre Basismethode; ihre ursprüngliche Identität bleibt im Export erhalten.

## Ausführung und Tests

`npm run test:quiz-analysis` läuft auch innerhalb des normalen `npm test`. Ohne explizite Testdatenbank wird der Datenbank-Integrationstest übersprungen. Die übrigen Tests laufen vollständig offline.

Für einen Export werden `ANALYSIS_DATABASE_URL` und `ANALYSIS_EXPECTED_DATABASE_HOST` über eine geeignete geschützte Umgebung bereitgestellt:

```sh
node --import tsx scripts/export-quiz-analysis.ts /absolute/local/output/snapshot.json
```

Der Export schreibt ausschließlich lokale Dateien: Snapshot und `snapshot.json.inventory.json`. Rohdatenexports gehören nicht in Git oder einen öffentlichen PR. Der Aufruf benötigt keine Migration und führt keine Production-Schreiboperation durch. Das SQL verwendet das bestehende Schema `pubquiz`.

Der Integrationstest erhält ausschließlich eine Development-Verbindung in `QUIZ_ANALYSIS_TEST_DATABASE_URL`. Er verweigert den bekannten Production-Host. Vor und nach dem Analyseaufruf vergleicht er Prüfsummen von Fragen, Quizzen und Zuordnungen sowie Runtime-Zähler. Eine `UPDATE ... WHERE FALSE`-Probe innerhalb einer Read-only-Transaktion muss PostgreSQL mit `25006` zurückweisen; sie verändert keine Daten. Der Analyseaufruf selbst führt ausschließlich SELECTs aus.

## Verifizierter Zwischenstand am 7. Oktober 2026

- Development: vollständiger Export von 121 Fragen, 5 Quizzen und 17 Datenbankvorlagen; Integritätsprüfung bestanden.
- Production-Oberfläche: 1.286 Fragen insgesamt und 719 im Filter „Aktiv / freigegeben“ erneut bestätigt. Diese Zahl ist nicht gleichbedeutend mit vollständiger Zuordnungsfähigkeit.
- Zielquizze weiterhin Paule II #30 (13.10.2026, 19 Uhr) und Oktober #31 (21.10.2026, 19 Uhr).
- Vollständiger Production-Export nicht ausgeführt. Der ausdrücklich autorisierte Einzelvariablen-Abruf über den regulären Vercel-Endpunkt bestätigte DATABASE_URL als Sensitive, lieferte aber keinen entschlüsselten Wert. Keine Production-Datenbankverbindung wurde aufgebaut. Weitere Entschlüsselungsversuche sind auf Nutzeranweisung ausgeschlossen. Ein früherer breiter Zugriff wurde von der automatischen Freigabeprüfung abgelehnt und entfernt.

Development-Daten dürfen nicht als Production-Inventar behandelt werden. Eine vollständige aktuelle Production-Statusmatrix, erneute Poolprüfung, Kandidatenpaarung und exakte Content-Gaps setzen den vollständigen Read-only-Export voraus.

## Nachfolgende Arbeitspakete

Das verbindliche Ziel ist 20 + 20 Fragen je Quiz, getrennte Inhalte und gleiche Slotstruktur. V1-Gewichte: Themenbreite 20, Themenbalance 20, Template-Breite 15, Template-Balance 10, Medien/Interaktion 20, Blockbalance/Formatwechsel 15. Zeit und Geografie gehören nicht zum V1-Score.

Auf ausdrückliche Folgeanweisung werden 40-Slot-Gerüst, 50 Anagramme, 50 recherchierte Schätzfragen und reine Variety-Berechnung unabhängig vom blockierten Production-Inventar vorbereitet. Bestehende Kandidaten und Gaps bleiben vorläufig. Für „Übersetzt vorgelesen“ wird kein Content generiert. Keine finale Quizzuordnung, fachliche Freigabe, automatische Rekategorisierung oder Production-Umbenennung.

Oberkategorien, Konfiguration, reine Score-Domainfunktion und UI bleiben getrennte PRs. Geplante Vererbung: kein Override verwendet den aktuellen Eventreihenstandard; ein Override ersetzt ihn vollständig. Kopieren erhält explizite Overrides, sonst den Standard der Zielreihe. Historische Konfigurations-/Score-Snapshots werden für V1 nicht erzwungen; spätere Versionierung muss ergänzbar bleiben.

## Abschluss PR #92

CI am 7. Oktober 2026: Prisma, TypeScript, vollständige Tests, Changed-file ESLint und Build bestanden. Acht Offline-Projektionstests bestanden; Development-Integration zuvor bestanden. PR bleibt offen, kein Merge/Deployment.

Alternativer bestehender Export: `exportFragenFuerTransfer` in `app/fragen/actions.ts` ist adminberechtigt und liest Inhalte mit findMany, erzwingt aber keine READ-ONLY-Transaktion. Er erhält weder IDs/Review-/Archivstatus noch Medien, alle Kategorien, Eventreihenbindung oder Quizzuordnungen. Er ist deshalb kein Ersatz für die freigegebene vollständige Projektion. Es wird kein neuer Production-Endpunkt bereitgestellt und kein alternativer Datenbankzugang versucht.
