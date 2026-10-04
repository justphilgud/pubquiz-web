# Fakten-Templates: vorbereiteter Production-Release

Stand: 4. Oktober 2026. Nur Vorbereitung: kein Merge, kein Production-Deployment, keine Production-Testdaten und keine Bereinigung ausgeführt. Vor jeder Ausführung ist die ausdrückliche Betreiberfreigabe erforderlich.

## Scope und Revisionen

Release-Basis: main `e6faf92eee0465808bfbcaa5ddfe08cc1b45a066`.
Abgenommene Preview: `2aa63e9157321f88927ac69b3e1f906b83aa63ff`.
Release-Branch: `codex/facts-production-release`.

Die Preview ist kein identischer Release-Tree: ein direkter Vergleich zu main enthält 61 Dateien und Rücknahmen älterer Meme-/Präsentationsänderungen. Deshalb wurden ausschließlich die fünf Fakten-Commits 1d457ed, 7f5a3d6, f46c342, 729ffab und a6ad024 auf main übernommen. Der Testskript-Konflikt wurde zugunsten aller main-Tests gelöst, ergänzt um Fakten- und Lösungsvorschau-Tests. Gemeinsame Präsentation und deutsche Texte behalten die neueren main-Änderungen. Die 34 fachlichen Änderungsdateien entsprechen dem Fakten-Scope; dieses Runbook kommt als Release-Dokumentation hinzu.

Enthalten: drei Fakten-Templates mit 2–7 Fakten, maximal 300 Zeichen/Fakt; Jahr 1–9999; Land als stabiler ISO-2-Code aus 193 UN-Mitgliedstaaten; freie Antwort mit akzeptierten Varianten oder optionaler Einfachauswahl; gemeinsamer Editor, Präsentation, Antwortvertrag und Bewertung; wiederverwendbare CountrySelect-Komponente.

Ausgeschlossen: Flaggen-/Länderumriss-Anbindung, Hydration-Fix, andere offene PRs, Schema-Refactoring, Dependencies, generierte Prisma-Dateien und Importplan-Dateien. Bestehende lokale/uncommittierte Dateien in den bisherigen Checkouts bleiben unangetastet. Tests laufen in einem neuen isolierten Checkout; dessen generierte Dateien werden ebenfalls nicht committed oder bereinigt.

## Release-Gates und Ausführung nach Freigabe

1. PR-Diff gegen main prüfen; nur die Fakten-Dateien und dieses Runbook zulassen. Aktuelle main-Basis erneut vergleichen. Bei Drift neu prüfen; kein Auto-Merge einrichten.
2. Blocking CI auf dem exakten PR-Head: Prisma generate/validate, Typecheck, vollständiges npm test, striktes CI-Skript-Lint, Changed-file ESLint und Build. Repository-weites Lint ist im bestehenden Prozess ausdrücklich informational und enthält Altlasten.
3. Lokale Windows-Prüfung: Typecheck erfolgreich. Der vollständige Testlauf reproduziert den vorhandenen Importplan-Bytehashfehler durch CRLF (erwartet 971fab02…, tatsächlich f9ef725b…). Importplan nicht verändern. Linux-CI muss diesen Test unverändert bestehen. Übrige lokale Gates werden separat protokolliert.
4. Der Release-Tree ist nicht exakt die alte Preview. Die Fakten-Dateien sind inhaltlich übertragen, doch main hat neuere gemeinsame Renderer. Vor Production-Freigabe den exakten PR-Head im Preview prüfen; die alte Preview-Abnahme ersetzt diese Integrationsprüfung nicht. Kein Production-Smoke vor Deployment durchführen.
5. Aktuellen Production-SHA und unveränderliche Deployment-URL unmittelbar vor dem Release erneut verifizieren. Ein geschütztes pre-deployment-Backup erstellen und auf Erfolg/Manifest/privaten Readback prüfen. Bei Fehler stoppen.
6. Nach ausdrücklicher Freigabe Draft-PR bereitstellen/mergen, ohne die Diff-Basis zu erweitern. Der tatsächlich erzeugte Merge-SHA entsteht erst beim Merge und wird erneut von main-CI geprüft. Kein ungeprüfter SHA wird deployt.
7. Deploy Production wird durch erfolgreichen main-Push-CI gestartet und wartet im GitHub-Environment production auf Required Reviewer. Das Environment ist verifiziert geschützt; main selbst besitzt aktuell keine klassische Branch Protection und keine Rulesets. Daher zusätzlich organisatorisch nur den überprüften PR mergen. Workflow nicht vorzeitig dispatchen oder selbst freigeben.
8. Nach Freigabe: Production-Datenbankidentität prüfen, Migrationstatus vorher, committed Migrationen deployen, Status nachher, Vercel Production-Deployment und HTTP-Smoke. Danach den unten beschriebenen Browser-Smoke ausführen. Das vorhandene HTTP-Smoke prüft allein Erreichbarkeit und reicht für die fachliche Abnahme nicht aus.
9. Bei Erfolg Production-SHA im operations-backup-Environment aktualisieren, Release-Nachweise ablegen. Keine Backup-/Retention-Schalter verändern.

## Migration und Datenwirkung

Einzige neue Migration gegenüber main: `20261004120000_add_facts_question_templates/migration.sql`.

Sie führt ausschließlich INSERT in pubquiz.frage_vorlagen aus: fakten_jahr, fakten_land, fakten_frei, jeweils slide_typ=facts; ON CONFLICT(code) DO NOTHING. Keine UPDATE/DELETE/TRUNCATE/ALTER-Anweisung, keine Datenkonvertierung, keine Änderung an prisma/schema.prisma. Normalfall: drei neue Katalogzeilen plus Prisma-Migrationshistorie. Bei einem bereits vorhandenen Code wird dessen Datensatz nicht verändert; daher vorher Codes und nachher Werte read-only kontrollieren und bei inkompatibler Vorbelegung stoppen.

Bestehende Quizze, Fragen, Antwortoptionen, Team-Drafts, Submissions und Bewertungen werden durch das SQL nicht verändert. Neue Faktenfragen nutzen template_config_json und bestehende Antworttabellen. Jahr/Land bekommen nur bei den neuen Template-IDs exakte 1/0-Bewertung; freie Antwort nutzt den vorhandenen normalisierten Vergleich/manuellen Fallback bzw. Einfachauswahl. Das Anwendungs-Release berührt gemeinsame Resolver und Renderer, daher sind Regressionstests erforderlich.

Der reale aktuelle Production-Migrationsstatus wurde in dieser Vorbereitung nicht über eine Production-Datenbanksitzung abgefragt. Direkt vor Freigabe muss der bestehende Workflow-Statuscheck genau diese neue Migration als erwartetes Delta bestätigen; weitere unerwartete offene Migrationen sind ein Stop-Grund. Es wurde keine Migration ausgeführt.

## Backup und Rollback

Letztes erfolgreiches Production-Deployment: Workflow 37043977026, SHA e6faf92eee0465808bfbcaa5ddfe08cc1b45a066, unveränderlich https://pubquiz-nm2itbivt-just-phil-gud.vercel.app, Alias https://pubquiz-web.vercel.app.

Verifiziertes vollständiges Backup vom 4. Oktober: Workflow 37189737047, Backupstep erfolgreich, Restore übersprungen. Aktuelle Live-Schalter: BACKUP_AUTOMATION_ENABLED=true, BACKUP_RETENTION_VERIFIED=false; PRODUCTION_RELEASE_SHA entspricht e6faf92…. Die ältere Runbook-Aussage über deaktivierten Schedule ist überholt; Retention bleibt ohne Löschfreigabe deaktiviert.

Nach Release-Freigabe, vor Migration, den vorhandenen AP9.4-Workflow auf main mit mode=acceptance, production_commit=<erneut verifizierter aktueller Production-SHA>, backup_type=pre-deployment, protect_backup=true, restore_after_backup=false starten. Backupkennung und Manifest-SHA aufzeichnen, vollständigen Erfolg inklusive Hashes, Medien und privatem Readback verlangen. Kein Restore und keine Retention-Aktivierung. Authentifizierungswerte sind vom Backup ausgeschlossen.

Anwendungs-Rollback: explizite Freigabe einholen, das zuvor verifizierte unveränderliche Production-Deployment im selben Vercel-Projekt zurückschalten. Vorbereiteter Befehl (nicht ausgeführt): `npx vercel@56.3.2 rollback https://pubquiz-nm2itbivt-just-phil-gud.vercel.app --scope just-phil-gud`. Danach Alias, Erreichbarkeit und bestehenden Standardquiz-Leseweg prüfen. [Vercel-Rollback-Dokumentation](https://vercel.com/docs/cli/rollback). Nach einem Rollback Domain-Zuweisungszustand vor einem späteren Promote überprüfen. Credentials ausschließlich über bestehende geschützte Operator-Umgebung, nicht im Report.

Die additive Migration bleibt bei einem App-Rollback bestehen; keine automatische Down-Migration, kein Löschen der Template-Zeilen oder der Migrationshistorie. Vor Rollback neue Fakten-Nutzung stoppen: die alte Anwendung unterstützt bereits angelegte Faktenfragen nicht vollständig. Diese Daten erhalten und später mit repariertem Release weiterverwenden.

DB-Notfall: bestehenden manuellen, Required-Reviewer-geschützten operations-restore-Pfad für ein leeres isoliertes Restore-Ziel verwenden und read-only nachvalidieren. Er ist ausdrücklich KEIN direkter Production-Restore. Datenverlustfall erfordert getrennt freigegebenes Recovery-/Cutover-Vorgehen; ein blindes Restore über laufende Production würde spätere Antworten verlieren und ist hier nicht vorbereitet oder autorisiert.

## Kleiner Production-Smoke: geplante Datensätze

Noch nichts angelegt. Einmalige Kennung: `TEST-FAKTEN-RELEASE-20261004-<erste8Zeichen-des-freigegebenen-Release-SHA>`. Vor Anlage auf Namens-/Slug-Kollision prüfen, bei Kollision stoppen. Alle erzeugten numerischen IDs sofort in einem Smoke-Manifest festhalten; keine Löschung nach Namenspräfix allein.

- 1 neue nicht öffentliche Eventreihe mit exakt dieser Kennung und Slug test-fakten-release-20261004-<sha8>. Keine bestehende Eventreihe bearbeiten; keine Benutzer oder Rollen anlegen.
- 1 neues Quiz in dieser Eventreihe, Titel Kennung, Datum des freigegebenen Smoke, kein öffentlicher Link, keine Medien, Standard-Präsentation. Automatisch 3 Abschnitte: Intro, Block 1, Outro. Alle Testfragen ausschließlich Block 1 zuordnen.
- 3 neue EVENT_SERIES-Fragen, ausschließlich dieser neuen Eventreihe zugeordnet (3 fragen_eventreihen-Zeilen), Quelle/Notiz enthält Kennung. Keine Kategorien, Relationen, Uploads oder Generatorläufe. Falls Rechte/Freigabe erforderlich sind, ausschließlich diese drei neuen Fragen freigeben.
- Jahr: Fragetext Kennung + Jahr; Fakten „Der Eurotunnel wird eröffnet.“ und „Nelson Mandela wird Präsident Südafrikas.“; Lösung 1994.
- Land: Fragetext Kennung + Land; Fakten „Die Bundesstadt heißt Bern.“ und „Die Währung heißt Schweizer Franken.“; Lösung CH, Anzeigename Schweiz.
- Freie Antwort: Fragetext Kennung + freie Antwort; Fakten „Diese Person entwickelte die spezielle Relativitätstheorie.“ und „Diese Person erhielt 1921 den Physik-Nobelpreis.“; Lösung Albert Einstein, akzeptierte Variante Einstein, keine sichtbaren Optionen.
- Daraus entstehen 4 richtige antworten-Zeilen (1994, CH, Albert Einstein, Einstein) sowie 3 quiz_fragen-Zuordnungen und die vom bestehenden Ablauf erzeugten quiz_ablauf_elemente.
- 1 neues Team namens Kennung + „ TEAM“, genau 1 Spieler, kein Foto, neues zufälliges Passwort nicht in Logs; 1 quiz_team_sessions-Zeile und die bestehende quiz_teams-Zuordnung dieses Quiz.
- Laufzeit: 1 quiz_praesentation_status, Blockfreigabe für Block 1, 3 Fragen-Runs (sonstige automatische Ablauf-Runs falls vom bestehenden Lifecycle erzeugt separat im Manifest), 3 team_antworten-Drafts und 3 finale team_answer_submissions. Genau ein gespeicherter/finaler Antwortstand pro Frage planen; bei Retry nur revisionsbedingte zusätzliche Snapshots dokumentieren. Bewertung liegt in diesen Antwortdatensätzen; keine fremden Bewertungen verändern.

Smoke je Frage: im Editor erstellen, speichern und wieder öffnen; Präsentation zeigt beide Fakten ohne Lösung; Teilnehmer antwortet 1994 / über Suche Schweiz / Einstein; Autosave bestätigen, Reload kontrollieren; zur Auflösung wechseln und finale Bewertung je 1 Punkt kontrollieren. Erwarteter Gesamtstand 3 Punkte. Danach Testquiz beenden. Zusätzlich eine bestehende Standardfrage und abgeschlossene Auswertung ausschließlich lesen. Keine bestehenden Quizze starten, stoppen, resetten oder neu bewerten. Keine globalen Statistik-/Schwierigkeits-Neuberechnungen.

## Sichere spätere Smoke-Bereinigung

Nur nach eigener ausdrücklicher Bereinigungsfreigabe und Manifest-Prüfung. Bis dahin beendete Testdaten erhalten. Vorher alle IDs, Namen, Eigentümer, Eventreihe und Relationen prüfen; die drei Fragen dürfen nur im Testquiz, das Team nur dort teilnehmen. Bei fremder Zuordnung abbrechen. Keine Wildcards, keine Präfix-Löschung, kein CASCADE-DDL und kein Reset bestehender Quizze.

Bestehende Adminmechanismen verwenden: drei Testquiz-Zuordnungen einzeln entfernen (removeFrageFromQuiz; löscht abhängige Test-Runs/Antworten/Submissions über vorhandene FKs), dann das nun fragenlose Testquiz löschen (deleteQuiz; Testabschnitte/Session/Freigaben/Status kaskadieren). Danach drei Testfragen über deleteQuestionPermanently löschen, dessen Schutzprüfungen müssen bestehen. Die eigenen Antwort-/Eventreihen-Zuordnungen werden über FKs entfernt. Schließlich neues Team über deleteTeamAction löschen, vorher ausschließlich Testhistorie prüfen; Force Delete nur falls noch erforderlich und separat freigegeben mit exaktem Teamnamen. Neue Eventreihe nur nach Null-Referenz-Prüfung und gesondert freigegebenem ID-genauem Delete entfernen, falls kein entsprechender UI-Löschmechanismus verfügbar ist; andernfalls archiviert belassen und dokumentieren.

Keine Template-Katalogzeilen oder Prisma-Migrationshistorie löschen. Nachbereinigung ausschließlich anhand Manifest-IDs read-only verifizieren; bestehende Referenzen und Produktivdaten dürfen nicht betroffen sein.

## Bekannte Befunde

Nicht blockierende React-Hydrationmeldung #418 in Preview-Moderation, Ursache nicht eingegrenzt; kein Fix in diesem Release. Maximale Faktenmenge bei 720p/LOVD benötigt etwa 14 Pixel Schrift; reale Projektionsentfernung nicht abgenommen. Windows-Importplan-Hashabweichung und informational Repository-Lint-Altlasten bleiben dokumentiert. Keine Flaggen-/Umriss-Erweiterung.
