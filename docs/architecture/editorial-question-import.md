# Sicherer redaktioneller Fragenimport

## Finalisierung 9. Oktober 2026

Integrationsbranch `codex/editorial-units-integration` basiert ausschließlich auf
PR #95 / `c62047e80cf6e63ff2bc3e673384cd310195765c`, das die Inhalte von PR #93
/ `52b0729152a4e4d12947e1cee0961fe2293fc73a` bereits enthält. Veröffentlichung
als Fast-forward auf PR #95; kein Merge nach main, keine unabhängigen Änderungen.
PR #93 bleibt die unveränderte Originalquelle. Die bytegetreuen Originaldateien
und die verwendete Excel-Prüftabelle liegen unter `original-pr93/`.
`finalization-audit.json` dokumentiert sämtliche Änderungen und Prüfsummen.

16 Schätzfragetexte erhalten die fehlende Einheit, 26 Einheiten werden
ausgeschrieben/präzisiert. Alle 50 Referenzwerte, Quellen, Bezugsdaten und
Erläuterungen bleiben unverändert. Das bestehende strukturierte Einheitenfeld
wird wiederverwendet. Der Adapter speichert die klassische Lösungsantwort als
`Referenzwert Einheit`; numerische Eingabe und manuelle Bewertung bleiben im
bestehenden NUMBER-Vertrag, ohne Umrechnung. Die vorhandene Runtime stellt
den strukturierten Wert mit Einheit dar. Der Importvalidator prüft zusätzlich
die Einheit im Fragetext, Referenz-/Template-Konsistenz und maximal zwei Kategorien.

Die Excel-Prüftabelle ist anhand ID, Originaltext, Lösung, Anagramm, Kategorie,
Einheit und Quelle zu 100/100 Originalzeilen verifiziert. Die eindeutigen 48
Empfehlungen und 33 bisherigen konfliktfreien Zuordnungen werden gemäß
Master-Auftrag verwendet. Optionale Zweitkategorien werden nicht ergänzt.
Die 19 als unklar markierten Fälle bleiben gesperrt; zusätzlich bleibt ANA-25
wegen Personenüberschneidung gesperrt. ANA-49 gehört bereits zu den 19.
ANA-15 wird unabhängig von der Bestandsheuristik ausgeschlossen. Die
Sperrmetadaten dürfen Kandidaten nur zurückstellen oder ausschließen.
Sie können keine Validierung oder Dublettenentscheidung freigeben.
Es wird keine Kategorienhierarchie eingeführt. Für die vorbereiteten
eindeutigen Kandidaten sind ausschließlich vorhandene Kategorien vorgesehen.

Provider `Editorial:PR93` und sämtliche Import-IDs bleiben stabil. Geänderte
Payloads unter bereits importierter ID bleiben Konflikte; keine automatische
Aktualisierung. Die Prüfsummen-Allowlist in Server Action und READ ONLY-Skript
wird auf die dokumentierte Version aktualisiert. LF-Attribute verhindern
plattformabhängige Prüfsummen. Manifest v2 ergänzt Template, Kategorien,
Einheit, Referenzwert, Lösung, Quellen und Quelldateiprüfsummen pro Kandidat.
PostgreSQL-Tests prüfen diese Felder zusätzlich zum bestehenden Parallelitäts-,
Idempotenz-, Rollback- und Integritätsvertrag.

## Prüfung vor Schemaänderung

Das bestehende `fragen.schwierigkeitslevel` ist ein numerischer, aus Ergebnissen abgeleiteter Wert. Redaktionelle LEICHT/MITTEL/SCHWER dürfen ihn nicht ersetzen. Geplant ist ausschließlich `fragen.redaktionelle_schwierigkeit`, nullable Text mit CHECK für diese drei Werte. Keine Backfills, keine Umdeutung bestehender Werte, keine Änderung vorhandener Fragen. Ein zusätzliches nullable Feld ist kompatibel mit bestehenden Schreibern; alle bestehenden Zeilen erhalten NULL. Der CHECK wird erst NOT VALID angelegt und anschließend validiert. Der ALTER-Schritt benötigt einen kurzen Tabellenlock; Preview-Migration vor Deployment kontrolliert ausführen, Production bleibt ausgeschlossen. Rücknahme nur nach Prüfung neu importierter Inhalte, nicht durch Löschen anderer Daten.

Die vorhandenen `external_question_import_batches` und `external_question_import_items` werden als Importjournal wiederverwendet. Deren Unique-Key `(provider, external_reference)` sichert stabile Quelldatensatzkennungen. Kein zusätzlicher Import-Ledger. Checksummen, unveränderte Quellenpayloads, Entscheidungen und ID-Manifest werden in bestehenden JSON-/Reportfeldern gespeichert. Ein anderer Payload unter derselben Kennung ist ein Konflikt, kein Update.

## Verantwortlichkeiten

Die bestehende Importoberfläche behält Dateiauswahl und Benutzerinteraktion; Server Actions behalten die zentrale Administratorprüfung. Ein gemeinsamer redaktioneller Service unter dem vorhandenen Importmodul kapselt Normalisierung, vollständige Templatevalidierung, Kandidatenentscheidungen, Transaktion und Manifest. Bestehende Template-Parser, Antwortableitung, Dublettenheuristik und Berechtigungsregeln werden verwendet. Der OpenTDB-Pilot bleibt unverändert; seine Multiple-Choice-Annahmen dürfen diese Pools nicht verändern.

## Sicherheitsvertrag

Dry-Run verwendet eine REPEATABLE READ READ ONLY-Transaktion mit festem SQL und ohne Journal-/Entwurfsanlage. Unbekannte Templates, fehlende Kategorien und unklare Sachkonflikte sind MANUELL PRÜFEN beziehungsweise ÜBERSPRINGEN. Semantische Ähnlichkeit ist eine konservative Heuristik, keine fachliche Gleichheitsbehauptung. Für spätere Pools können explizite Messgrößen- und Zeitraum-Metadaten geliefert werden; ungeklärte bestehende Metadaten begründen niemals eine automatische Freigabe.

Der Writer ist Preview-only, prüft zusätzlich die verifizierte Datenbankidentität und Berechtigung, verwendet einen transaktionalen Advisory Lock und den vorhandenen Unique-Key. Er prüft den Zielbestand unmittelbar erneut. Ein veralteter Dry-Run darf nicht ungeprüft geschrieben werden. Neue Fragen bleiben DRAFT und freigegeben=false. Kein Bestandsupdate, kein Quizbezug. Bestandstabellen werden für die kurze Batchtransaktion gegen konkurrierende Schreibänderungen gesperrt, damit Integritätsvergleiche nicht durch fremde Writes verfälscht werden. Fehler einschließlich Integritätsabweichungen rollen den gesamten Batch samt Journal zurück.

Integritätsnachweise speichern ausschließlich aggregierte Zähler/Hashes, keine personenbezogenen Antwortinhalte. Vorhandene Fragen und zugehörige Metadaten, Quizzuordnungen, Teilnehmerantworten/Submissions und Bewertungen müssen unverändert bleiben. Erwartete neue Fragen, Antworten, Kategoriezuordnungen und Journalzeilen werden exakt gegen das Manifest geprüft. Bestehende Kategorien werden nur referenziert; fehlende Kategorien nicht automatisch erzeugt.

## Abnahmegrenzen

PR #93, Commit `52b0729152a4e4d12947e1cee0961fe2293fc73a`, bleibt unverändert. Nur Preview ist zum Schreiben freigegeben. Echte PostgreSQL-Tests müssen Parallelität, Wiederholung und Rollback prüfen. Ein übersprungener Integrationstest ist keine Abnahme. Preview-Dry-Run, Import und Browser-End-to-End folgen erst erfolgreicher CI und kontrollierter Bereitstellung. Production-Import/-Deployment und Merge sind ausgeschlossen.

Die manuelle Preview-Bereitstellung erlaubt zusätzlich ausschließlich den Importbranch codex/editorial-safe-import. Der reguläre Preview-Branch und sämtliche Production-Gates bleiben unverändert. Dispatch erst nach erfolgreicher CI des exakt zu deployenden SHAs. Die historische Basismigration enthält eine BOM und überlappt spätere Migrationen. Die isolierte PostgreSQL-CI baut daher eine leere Datenbank aus dem aktuellen Prisma-Modell ohne das neue Schwierigkeitsfeld auf und führt anschließend die echte additive Migration aus. Historische Dateien, Checksummen und persistente Datenbanken bleiben unverändert.

Der ausschließlich lesende GitHub-Workflow-Modus editorial_dry_run_only verwendet die bestehende Preview-Environment und nur deren DATABASE_URL. Er prüft zusätzlich die feste Preview-Identität, zwei genehmigte Quellprüfsummen und den festen READ ONLY-Modus. Er enthält keine Migration, keinen Writer-Aufruf und keinen Vercel-Zugriff. Das Ergebnis wird als JSON-Artefakt gespeichert; Zugangsdaten erscheinen darin nicht. Ein Operator ist nur für einen tatsächlichen Import verpflichtend, für diesen lesenden Zugang wird kein fiktiver Benutzer angelegt.

## Nachkontrolle importierter Inhalte

Der bestehende Preview-Nur-Lese-Workflow erzeugt zusätzlich
`editorial-integrity-audit.json`. Fest geprüfte Quelldateien werden gegen die
unveränderten Journalpayloads und gegen alle 79 importierten Fragen verglichen.
Pro Frage werden öffentliche redaktionelle Unterschiede und Reviewstatus
festgehalten. Die ursprünglichen 146 Fragen, Antworten und Kategoriezuordnungen
werden nach Ausschluss der Import-IDs gegen den ursprünglichen Batchnachweis
geprüft. Quiz-/Teamdaten erscheinen ausschließlich als aggregierte Hashes.
Dieser Kontrollpfad schreibt weder Fragen noch Journal-/Quizdaten und ist auf
den genehmigten Preview-Importbranch und die feste Preview-Datenbank begrenzt.

## Begrenzte Wiederherstellung der Preview-Testfragen

Der manuelle Modus `editorial_repair_test_questions` des bestehenden Preview-
Workflows ist ausschließlich für #154/ANA-01 und #207/EST-09 vorgesehen. Er ist
gegenseitig exklusiv mit Deployment und Nur-Lese-Modus, verlangt die bestehende
externe Branchfreigabe, erfolgreiche vollständige Push-CI des exakten SHAs,
die feste Preview-Datenbank und einen weiterhin aktiven Administrator als
ursprünglichen Importoperator. Keine neuen Secrets, Rollen oder Branchfreigaben.
Kein HTTP-Admin-Endpunkt und keine frei wählbaren IDs/SQL/Quelldateien.

Die einzige erlaubte Inhaltskorrektur ist die Rückkehr zur unveränderten
Konfiguration des geprüften Importjournals: Großschreibung von Anagramm und
Vorschlag bei #154 sowie materialisierte Pixel-Standardwerte bei beiden Fragen.
Jede andere Inhaltsabweichung oder Änderung an den übrigen 77 Fragen blockiert.
Beide Statusrücknahmen verwenden `transitionStoredQuestionStatus`, denselben
Persistenzpfad wie die berechtigte Editor-Server-Action. Kein vollständiges
Speichern und keine Neuberechnung. Der Pfad verändert `ist_unfertig` nicht.

Alle Änderungen laufen in einer SERIALIZABLE-Transaktion mit festen Tabellen-
locks und Zeitlimits. Alle 79 Quellen-/Journalprojektionen, der ursprüngliche
Fragenbestand und sämtliche anderen Fragen, Antworten, Kategoriezuordnungen,
Medien, Quiz-, Team-, Submission-, Bewertungs- und Journalhashes werden geprüft.
Die Zielzeilen dürfen außerhalb der ursprünglichen Konfiguration und der
Status-/Audit-Metadaten nicht abweichen. Jeder unerwartete Unterschied bewirkt
Rollback der gesamten Transaktion. Das Verfahren ist wiederholbar ohne erneute
Änderungen, wenn die beiden Fragen bereits korrekt und DRAFT sind.

Echte PostgreSQL-CI prüft die 79-Fragen-Wiederherstellung, identische Quellen,
Status DRAFT für alle 79, erhaltene Testantworten/manuelle Punkte, Idempotenz und
Rollback bei einem absichtlich Bewertungen verändernden Datenbanktrigger.
Der Nachweis enthält nur redaktionelle Unterschiede und aggregierte Hashes;
keine Credentials oder Teilnehmerantwortinhalte.

## Production-Vorbereitung (9. Oktober 2026)
Der bestehende redaktionelle Importkern erhält ausschließlich eine zusätzliche,
workflowgebundene READ ONLY Production-Capability. `productionPreflight=true`
verlangt den fest geprüften Production-Endpoint und TLS/Channelbinding, den
bestehenden Preflightworkflow auf main, operations-backup und dessen bestätigten
Production-SHA. Die Session muss pubquiz_backup_reader sein. Preview-Serveraction
und Preview-Guards bleiben unverändert; Production-Schreiben wird unabhängig von
übergebenen Parametern vor dem Verbindungsaufbau zurückgewiesen.

Die unveränderlichen Quellen werden erneut gehasht und geparst. Die versionierte
production-allowlist.json enthält exakt die 79 auf Preview abgenommenen externen
IDs (45 Anagramme, 34 Schätzfragen); Quellenpayload, Reihenfolge und Fingerprints
werden überprüft. Die übrigen 20 Kandidaten und die Dublette gelangen nicht in
den Production-Auftrag. Keine Preview-Frage-IDs werden übernommen.

Im vorhandenen external-question-import-preflight.yml wählt editorial_pr95 den
festen redaktionellen Nur-Lese-Job. Der bisherige externe Planpfad bleibt getrennt;
sein bestehender Materialisierungsguard verlangt weiterhin gültige Eingaben.
Der neue Job verwendet nur das bereits vorhandene Leser-Credential. Kein neuer
Secretzugang, keine Branchfreigabe, keine Migration oder Writerumgebung. Er liest
_prisma_migrations und Difficulty-Spalte/Constraint im selben Nur-Lese-Snapshot
wie Dubletten-/Kategorie-/Bestandsinventur. Pending/failed Migrationen sowie rohe
Schema-Metadaten werden zur manuellen Prüfung dokumentiert, nie automatisch
angewendet. Ausgabe enthält Zähler und Integritätsdigests, keine Credentials.

Aktuell ist operations-backup auf main beschränkt. Ein offener PR kann diesen
neuen Job daher nicht real gegen Production abnehmen. Diese Grenze darf nicht
für die Vorbereitung erweitert werden. Fehlende SELECT-Rechte blockieren, statt
ACLs automatisch zu ändern. Production-Schreibfreigabe ist weiterhin ein eigenes
Gate: vor deren Implementierung müssen aktueller Live-Dry-Run, Backup/Restore,
exakte Reviewer-/Digestbindung und tatsächliche Writerrechte geprüft sein.
Der bestehende generische Productionwriter wird nicht mit diesem abweichenden
redaktionellen Payloadvertrag gestartet. Es gibt keine zweite Importlogik.

Tests: gefrorene Allowlist/Payloads, Ausschlüsse, sämtliche Workflowkontext-Gates,
Productionwrite-Abweisung vor Netzwerkzugriff, unveränderte Previewgrenze; reale
PostgreSQL-Nur-Lese-Inventur aller 79 mit unveränderter Baseline und Migrations-
metadaten. Bestehende Transaktions-/Idempotenz-/Rollback-/Status-Regressionssuite
bleibt aktiv.

Production-Prismahistorie liegt nach dem autorisierten Production-Preflight
explizit in public._prisma_migrations. Der redaktionelle Nur-Lese-Adapter liest
ausschliesslich diese feste Relation; kein search_path-/Namens-Fallback. Ein
PostgreSQL-Regressionstest mit irrefuehrender pubquiz-Namensrelation stellt
sicher, dass diese nicht verwendet wird. Keine Schema- oder ACL-Aenderung.

## Production-Freigabepfad (gezielte Erweiterung nach PR #95)

Der historische Preview-only-Vertrag bleibt fuer UI-Aktionen bestehen.
Ein zusaetzlicher Workflow-only-Pfad nutzt denselben Importkern und die
bestehende operations-content-import-Environment. Der aktuelle Vertrag,
Einmalfreigabe, Digestbindung, SERIALIZABLE-Begruendung, Rechtegrenzen und
Testnachweise sind in docs/operations/editorial-production-write.md beschrieben.
Die Bereitstellung ist keine Schreibfreigabe; dry_run bleibt Standard.
