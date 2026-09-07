# B10 – Diagnose des Vercel Edge-Request-Spikes

Stand: 7. September 2026, Messungen bis 14:40 UTC (16:40 Uhr Berlin).
**Ergebnis: C – konkreter App-Bug. Risiko: kritisch nach dem B10-Kriterium einer dauerhaft unkontrollierten Requestschleife in einem einzelnen Client.**

Der Moderationsclient enthält eine asynchrone Effect-Rückkopplung beim Laden skurriler Antworten. Sie erneuert außerdem den Live-Snapshot-Effect und umgeht damit dessen 750-ms-Wartezeit. Mehrere offen gebliebene Preview-Moderationen verstärken diese Last. Die Routeverteilung und aktuelle Runtime-Logs passen unmittelbar zu diesem Mechanismus. Die AP5-Render-/Screenshotmatrix erklärt den Spike nicht als reine Asset- oder CI-Last. Der Fehler wurde bereits am 25. August eingeführt, nicht durch AP5.

Die Anwendung ist **nicht repariert**. Die Last war zum Messende weiterhin erhöht. Ausschließlich dieser Bericht wurde erstellt; Anwendung, Tests, Konfiguration, Datenbank, Living Specification, main und Production wurden nicht verändert.

## 1. Quellen, Verfahren und Grenzen

Untersuchter aktueller Preview-Code: `4bce410a822ec249a8b4c71011b5c8668e6823cc`; AP5-Dokumentation: `bc382aeac96485cfb2724c684cdc43cb1e5b9b12`. Bericht im vorhandenen Worktree `codex/ap5-presentation`. Der ältere, separat vorhandene Arbeitsstand im Hauptverzeichnis wurde nicht bearbeitet.

Quellen:

- [Vercel-Anomalie](https://vercel.com/just-phil-gud/~/observability/alerts/ag_01a07c0b-7a9a-7272-b3fc-010b2417f06b?alertType=usage_anomaly&groupId=ag_01a07c0b-7a9a-7272-b3fc-010b2417f06b): Alarmdaten und bestehende Untersuchung.
- [Projektbezogene Edge-Metriken](https://vercel.com/just-phil-gud/pubquiz-web/observability/edge-requests): Environment-Filter und benutzerdefinierte Zeitfenster, Route-, Cache- und Statusauswertung.
- [Vorhandene Runtime-Logs](https://vercel.com/just-phil-gud/pubquiz-web/logs): Methode, Host, Pfad, Zeitstempel und bereits vorhandene `live-performance`-Diagnostik.
- Git-Historie, GitHub-Actions-Läufe, Workflowdateien, [AP5-Abnahmebericht](ap5-presentation-quality.md), [304 finale Messwerte](assets/ap5/preview-matrix.json), Quelltext der laufenden Mechanismen.
- [Vercel: CDN Requests](https://vercel.com/academy/optimize-your-vercel-account/edge-requests): Edge Requests umfassen unter anderem Seiten, RSC, Assets, API-Aufrufe und Prefetches. Sie sind weder mit Edge-Function-Aufrufen noch mit SQL-Abfragen gleichzusetzen.

Alle Zeiten in diesem Bericht sind UTC. Das Dashboard zeigte Berlin-Zeit, also UTC+2. Angaben wie 17K oder 233K werden aus der gerundeten Oberfläche übernommen. Prozentwerte und Differenzen daraus sind Näherungen, keine exakten Exporte. Tabellen aus unterschiedlichen Alarm-/Dashboardfenstern werden nicht addiert.

Vor einer möglichen kontrollierten Messung wurde hier ein passives Resource-Timing-Lesen des bereits offenen eigenen Quiz-28-Tabs dokumentiert, optional mit einem Reload. Der Browserzugang stellt jedoch keine Resource-Timing-/Netzwerkaufzeichnung bereit. **Der Reload und ein neuer Testlauf wurden nicht ausgeführt.** Stattdessen wurden bestehende Vercel-Logs gelesen. Keine zusätzlichen Quizfenster, Starts, Stops, Resets oder Antworten wurden für B10 erzeugt; vorhandene Benutzer-Tabs wurden nicht geschlossen. Das Lesen eines vorhandenen Tabs kann dessen Sichtbarkeit beeinflussen; daraus wird keine unveränderte Vordergrund-/Hintergrundmessung behauptet.

Nicht verfügbar sind ein vollständiger HAR des historischen AP5-Laufs und eine vollständige Zuordnung jedes Server-Action-Requests zu Action-ID und einzelnem Browser-Tab. Daher lässt sich der Anteil jeder einzelnen AP5-Bedienhandlung nicht exakt beziffern. Das verhindert die eindeutige Feststellung des Codefehlers nicht.

## 2. Alarm und Verlauf

Gemeldet: Beginn 13:25 UTC, Medium Severity, ca. 399 Requests/15 Minuten im Siebentagesmittel gegenüber ca. 23.600 im gemeldeten Fenster, etwa 59-fach. Vercel meldete daneben einen entsprechenden Function-Invocations-Anstieg. Die Alarmansicht nennt zwei Ereignisse innerhalb von zwei Stunden und eine längere aktive Phase.

Direkt abgefragte Preview-Fenster:

| UTC | Länge | Edge Requests | Auf 15 Minuten normiert | Befund |
| --- | ---: | ---: | ---: | --- |
| 12:55–13:25 | 30 min | ca. 28K | ca. 14K | Bereits vor Alarmbeginn stark erhöht |
| 13:25–13:40 | 15 min | ca. 17K | ca. 17K | Moderation und Live-Snapshot dominieren |
| 13:40–14:10 | 30 min | ca. 62K | ca. 31K | Weiterer Anstieg nach dem Alarm |
| 12:30–14:30 | 120 min | ca. 233K | ca. 29K im Mittel | Mehrstündige Belastung |
| 14:20–14:35 | 15 min | ca. 77K | ca. 77K | Zum Diagnosezeitpunkt keine Normalisierung |

Die direkt gewählten 13:25–13:40 ergeben ca. 17K, nicht die gemeldeten 23.600. Der genaue rollierende Bezugszeitraum der Alarmzahl ist damit nicht reproduziert; die Zahlen werden bewusst nicht gleichgesetzt. Der Befund einer länger anhaltenden und später nochmals höheren Last ist unabhängig davon eindeutig. Aus diesen Aggregaten lässt sich kein mathematisch exponentieller Verlauf ableiten. Der gefundene Mechanismus erzeugt eine durch Antwortlatenz begrenzte, fortgesetzte Schleife, keine sich pro Durchgang verdoppelnde Zahl von Timern.

## 3. Preview und Production

| Fenster | Preview | Production |
| --- | ---: | ---: |
| 12:30–14:30 UTC, identische Filter | ca. 233K | 0 |
| 14:20–14:35 UTC, identische Filter | ca. 77K | 0 |
| Breiter 12-Stunden-Blick bis ungefähr 14:30 UTC | ca. 445K | 26 im wenige Minuten früher erfassten Vergleich |

Der breite Vergleich ist wegen leicht unterschiedlicher Endzeiten kein exakter Prozentvergleich. Im identischen zweistündigen Kernfenster entfällt die gemessene Last vollständig auf Preview. **Kein Production-Spike nachgewiesen.** Daraus folgt keine allgemeine Aussage, dass künftige Production-Versionen vom Codefehler frei wären.

Konkrete Hosts in der aktuellen Logstichprobe:

- `pubquiz-9m1nisjp0-just-phil-gud.vercel.app`: älteres AP4-Preview; hochfrequente Live-Snapshots und POSTs auf `/quiz/28/moderation`, daneben `/quiz/27/auswertung`.
- `pubquiz-48nlfwrpx-just-phil-gud.vercel.app`: älteres B09-Preview; ebenfalls laufende Live-Snapshots, in der kleinen Stichprobe etwa im Sekundentakt.

Weitere AP5-Hosts waren `pubquiz-cqmu9qsxa-just-phil-gud.vercel.app`, `pubquiz-2jqwx5gk2-just-phil-gud.vercel.app` und `pubquiz-46zl77j4i-just-phil-gud.vercel.app`. Exakte historische Requestanteile pro Host wurden nicht exportiert. Die vorhandene Vercel-Untersuchung beschreibt mehrere Preview-Hosts und einen einzelnen Desktop-Browser-Ursprung. Das ist unterstützende Provideranalyse, kein Beweis für eine bestimmte Person oder einen bestimmten Tab.

## 4. Routeverteilung und Requestarten

Preview, 12:30–14:30 UTC, insgesamt ca. 233K:

| Route | Requests | Anteil ungefähr | Einordnung |
| --- | ---: | ---: | --- |
| `/api/quiz/live-snapshot` | 110K | 47 % | Dynamische POST-API, DB-relevant |
| `/quiz/[quizId]/moderation` | 105K | 45 % | Insbesondere Server-Action-POSTs, daneben Seiten-/RSC-Zugriffe |
| `/quiz/[quizId]/praesentation` | 7,1K | 3 % | Zwei Status-Actions pro regulärem Poll plus situative Actions |
| `/quiz/[quizId]/auswertung` | 5,1K | 2,2 % | Revisions-Action und gegebenenfalls RSC-Refresh |
| `/api/quiz/team-live-snapshot` | 4,7K | 2 % | Teilnehmerstatus, gelegentlich vollständiger Antwortstatus |
| Alle übrigen | Größenordnung wenige Tausend oder weniger | ungefähr 1 %, rundungsabhängig | Seiten, Login, Fixtures und Assets zusammen |

Die fünf dominanten Routen ergeben gerundet 231,9K. Die rechnerische Differenz von 1,1K ist wegen Rundung **keine exakte Restzahl oder harte Obergrenze**. Alle fünf zeigten 0 % Cache. Im Kern sind dynamische, datenbankrelevante Aufrufe das Problem, nicht Font-/Bild-Downloads.

Im unmittelbaren Fenster 13:25–13:40: ca. 8,6K Live-Snapshot, 7,6K Moderation, 600 Auswertung, ein Bildrequest und ein `/`-Request. Im späteren Fenster 14:20–14:35: ca. 38K Moderation, 38K Live-Snapshot, 670 Auswertung, 537 Präsentation sowie jeweils ein Logo-, Icon- und `/`-Request. Das nahezu paarweise Auftreten von Moderations-Action und Live-Snapshot entspricht dem gefundenen Effect-Zyklus.

Im 30-Minuten-Fenster 13:40–14:10 zeigten einzelne statische Bilder nur 8–13 Abrufe und ca. 85–88 % Cache-Hits, das Logo 12 Abrufe bei ca. 83 %. Kein Hinweis auf einen dominierenden Media-/Cache-Miss-Sturm. Audio aus Blob-Speicher ist außerdem nicht automatisch ein Request gegen den App-Host.

Statusauswertung 12:30–14:30: ca. 232K HTTP 200; 97×304, 32×204, 18×307, 8×302, 5×206, 4×303, 1×499. Eine Fehler-/Redirect-Retry-Schleife erklärt diese Verteilung nicht. Spätere Logs zeigten auch einzelne Fehlerzählungen; daraus wird kein vollständig fehlerfreier Betrieb abgeleitet.

## 5. Polling-Inventar

Die Tabelle beschreibt den untersuchten Preview-Anwendungsstand. „Nach Antwort“ bedeutet: Netzwerk-/Serverlaufzeit kommt zur Wartezeit hinzu. Jede Action entspricht grundsätzlich einem POST auf den aktuellen Seitenpfad, nicht einem separaten benannten API-Pfad.

| Bereich | Endpoint / Action | Wartezeit und Anzahl | Bedingung | STOPPED, Hintergrund, Cleanup |
| --- | --- | --- | --- | --- |
| Moderation: Live | `/api/quiz/live-snapshot` | Sofort, dann 750 ms nach Antwort; 1 Request | Gemountete Moderation; nicht auf relevante Frageslides begrenzt | Kein STOPPED-Stopp; normale Fragen ohne eigene Hidden-Drossel; Timeout und active-Flag beim Cleanup, kein Abort |
| Moderation: Antwortfortschritt | `getAntwortStatus` | Sofort + 1.500-ms-Intervall; 1 Action; In-flight-Guard | Quiz-/Frage-/Lifecycle-Kontext | Läuft auch STOPPED; clearInterval + active-Flag; kein Abort |
| Moderation: skurrile Antworten | `getPresentationFunnyAnswers` | Eigentlich einmal je Kontext; tatsächlich Rückkopplung ohne Intervall auf `frage` | `frage`, `funny`, `aufloesung`; State-Schleife auf `frage` | Kein STOPPED-/Hidden-Guard; active-Flag verhindert alte Anwendung, unterbindet neue Generation nicht |
| Moderation: Ranglisten | Zwischenstand bzw. Quiz-/Jahreswertung | Sofort, dann 2.000 ms nach Antwort; 1 bzw. 2 Actions | Nur entsprechender Ranglistenslide | Shared Cleanup mit active/clearTimeout; kein Abort |
| Präsentation: Live | `getPraesentationStatus` + `getQuizLiveSnapshot` | Sofort, dann 750 ms nach dem Paar; 2 Actions | Gemounteter Player, auch vor Medienaktivierung | Kein STOPPED-Stopp; Cleanup active/clearTimeout; kein Abort |
| Präsentation: Ranglisten | Audience-Zwischenstand bzw. Quiz-/Jahreswertung | 2.000 ms nach Antwort; 1 bzw. 2 Actions | Ranglistenslide; Slide und Live-updatedAt als Kontext | Gleicher Shared Cleanup; kein Abort |
| Präsentation: funny / Schätzfrage | `getPresentationFunnyAnswers`, Schätzfragen-Lesen | Kontextabhängig einmalig | Entsprechender Slide / Frage | Funny-Set enthält Gleichheitsguard; keine identische Endlosschleife nachgewiesen |
| Antwortformular: Live | `/api/quiz/team-live-snapshot` | Sofort, dann 500 ms nach Antwort; normalerweise 1 | Gültige Teamsession | Läuft auch STOPPED; 401 entfernt Session und beendet künftiges Polling; active/clearTimeout, kein Abort |
| Antwortformular: vollständiger Status | Derselbe Endpoint, vollständiger Modus | Zusätzlicher bedingter Request / im Snapshot eingebetteter Status | Geänderte Revision / aktive Frage / Kontext | Revisionsübernahme kann Effect einmal neu starten; kein fortgesetzter Zyklus bei unveränderter Revision belegt |
| Auswertung | `getQuizEvaluationRevision` | Sofort, dann 2.000 ms nach Antwort; 1 Action | Gemountete Auswertung | Auch STOPPED; bei Revisionwechsel und ohne Bewertungssperre `router.refresh()`; Shared Cleanup |
| Pixel / Interaction | Obige Live-Snapshots | Keine zusätzliche eigene Netzwerk-Pollrate | Aktiver bzw. gespeicherter Interaction-Kontext | Lokale Uhr tickt 1 s ohne HTTP; Deadline-Finalisierung serverseitig bedingt |

Sonderfall **erstklassige Live-Umfrage**: `getLivePollPollingDelay` setzt für Moderations-, Präsentations- und Team-Live-Polls 1.200 ms sichtbar, 5.000 ms verborgen und exponentielles Fehler-Backoff bis 15.000 ms. Diese Behandlung gilt nicht generell für alle normalen Quizfragen. Antwortfortschritt und Auswertungs-Polls bleiben davon unabhängig.

Team-Drafts werden eingabe-/versionsabhängig verzögert gespeichert, nicht als pauschaler dauernder Poll. Absenden, Navigation, Bewertung, Resetbeobachtung und initiale Seiten-/Sessionzugriffe kommen als ereignisabhängige Last hinzu. Lokale Timer, Animationen und Screenshots sind selbst keine HTTP-Polls.

Quellstellen: `app/quiz/[quizId]/moderation/ModerationClient.tsx` (Live ab 346, Funny ab 690, Fortschritt ab 734), `app/quiz/[quizId]/praesentation/QuizPraesentationPlayer.tsx`, `app/quiz/[quizId]/antworten/QuizAntwortClient.tsx` (ab 345), `app/quiz/[quizId]/auswertung/QuizAuswertungClient.tsx`, `app/quiz/evaluation/pollEvaluation.ts`, `app/umfragen/livePollRuntime.ts`.

## 6. Erwartete Last eines Quizabends

Modell für 900 Sekunden, normale stabile Frageslides, je ein Moderator und eine Präsentation, N angemeldete Teams. Zunächst **nur legitimes Polling ohne den Bug**, ohne Netzwerklatenz und ohne Initial-/Bedienzugriffe:

- Moderator: 900/0,75 + 900/1,5 = 1.800 Requests.
- Präsentation: 2 × 900/0,75 = 2.400 Requests.
- Team: 900/0,5 = 1.800 Requests.
- Gesamt: **4.200 + 1.800 × N pro 15 Minuten**.

| Betrieb | Requests / 15 min ungefähr |
| --- | ---: |
| Nur 1 Moderator | 1.800 |
| Nur 1 Präsentation | 2.400 |
| Moderator + Präsentation + 3 Teams | 9.600 |
| Moderator + Präsentation + 10 Teams | 22.200 |
| Moderator + Präsentation + 20 Teams | 40.200 |
| Moderator + Präsentation + 40 Teams | 76.200 |

Das sind Intervall-Nennwerte: Antwortlatenz und gegebenenfalls Action-Serialisierung senken den Durchsatz; Interaktionen, Revisionwechsel und zusätzliche Tabs erhöhen ihn. Ein offenes Auswertungsfenster ergänzt nominal 450 Requests/15 min. Ranglisten ergänzen pro betroffenem Moderator/Player 450 (Zwischenstand) bzw. 900 (zwei finale Wertungen). Auf normalen Frageslides fallen diese Ranglistenabfragen nicht zusätzlich an.

Bei durchgehend sichtbarer erstklassiger Live-Umfrage ergibt sich stattdessen etwa 2.850 + 750 × N; verborgen etwa 1.140 + 180 × N, jeweils einschließlich Moderations-Antwortfortschritt und ohne Auswertungsfenster. Browser-eigene Timerdrosselung kann diese Zahlen weiter verändern, ist keine garantierte Anwendungskontrolle.

23.600 Requests wären somit mit etwa zehn tatsächlich aktiven Teams grundsätzlich bereits durch legitimes Polling plausibel. **Hier widerspricht die gemessene Verteilung dieser Erklärung als Hauptursache:** Nur ca. 4,7K Team-Snapshots stehen ca. 215K Moderation plus Live-Snapshot in zwei Stunden gegenüber.

Mit dem gefundenen Bug existiert keine belastbare Obergrenze aus den Pollingintervallen. Bei beispielsweise zehn Effect-Zyklen/Sekunde verursacht schon eine Moderation ungefähr 18.000 zusätzliche/ersetzende Schleifenrequests in 15 Minuten (je eine Action und ein Snapshot pro Zyklus), zuzüglich des separaten Fortschrittspolls. Nicht einfach 18.000 zur vollen regulären Snapshotrate addieren: der Neustart verdrängt häufig deren Timer. Mehrere Moderationstabs vervielfachen die Last, auch ohne Teams.

## 7. Konkreter Bug und gemessene Gegenprobe

**Datei:** `app/quiz/[quizId]/moderation/ModerationClient.tsx`, insbesondere 159–174, 334–407 und 690–709.

Mechanismus:

1. Der Funny-Effect hängt vom Objekt `aktuellerSlide` ab und ruft `getPresentationFunnyAnswers` auf.
2. Auf jedem Frageslide schreibt die Antwort `setFunnyQuestionIds(current => { const next = new Set(current); ...; return next; })`.
3. Auch bei null Antworten bzw. unveränderter Mitgliedschaft ist `next` ein neues Objekt.
4. `useMemo(..., [funnyQuestionIds, quiz])` baut neue Slides; `aktuellerSlide` erhält eine neue Identität.
5. Dadurch startet derselbe Funny-Effect sofort erneut. Ein inhaltlicher Zustandswechsel ist nicht erforderlich.
6. Zusätzlich ändert sich `applyLiveState`, weil es von `slides` abhängt. Der Live-Effect räumt seinen alten Timer auf und startet einen neuen **sofortigen** Snapshot. Die 750-ms-Pause wird umgangen.

Der Mechanismus benötigt weder Antworten noch Teams noch einen laufenden Countdown. Eine normale Frage reicht, auch wenn das Quiz STOPPED ist. Der bereits offene eigene Quiz-28-Tab wurde auf STOPPED/Frageslide 10 mit null Teams/Antworten vorgefunden. Kein neuer Reproduktionslauf wurde gestartet.

**Tatsächliche Logstichprobe**, alter AP4-Host `pubquiz-9m1nisjp0-just-phil-gud.vercel.app`, 14:40 UTC:

| Zeit | Request | Diagnostik |
| --- | --- | --- |
| 14:40:00.242 | POST `/quiz/28/moderation` und POST `/api/quiz/live-snapshot` | Snapshot queryCount 9 |
| 14:40:00.321 | dieselben beiden Pfade | Snapshot queryCount 9 |
| 14:40:00.403 | dieselben beiden Pfade | Snapshot queryCount 9 |
| 14:40:00.489 | dieselben beiden Pfade | Snapshot queryCount 9 |
| 14:40:00.581/582 | Snapshot / Moderation | Snapshot queryCount 9 |
| 14:40:01.475 | POST `/quiz/28/moderation` | `moderator-answer-status`, queryCount 12 |

Die ausgewählten aufeinanderfolgenden Paare liegen rund 79–93 ms auseinander. Das entspricht in diesem kurzen Ausschnitt etwa elf bis dreizehn Paaren pro Sekunde. Es ist eine Host-/Pfadstichprobe, keine isolierte Langzeitmessung eines einzelnen Tabs und kein Beweis, dass jede leere Moderations-Logzeile genau die Funny-Action ist. Zusammen mit dem deterministischen Codezyklus und den aggregierten nahezu gleichen Routezahlen ist es jedoch ein sehr starker Nachweis des Mechanismus. Ein normaler einzelner Snapshot-Poll dürfte frühestens nach 750 ms **plus** Antwortdauer wieder starten.

Historie: Die bedingungslose neue Set-Identität stammt laut `git blame` aus `9c722fa3` vom 25. August, 17:35 UTC. AP1 ergänzte später Lifecycle-Abhängigkeiten; AP5 hat diese Schleife nicht neu eingebaut. Der bereits in AP2 korrigierte andere instabile Effect ist damit kein Beleg, dass sämtliche ähnlichen Fälle beseitigt waren.

Weitere Prüfung:

- Keine primäre Akkumulation vergessener Intervalle: Cleanup ist vorhanden. Der Fehler ist das wiederholte Erzeugen einer neuen Effect-Generation.
- Kein Abbruch bereits laufender Requests per AbortController; alte Requests können DB-Arbeit fortsetzen. Active-Guards unterdrücken überwiegend verspätete Zustandsübernahmen.
- Auswertungsrevision ist inhaltsbasiert; `getPraesentationStatus` liest vorhandenen Status ohne bei jedem Poll `updatedAt` zu schreiben. Kein gleichartiger dauerhafter Refresh-Zyklus dort nachgewiesen.
- Normale Pollfehler werden ohne allgemeinen Backoff wiederholt, aber mit Wartezeit; Live-Umfragen haben Backoff. Das beobachtete erfolgreiche POST-Muster ist keine Fehler-Retry-Schleife.
- Reset-/Frage-/Lifecycle-Wechsel erneuern Kontexte legitim. Globales Abschalten bei STOPPED würde auch Resetbeobachtung und nachträgliche Auswertung beeinflussen und ist deshalb kein vorgeschlagener Sofortfix.

## 8. AP5-Testlast und CI-Korrelation

| UTC | Ereignis |
| --- | --- |
| ca. 12:41 | AP4-Preview-Deployment #150, Lauf `34123242451`, danach Host `9m1nisjp0` |
| 13:00:53 | AP4-Berichtscommit `825cae2`; Dokumentations-CI, kein neuer Runtime-Inhalt |
| 13:25 | Gemeldeter Beginn der B10-Anomalie |
| 13:34:13 | Erster AP5-Runtime-Commit `36bba85`; CI `34128157855` / `34128157936` |
| ca. 13:36–13:38 | AP5-Deployment #154, `34128383801`, Host `cqmu9qsxa` |
| danach | Erste reale Render-/Audioabnahme, lokale 304er-Geometrieprüfung |
| 13:57:17 | Korrektur `12b4abc`; CI `34130271929` / `34130271937` |
| ca. 13:59–14:01 | Deployment #156, `34130445043`, Host `2jqwx5gk2`; nachfolgend reale 304er-Matrix |
| 14:11:58 | Auswahlkorrektur `4bce410`; CI `34131638085` / `34131638208` |
| ca. 14:13–14:15 | Deployment #157, `34131809583`, Host `46zl77j4i` |
| danach bis 14:23 | Finale 304er-Previewmatrix, Screenshots und Audio-Stopp-Abnahme |
| 14:23:21 | AP5-Berichtscommit `bc382ae` |
| 14:20–14:35 | Weiter ca. 77K Preview-Requests, nachdem die finale Matrix abgeschlossen war |
| 14:40 | Weiter hochfrequente POSTs auf dem alten AP4-Host in bestehenden Logs |

Die vollständige AP5-Matrix war zum Alarmbeginn noch nicht im ersten AP5-Preview bereitgestellt. Die späteren automatisierten Matrizen können deshalb den Beginn um 13:25 nicht als unmittelbare Fixture-Last erklären. Bereits vor AP5 waren Preview-Quizfenster vorhanden; Quiz 28 wurde später auch durch alte, weiter offene Moderationsclients beobachtet.

**304 Kombinationen sind nicht automatisch 304 Seitenladungen.** Die Fixture ist eine Clientseite mit lokal umgeschalteten Fällen/Themes und veränderter Viewportgröße. Die 19 × 4 × 4-Kombinationen werden auf einer geladenen Seite durchgespielt. Die lokale Matrix und zusätzliche lokale 96er-Auswahlmatrix erzeugen keine Vercel-Seitenrequests. Screenshots und Geometrielesen erzeugen selbst keine App-Requests; Erstzugriff, neue Asset-URLs, Browser-Revalidierung und Medienladen dagegen schon. Die Fixture enthält keinen Quiz-Live-Poll.

Lastmodell pro realem Matrixlauf: `ein Seiten-Bootstrap + erstmalig benötigte JS/CSS/Fonts/Bilder + eventuelle Asset-Revalidierungen`, nicht `304 × kompletter Bootstrap`. Im warmen Cache ohne neue Medien ist ein weiterer Fixturezustand hinsichtlich eigener Datenabfragen **0 Requests**; dies ist eine Codeeigenschaft, kein nachträglich gemessener HAR. Die genaue Zahl eines kalten historischen Bootstrap ist nicht rekonstruierbar. Dafür wird keine erfundene „Requests pro Screenshot“-Zahl eingesetzt.

Empirische Begrenzung: In der zweistündigen Auswertung dominieren zu ungefähr 99 % fünf Live-/Action-Routen; sämtliche übrigen Routen einschließlich Fixtures, Assets, Login, Navigation und Smoke liegen zusammen nur in der Größenordnung weniger Tausend oder darunter. Die konkrete isolierte Matrixsumme ist nicht exakt verfügbar. Die beobachteten einzelnen Assetzahlen liegen im niedrigen zweistelligen Bereich. Eine alleinige Matrix-/Asseterklärung für zehntausende Live-Snapshot- und Moderations-POSTs ist damit ausgeschlossen.

CI baut und führt lokale Tests aus; sie startet keine 304 entfernten Browserseiten. `deploy-preview.yml` führt einen `curl`-Smoke auf `/` mit Redirectfolgen und höchstens drei Retries aus. Diese begrenzten Zugriffe erklären nicht die kontinuierlichen POST-Paare. Medien-/Audio-Tests erzeugen einzelne Ladevorgänge und Bedienbefehle. Ihr relevanter indirekter Beitrag sind die während und nach Tests offen gebliebenen Live-Clients: diese laufen weiter, auch beim Screenshot eines anderen Tabs und teilweise auf älteren Deployment-Hosts. AP5-Testbetrieb kann den vorhandenen Bug somit **verstärkt bzw. länger aktiv gehalten** haben; ein exakter Prozentanteil dieser indirekten Last ist nicht belegt.

## 9. Datenbank- und Kostenrisiko

Die aktuelle Stichprobe liefert **queryCount 9 pro Moderator-Live-Snapshot** und **12 pro Moderator-Antwortstatus**. Die vorhandene Implementierung zählt Prisma-Query-Events über `prisma.$on('query')` innerhalb des Diagnosekontexts, nicht bloß die Zahl der `findMany`-Aufrufe. Gemessene Snapshots hatten etwa 13–21 ms Gesamtdauer, viele etwa 14–17 ms; parallele SQL-Laufzeiten dürfen deren Summe überschreiten. Das ist eine kleine Stichprobe, keine p95-Latenzmessung.

Allein 38K Snapshots im Fenster 14:20–14:35 entsprechen bei neun Queries repräsentativ **ca. 342K SQL-Query-Events in 15 Minuten**, rund 380/s im Mittel. Das ist eine Hochrechnung aus aktueller Stichprobe und gerundeter Routezahl, keine vollständige historische DB-Zählung. Funny-Actions, Fortschritts-Actions, Auth-/Berechtigungsprüfungen, Präsentation und Auswertung kommen zusätzlich hinzu. Für die Funny-Action wurde kein verlässlicher eigener queryCount gemessen; sie liest Berechtigungen, Quizfrage samt Relationen und skurrile Teamantworten samt Relationen und ist auch bei null Ergebnissen nicht DB-frei.

`getQuizLiveSnapshotData` liest bereits im Grundpfad mehrere Tabellen; Relationen, Teamkontext, Live-Umfragen und Deadlinebehandlung erhöhen den Aufwand. Teilnehmer-Vollstatus kann zusätzlich teuer sein. Die Auswertungsrevision liest Antworten, Sessions und Quizfragen samt Interaction-Bezug, sie ist kein kostenloser In-Memory-Vergleich. Die Untersuchung hat keine Datenbankoperation direkt ausgelöst und keine Queryoptimierung durchgeführt.

Das führt zu unnötigen Preview-Neon-Abfragen und Vercel-Function-Aufrufen. Ob konkrete Neon-Sättigung oder Mehrkosten bereits entstanden sind, wurde nicht anhand einer vollständigen Abrechnung/DB-Metrik festgestellt. Kein Eurobetrag wird geschätzt. Das Kosten- und Skalierungsrisiko folgt bereits aus der fortgesetzten dynamischen Last. Auch der legitime Grundbetrieb mit 20/40 Teams ist requestintensiv; dessen Optimierung ist eine separate Entscheidung nach der Bugkorrektur.

## 10. Entscheidung und vorgeschlagener Fix-Auftrag

**Genau eine Ergebniskategorie: C – konkreter App-Bug.** Nicht A, weil ein unabhängiger Loop nachgewiesen ist; nicht bloß B, weil Intervallsteuerung umgangen wird. Die fehlende exakte historische Attribution einzelner Tabs ändert diese Entscheidung nicht.

**Risiko kritisch gemäß B10:** Ein einzelner normaler Moderationsclient kann ohne Benutzeraktion dauerhaft Requests auslösen, die nicht vom vorgesehenen Pollintervall begrenzt werden. Der beobachtete Spike betrifft Preview; Production-Betroffenheit ist für diese Einstufung nicht erforderlich. Niedrige Einzelrequest-Latenz beseitigt den Fehler nicht, sondern ermöglicht mehr Zyklen.

Vorgeschlagener separater Minimalfix, hier **nicht implementiert**:

1. Im Funny-Set-Updater bei unveränderter Mitgliedschaft exakt `current` zurückgeben; nur bei echtem Hinzufügen/Entfernen ein neues Set erzeugen.
2. Den Funny-Ladecontext auf stabile fachliche Werte (Quiz-ID, Slide-Typ, Assignment-ID, Lifecycle-Revision) statt kompletter Slide-Objektidentität beziehen. Existierende fachliche Aktualisierungstrigger erhalten.
3. Prüfen, dass eine tatsächliche Änderung der Funny-Slideliste höchstens eine begrenzte Live-Effect-Neusynchronisierung auslöst. Intervall, Lifecycle und Serververtrag unverändert lassen.

Architektur: Zustandsableitung und Slideaufbau bleiben im bestehenden Moderationsclient. Eine kleine reine Membership-Updatefunktion kann Identitätstreue testbar machen; keine neue Pollingarchitektur, keine neue Dependency und kein Verschieben serverseitiger Verantwortung sind nötig.

Notwendige Regressionen im Fix-Auftrag:

- Leere sowie unveränderte nichtleere Funny-Antworten über mehrere aufgelöste Promises: keine selbsttragende Effect-Kette, unveränderte Set-Identität.
- Echtes Hinzufügen und Entfernen: Funny-Slide bleibt korrekt und stabil; kein Index-/Auswahlverlust.
- Live-Snapshot-Requestzahl über kontrollierte Zeit im stabilen Kontext bleibt innerhalb der vorgesehenen Rate; unabhängiger 1.500-ms-Fortschrittspoll bleibt erhalten.
- Fragewechsel, RUNNING/STOPPED, Resetrevision und Unmount mit verspäteter Response: keine alte Zustandsübernahme, keine weiter registrierten Timer.
- Reale Preview-Abnahme mit einer Moderation, danach zwei Tabs; Methoden, Action und API über einen ausreichend langen Zeitraum getrennt zählen. Kein Test gegen Production.

Änderungsrisiko: gering bis mittel bei begrenztem Identity-Fix; insbesondere Funny-Slide-Aktualisierung und Auswahl müssen getestet werden. Pauschales STOPPED-Abschalten, längere Intervalle oder Caching könnten fachliches Liveverhalten ändern und sind **nicht** Teil des Minimalvorschlags. Ein neues Deployment allein beendet außerdem keine noch laufenden Clients alter Preview-Hosts; deren kontrolliertes Neuladen/Schließen muss bei einer späteren Freigabe mitbedacht werden. In B10 wurden sie nicht geschlossen.

## 11. Abschluss und offene Messgrenzen

Geänderte Datei: ausschließlich `docs/reports/b10-edge-request-spike.md`. Architektur unverändert. Typecheck und ESLint wurden in B10 nicht erneut ausgeführt, da weder Anwendungs- noch Testcode geändert wurde. Kein Build, kein Deployment, kein Push, kein Commit und keine Migration für diese Diagnose. Keine Benutzer-/Quiz-/Team-/Antwortdaten geändert. main und Production wurden nicht verändert.

Offen bleiben die genaue rollierende Alarmperiode für 23.600, die vollständige historische Aufteilung nach Action-ID und Browser-Tab, der kalte Fixture-HAR und die vollständigen Neon-/Abrechnungskosten. Diese Grenzen werden nicht mit Schätzpräzision verdeckt. Für den nächsten Auftrag ist keine spekulative Architekturänderung nötig: zuerst den konkreten Moderations-Identity-Loop beheben und anschließend dessen Wegfall messen. Bis dahin ist der Fehler offen; die zuletzt gemessene Last war weiterhin stark erhöht.
