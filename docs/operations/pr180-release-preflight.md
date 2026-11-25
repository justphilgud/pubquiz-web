# PR180 – exakter Releaseplan und Musik-Bingo-Endabnahme

Stand: 25.11.2026. Separater Operations-PR zur Vorbereitung, **kein Merge und keine
Production-Operation**. Die allgemeine Releasefreigabe ersetzt weder Planreview
noch GitHub-Environment-Review. PR180 bleibt unverändert.

## Unveränderliche Eingaben

| Feld | Wert |
| --- | --- |
| Erwartete Production-Basis | `8f049b8182cf498079d7ad26aec3fc64dcf842d7` |
| PR180-Kandidat | `72ea417c4857fedc3d1e59b443ddff5298c8665f` |
| Alte/neue Migrationsanzahl | 79 / 80 |
| Baseline-Manifest SHA256 | `8af6aff9799497bf6415f2e235bf5f74e7d2807c449d0872761d5e70fc0adb35` |
| Baseline-Schema SHA256 | `c285d05ddb25bebba4314e74afd075f480462b816fb3ba0da468780e515727f8` |
| Kandidaten-Schema SHA256 | `53ce29a7a086bca7d22e9b46657b1b112190cf03404942a53093e85ffc5e484d` |
| Einziges Delta | `20261125120000_bingo_round_content` |
| SQL SHA256 | `c3fc878b7c90f764a2a23603414e4e292ce338fbd69f93e1a2f4a11988017b9a` |

Basis und Kandidat stammen aus Git, nicht aus einem produktiven Katalog. Die Basis
ist hier ein erwarteter Wert; aktuelle Aliasse und tatsächlicher Production-SHA
müssen im frischen geschützten Live-Preflight erneut bestätigt werden.

## Architektur und Schutzgrenzen

Die bestehende Bingo-Planregistry vermittelt weiterhin Paarvergleich,
Manifestprüfung, erwartete Pending-Migrationen und Deltabelege. Der neue Plan
erweitert genau dieses Muster. Der isolierte Builder ruft einen eigenen engen
Deltatest auf. Keine Anwendungskomponente, Production-Verbindung, Rolle, Freigabe,
Deploymentpolicy oder Backup-Schutzregel wird verändert.

`production-preflight-bingo-bell-plan.ts` bindet alle alten SQL-Bytes und beide
Schemas. Fehlende, zusätzliche, doppelte, umsortierte oder geänderte Dateien,
vertauschte/verkürzte SHAs und beidseitig gleich verfälschte Manifestdaten werden
abgewiesen. Ein anderer Kandidat erfordert eine erneute Planprüfung.

`production-preflight-bingo-bell-delta.ts` läuft ausschließlich im vom bisherigen
Builder erzeugten isolierten PostgreSQL. Die Referenz ist wie bisher unabhängiges
Prehistory-DDL plus sämtliche versionierten Inkremente, kein aus Production
abgeleitetes Sollschema. Eine getrennt formulierte DDL-Referenz beschreibt die
drei neuen Tabellen einschließlich Defaultwerten, Constraints, Index und
restriktiven Fremdschlüsseln. Der **vollständige** Katalog nach dem Delta muss
dieser Referenz entsprechen; keine pauschale Ausblendung neuer Objekte.

Eine befüllte Basis enthält Abend, Runde, Karte, Layout/Code, Live-Lauf und Journal.
Sämtliche alten Tabellenzeilen werden vor/nach Migration und Constraintproben
verglichen. Neue Tabellen müssen zunächst leer sein. Gültige neue Daten werden in
zurückgerollten Proben akzeptiert; ungültige Bereiche/JSON, Fremdabendreferenzen
und abhängige Löschungen abgewiesen. Die Rollback-Probe erhält Schema und alte
Zeilen. Lockbudget 2 s und Statementbudget 30 s sind Testgrenzen, keine Zusage zur
Production-Dauer. Keine Reparatur, Backfills oder Historienlöschung.

Der historische lineare Neuinstallationsfehler bei
`20260713130000_add_question_draft_fields` bleibt separat FAIL /
`HISTORICAL_BASELINE_OVERLAP`; er wird nicht als erfolgreiche Neuinstallation
ausgegeben. Die vollständige aktuelle Historien- und Schemaprüfung bleibt nötig.

## Musik-Bingo-Endabnahme am unveränderten Kandidaten

Technische Endabnahme der Korrekturverträge abgeschlossen; keine Prüfung echter
Eventdaten und keine erneute Behauptung einer subjektiven Hör-/Beamerabnahme.

| Nachweis | Ergebnis |
| --- | --- |
| Immutable Kandidatenquellen | Test lädt Eventruntime, Kartenprüfung und Matching-Projektion direkt aus dem exakten Git-Commit; nicht aus Operations-HEAD |
| 12 Fälle | TEXT/AUDIO/IMAGE/VIDEO × DIRECT/APPROVAL/HIDDEN bestanden |
| Frühere Ziehung | Position 1 wird von B 1 auf O 75 korrigiert; ID und Position bleiben, spätere Ziehungen 16/31/46/61 bleiben unverändert |
| Neue Zuordnung | Text „Prepared content 75“ bzw. Medium mit neuer Asset-ID; nach expliziter Auflösung „Answer 75“; HIDDEN bleibt vorher verdeckt |
| Unveränderter Satz | Vorbereitete Einträge vor/nach allen Befehlen bytegleich; kein Umschreiben der Zahl-zu-Inhalt-Zuordnung |
| Karten und Historie | Alter Nachweis behält eine Linie; korrigierte Neuberechnung und neue Prüfung ergeben null Linien; Korrekturgrund bleibt im Audit |
| Konflikt | Bereits gezogene 16 wird abgewiesen, Zustand unverändert |
| Aktuelle Medienkorrektur | Alte Cue entfernt; neue Audio-/Video-Asset-ID; expliziter Neustart beginnt bei Position 0 |
| Tatsächliches Formular | Chromium gegen Kandidatenkomponente: frühere Ziehung, ungültige Werte, Dublette, Abbrechen ohne Befehl, Vorschau B 1 → O 75 und genau ein korrekter Speicherbefehl bestanden |
| Tatsächlicher Medienplayer | Bestehender Chromium-Test: Aktivierung, stabiles Polling, Pause/Replay, Offline/Reload, Quellwechsel stoppt alten Ton und startet neuen nicht automatisch; bestanden |

Die zwölf Domain-/Projektionsfälle verwenden einen begrenzten In-Memory-Adapter
für die parametrisierte Zuordnungsabfrage. Sie sind kein neuer Datenbank- oder
HTTP-End-to-End-Lauf. Frühere echte PostgreSQL- und Browsernachweise einschließlich
Medienerhalt, Korrektur, CAS und Rechte bleiben im
[PR180-Prüfbericht](../acceptance/bingo-bell-2026-11-25.md) dokumentiert. Der separate
Player-Test prüft bytegleiche Kandidatenquellen. Historische Korrektur ersetzt
keine aktuell spätere Ziehung und spielt frühere Medien nicht unaufgefordert ab.

## Tests und tatsächliche Grenzen

- Plan-/Manifest-/Evidenz- und Operations-Scope-Regressionen lokal bestanden.
- Neuer Deltatest lokal in einer frisch erzeugten PostgreSQL-18-Datenbank auf
  `127.0.0.1:55473` bestanden; Produktionsmajor wird dadurch nicht behauptet.
  CI ergänzt die exakte Paarzeile unter PostgreSQL17 mit Netzwerkisolation.
- Musikfälle und Chromium-Formular-/Playerprüfung lokal bestanden.
- Typecheck und ESLint werden am endgültigen Operations-Stand geprüft; endgültige
  CI-Läufe und Ergebnisse stehen im Operations-PR. Kein lokales Ergebnis ersetzt CI.
- Kein Live-Preflight, neues Production-Backup, Restore, Merge, Migration oder
  Deployment Bestandteil dieser Vorbereitung. Keine produktiven Testdaten.

## Sichere spätere Releasefolge und Rückweg

1. Operations-PR separat technisch prüfen, vollständige CI abwarten und nur mit
   entsprechender Freigabe regulär mergen. Operations-Scope muss Anwendungsdeploy
   ausschließen; gemischte App-/Prismaänderungen bleiben deploypflichtig.
2. PR180-Kandidat und Production-Aliasse erneut bestätigen; geschützten main-only
   Read-only-Preflight für genau dieses Paar starten. Erforderliche Owner-Reviews
   nicht selbst ersetzen. Nur vollständiges PASS gilt als Erfolg.
3. Danach frisches AP9.4-Backup (`acceptance`, `pre-deployment`, geschützt,
   `restore_after_backup=false`) einschließlich Datenbank und referenzierter Medien;
   Manifest, privates Readback, Hashes und Integrität verifizieren.
4. Erst dann PR180 regulär mergen, main-CI für genau den Merge-Commit prüfen,
   vorhandenen geschützten Migrations-/Deploymentworkflow mit Owner-Review nutzen.
5. Migrationstatus, READY, Laufzeit-SHA, alle Production-Aliasse und nur lesende
   Smoke-Tests prüfen. Keine Karten, Ziehungen, Rufe oder Bewertungen in Events schreiben.

Eine bloße Rücknahme der drei Tabellen ist **kein** erlaubter Rückweg: Nach neuen
Prüfbefehlen versteht alter Code die Journale nicht. Ein Roll-forward bzw.
kompatibler Reader benötigt gesonderte Prüfung; keine Downmigration oder
Historienlöschung. Bei Fehlern anhalten und verifiziertes Backup bewahren.
