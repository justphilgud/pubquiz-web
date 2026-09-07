# AP1 – Implementierungs- und Abnahmebericht

Stand: 7. September 2026. Basis: aktueller Preview-Commit `e76f57d`, gemäß
ausdrücklicher Entscheidung des Auftraggebers. Umsetzung im Worktree
`.worktrees/ap1-quiz-lifecycle`, Branch `codex/ap1-quiz-lifecycle`.
Der alte lokale Arbeitsstand einschließlich vorhandener fremder Änderungen bleibt
erhalten. `main` und Production wurden nicht verändert.

## 1–6. Befund und fachliche Umsetzung

Der alte Start hing am Abspielen der Startsequenz, Stop war nur lokaler UI-State,
und das Laden synchronisierte einen alten Präsentationszustand. Eine explizite
Durchlaufbereinigung fehlte. Freigaben kannten keine reversible Fragensichtbarkeit;
erneutes Besuchen finaler Fragen konnte neue leere Run-Kontexte erzeugen.

AP1 erweitert den vorhandenen Präsentationsstatus und die Interaction-Runs:

- PREPARATION erlaubt Vorbereitung, Teambeitritt und Testantworten ohne Start.
- Explizites Starten persistiert die Startzeit einmalig; Doppelklick bleibt konsistent.
- RUNNING stellt die Live-Position bei Reload wieder her. Die Präsentation benötigt
  zusätzlich eine lokale Browseraktivierung für die Medienwiedergabe.
- STOPPED bleibt nach Reload erhalten, schließt Antwortannahme/Blöcke, finalisiert
  vorhandene nichtleere Drafts über die bestehende Bewertungslogik und stoppt Medien.
- Bestätigter Reset löscht nur die beschriebenen quizbezogenen Laufzeitdaten und
  setzt Vorbereitung/Slide 1 wieder her. Globale Teamprofile und Quizinhalt bleiben.
- Rücknavigation blendet nachfolgende Fragen aus. Manuelles Aus-/Einblenden erhält
  Antworten und Run-Identität. Finalisierte Antworten bleiben finalisiert.

UI-Komponenten behalten Darstellung und Bedienung. Fachzustand, Freigaben,
Transaktionen und Schreibsperren liegen in den bestehenden Services beziehungsweise
kleinen gemeinsamen Lifecycle-Hilfen. Quiz-Row-Lock und Durchlaufrevision schützen
Start/Stop/Reset und alte Moderatorbefehle.

## 7–8. Living Specification und Regressionen

Verbindlicher Vertrag: [quiz-lifecycle.md](./quiz-lifecycle.md).
`AGENTS.md` verpflichtet künftig zum Lesen, Hinterfragen, Testen und Aktualisieren
der betroffenen Living Specification. `answer-interaction.md` verweist darauf.

Zehn zusätzliche Lifecycle-Regressionen ordnen A–H und INV-01–12 zu. Sie kombinieren
Verhaltenstests der Zustands-/Freigabeauswahl mit Architekturprüfungen der
Serveraktionen und einem Lock-Reihenfolgetest. Hinzu kommen zwei Tests für die
auf Preview begrenzte direkte Prisma-CLI-Verbindung.
Die früheren Erwartungen „Audio startet Quiz“, „Player hat keine Buttons“ und
„finale Standardfrage erzeugt neuen Run“ wurden wegen ausdrücklicher neuer
Fachanforderungen geändert; Bewertungstests wurden nicht abgeschwächt.

## 9. Qualitätsprüfung und reale Browserabnahme

- Vollständige Testsuite: 997 Tests (343 + 505 + 149), keine Fehler.
- TypeScript: erfolgreich.
- ESLint der geänderten Dateien: erfolgreich; CI prüft zusätzlich den Gesamtbestand.
- Prisma-Schema validiert und Client generiert.
- Production-Build erfolgreich; auch durch die blockierende GitHub-CI verifiziert.
- Additive Migration `20260907120000_quiz_lifecycle` in Preview erfolgreich angewandt.

Eigens über die Oberfläche erstelltes Testquiz: **21 – Codex AP1 Lifecycle E2E
2026-09-07**. Keine vorhandenen Quizdaten zurückgesetzt. Zwei normale Fragen im
gemeinsamen Block, anschließend eine vorhandene Audiofrage ergänzt. Die zentralen
Lifecycle-Tests liefen auf Deployment `6643a5e`.

| Test | Im Preview-Browser beobachtet |
| --- | --- |
| A | Moderation, Präsentation, QR-Slide und Teambeitritt: weiterhin Vorbereitung / Nicht gestartet. |
| B | Expliziter Start mit Doppelklick: Laufend; nach Reload weiterhin Laufend. |
| C | Aktivierungsoverlay erforderlich. Im Storybook-Template Audio vorher `paused=true`, danach `paused=false`, kein Medienfehler, Fortschritt bis 20,397 Sekunden. |
| D | Zwei Preflight-Antworten gespeichert und per Blockschließung finalisiert. Bestätigter Reset: Teams 0, Auswertung 0 Treffer, alte Teamsitzung ungültig, keine Freigabe, Slide 1. |
| E | Frage 1 → Frage 2 → Frage 1: zweite Frage verschwindet nach Polling; beim Wiederbesuch ist „AP1 Testantwort B“ erhalten. Entspricht demselben Übergang wie Frage 6 → 7 → 6. |
| F | Manuelles Aus-/Einblenden erhält den Antworttext. Nach endgültigem Blockschließen bleiben beide Abgaben einschließlich Bewertung bei erneutem Vor-/Zurücknavigieren in der Auswertung erhalten. |
| G | RUNNING-Reload von Moderation und Präsentation auf Slide 8 erhält Position; Team-Reload erhält Antwort „7“. Stop finalisiert sie mit einem Punkt. |
| H | Reset aus späterer RUNNING-Position stellt Slide 1 und Vorbereitung wieder her, auch nach erneutem Öffnen. |

Zusätzlich: Stop bleibt nach Reload als „Beendet“ in der Moderation und
„Quiz beendet“ im Player sichtbar. Das globale Testteam kann sich nach Reset mit
seinem bestehenden Zugang erneut anmelden. Abschließender Zustand des Testquiz:
PREPARATION, Slide 1, keine Teams oder Antworten.

Ergänzende Prüfung auf Deployment `a28cb21`: Das Teamformular zeigt Vorbereitung
und Beendet korrekt. Auch mit ausgefülltem Teamnamen bleibt der Beitritt nach Stop
gesperrt. Anschließender Reset stellt die Anzeige Vorbereitung wieder her.

## 10. Geänderte Dateien

Fachlogik und UI:

- `app/quiz/quizLifecycle.ts`, `app/quiz/quizLifecycle.server.ts`
- `app/quiz/quizAnswerLiveState.ts`, `app/quiz/actions.ts`
- `app/quiz/interaction/interaction.server.ts`, `interactionRunReuse.ts`
- `app/quiz/[quizId]/praesentation/statusActions.ts`, `QuizPraesentationPlayer.tsx`
- `app/quiz/[quizId]/moderation/ModerationClient.tsx`, `components/QuizLifecycleControls.tsx`
- `app/quiz/[quizId]/antworten/QuizAntwortClient.tsx`
- `app/rendering/presentation/presentationLiveState.ts`
- `app/teams/teamSession.server.ts`, `app/umfragen/livePollRuntime.server.ts`

Schema, Betrieb und Dokumentation:

- `prisma/schema.prisma`, `prisma/migrations/20260907120000_quiz_lifecycle/migration.sql`
- Sieben erzeugte Prisma-Dateien unter `app/generated/prisma/`
- `prisma.config.ts`, `scripts/prisma-cli-connection.ts`
- `AGENTS.md`, `docs/architecture/answer-interaction.md`, Living Specification und dieser Bericht

Tests:

- `app/quiz/quizLifecycleRegression.test.ts`, `quizLifecycle.test.ts`
- `app/quiz/interaction/interactionArchitecture.test.ts`, `liveResultCloseRegression.test.ts`
- `app/rendering/presentation/presentationLiveState.test.ts`, `presentationOutputPolicy.test.ts`
- `scripts/prisma-cli-connection.test.ts`, `scripts/ci-workflows.test.ts`

## 11–12. Commits und Deployment

- `6643a5e`: Lifecycle, Navigation, Reset, Dokumentation und Regressionen.
- `50fbab7`: Lifecycle-Anzeige auch im Teamformular.
- `26b4004`: direkte Neon-Verbindung für die Prisma-CLI ausschließlich in Preview.
- `a6650b6`: lesende Diagnose des bereits belegten Preview-Migrationslocks
  (`package.json`, `scripts/inspect-preview-migration-lock.ts`).
- `a28cb21`: eng begrenzter Wiederherstellungsversuch für die zuvor identifizierte
  inaktive Pooler-Sitzung. Beim Ausführen war kein Lockhalter mehr vorhanden;
  es wurde keine Verbindung beendet. Diagnose, Freigabe und npm-Hook sind im
  abschließenden Stand wieder entfernt.

Erstes erfolgreiches [Preview-Deployment #118](https://github.com/justphilgud/pubquiz-web/actions/runs/34093067312)
mit Migration und Smoke-Test:
[AP1 Preview](https://pubquiz-nq9s9e0nr-just-phil-gud.vercel.app).
Neuester geprüfter [CI-Lauf #119](https://github.com/justphilgud/pubquiz-web/actions/runs/34095380963).
Die zwischenzeitlichen Folge-Deployments scheiterten an einem bestehenden Prisma-
Advisory-Lock einer inaktiven PgBouncer-Sitzung. Im
[Wiederherstellungslauf #127](https://github.com/justphilgud/pubquiz-web/actions/runs/34096092670)
war der Lock bereits freigegeben; Migration und anschließende Statusprüfung
liefen erfolgreich durch. Keine Datenbankverbindung musste beendet werden.
Auch Vercel-Deployment und Smoke-Test sind erfolgreich:
[aktualisierte AP1 Preview](https://pubquiz-3473f3f9p-just-phil-gud.vercel.app).
Der abschließende Commit entfernt ausschließlich die temporäre Betriebsdiagnose
und ergänzt diesen Bericht; die geprüfte Anwendungslogik bleibt identisch.

## 13. Grenzen und außerhalb AP1 gefundene Punkte

- Vollständige Historisierung erfordert eine eigene Durchlaufidentität in allen
  Antwort-/Auswertungswegen. AP1 führt diesen großen Umbau bewusst nicht ein.
  Reset ist daher ausdrücklich destruktiv und bestätigt.
- Vorhandene alte Startzeiten werden als RUNNING interpretiert. Historisch nur
  lokal erfolgte Stop-Aktionen lassen sich nicht nachträglich rekonstruieren.
- Polling macht Sichtbarkeitsänderungen nach dem nächsten Abruf sichtbar; die
  serverseitige Schreibsperre gilt bereits mit Abschluss der Transaktion.
- Kopierdialog: bestehende Schaltfläche „Kopie anlegen“ hat keinen Submit-Handler.
  Testquiz deshalb über das normale Formular angelegt; nicht in AP1 geändert.
- Standard-Renderer: `STRUCTURED_RESPONSE` rendert vorhandene Audiomedien nicht.
  Bestehender, unabhängiger Layoutbefund; tatsächliche Audioaktivierung deshalb
  zusätzlich im vorhandenen Storybook-Template geprüft. Kein Layoutumbau in AP1.
- Browserprüfung erfolgte im verfügbaren In-App-Browser, kein Safari-/iOS-Labortest.
