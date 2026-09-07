# AP6 – Intro, QR und Teambeitritt: Abnahme

Stand: 7. September 2026. AP6 ist auf Preview implementiert und real abgenommen.
Runtime: `0a250b9601abc0b6b59f776df5727d719b24539a`.
[Finales Preview](https://pubquiz-niasltf8u-just-phil-gud.vercel.app).
Deployment: `dpl_5tyJiieCmMVHxBQPmEbGKFhPcyoU`.

## Ergebnis entsprechend den 29 Berichtspunkten

| Nr. | Gegenstand | Ergebnis |
| --- | --- | --- |
| 1 | Bisheriger Vertrag | `resolveQuizFlow` und `buildPraesentationSlides` projizierten Standard-, gespeicherte und Legacy-Intros. QR hatte Order 50, Regeln 60. Die bestehende QR-Teamprojektion zeigte maximal zwölf Teilnahmen. |
| 2 | Neue Reihenfolge | Wartebildschirm → Startsequenz → Willkommen → Preise → Regeln → QR → erster Fragenblock. Zusätzliche Intro-Stories bleiben erhalten und stehen ebenfalls vor QR. |
| 3 | QR zuletzt | Zentraler Flow-Vergleich priorisiert QR hinter anderen BEFORE_QUIZ-Inhalten desselben Ankers, unabhängig von alten Orderwerten. Browser: Regeln 5/15, QR 6/15, Block 1 auf 7/15. |
| 4 | Kein Auto-Übergang | QR blieb mehrere Minuten unverändert stehen. Weiter zum Block erfolgte ausschließlich per Moderationsbutton. |
| 5 | Datenquelle | Vorhandener Live-Snapshot und vorhandene Team-Query; zusätzliche lesende `joinObservation` im bestehenden View-Model. Keine zweite Join-Datenhaltung. |
| 6 | Neuer Join | Neue persistierte `quiz_team_session_id` nach der ersten stillen Baseline. Globale Team-ID oder Objektidentität sind keine Ereignisauslöser. |
| 7 | Animation | Vier Sekunden je Begrüßung, sanftes Ein-/Ausblenden, Teamname und vorhandener Avatar über `TeamIdentityVisual`. Reduced Motion unterdrückt die Bewegung bei gleicher Anzeigedauer. |
| 8 | Queue/Burst | Normale Joins nacheinander. Ab vier wartenden Teams Sammelanzeige mit Gesamtzahl, bis zu sechs Namen/Avataren und Restzahl. Laufende Anzeige bleibt bestehen. Eine einzelne 40er-Welle benötigt höchstens laufende Anzeige plus Sammelanzeige, also acht Sekunden. |
| 9 | Reload/Reconnect | Teamreload und Präsentationsreload erzeugten keine Begrüßung bestehender Teilnahmen. Team D nach neuer QR-Baseline wurde genau einmal begrüßt. AP1 bleibt erhalten: Präsentation öffnet in PREPARATION lokal zunächst auf Slide 1; erneute Moderationsnavigation führte zurück zum QR. |
| 10 | Reset/STOPPED | STOPPED zeigte „Quiz beendet“, sperrte die Antwortansicht und entfernte die aktive Projektion. Nach ausdrücklich freigegebenem Reset: PREPARATION, Slide 1, ungültige alte Teamsessions, leere QR-Liste. Team E danach genau einmal begrüßt. Revisions-/Queue-Cleanup zusätzlich automatisiert geprüft. |
| 11 | Avatar | Bestehendes Profil-/Fallback-System unverändert. Beispiel D: „Rennschnecke“ in Teamprofil, QR-Liste und Begrüßung. |
| 12 | Themes/Responsive | Standard, LOVD, Corporate und Storybook bei 1280×720, 1920×1080 und 2560×1440. Zwölf Geometrieprüfungen: QR vollständig im Slide und links außerhalb der Begrüßung. |
| 13 | CR07 | Nur die automatische sichtbare END_OF_BLOCK-Notiz „Gesammelt am Ende des Blocks“ entfernt. Der Auftrag bezeichnete sie sinngemäß als „Antworten am Ende des Blocks“. |
| 14 | Block/Reveal | Unveränderte Frage → Countdown/Pause → Auflösung. Browser: Frage 8/15, Countdown 9/15 mit vorhandener Steuerung, Auflösung 10/15 mit richtiger Antwort 7. Andere Moderationshinweise bleiben sichtbar. |
| 15 | Requestarchitektur | Kein zusätzlicher Poller, keine neuen Server-Actions, keine Requests oder Writes pro Animation. Bestehende QR-Query liefert alle Teilnahme-IDs; sichtbare Liste bleibt auf zwölf begrenzt. Payload wächst linear mit der Teamzahl, Zahl der SQL-Aufrufe dadurch nicht. |
| 16 | B10a | B10a-Regression weiterhin grün. Gleiche Snapshotdaten starten weder Effect noch Timer erneut; wachsende Queue verlängert laufende Anzeige nicht. Reale Moderations-Snapshotabstände etwa 0,83 s, keine 80-ms-Schleife. |
| 17 | Requestmessung | Drei feste Dreiminutenfenster unten. Finale QR- und normale Fragenphase liegen beide auf dem B10a-Niveau. Keine allgemeine Laststudie und keine Hochrechnung als Messung ausgegeben. |
| 18 | Living Specs | Neue `intro-team-join.md`, Rückverweise aus Lifecycle, Presentation Rendering und Submission-Live-State. |
| 19 | Neue Tests | Elf Queue-/Komponenten-/Architekturtests; zusätzlicher Flow-Builder-Fall mit Legacy-QR und dynamischer Story. Zwei bisherige Reihenfolge-Erwartungen an ausdrücklich neue fachliche Reihenfolge angepasst. |
| 20 | Qualität | 1078 Tests grün; TypeScript, repositoryweiter ESLint, Prisma-Validierung, Production-Build, Preview-CI, Deployment und Smoke grün. Details unten. |
| 21 | Browser | Eigenes Quiz 30, PREPARATION-Intro, reale Beitritte, Reloads, Start, Frage, Antwortzähler 1/4, Countdown, Auflösung, STOPPED, freigegebener Reset, neuer Join und echte Folge H→I geprüft. |
| 22 | Visuelle Nachweise | Screenshots und zeitgestützte Beobachtungen unten. Animation wurde live beobachtet; Screenshots sind ergänzende Nachweise. |
| 23 | Backlog | B05-Kopierdialog blieb unverändert; dessen bestehender Fehler verhinderte die Kopie, daher eigenes Quiz regulär angelegt. B10b-Team-Polling bleibt getrennt. Neu dokumentiertes bestehendes Darstellungsproblem: Standard-Regelfolie mit vier Regeln schneidet bei 1280×720 die unteren Regeln ab. Das unveränderte Regeln-CSS ist außerhalb der AP6-Positionskorrektur. Schmale Hochkant-Präsentationspanels benötigen ebenfalls eine eigene Layoutentscheidung. |
| 24 | Dateien | Vollständige Runtime-Dateiliste unten; dazu Living Specs, dieser Bericht und Nachweise. |
| 25 | Schema | Keine Schemaänderung, keine Migration, keine neue Abhängigkeit. |
| 26 | Commits | `2ccf53b` AP6-Implementierung; `0a250b9` QR-Höhenkorrektur aus realer visueller Abnahme. Bericht/Nachweise folgen als separater Dokumentationscommit auf dem Feature-Branch. |
| 27 | Finaler Runtime-Commit | `0a250b9601abc0b6b59f776df5727d719b24539a`, identisch auf Feature und Preview vor dem Dokumentationscommit. |
| 28 | Preview | [pubquiz-niasltf8u](https://pubquiz-niasltf8u-just-phil-gud.vercel.app), über den authentifizierten Preview-Branchalias real getestet. Deployment-ID und Commit aus GitHub-Deploymentzusammenfassung verifiziert. |
| 29 | Main/Production | `main` unverändert auf `e76f57dce19f26488cf9db24b881ab06bf004fd6`; Production-Deploymentjobs übersprungen. Ausschließlich eigenes Preview-Quiz verändert. |

## Architektur und Qualitätsnachweise

Flow/Slide-Builder behalten die fachliche Reihenfolge. Snapshot-Server behält die
bestehende Datenabfrage. Der Renderer wählt weiterhin den sichtbaren Slide.
Die neue reine Queue-Projektion trägt Deduplizierung, Revisionen und Burst-Regeln;
`TeamJoinWelcome` trägt nur Darstellung und einen lokalen Anzeigetimer. Die
QR-Höhenkorrektur liegt ausschließlich im Renderer-CSS. Anmeldung, Persistenz,
Submission und Bewertung bleiben in ihren bisherigen Modulen.

Die erste visuelle Prüfung fand bei voller Teamliste einen abgeschnittenen QR-Code
in LOVD. `0a250b9` begrenzt die quadratische QR-Fläche auf die verbleibende Höhe,
lässt ausschließlich die Informationsspalte scrollen und verschiebt die Begrüßung
rechts neben den Code. Die finale Abnahme verwendet diesen korrigierten Stand.

| Prüfung | Ergebnis |
| --- | --- |
| Vollständige lokale Tests | 1078 erfolgreich, 0 Fehler (392 + 508 + 11 + 167); AP1–AP5 einschließlich Pixel/B09, Bewertung, Audio und B10a enthalten |
| TypeScript | `npm run typecheck` erfolgreich, erneut nach CSS-Korrektur |
| Repository-ESLint | `npm run lint` erfolgreich, erneut nach CSS-Korrektur |
| Prisma | `npm run db:validate` erfolgreich mit CI-Validierungsumgebung |
| Production-Build | Erfolgreich; bestehender Hinweis auf mehrere Lockfiles im lokalen Worktree, kein AP6-Fehler |
| Finale CI | [CI 34144083198](https://github.com/justphilgud/pubquiz-web/actions/runs/34144083198) und [CI 34144083158](https://github.com/justphilgud/pubquiz-web/actions/runs/34144083158) erfolgreich: Tests, Prisma, TypeScript, Build und CI-Lint |
| Deployment/Smoke | [Deploy Preview 34144240623](https://github.com/justphilgud/pubquiz-web/actions/runs/34144240623) erfolgreich, Runtime und Smoke bestätigt |

## Reale Requests

Vercel Observability, Project pubquiz-web, Environment Preview, Gruppierung Request
Path und Filter auf jeweilige Deployment-ID. Zeiten am 07.09.2026 in Europe/Berlin
(UTC+2). Werte nach Ablauf der Fenster und mit Ingestionsabstand gelesen.

| Fenster | Runtime / Situation | Team-Snapshot | Präsentation | Live-Snapshot | Moderation |
| --- | --- | ---: | ---: | ---: | ---: |
| 18:33–18:36 | `2ccf53b`, QR, drei Teamclients | 918 | 390 | 212 | 120 |
| 18:45–18:48 | `0a250b9`, QR, vier Teamclients | ca. 1200 | 391 | 213 | 120 |
| 18:49–18:52 | `0a250b9`, normale Frage, vier Teamclients | ca. 1200 | 389 | 209 | 117 |

Vercel rundet die letzten Teamwerte als „1.2K“; sie werden deshalb bewusst nicht
als exakte 1200 angegeben. Das Antwortformular hatte im letzten Fenster genau
einen zusätzlichen Request für die eingegebene Testantwort. Statische Bilder,
Referenzseiten-Navigationen und Assets sind in den Rohtexten separat sichtbar.

Die feste Moderations-/Präsentationslast beträgt rund 240 Requests/Minute;
Teamclients liegen bei rund 100/Minute. Das entspricht der B10a-Modellbasis
von etwa 3625 + 1500×Teams je 15 Minuten. Die Messung mit drei/vier Clients
ist keine reale Lastmessung mit 10/20/40 Teams. Reloads im gemeinsamen Browser
verwenden dessen vorhandenen Session-Speicher; hier werden geöffnete Clients
gezählt, nicht unabhängige physische Endgeräte.

[Erstes QR-Fenster](assets/ap6/requests-qr-initial.txt),
[finales QR-Fenster](assets/ap6/requests-qr-final.txt),
[Fragenfenster](assets/ap6/requests-question-final.txt).
[Live-Snapshot-Stichprobe](assets/ap6/qr-live-snapshot-log-sample.txt):
18:47:26.60 → 27.43 → 28.28 → 29.11, dann 30.78 in der dargestellten Logauswahl.
QR-Snapshot dort 1738 Payload-Bytes und 12 SQL-Aufrufe; kein Request pro Frame.

## Reale Browser- und Animationsabnahme

Eigenes Preview-Quiz **30 „Codex AP6 Intro und Teambeitritt“**, eine vorhandene
freigegebene Standardfrage, eigener Block 1. Kein fremdes Quiz geändert.
Regeln und QR wurden in PREPARATION durchlaufen; QR blieb weit länger als
30 Sekunden stehen. A, B, C traten bei, danach Reloads und D. Der neue D-Join
wurde zeitlich erfasst und verschwand ohne Wiederholung.

Start setzte RUNNING, ließ QR bestehen. Manuell folgten Block 1 und Frage.
Testantwort 7 wurde gespeichert; Moderator zeigte 1 Antwort / 4 Teams (25 %).
Countdownsteuerung und gesammelte Auflösung blieben funktionsfähig.
STOPPED sperrte die Teamansicht. Der Nutzer gab anschließend das Löschen der
vier Testteilnahmen und einer Testantwort ausdrücklich frei. Reset führte zu
PREPARATION, Slide 1 und leeren Teilnahmen; alte Teamclients erhielten die
bestehende Session-ungültig-Meldung. E nach Reset wurde einmal begrüßt.

Zusätzliche Beitritte F/G und eine durchgängig beobachtete echte Folge H/I
prüften die Queue. H sichtbar 18:58:16.947–20.350, I ab 18:58:21.014 bis 23.731,
ab 24.401 keine Anzeige mehr. Die lokale synthetische Dreierqueue zeigte
ebenfalls 1 → 2 → 3 → leer. Ein synthetischer 20er-Burst zeigte eine Sammelkarte
mit sechs Avataren/Namen und „+14 weitere“. Synthetische Referenzen erzeugen
keine gespeicherten Quizteilnahmen.

[Echte Queue mit Zeitstempeln](assets/ap6/real-queue-continuous.json),
[D nach Reload](assets/ap6/actual-team-d-observation.json),
[E nach Reset](assets/ap6/reset-join-observation.json),
[synthetische Dreierqueue](assets/ap6/queue-observation.json).

Alle Live-Testtabs wurden nach Abschluss geschlossen. Quiz 30 bleibt mit dem
zweiten eigenen Testlauf in PREPARATION; darin fünf Testteilnahmen E–I,
keine neue Testantwort. Globale Testprofile A–I bleiben gemäß Resetvertrag erhalten.

## Visuelle Nachweise

Alle Screenshots zeigen eigene Testinhalte oder synthetische Rendererreferenzen;
keine Login-/Passwortansichten. Interne Referenzbedienung ist in einigen
Screenshots am unteren Rand sichtbar und gehört nicht zur Quizpräsentation.

| Nachweis | Screenshot |
| --- | --- |
| Regeln vor QR | [Regeln, 5/15](assets/ap6/rules-final-1280.png) |
| Regulärer QR-Slide | [QR mit drei Teams](assets/ap6/qr-final-three-teams.png) |
| Reale Begrüßung | [Team D](assets/ap6/actual-team-d-welcome.png) |
| Echte Queue | [H](assets/ap6/real-queue-1.png), [I](assets/ap6/real-queue-2.png) |
| LOVD-Burst | [20 Teams mit Restanzeige](assets/ap6/lovd-join-final-1280.png) |
| Reset | [Leerer QR](assets/ap6/reset-empty-qr.png), [neuer Join E](assets/ap6/reset-new-team-e.png) |
| Block/Reveal | [Frage](assets/ap6/question-final.png), [Auflösung](assets/ap6/solution-final.png), [STOPPED](assets/ap6/stopped-final.png) |

| Theme | 1280×720 | 1920×1080 | 2560×1440 |
| --- | --- | --- | --- |
| Standard | [Bild](assets/ap6/standard-1280.png) | [Bild](assets/ap6/standard-1920.png) | [Bild](assets/ap6/standard-2560.png) |
| LOVD | [Bild](assets/ap6/lovd-1280.png) | [Bild](assets/ap6/lovd-1920.png) | [Bild](assets/ap6/lovd-2560.png) |
| Corporate | [Bild](assets/ap6/corporate-1280.png) | [Bild](assets/ap6/corporate-1920.png) | [Bild](assets/ap6/corporate-2560.png) |
| Storybook | [Bild](assets/ap6/storybook-1280.png) | [Bild](assets/ap6/storybook-1920.png) | [Bild](assets/ap6/storybook-2560.png) |

[Geometrien aller zwölf Kombinationen](assets/ap6/responsive-geometry.json).
Die Animationen verändern beim Ein-/Ausblenden kurz ihre Deckkraft; die
zeitlichen Beobachtungen ergänzen deshalb die einzelnen Bildzeitpunkte.
Temporäre Viewport-Vorgaben wurden nach der Prüfung zurückgesetzt.

## Separates Backlog-Finding AP6-F01

Status: offen, außerhalb AP6. Standard-Regelfolie mit vier kurzen Regeln bei
1280×720: Untere Listeneinträge werden durch den bestehenden Inhaltsrahmen
abgeschnitten. Reproduktion: Quiz 30, Regeln auf Slide 5, 1280×720.
Erwartung eines späteren Layoutauftrags: Alle vier Regeln vollständig lesbar,
ohne Änderung der Reihenfolge oder Inhalte. Nachweis: Regelscreenshot oben.
AP6 ändert die Regeln-Darstellung nicht; die neue Höhenbegrenzung gilt nur für
`data-flow-type="QR_CODE"`.

## Geänderte Runtime-Dateien

- `app/globals.css`
- `app/quiz/[quizId]/QuizFragenSortableTable.tsx`
- `app/quiz/[quizId]/moderation/ModerationClient.tsx`
- `app/quiz/[quizId]/moderation/components/CurrentSlidePanel.tsx`
- `app/quiz/[quizId]/praesentation/QuizPraesentationPlayer.tsx`
- `app/quiz/[quizId]/praesentation/buildPraesentationSlides.ts`
- `app/quiz/[quizId]/praesentation/buildPraesentationSlides.test.ts`
- `app/quiz/[quizId]/slides/intro/page.tsx`
- `app/quiz/fixedSlidesPolicy.ts`, `app/quiz/fixedSlidesPolicy.test.ts`
- `app/quiz/flow/quizFlow.ts`, `app/quiz/flow/quizFlow.test.ts`
- `app/quiz/interaction/interaction.server.ts`
- `app/rendering/presentation/PresentationSlideRenderer.tsx`
- `app/rendering/presentation/TeamJoinWelcome.tsx`
- `app/rendering/presentation/teamJoinQueue.ts`
- `app/rendering/presentation/teamJoinQueue.test.ts`
- `app/rendering/presentation/presentationQualityFixtures.ts`
- `app/templates/presentation-quality/PresentationQualityPreview.tsx`
- `package.json`

Keine offenen AP6-Blocker. B05, B10b, das bestehende Abschneiden der Regelliste
bei 1280×720 und allgemeine Hochkant-/Mobile-Präsentationsgestaltung wurden
nicht nebenbei implementiert. Der Regelscreenshot belegt die Position vor QR,
keine fehlerfreie vollständige Regellayoutdarstellung.
