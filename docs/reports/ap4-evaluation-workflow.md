# AP4 – Bewertungs- und Ergebnisworkflow

Stand: 2026-09-07. AP4 auf Preview technisch und im realen Browser erfolgreich abgenommen.
B07 und B08 sind auf dem finalen Runtime-Commit behoben.

## 1–2. Reproduzierte Ursachen B07/B08

Vor der Änderung auf B09-Preview, eigenes Quiz 27 mit drei eigenen Testteams:
Standardantwort von Team B (`sieben`, Musterlösung `7`) von REVIEW_REQUIRED auf
CORRECT gesetzt. Die Aktion speicherte einen Punkt und leitete danach auf
`/fragen` um. Ein neu geöffnetes Auswertungsfenster zeigte den gespeicherten Punkt,
das bereits geöffnete zweite Fenster zeigte weiter null. Mit Team C wiederholt.
Die geöffnete Siegerfolie blieb nach der Bewertung von Team C bei null Punkten.

B08: `updateTeamAntwortBewertung` rief nach dem Commit
`updateQuizFragenStatistiken` auf. Dessen globales `requireAdmin` leitete den
berechtigten Event-Manager auf `/fragen` um. Dadurch wurde die nachfolgende
Revalidation nicht mehr erreicht. B07: Auswertungsfenster hatten keinen eigenen
Ergebnisabgleich; Ergebnisfolien luden nur bei Slide-/Lifecycle-Änderungen neu.

## 3–6. Aktualisierungsweg und Quelle der Wahrheit

Bisher: Transaktion → globaler Statistikaufruf → Auswertungs-Revalidation.
Neu: berechtigte, revisionsgeschützte Transaktion mit zentraler Neuberechnung →
Auswertungs-Revalidation → React-/Router-Refresh. Weitere Auswertungsfenster prüfen
einen Inhaltsfingerabdruck; Ergebnisfolien wiederholen ihre vorhandenen Leser.
Persistierte `team_antworten` bleiben die Wahrheit. Keine optimistischen Punkte,
kein Vollreload und keine neue clientseitige Bewertungsdatenhaltung.

## 7–8. Navigationskorrektur

Der redundante globale Admin-Statistikaufruf entfällt. Der zentrale Evaluator
aktualisiert die betroffenen Statistiken bereits innerhalb der Transaktion.
Manuelle Fehler werden als Ergebnis zurückgegeben und in derselben Ansicht gezeigt.
Alle Bewertungsbuttons hatten bereits einen expliziten Typ; kein Parent-Form-
Submit, Link oder `router.push/replace` war die reproduzierte Ursache.

## 9–11. Sequenzen, Änderungen und Konkurrenz

Bewertungen ersetzen Werte und berechnen abhängige Punkte erneut. Die Quiz-Sperre
serialisiert den betroffenen Ablauf mit den bestehenden AP1/AP2-Schreibpfaden.
Die Antwort wird erst unter der Sperre gelesen. Ein abweichender Inhaltsfingerabdruck
weist einen veralteten Fensterstand ab. Bestehender Schutz manueller Overrides bleibt.
Client-Sperre und React-Transition verhindern doppelte Aktionen während Speichern
und Refresh. Abrufe überlappen nicht; Antworten verlassener Ansichten werden ignoriert.

## 12–13. Gesamtsummen und Matrix

Antwortliste, Gesamtsummen, Matrix und Backfillstatus werden aus einem gemeinsamen
Repeatable-Read-Snapshot gelesen. Auch getrennte Ergebnisleser lesen ihre
Teilprojektionen konsistent. Der anonyme Zwischenstand bleibt anonym.
Geöffnete Matrixdetails beziehen ihren Inhalt aus der neuesten Matrix; Auswahl,
Teamidentität, Filter und Tab bleiben UI-Zustand.

## 14–15. AP1/AP2 und Living Specification

Keine Änderung von Drafts, Submissions, Antwortzählern, Runs, Fragenzuständen,
Präsentationsposition oder Lifecycle durch Bewertung bzw. Ergebnisaktualisierung.
Keine Änderung an der automatischen Punkteformel. Neue Spezifikation:
[evaluation-workflow.md](../architecture/evaluation-workflow.md), verlinkt aus
Lifecycle, Submission-Live-State, Answer Interaction und Runtime-Verträgen.
Sie enthält SCORE-INV-01 bis SCORE-INV-12.

## 16–17. Tests und technische Qualität

15 zusätzliche Tests für Revisionsänderungen, zehn aufeinanderfolgende
Revisionsprüfungen, stale/duplicate Requests, Abrufreihenfolge, Fehler/Retry,
späte Responses, Navigations- und Schreibgrenzen sowie Matrix-/Folienaktualisierung.
Der bestehende Loader-Test prüft nun ausdrücklich den gemeinsamen Snapshot.
Bestehende fachliche Scorer- und AP1/AP2/AP3-Tests bleiben unverändert.

- Vollständige Testsuite: 1.048 erfolgreich (391 + 508 + 149).
- TypeScript: erfolgreich.
- Repositoryweiter ESLint: erfolgreich.
- Prisma-Validierung: erfolgreich; keine Client-Neugenerierung erforderlich.
- Production-Build: erfolgreich. Der erste Versuch scheiterte
  an gesperrten Google-Font-Downloads; mit Netzwerkzugriff war der Build ausführbar.
- Preview-CI #144 und Feature-CI #145 erfolgreich. Deployment #150
  (`34123242451`) und integrierter Smoke-Test erfolgreich.

## 18. Reale Browserabnahme

Setup angelegt: eigenes Quiz **Codex AP4 Bewertung E2E 2026-09-07**, ID 27.
Drei ausdrücklich freigegebene Testteams Codex AP3 A/B/C, Pixel-Stufenfrage mit
drei REVIEW_REQUIRED-Antworten und Standardfrage mit einer automatisch korrekten
Antwort sowie zwei zunächst prüfpflichtigen Antworten. Alle relevanten Antworten
finalisiert, Quiz laufend, Präsentation auf Siegerfolie 17/21.

Nach Deployment wurden folgende **14 erfolgreiche Bewertungen** einzeln im
sichtbaren Browserzustand kontrolliert (Q2 = Pixel-Stufe 1, Q3 = Standardfrage):

| Nr. | Team / Frage | Aktion | Bestätigter Zustand / Einzelpunkte |
|---|---|---|---|
| 1 | B / Q3 | Falsch, Tastatur | WRONG / 0 |
| 2 | B / Q3 | Teilweise, 0,5 | PARTIAL / 0,5 |
| 3 | B / Q3 | Richtig | CORRECT / 1 |
| 4 | C / Q3 | Falsch | WRONG / 0 |
| 5 | C / Q3 | Richtig | CORRECT / 1 |
| 6 | A / Q3 | Falsch | WRONG / 0, automatische Basis bleibt 1 |
| 7 | A / Q3 | Bewertungs-Reset | CORRECT / 1, Quelle AUTO |
| 8 | A / Q2 | Richtig | CORRECT / 1, Teamgesamt 2 |
| 9 | B / Q2 | Richtig | CORRECT / 1, Teamgesamt 2 |
| 10 | C / Q2 | Falsch | WRONG / 0 |
| 11 | C / Q3 | Falsch, Mausklick | WRONG / 0 |
| 12 | C / Q3 | Richtig, Doppelklick | CORRECT / 1, keine Punktverdopplung |
| 13 | C / Q3 | Falsch, zwei Fenster gleichzeitig | Ein Erfolg, zweiter Versuch mit Revisionskonflikt abgewiesen; beide Fenster WRONG / 0 |
| 14 | C / Q3 | Richtig, Mausklick | CORRECT / 1 |

Zusätzlicher Fehlerfall: 2 Teilpunkte bei maximal 1 Punkt wurden mit
„Die Punktzahl passt nicht zum gewählten Bewertungsstatus.“ abgewiesen.
Die zuvor bestätigte Bewertung CORRECT / 1 blieb erhalten; kein Seitenwechsel.
Der verworfene parallele Versuch zeigte „Die Bewertung wurde inzwischen geändert.
Bitte den aktuellen Stand prüfen und erneut bewerten.“.

Das zweite Fenster aktualisierte seine Punktestandstabelle und später die bereits
geöffneten Matrixdetails ohne Reload. Bei Aktion 8 blieb die Zelle A/Q2 geöffnet
und zeigte danach Richtig, 1 Einzelpunkt und 2 Teamgesamtpunkte. Im ersten Fenster
blieben Block 1 und die jeweils ausgewählten Teams A/B/C erhalten. Alle Routes
blieben `/quiz/27/auswertung`. Beim letzten Mausklick betrug die gemessene
Scrollposition vorher und nachher exakt 632 px. Beim Entfernen des Fehlerhinweises
zuvor verringerte sich die Dokumenthöhe entsprechend; kein Sprung zum Listenanfang.
Alle 30 sichtbaren Bewertungsbuttons besitzen `type="button"` und keinen Parent-Form.

Endstand **A 2 / B 2 / C 1**; Pixel Q2 **1 / 1 / 0**, Standard Q3 **1 / 1 / 1**.
Die Siegerfolie und Moderationsvorschau wechselten den sichtbaren Punktestand von
C zwischen 0 und 1 ohne Slidewechsel. Das Quiz blieb RUNNING, Slide **17/21**.
Anschließender echter Reload von Auswertung und Moderation: identische
Punktestandzeilen, identische Antwortzeilen von C und unveränderte Präsentationsposition.
Die Testdaten bleiben als Nachweis erhalten; kein Quizreset durchgeführt.

Die automatisierten Regressionen decken zusätzlich AP1 Start/Stop/Reset,
Aus-/Einblenden, AP2 Zähler/Draft/Final/Blockclose, Ordering, strukturierte Antworten,
Pixel Challenge und Stufenwertung 3/2/1 ab. Diese Pfade wurden im AP4-Browser nicht
noch einmal vollständig durchgespielt; die reale Abnahme konzentriert sich auf B07/B08.

Nachweise: [Browserdaten](ap4-browser-evidence.json),
[alter Punktestand](ap4-before-stale.png), [alte Präsentation](ap4-before-presentation.png),
[Antwortstand nach Konflikt](ap4-conflict.png),
[Live-Gesamtpunkte mit Konflikthinweis](ap4-scores-live.png),
[finale Matrix](ap4-matrix-final.png), [Live-Präsentation](ap4-presentation-live.png).
Die Screenshots enthalten ausschließlich das eigene Testquiz und synthetische Testteams.

## 19. Bewusst nicht behobene Nebenbefunde

Im bestehenden Quizkopierdialog funktionierte die Schaltfläche zum Anlegen nicht
zuverlässig, der Tastatur-Submit hingegen schon (bekanntes B05, ausdrücklich außerhalb
AP4). Auch die Suchschaltfläche der Inhaltsauswahl benötigte beim Test einen
Tastatur-Submit. Beide Befunde werden hier festgehalten, ohne angrenzende UI umzubauen.
Bei der AP4-Abnahme blockierte zudem ein offener Vercel-Share-Dialog Mausklicks;
nach Dismiss/Escape funktionierten sie. Das war eine Browserüberlagerung, kein
Bewertungsfehler. Die Suchschaltfläche ist deshalb als Nebenbefund mit noch offener
Ursacheneinordnung zu verstehen.
Die bestehende GitHub-Workflow-Warnung zu Node-20-Actions unter Node 24 bleibt
außerhalb des AP4-Scopes.

## 20. Geänderte Dateien

- `app/quiz/actions.ts`, `quizAccess.server.ts`: Mutation, Revision, konsistente Leser.
- `app/quiz/evaluation/evaluation.server.ts`: Sperrreihenfolge und Snapshot-Unterstützung.
- `evaluationRevision.ts`, `pollEvaluation.ts`: Fingerabdruck und Abrufsteuerung.
- `evaluationWorkflow.test.ts`, `evaluationLifecycle.test.ts`, `package.json`: Tests.
- `app/quiz/[quizId]/auswertung/{page,QuizAuswertungClient}.tsx`: Refresh, Fehler, Auswahl.
- `app/quiz/evaluation/TeamQuestionEvaluationMatrix.tsx`: aktuelle Detailprojektion.
- `app/quiz/[quizId]/moderation/ModerationClient.tsx`: Ergebnisabruf.
- `app/quiz/[quizId]/praesentation/{QuizPraesentationPlayer.tsx,statusActions.ts}`: Ergebnisabruf/-Snapshot.
- Architektur-Spezifikation und vier Querverweise; dieser Bericht und Browsernachweise.

## 21–25. Schema, Commits, Preview und Production

Keine Schemaänderung, Migration oder neue Abhängigkeit.
Arbeitsbranch `codex/ap4-evaluation` auf Basis `0f17f3b` (B09-Runtime `108f4cb`).
Runtime-Commit: `2df6283aad3d7bc0a448b110e2436de2248fbff3`, auf Feature- und Preview-Branch veröffentlicht.
Preview-CI: #144 (`34123072174`); Feature-CI: #145 (`34123072303`).
Preview: https://pubquiz-9m1nisjp0-just-phil-gud.vercel.app
Deployment-ID: `dpl_EEUmpNbBmKYg3Ch9F3JvUXuZn9NA`.
Browserabnahme auf genau dieser Deployment-Adresse erfolgreich.
Remote-Preview vor Integration: `108f4cbc6dc7729f47166d4223645de77aa34746`.
`main` vor Integration: `e76f57dce19f26488cf9db24b881ab06bf004fd6`.
Keine Änderungen an main/Production beauftragt oder vorgenommen.
