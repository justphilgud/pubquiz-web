# B10a – Moderations-Request-Loop

Status: abgeschlossen – Implementierung, Qualitätsprüfungen und reale Preview-Request-Abnahme erfolgreich.
Runtime: `2865ceb022cd9ed447b88750209526df255b39b1`.
Branch: `codex/b10a-moderation-loop`.
Finales Preview: https://pubquiz-7fbv5b7js-just-phil-gud.vercel.app
Deployment: `dpl_4WfNXvTPu2LLcuR8uCC3b994SVRU`.

## Ursache und Korrektur

Grundlage: [B10-Diagnose](b10-edge-request-spike.md), vollständig vor Änderung gelesen.
Der Funny-Effect schrieb bei jedem erfolgreichen Read ein neues Set, auch ohne
Mitgliedschaftsänderung. Dadurch entstanden neue Slides und eine neue Callback-
Identität; Funny-Read und sofortiger Live-Snapshot starteten wieder. Die ungefähr
80 ms waren Antwort-/Renderlatenz der Schleife, kein vorgesehenes Pollintervall.

Korrektur in `app/quiz/[quizId]/moderation/ModerationClient.tsx`:

- Bei identischer Funny-Mitgliedschaft exakt `current` zurückgeben.
- Funny-Effect: primitive Quiz-ID, Assignment-ID, Slide-Typ, Lifecycle und Revision.
- Live-State-Callback: geordnete primitive Slide-Key-Signatur statt Slide-Arrayreferenz.
- Snapshot-Effect berücksichtigt echte Lifecycle-/Resetwechsel, räumt Timer auf und
  bricht seinen Fetch per AbortController ab. Vorhandene active-Guards bleiben.
- 750-ms-Live-Pause, 1.500-ms-Antwortfortschritt, Live-Poll-Ausnahme sowie
  Submission-, Pixel-, Bewertungs- und Präsentationsregeln bleiben erhalten.

Verantwortung bleibt im vorhandenen Moderationsclient; keine neue Komponente,
Engine, Dependency, Datenbankänderung oder allgemeine Pollingoptimierung.

## Regressionen und Qualitätsprüfung

Sieben neue Tests in `app/quiz/moderationRequestLoop.test.ts`, über `npm test` in CI:

1. Unveränderte leere Menge, wiederholt neu projiziertes Quiz: ein Funny-Read,
   kein neuer Snapshot-Kontext; reguläre Pollrate und Antwortzähler bleiben erhalten.
2. Gegenprobe mit früherer Set-/Dependency-Kombination erkennt den Requestloop.
3. Echte Funny-Hinzufügung/-Entfernung ändert das Deck; unverändert nichtleer bleibt stabil.
4. Andere Frage, Phase, Quiz-ID, Lifecycle und Resetrevision aktualisieren den Kontext.
5. Verspätete Funny-Antworten aus altem Frage-/Resetkontext werden verworfen.
6. Wiederholtes Mount/Unmount akkumuliert keine Timer.
7. Unmount vor Snapshot-/Fortschrittsantwort verhindert Zustandsänderung und Nachstart.

Der Test führt den tatsächlichen Komponentenrumpf und seine Effects mit
kontrollierten Hook-/Timer-/Transportgrenzen sowie dem echten Deck-/Live-Resolver
aus. JSX wird entfernt; es ist ausdrücklich kein echter React-DOM-Renderer.
Die reale Preview-Abnahme ergänzt diesen Test und ist Abschlussbedingung.

Lokal: 1.066 Tests erfolgreich (391 + 508 + 11 + 156), TypeScript erfolgreich,
repositoryweiter ESLint erfolgreich, Prisma-Schema gültig, Production-Build erfolgreich.
Erster Buildaufruf ohne CI-Umgebung verlangte die lokale Env-Datei; danach scheiterte
nur der gesperrte Google-Fonts-Zugriff. Mit CI-Dummyvariablen und Netzwerkfreigabe
war der Build grün. Keine DB-Verbindung oder Migration für lokale Prüfungen.

- [Feature-CI](https://github.com/justphilgud/pubquiz-web/actions/runs/34135750563): erfolgreich.
- [Preview-CI](https://github.com/justphilgud/pubquiz-web/actions/runs/34135750701): erfolgreich.
- [Deployment #161](https://github.com/justphilgud/pubquiz-web/actions/runs/34135921108): erfolgreich, 2m17s.
- Deploymentjob `101786742646`: Validierung, Migrationstatus und vorhandener
  Deploymentworkflow einschließlich Smoke-Test erfolgreich. Keine neue Migration.
- Die workflow_run-Überschrift zeigt main/e76f57d als Workflowdefinition; der
  Deployment-Summary bestätigt ausdrücklich Preview-Branch und Runtime `2865ceb`.
  Production-Deployment wurde übersprungen.
- Bestehende Actions-Runtimewarnung unverändert (außerhalb B10a).

## Kontrollierte Browser-Abnahme

Eigene, ausdrücklich freigegebene Testkopie: **Quiz 29 – Codex B10a Request-Abnahme**,
aus Quiz 28, drei Fragen, Datum 7. September. Keine bisherigen Abnahmedaten gelöscht.
B05-Kopierbutton besitzt keinen Klick-Handler; deshalb zunächst keine Kopie angelegt.
Nach lesender Kontrolle wurde das autorisierte Formular per Eingabetaste abgesendet.
B05 wurde nicht verändert.

Abgenommen wurde die frisch geladene, angemeldete stabile Preview-Alias-Adresse
`https://pubquiz-web-git-preview-content-and-quiz-flow-just-phil-gud.vercel.app`.
Eine zunächst alte Toolbar-ID führte vorsorglich zur Login-Anfrage für den eindeutigen
Host. Danach bestätigten die geladenen Script-URLs am frischen Moderationsclient
explizit `dpl_4WfNXvTPu2LLcuR8uCC3b994SVRU`, identisch zur eindeutigen Deployment-URL.
Die Messabfragen filtern zusätzlich exakt diese Deployment-ID, Projekt pubquiz-web
und Environment Preview. Die zweite Anmeldung war damit nicht erforderlich.

Ein Moderator und eine aktivierte Präsentation liefen in getrennten Browser-Tabs.
Quiz 29 wurde gestartet, normale Frage 1 (Slide 8) und danach Frage 2 (Slide 9)
jeweils mehrere Minuten ohne Bedienung beobachtet. Andere alte Moderationen waren
geschlossen. Die Messung fand im In-App-Browser mit wechselndem Vordergrund und
Vercel-Auswertung als weiterem Tab statt; Browser-Scheduling kann Durchsatz senken.
Es handelt sich nicht um einen Lasttest mit 40 echten Clients.

Das eigene Team Codex B10a wurde angemeldet; auf Frage 2 wurde um 15:26 UTC eine
synthetische Antwort gespeichert. Die UI bestätigte den gespeicherten Entwurf;
der AP2-Zähler wechselte von 0 Teams / 0 Antworten auf 1 Team / 1 Antwort / 100 %.
Der vorhandene Vertrag übernimmt den Entwurf beim Schließen; kein neuer Submitweg.

Runtime-Logstichprobe (Vercel zeigt lokale Zeit UTC+2): aufeinanderfolgende
Moderator-Snapshots 17:20:53.94, 54.77, 55.62, 56.52, 57.35, 58.20; Abstände
830, 850, 900, 830, 850 ms. Alle Status 200 und queryCount 9. Antwortfortschritt
17:20:54.80, 56.30, 57.80: jeweils 1.500 ms, Status 200, queryCount 12.
Die regulären zwei Präsentations-Actions können weiterhin eng aufeinander folgen;
das ist kein erneuter Moderation-/Snapshot-Loop. Die frühere dauerhafte 80-ms-Signatur
fehlt in der neuen Stichprobe und wird durch die Mehrminutenraten gegengeprüft.

STOPPED um 15:31 UTC real geprüft: Moderation Beendet mit weiterhin 1/1 Antworten,
Teamformular ohne Antwortfelder und mit „Das Quiz ist beendet“, Präsentation mit
„Quiz beendet“ und Hinweis auf erhaltene Antworten. Kein Reset und keine Löschung.
Die Statusbeobachtung in STOPPED ist absichtlich unverändert; sie erkennt einen
späteren Reset und ist kein Hinweis auf den behobenen Zusatzloop.

## Messwerte / B10b

Vercel Query Builder: Requests / Count / Sum, Request Path und Request Method,
Deployment-ID wie oben. Alle folgenden Pfade sind POST. Zeitfenster UTC, Datum
2026-09-07 (UI lokal jeweils +2 Stunden). Frühe Zwischenstände waren durch
Ingestionsverzögerung unvollständig; Tabelle enthält später erneut gelesene Werte.

| Fenster / Zustand | Dauer | Moderator-Snapshot | Moderation | Präsentation | Team-Snapshot | Gesamt |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 15:14–15:17, Frage 1, 0 Teams | 3 min | 212 | 120 | 388 | 0 | 720 |
| 15:19–15:22, Frage 2, 0 Teams | 3 min | 212 | 120 | 388 | 0 | 720 |
| 15:27–15:30, Frage 2, 1 Team, Antwort gespeichert | 3 min | 212 | 120 | 393 | 300 | 1.025 |
| 15:32–15:35, STOPPED, 1 Team | 3 min | 212 | 120 | 390 | 306 | 1.028 |

Auch STOPPED bleibt mit 342,67 Requests/min insgesamt und 110,67/min für die
Moderation samt API im regulären Bereich. Nach dem letzten Fenster wurden um
15:35 UTC alle drei eigenen pollenden Testtabs geschlossen.

Die ersten beiden Ruhefenster ergeben jeweils 240 Requests/min insgesamt:
70,67 Moderator-Snapshots + 40 Moderations-Actions + 129,33 Präsentations-Actions.
Im Teamfenster: 341,67/min, davon 100 Team-Snapshots und 131 Präsentations-Actions.
Die Moderation einschließlich ihres API-Pfads bleibt bei 110,67/min. Das liegt
unter den nominalen 80 + 40 = 120/min; Snapshot-Pause plus Antwortlatenz erklärt
den Unterschied. Präsentation: nominal höchstens 160/min, gemessen 129–131/min.
Kein verstecktes Debounce, kein längeres Intervall und kein neuer Pollingmechanismus.

**Vorher/Nachher mit Vergleichsgrenzen:** Die B10-Hoststichprobe mit 79–93-ms-Paaren
entspricht hochgerechnet rund 660–780 Snapshots/min und ebenso vielen
Moderationsaufrufen, zusammen 1.320–1.560/min; das war kein isolierter einzelner
Client. B10a misst kontrolliert einen Moderator: 70,67 Snapshots/min + 40/min.
Die Snapshotfrequenz liegt damit etwa 89–91 %, die Summe etwa 92–93 % niedriger
als die Kurzstichproben-Hochrechnung. Das alte aggregierte 15-Minutenfenster mit
38K + 38K entsprach rund 5.067/min allein auf diesen beiden Pfaden über mehrere
alte Clients; es ist nicht direkt als Einzelclient-Vergleich geeignet.

**DB-Auswirkung:** Neun Query-Events pro Snapshot bleiben unverändert. Vorher
entsprach die Kurzstichprobe hochgerechnet 5.940–7.020 Snapshot-Queries/min,
nachher 636/min. Mit zwölf Queries pro regulärer Fortschritts-Action kommen
480/min hinzu, somit ungefähr 1.116 Queries/min für diese zwei Moderationsleser.
Das sind Hochrechnungen aus Requestzahlen und Logstichproben, keine vollständige
DB-Messung. Funny-Reads bei Kontextwechseln, Präsentation, Team, Auth und Writes
sind nicht vollständig enthalten. Der alte 38K-Snapshotblock bedeutete allein
ca. 22.800 Snapshot-Queries/min über alle beteiligten Clients.

**Neue Baseline:** Extrapolation des ruhigen Teamfensters mit einem Moderator,
einer Präsentation und N Teams: `15 × (212/3 + 120/3 + 393/3 + N × 300/3)`
= `3.625 + 1.500 × N` Requests pro 15 Minuten.

| Teams | Neue beobachtungsbasierte Baseline / 15 min |
| ---: | ---: |
| 10 | ca. 18.625 |
| 20 | ca. 33.625 |
| 40 | ca. 63.625 |

Diese Werte sind keine Messung mit 10/20/40 gleichzeitigen Teams, sondern eine
lineare Extrapolation des finalen Previews. Normale Frage, keine zusätzliche
Auswertung, keine Übergänge/Initialzugriffe, Hintergrund-/Netzwerkbedingungen
wie oben. Bei niedrigerer Latenz können Raten an die nominalen Intervallgrenzen
heranreichen. Das frühere 4.200 + 1.800 × N bleibt als theoretischer Grenzwert
mathematisch nachvollziehbar, wird aber ausdrücklich nicht als neue Messbaseline
übernommen. Größere Quiz-/Teamdaten können DB-Kosten zusätzlich verändern.

**Genau eine Empfehlung: B10b als Optimierungs-Backlog behalten.** Der konkrete
Moderationsloop ist behoben; jetzt dominiert legitimes 500-ms-Team-Polling:
bei 40 Teams im neuen Modell 60.000 von 63.625 Requests / 15 min (rund 94 %).
Mögliche spätere Optimierung: fachlich abgestufte Pollintervalle für normale
Fragen und inaktive Ansichten, zum Beispiel 2 s statt 500 ms im geeigneten Zustand.
Unter gleichen Latenzannahmen könnte das Team-Requestvolumen um rund 70–75 % sinken.
Risiko: verzögerte Frage-/STOPPED-/Resetanzeige; Pixel und Live-Umfragen benötigen
separat geprüfte Reaktionsverträge. In B10a wurde davon nichts implementiert.

Die finale Deployment-Messung zeigt weder dauerhaft dichte Moderationspaare noch
einen dem B10-Spike vergleichbaren Durchsatz. Historische Vercel-Anomalien bleiben
sichtbar. Die globale Abnahme der Last kann zusätzlich vom Schließen alter Tabs
beeinflusst sein; die isolierte neue Deployment-Messung trägt den Fixnachweis.

## Geänderte Dateien und Grenzen

Runtimecommit und finaler Preview-Commit: `2865ceb022cd9ed447b88750209526df255b39b1`.

- `app/quiz/[quizId]/moderation/ModerationClient.tsx`
- `app/quiz/moderationRequestLoop.test.ts`
- `package.json`
- `docs/architecture/submission-live-state.md`
- `docs/reports/b10-edge-request-spike.md` (vorhandene Diagnose mit versioniert)
- `docs/reports/b10a-moderation-request-loop.md`
- `docs/reports/b10a-request-measurements.json` (abgeschriebene, bereinigte UI-Messwerte)

Der Dokumentationscommit folgt ausschließlich auf dem Fixbranch und ändert das
bereits abgenommene Preview nicht. Remote main wurde abschließend lesend bestätigt:
`e76f57dce19f26488cf9db24b881ab06bf004fd6`, unverändert gegenüber vor B10a.
Production wurde nicht deployed. Keine Schemaänderung, Migration oder Dependency.
Offene Punkte außerhalb B10a: B10b-Optimierung, bestehender B05-Kopierbutton ohne
Handler und vorhandene GitHub-Actions-Runtimewarnung. Keine davon wurde mitgeändert.
