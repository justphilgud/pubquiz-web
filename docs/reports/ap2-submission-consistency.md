# AP2 – Submission- und Moderationskonsistenz

Basis: Preview/AP1 `8b94b94`, isolierter Branch `codex/ap2-submission-consistency`.

## Ursache und Lösung

Die Moderation zählte im aktuellen Run nur finale Snapshots, während das Formular
normale Antworten zunächst als Draft speichert. Ohne aktuellen Run zählte der alte
Fallback sogar leere Zeilen. Der neue lesende Interaction-Service verwendet den
Run-Contract und die bestehende Inhaltsvalidierung sowie die letzte finale
Submission pro Team. Der Zähler initialisiert jetzt mit der angezeigten Frage;
verlassene Poll-Kontexte dürfen keine Ergebnisse mehr eintragen.

Im ersten realen Durchlauf war ein weiterer Effekt sichtbar: Der Reload zeigte
korrekt 1, das laufende Fenster blieb bei 0. Die Slide-Objektidentität ändert sich
bei bestehenden UI-Aktualisierungen. Der erste AP2-Abbruchschutz verwarf deshalb
fortlaufend gültige Antworten. Commit `354854d` bindet das Polling ausschließlich
an primitive Frage-ID, Quiz-ID und Durchlaufrevision; der Regressionstest schützt
diese Abhängigkeit. Dieser Browserfund wurde vor der Abnahme korrigiert.

Als Antwort zählt ein gültiger nichtleerer persistierter Draft oder eine wirksame
finale Submission. Änderungen zählen das Team höchstens einmal. Ein geleerter
unfinalisierter Draft zählt 0; eine vorhandene finale Abgabe bleibt erhalten.
Reload, Aus-/Einblenden, Rücknavigation, Close und Stop erhalten die Inhalte.
Reset entfernt sie ausschließlich gemäß AP1. „Finale Antworten“ und öffentliche
Ergebnisse verwenden weiterhin finale Snapshots; Bewertung bleibt unverändert.

## Architektur und Dateien

- `app/quiz/interaction/answerProgress.ts`: reine Projektion, Team-Deduplizierung.
- `app/quiz/interaction/answerProgress.server.ts`: konsistenter read-only DB-Snapshot.
- `app/quiz/interaction/interactionStoredAnswer.ts`: vorhandene Adapter extrahiert.
- `app/quiz/interaction/interaction.server.ts`: verwendet dieselben Adapter weiterhin.
- `app/quiz/[quizId]/praesentation/statusActions.ts`: autorisierter dünner Wrapper.
- `app/quiz/[quizId]/moderation/page.tsx`: Initialzählung der tatsächlichen Frage.
- `app/quiz/[quizId]/moderation/ModerationClient.tsx`: Poll-Abbruchschutz, finale Anzahl.
- `app/quiz/interaction/answerProgress.test.ts`: Fälle A–L, Legacy, Contract, Read-only.
- `app/quiz/interaction/interactionArchitecture.test.ts`: neue zentrale Lesearchitektur.
- `package.json`: Regressionen in regulärer CI-Suite.
- `docs/architecture/submission-live-state.md`: Living Spec mit SUB-INV-01 bis 12.
- `docs/architecture/answer-interaction.md`, `quiz-lifecycle.md`: Querverweise.
- Dieser Bericht: technische Prüfung und Browserabnahme.

Präsentation und Antwortformular erhalten keine neue Persistenzlogik. Gemeinsame
Adapter wurden unverändert ausgelagert. Keine Dependency, kein Schema und keine
Migration geändert. Keine Änderungen an Pixel, Ordering-Bewertung oder öffentlichen
Live-Ergebnissen; keine Umsetzung späterer Arbeitspakete.

## Qualitätsprüfung

Vollständige Testsuite, Typecheck, repositoryweiter ESLint und Production-Build
sind erfolgreich (1.023 Tests: 369 + 505 + 149). Prisma-Client wurde aus dem unveränderten Schema generiert;
eine Migration ist nicht erforderlich. Auch nach der Browserkorrektur wurden die vollständige Suite, Typecheck,
repositoryweiter ESLint und Production-Build erneut erfolgreich ausgeführt.
CI für `354854d`: Runs 34099336401 und 34099336326 erfolgreich.
Erstes Preview `7f93c30`: Run 34098509887 erfolgreich einschließlich Smoke-Test.
Korrigiertes Preview `354854d`: [Deployment 34099495561](https://github.com/justphilgud/pubquiz-web/actions/runs/34099495561), erfolgreich inklusive Smoke-Test.
URL: [AP2 Preview](https://pubquiz-1bgwdo15m-just-phil-gud.vercel.app).
Die abschließende Browserabnahme auf diesem korrigierten Stand ist erfolgreich.

## Preview-Abnahme

Eigenes Testquiz: 22, „Codex AP2 Submission E2E 2026-09-07“.
Abgenommen am 7. September 2026, ca. 10:28–10:34 Uhr (Europe/Berlin).
Drei getrennte Teams: AP2 Alpha, Bravo und Charlie 20260907. Zwei Moderationsfenster
auf `354854d`. Die bereits geöffneten Teamformulare liefen auf dem ersten AP2-
Deployment `7f93c30`; deren Formular- und Schreibcode ist in `354854d` unverändert.
Beide Deployments verwenden dieselbe Preview-Datenbank. Es wurden keine bestehenden
fremden Quizdaten für die Abnahme verändert.

| Prüfung | Beobachtung | Ergebnis |
| --- | --- | --- |
| Ausgangslage / leer | 3 Teams, 0 Antworten; zuvor geleerter Draft zählt nicht | bestanden |
| Alpha antwortet „Berlin“ | Beide Moderationen zeigen ohne Reload 1 / 3, 33 % | bestanden |
| Bravo antwortet „7“ | Zähler steigt live auf 2 / 3, 67 % | bestanden |
| Charlie antwortet „8“ | Zähler steigt live auf 3 / 3, 100 % | bestanden |
| Alpha ändert auf „Hamburg“ | Neuer Text gespeichert; beide Moderationen bleiben bei 3 | bestanden |
| Team-Reload | Charlie sieht weiterhin „8“ | bestanden |
| Moderations-Reload | Frage 1 weiterhin 3 / 3 | bestanden |
| Frage ausblenden | Teamformular zeigt die Frage nicht; Zähler bleibt 3 | bestanden |
| Frage wieder einblenden | Vorhandene Antworten, weiterhin 3 | bestanden |
| Zweite Frage öffnen | Eigenständiger Zähler 0 | bestanden |
| Alpha beantwortet Frage 2 | Zähler der zweiten Frage 1 / 3 | bestanden |
| Zurück zu Frage 1 | Zähler 3; Frage 2 im Formular ausgeblendet | bestanden |
| Erneut zu Frage 2 | Zähler 1; „AP2 Anagramm-Test“ weiterhin gespeichert | bestanden |
| Block schließen auf Frage 1 | Zähler bleibt 3; vorhandene Drafts auto-finalisiert | bestanden |
| Auswertung | Frage 1: Hamburg, 7, 8; Frage 2: eine Abgabe, zwei unbeantwortet | bestanden |
| Bestehende Bewertung | Bravo erhält für „7“ 1 Punkt / CORRECT; übrige Texte REVIEW_REQUIRED | bestanden |
| Stop und Moderations-Reload | Beendet, gleiche Frage, weiterhin 3 Antworten in beiden Fenstern | bestanden |
| Auswertungs-Reload nach Stop | Dieselben vier finalisierten Abgaben und Bewertungen | bestanden |
| Bestätigter Reset | Beide Moderationen: Vorbereitung, Slide 1, 0 Teams, 0 Antworten | bestanden |
| Auswertung nach Reset | 0 Treffer, keine Antworten | bestanden |
| Teilnehmer nach Reset | Alte Sitzung ungültig; Reload zeigt Vorbereitung und leeren Join | bestanden |

Der Testlauf ist aufgeräumt: Quiz 22 verbleibt mit seinen zwei redaktionellen
Fragen in Vorbereitung. Die drei globalen Testteamkonten bleiben gemäß AP1 erhalten;
ihre Quizteilnahmen, Antworten und Bewertungen wurden durch den Test-Reset entfernt.

## Commits und Bereitstellung

- `7f93c30`: gemeinsame Inhaltsprojektion, Initialzählung, Regressionen und Living Spec.
- `354854d`: im Browser erkannte Instabilität der Effect-Abhängigkeit korrigiert.
- Der abschließende Dokumentationscommit im AP2-Branch enthält diesen Abnahmebericht.

Der deployte und abgenommene Runtime-Stand bleibt `354854d`; der reine
Berichtsabschluss benötigt keine weitere App-Bereitstellung. Preview-Branch:
`preview/content-and-quiz-flow`. AP2-Branch: `codex/ap2-submission-consistency`.
`main` bleibt auf `e76f57dce19f26488cf9db24b881ab06bf004fd6`.

Die Living Spec dokumentiert SUB-INV-01 bis SUB-INV-12 sowie Draft-, Final-,
Reload-, Close-, Stop- und Reset-Semantik. Sie ist mit beiden vorhandenen
Architekturverträgen verlinkt. Neue Projektions-Regressionen decken A–L, Legacy,
Choice, Ordering und Read-only-/Polling-Guards ab; vorhandene Bewertungstests
wurden nicht abgeschwächt.

## Offene Grenzen

Keine offenen Fehler aus der AP2-Abnahme. Keine vollständige Run-Historisierung. Daten mit beschädigtem gespeichertem
Contract werden durch vorhandene Validierung abgewiesen, nicht beim Lesen repariert.
Die Anzeige ohne Fragebezug ist bewusst 0 und kein Summenzähler über das Quiz.
Main, Produktion und bestehende lokale Änderungen bleiben unberührt.
