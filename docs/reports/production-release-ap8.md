# Production Release nach AP8

Releaseprotokoll, 7. September 2026. Status: Production erfolgreich veröffentlicht; Migrationen und lesender Production-Smoke erfolgreich.

## Vorabprüfung und Releasegrundlage

- Auftrag: ausdrücklich freigegebenes Production-Deployment des abgenommenen AP8-Stands, keine funktionalen Änderungen.
- Vorheriger Remote-main und laufendes Production: `e76f57dce19f26488cf9db24b881ab06bf004fd6`.
- Abgenommener Preview-Runtime: `a014c1be2f326cd562650c4fd6f4096c542809c4`.
- Finaler Release-/Main-Commit: `1d4c703e068c0752a10757620d1f7fe03d47b20a`, direkter Nachfolger; ausschließlich `docs/reports/ap8-cleanup.md` und dessen Nachweise. Runtime-Diff gegen `a014c1b` leer.
- Remote-preview und Remote-AP8 vor Release: beide `a014c1b`.
- Graph: main ist direkter Vorfahr; main→Runtime 33 Commits, main→Release 34; keine divergierenden Main-Commits. Fast-forward ohne Konfliktauflösung möglich.
- Isolierter Worktree `.worktrees/ap5-presentation` vor Release sauber. Andere Worktrees einschließlich lokal belegtem main in `pubquiz-prod` bleiben unangetastet. Fremde uncommitted Änderungen im Haupt-Worktree gehen nicht in den Release ein.
- [Abgenommenes Preview](https://pubquiz-ojcwrsyif-just-phil-gud.vercel.app), [AP8-Bericht](ap8-cleanup.md).

## Vollständiger Releaseumfang main → AP8

234 Dateien im Runtime-Diff, einschließlich bisheriger Dokumentation; zusätzlich 25 reine AP8-Nachweisdateien im Dokumentationscommit.

| Bereich | Enthaltene abgenommene Änderungen |
| --- | --- |
| Lifecycle/AP1 | Explizite Vorbereitung, laufender und gestoppter Zustand; Revision, Erhaltung von Antwortkontexten; kompakte Lifecycle-Steuerung. |
| Submission/Moderation/AP2 | Persistierte Interaction-Antworten als Fortschrittsquelle, stabiler Antwort-Pollingkontext. |
| Pixel/AP3/B09 | Persistierte Stufenhistorie und Stufenwertung, gebündelte Snapshots, synchronisierte Countdowns; letzte Stufe offen bis manuellem Abschluss. |
| Bewertung/AP4 | Persistierte Scores und Revisionsabgleich, erhaltener Auswertungskontext und Poll-/Matrixkonsistenz. |
| Präsentation/Audio/AP5 | Gemeinsame Lesbarkeitsrollen, Volltext-Overflow, Layout für Auswahlfragen, strukturierte Medien und synchronisiertes Audio. |
| Intro/QR/Teamjoin/AP6 | Manueller Introabschluss auf QR, lokale Teambegrüßungsqueue, begrenzte QR-/Willkommensgeometrie. |
| Mobile Editor/AP7 | Gemeinsame kompakte Action-Bar, Viewport-/Tastaturgeometrie, erreichbarer Spezialfragedialog. |
| Cleanup/AP8 | Korrekte Kopierform, natürliche Regelfolienhöhen, getrennte Skalenlabels. |
| Performance/B10a | Stabile Effect-Kontexte in Moderation statt Request-Schleife; B10b bleibt offen. |
| Dokumentation | Living Specs und Preview-Abnahmeberichte AP1–AP8, B09, B10/B10a mit freigegebenen Nachweisen. |
| Schema/Prisma | Zwei additive Migrationen; bestehender Preview-Prisma-CLI-Verbindungsresolver, Production-Verbindungsweg unverändert. |

## Migrationen und Datenverträglichkeit

Reihenfolge der gegenüber main neuen Migrationen:

1. `20260907120000_quiz_lifecycle`: optionale `quiz_stopped_at`, `lifecycle_revision INTEGER NOT NULL DEFAULT 0`, `is_hidden BOOLEAN NOT NULL DEFAULT false`.
2. `20260907180000_pixel_stage_history`: optionale `pixel_stage_history JSONB`, `pixel_completed_stages INTEGER NOT NULL DEFAULT 0`.

Beide SQL-Dateien vollständig geprüft: ausschließlich ADD COLUMN, kein DROP,
TRUNCATE, DELETE, Umbenennen oder Datenumschreiben. Nullable Spalten bzw. konstante
Defaults schützen bestehende Zeilen; alter Code kann die zusätzlichen Spalten
weiter ignorieren. AP8 selbst enthält keine Migration.

[Finaler Preview-Workflow](https://github.com/justphilgud/pubquiz-web/actions/runs/34152240529/job/101836730843)
bestätigt nach Deployment 41 Migrationen und „Database schema is up to date“.
Die tatsächlich auf Production ausstehenden Migrationen werden zusätzlich im
vorgesehenen Workflow vor `migrate deploy` aufgezeichnet und danach verifiziert.
Kein lokaler Production-Migrationslauf, kein `migrate resolve`, keine manuelle Datenänderung.
Der vorherige erfolgreiche Production-Workflow bestätigt 39 Migrationen und
aktuelles Schema; die beiden neuen Migrationen vervollständigen damit die 41.

## Finaler lokaler Preflight

Auf unverändertem Releasekandidaten `1d4c703` erneut ausgeführt:

- Vollständige Suite: 1.095 Tests erfolgreich (400 + 508 + 11 + 176).
- `npm run typecheck`: erfolgreich.
- `npm run lint -- --max-warnings=0`: erfolgreich, keine Warnungen.
- `npm run db:validate`: erfolgreich.
- `npm run build`: erfolgreich.

Build/Schema-Prüfung mit CI-Dummy-URL, ohne Production-Datenbankzugriff.
Keine Tests abgeschwächt und keine Codeänderung vorgenommen.

## Rollbackweg und Gate vor Veröffentlichung

Vor dem Release laufendes Production-Deployment laut Vercel Overview:
`dpl_BigpuoXmVs6HUBHpqm2AiDb1diVJ`, URL
`https://pubquiz-etmhcfefs-just-phil-gud.vercel.app`, stabile Domain
`https://pubquiz-web.vercel.app`; Status Ready, Source `e76f57d`.
Vorheriger erfolgreicher [Production-Workflow 33191446378](https://github.com/justphilgud/pubquiz-web/actions/runs/33191446378).

Vercel bietet im Projekt „Instant Rollback“. Bei schwerem Code-/Erreichbarkeitsfehler
ist das obige Deployment das identifizierte Rückfallziel über den bestehenden
Vercel-Rollbackweg. Zusätzliche Datenbankspalten bleiben bestehen. Bei Migration-,
Schema- oder Datenproblemen zuerst anhalten und Befund sichern; keine automatische
oder improvisierte Rückmigration. Ein Rollback wurde nicht ausgeführt.

Main-Integration nur als Fast-forward nach erneutem Remoteabgleich. Anschließend
Main-CI und Runtime-Gleichheit erneut prüfen, bevor der bestehende geschützte
Production-Workflow freigegeben wird. Dessen Reihenfolge bleibt Identitätsprüfung,
Migrationsstatus, `prisma migrate deploy`, Statusprüfung, Vercel Production und HTTP-Smoke.


## Integration und Production-Deployment

Main wurde nach erneutem Fetch konfliktfrei per Fast-forward auf `1d4c703`
aktualisiert, gleichzeitig AP8-Dokumentation auf `codex/ap8-cleanup` veröffentlicht.
Kein Force-Push, keine Änderung des lokal anderweitig belegten Main-Worktrees.
Nach Integration erneut Runtime-Diff leer.
[Main-CI](https://github.com/justphilgud/pubquiz-web/actions/runs/34154094829)
vollständig erfolgreich, einschließlich Build und repositoryweitem Lintjob.

Die automatische Freigabeprüfung verlangte für das Environment-Gate eine direkte
Nutzerfreigabe. Diese wurde mit „Approved“ erteilt; das GitHub-Gate zeigt die
Freigabe und der vorgesehene Workflow ist anschließend erfolgreich durchgelaufen.

| Nachweis | Ergebnis |
| --- | --- |
| Workflow | [Deploy Production #170, 34154225181](https://github.com/justphilgud/pubquiz-web/actions/runs/34154225181/job/101842572440), success |
| Release-Commit | `1d4c703e068c0752a10757620d1f7fe03d47b20a` |
| Jobstart / Jobende | 2026-09-07 19:08:58 / 19:11:28 UTC (21:08:58 / 21:11:28 MESZ) |
| Deployment | `dpl_3Ufmv6QmvYkp712cPjVPXBDJtsN3` |
| Vercel | [Deploymentdetail](https://vercel.com/just-phil-gud/pubquiz-web/3Ufmv6QmvYkp712cPjVPXBDJtsN3): Ready, Production, Current; Source `1d4c703` |
| Stabile URL | https://pubquiz-web.vercel.app |
| Eindeutige URL | https://pubquiz-duckwlqkj-just-phil-gud.vercel.app |
| Migrationen | Vorher genau die zwei oben genannten Migrationen ausstehend; `migrate deploy` erfolgreich; danach 41 Migrationen, „Database schema is up to date!“ |
| Workflow-Smoke | Erfolgreich |

Der vorangestellte Migrationsstatus meldete erwartungsgemäß ausstehende Migrationen;
dieser im Workflow tolerierte Status ist kein fehlgeschlagenes Deployment.
Keine neue Migration und kein alternativer Deploymentweg verwendet.

## Lesender Production-Smoke

Prüfung nach Deployment auf der stabilen Domain, öffentlicher Login zusätzlich
auf der eindeutigen Deployment-Domain:

- Startseite und vorhandene authentifizierte Sitzung funktionieren; separater
  nicht angemeldeter Deployment-Host zeigt das Loginformular. Logo vollständig geladen.
- Quizübersicht und bestehendes Quiz lesend geöffnet.
- Moderation lädt im Zustand Vorbereitung; keine Lifecycle- oder Navigationsaktion
  ausgelöst. Präsentation zeigt den vorgesehenen lokalen Aktivierungshinweis;
  keine Live-Präsentation gestartet. Browser-Fehlerlog der Moderation leer.
- Interne synthetische Rendererreferenz lädt mit Production-Code: vier Regeln bei
  1280 × 720, Inhaltshöhe gleich verfügbarer Höhe (530 px), kein Überlauf.
  QR-Slide mit sichtbarem QR-Code, Logo und EDITORIAL-Theme geprüft; Browserfehlerlog leer.
  Diese Referenz legt keine Quizdaten an.
- Contentliste und bestehender Entwurf geladen, keine Eingabe verändert oder gespeichert.
  Mobile Prüfung bei tatsächlich gemessenen 390 × 844: Action-Bar 61 px hoch am
  unteren Rand, „Weitere Aktionen“ sichtbar. Desktopdarstellung ebenfalls vorhanden.
- Ein anfänglich verwendeter, nicht vorhandener Listenpfad `/content/questions`
  lieferte erwartbar 404; der reguläre Navigationspfad `/fragen` funktioniert.

Keine Testinhalte, Teilnahmen oder Antworten angelegt; kein Quiz gestartet,
gestoppt oder zurückgesetzt. Keine manuellen Production-Datenänderungen.
Die einzigen beabsichtigten Datenbankschemaänderungen liefen im freigegebenen Prisma-Workflow.
Keine Production-Screenshots oder Rohdaten in diesen Bericht übernommen.

## Observability und B10a

Vercel nach Deployment, Environment Production, angezeigtes Zeitfenster letzte
12 Stunden: 657 Edge Requests, 598 Function Invocations, Error Rate 0 %, Timeout 0 %. Die Tabelle
zeigt 187 Live-Snapshot-Aufrufe und 131 Moderationsaufrufe, beide mit 0 % Fehlern.
Diese Fensterzahlen enthalten auch Traffic vor dem Release; sie sind keine
isolierte Lastmessung des neuen Deployments.

Im sichtbaren Runtime-Logausschnitt 21:15:20–21:15:44 MESZ liegen die wiederholten
Moderations-POSTs bei ungefähr 1,5 Sekunden Abstand und die Snapshot-POSTs bei
ungefähr 0,84 Sekunden, jeweils HTTP 200. Keine ~80-ms-Moderationsschleife erkennbar.
Polling-Tabs nach dem Smoke geschlossen. Kein Lasttest und keine vollständige
Live-Veranstaltung simuliert; der begrenzte Smoke ersetzt B10b/AP9 nicht.

Der Fehlerfilter im 30-Minuten-Fenster zeigte zwölf Einträge, vollständig gelesen:
alle enthalten ausschließlich die PostgreSQL-Treiberwarnung zur künftig geänderten
SSL-Modus-Semantik. Nach Deployment betroffene Requests waren erfolgreich (HTTP 200);
dieselbe Warnung ist auch vor Deployment vorhanden. Keine Datenbank-Abfragefehler,
Migrationfehler oder neue Serverausfälle im geprüften Ausschnitt.

## Warnungen, Rollback und verbleibender Umfang

Kein Rollback erforderlich oder ausgeführt. Identifiziertes Rückfallziel und
Schema-Verträglichkeit sind oben dokumentiert.

Offene Wartungshinweise: bestehende PostgreSQL-SSL-Semantik-Warnung sowie
Toolchain-/Dependency-Hinweise im Workflow (Node-20-Actions, deprecated CLI-Abhängigkeiten).
Keine Änderungen daran während dieses Releases.

AP9 bleibt ein eigener Auftrag: B10b Team-Pollingoptimierung, vollständige
System-E2E-Stabilisierung, echte Android-Chrome-/iOS-Safari-Tastaturabnahme,
AP7-F01 Live-Polls vs. Frage-Polltemplates, Hochkant-/Mobile-Präsentationsgestaltung,
vollständige Run-Historisierung und weitere Release-/Performance-Tests.

Architektur und Komponentenverantwortlichkeiten wurden im Release nicht verändert.
Einzige neu erstellte Datei dieses Releaseauftrags ist dieser Bericht.
Keine Features, Bugfixes, Refactorings, Abhängigkeiten oder ungeplanten funktionalen
Änderungen hinzugefügt. Runtime entspricht exakt dem abgenommenen AP8-Stand.

