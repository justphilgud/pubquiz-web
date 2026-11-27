# PR189 – exakter Production-Release ohne neues Backup

Freigabe vom 27.11.2026: „Ok, dann nehm es bitte ohne backup auf prod“.
Dies gilt als fachliche Abnahme sowie Merge-/Releasefreigabe für PR189. Die
Backup-Ausnahme ist ausdrücklich auf diesen Release begrenzt. Kein neues Backup
starten oder anfordern; kein historisches Backup als aktuell verifiziert ausgeben.
GitHub-Environment-Reviews, unveränderliche Commit-Paare und sämtliche übrigen
Schutzmaßnahmen bleiben erhalten.

## Exakte Eingaben

| Feld | Wert |
| --- | --- |
| Erwartete aktuelle Production-Basis | `3b8fc6f1f1427504e1191004ffc8e37e94410a2e` |
| Regulärer PR189-Merge / Releasekandidat | `e144cfc931c695423c28f20e1a3dd83409732c1c` |
| Fachlich freigegebener, vollständig grüner PR-Head | `44a7831925b9ec903171931f330bc3b7a8608861` |
| Migrationen vorher / nachher | 81 / 81 |
| Letzte Migration | `20261126120000_event_ceremony` |
| Manifest SHA256 | `85646ef7090288ee7f848dc32a289a9af7cf40a250cbc60d3569ff80e728e9a8` |
| Schema SHA256 vorher / nachher | `26cc4d670ef3c954731a14250b580c33667e51869c9edc176b238cbf7f6127b1` |
| Erwartetes SQL-/Schema-Delta | keines |
| Neues Backup | ausdrücklich nicht beauftragt / nicht erstellt |

Die letzte tatsächliche geschützte Anwendungsbereitstellung
`45967834350` war erfolgreich für `3b8fc6f1`. Der nachfolgende Operations-Lauf
`45969611801` für `2ca40b82` hatte keinen Anwendungsdeploy. Der neue geschützte
GET-only-Metadatenpreflight muss die tatsächlich aktuelle Basis selbst bestätigen;
ein früherer Lauf ersetzt das nicht.

## Architektur und technische Reviewkriterien

`BINGO_INTRO_PR189_NO_DELTA_PREFLIGHT_PLAN` ergänzt ausschließlich die bestehende
exakte No-Delta-Registry. Alle alten Paare, gepinnten Bytes und Fail-Closed-Prüfungen
bleiben unverändert. Keine Wildcards, keine abschaltbaren Gates und keine neue
ausführbare Kandidaten-SQL-Freigabe. Die vorhandene geheimnisfreie PostgreSQL17-
Safety-Matrix erhält nur die zusätzliche exakte Paarzeile.

Tests lesen beide unveränderlichen Git-Stände, vergleichen 81 Manifesteinträge
und das Prisma-Schema und prüfen die vollständige Abstammung. Der Mergebaum muss
identisch mit dem freigegebenen PR-Head sein. Falsche/vertauschte/verkürzte SHAs,
PR-Head statt Merge, fehlende/zusätzliche/doppelte/geänderte/umsortierte Dateien,
beidseitig gleich verfälschte Bytes, Schemaabweichung sowie unvollständige,
fehlgeschlagene oder abweichende Migrationshistorie bleiben gesperrt.

Operations-only Scope muss false bleiben; gemischter App-/Prisma-/Package-Scope
muss true bleiben. Der Live-Workflow bleibt main-only mit `production` und
`operations-backup`, read-only Datenbankreader, TLS und vorgeschriebenem Owner.
Ein No-Delta-PASS ist kein behaupteter neuer vollständiger Live-DDL-Abgleich;
der historische Bootstrap bleibt ausdrücklich NOT_RUN.

## Geschützter Ablauf

1. Diese separate Operationsregistrierung technisch prüfen, alle CI-/Safety-
   Checks abwarten und regulär integrieren. Auch die zugehörige main-CI abwarten.
   Anwendungsbytes dürfen gegenüber `e144cfc9` nicht abweichen.
2. Einen automatisch aus der grünen Kandidaten-main-CI erzeugten Deployment-Lauf
   vor dem Preflight nicht freigeben. Falls er ausschließlich auf Owner-Review
   wartet und noch keine Production-Schritte gestartet hat, genau diesen Lauf
   regulär abbrechen, um die gemeinsame Concurrency freizugeben. Niemals einen
   fremden oder bereits laufenden Deploy unbesehen abbrechen.
3. Bestehenden `production-read-only-preflight.yml` auf main mit genau
   `expected_production_sha=3b8fc6f1...` und
   `release_candidate_sha=e144cfc9...` starten. Die echte Environment-Freigabe
   bleibt beim vorgeschriebenen Owner; nicht selbst bestätigen.
4. Nur nach Gesamt-PASS fortsetzen: Projekt/Alias/SHA/READY korrekt; Readeridentität
   und READ ONLY bestätigt; alle 81 Migrationen eindeutig abgeschlossen und mit
   korrekten Prüfsummen, ohne pending/failed/drift. Bei Abweichung anhalten.
5. **Kein Backup-Schritt** gemäß ausdrücklicher Nutzerfreigabe. Unmittelbar vor
   Deployment Basis und gültigen Preflight erneut abgleichen. Den ursprünglichen
   Kandidatenlauf regulär wieder starten; dessen `workflow_run.head_sha` muss
   `e144cfc9...` bleiben. Erneute tatsächliche Owner-Freigabe abwarten. Keine
   direkte Vercel-Bereitstellung, keine manuelle SHA-Überschreibung und kein
   App-Deployment des Operations-Nachfolgers.
6. Bestehenden Deployment-Workflow unverändert ausführen lassen. Vorher/nachher
   81 aktuelle Migrationen und keine neue ausgeführte Migration erwarten. READY,
   Deployment-URL, Aliasse und authentifizierten Runtime-Commit prüfen. Ein HTTP200
   einer Vercel-Anmeldeseite ist kein funktionaler App-Smoke-Test.
7. Ausschließlich lesender Smoke: Bingoübersicht, kompakte Vorbereitung mit
   unabhängigen Folieneinfügungen, Moderationseingaben, Runden-/Deck-/Codeanzeige,
   bestehende Historie, Präsentationsfarben/Logos/letzte zehn Ziehungen. Nichts
   speichern, keine echte Ziehung, Korrektur, Prüfung, Entscheidung, Sortierung
   oder Runde erzeugen. Schreibende Fälle sind durch synthetische Tests belegt;
   reale Numpad-/Saalprojektorprüfung bleibt eine dokumentierte Grenze.

## Rückweg und Abbruch

Kein Schema-Delta macht den alten Anwendungsreader nicht kompatibel mit neuen
Journaleinträgen: `navigateRound`, `selectedRoundId` sowie `placement`/`insertions`
werden von älterem Code nicht verstanden. Nach neuen Schreibvorgängen kein blindes
Code-Rollback. Keine Journalumschreibung, Löschung, Datenreparatur, Downmigration
oder improvisierter Restore. Ein Rückweg müsste separat mit kompatiblem Reader
und tatsächlicher Datenlage geprüft werden. Es existiert für diesen Release
bewusst kein neues Vorab-Backup.

Bei CI-, Preflight-, Merge- oder Deploymentfehler anhalten und konkreten Befund
melden. Lauf-IDs, tatsächlich bestätigte Metadaten und Smoke-Ergebnisse werden
am Release-/Operations-PR dokumentiert; dieses Dokument behauptet kein bereits
erfolgtes Deployment.
