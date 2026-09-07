# AP2 – Submission- und Moderationskonsistenz

Basis: Preview/AP1 `8b94b94`, isolierter Branch `codex/ap2-submission-consistency`.

## Ursache und Lösung

Die Moderation zählte im aktuellen Run nur finale Snapshots, während das Formular
normale Antworten zunächst als Draft speichert. Ohne aktuellen Run zählte der alte
Fallback sogar leere Zeilen. Der neue lesende Interaction-Service verwendet den
Run-Contract und die bestehende Inhaltsvalidierung sowie die letzte finale
Submission pro Team. Der Zähler initialisiert jetzt mit der angezeigten Frage;
verlassene Poll-Kontexte dürfen keine Ergebnisse mehr eintragen.

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
sind erfolgreich. Prisma-Client wurde aus dem unveränderten Schema generiert;
eine Migration ist nicht erforderlich. Browserabnahme und finale Deployment-Links
werden nach Veröffentlichung ergänzt.

## Preview-Abnahme

Eigenes Testquiz: 22, „Codex AP2 Submission E2E 2026-09-07“.
Browserabnahme ausstehend; bisher ausschließlich Vorbereitung des Testinhalts.

## Offene Grenzen

Keine vollständige Run-Historisierung. Daten mit beschädigtem gespeichertem
Contract werden durch vorhandene Validierung abgewiesen, nicht beim Lesen repariert.
Die Anzeige ohne Fragebezug ist bewusst 0 und kein Summenzähler über das Quiz.
Main, Produktion und bestehende lokale Änderungen bleiben unberührt.
