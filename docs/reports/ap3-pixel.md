# AP3 – Pixel-Frage und Stufenwertung

Stand: 7. September 2026. Technische Implementierung und Preview-Deployment geprüft;
reale Browserabnahme wartet auf Anmeldung am neuen Deployment. Noch kein abgeschlossener
Abnahmebericht.

## Fachlicher Vertrag und Architektur

Ausgangsbasis: Preview 6038b8c (AP2 inklusive kompakter Lifecycle-Leiste).
IST-Analyse, finale Modi, Normalisierung, Invarianten und Zustandsübergänge:
[Living Specification](../architecture/pixel-question.md).

Challenge bleibt der kompatible Default. Konfigurierte Zeiten, Stopper-Sperre,
20 Sekunden Restantwortzeit, 3/2/1 Normalpunkte, exklusiver 6/4-Bonus und −1 bei
falschem Stop bleiben erhalten. Die letzte bisher unbegrenzt offene Challenge-
Phase schließt nun bewusst nach ihrer vorhandenen konfigurierten Dauer.

Stufenwertung hat drei Phasen zu je 20 Sekunden. Die persistierte relevante Stufe
bestimmt bei korrekter finaler Antwort ausschließlich 3/2/1 Punkte. Falsche letzte
Antworten erhalten 0, auch wenn eine frühere Antwort richtig war. Andere Teams
beeinflussen die Punkte nicht. Zentraler Bewertungsstatus, Auswertungen und
Gesamtpunkte verwenden denselben bestehenden Allokator und dieselbe Persistenz.

Keine neue Submission-Engine: Grenzstände liegen in `team_antworten.pixel_stage_history`;
`quiz_interaction_runs.pixel_completed_stages` verhindert wiederholte Verarbeitung.
Beide Felder sind additive Migrationen. Snapshotgrenzen werden vor späteren Writes
unter dem Run-Lock nachgezogen. Der aktuelle Draft bleibt beim Stufenwechsel stehen.
Eine finale Submission entsteht im Stufenmodus beim Close aus dem letzten Stand.
Der Speichern-Button bestätigt nur den Draft. AP2 zählt weiterhin ein Team einmal.

Vergleich: bestehendes NFKC/Trim/Whitespace/Kleinschreibungs-Fingerprint. Leerer
Grenzstand entfernt die Stufenzuordnung; erneute spätere Eingabe erhält die spätere
Stufe. Keine aggressive zusätzliche Textnormalisierung.

## Oberflächen und Lifecycle

Modusauswahl im vorhandenen Pixel-Editor. Erklärung vor jeder Pixel-Frage mit
eigenem NON_QUESTION-Key; öffnet noch keinen Run. Regeltexte liegen in der
Template-Content-Schicht. Generator, Bildstärken und Slots bleiben gleich.

Audience und Moderation zeigen Modus, Bildstufe 3/2/1, Countdown und ggf. Challenge.
Teamformular zeigt die gleiche Zeit, erhält Antworten und verwendet für Pixel-
Aktionen semantische Primärfarben mit Focus/Active/Disabled. Keine allgemeine
Neugestaltung und keine Änderung der kompakten Lifecycle-Steuerung.

Zeitquelle: `opened_at`, konfigurierte Dauern bzw. bestehende Challenge-Deadline.
`serverNow` synchronisiert den Offset; Sekundenticks sind lokal. Keine neue
Polling-Schleife und keine sekündlichen Writes. Nach Leerläufen wird eine fällige
Grenze beim nächsten bestehenden Zugriff nachgezogen, ohne die Frist zu verlängern.

Reload erzeugt keinen Run und keinen Timerstart. Close/Stop finalisiert den
aktuellen Stand; `closed_at` friert die Stufenanzeige ein. AP1 sperrt weitere Writes.
Reset entfernt Zusatzmetadaten zusammen mit bestehenden Drafts/Runs/Sessions.
Bestandsfragen benötigen keine manuelle Datenkorrektur; fehlender Modus bleibt
Challenge. Keine destruktive Migration, kein Production- oder main-Update.

## Technische Prüfung

- Vollständige Testsuite: 1.030 Tests (374 + 507 + 149), 0 Fehler.
- Bestehende Pixel-/Challenge-Punktematrix und AP1/AP2-Regressionen erhalten.
- Neue Tests: Modi/Kompatibilität, A–K-Grenzverläufe, Leeren/Wiederbefüllen,
  unabhängige 3/2/1-Teams, Reload-Zeitgrenzen, Erklär-Slide-Sequenz, beide Regeltexte
  und Countdown-Rendering vor/nach Challenge.
- Editor-Regressionsassertion erweitert um expliziten Challenge-Modus; bestehende
  Werte werden weiterhin geprüft. Keine Tests entfernt.
- TypeScript: erfolgreich. Repositoryweiter ESLint: erfolgreich.
- Prisma-Validierung und Client-Generierung: erfolgreich.
- Production-Build im CI-Modus: erfolgreich; keine Verbindung zu einer Test- oder
  Produktionsdatenbank erforderlich. Erster Aufruf ohne CI scheiterte erwartbar
  an fehlender lokaler Umgebungsdatei im isolierten Worktree.
- `git diff --check`: erfolgreich; reine Generator-Whitespace-Änderungen entfernt.

## Offene Preview-Abnahme

CI, Migration, Deployment und Smoke-Test: erfolgreich (Nachweise unten).
Eigenes Testquiz, bestehende Pixel-Fragen und Editor-Persistenz: ausstehend.
Challenge inklusive Restzeit, Sperre, Bewertung und Reload: ausstehend.
Drei Teams mit 3/2/1, Einzel-/Gesamtpunkte und Ergebnisdarstellung: ausstehend.
Zusätzlicher Lauf richtig → falsch mit 0 Punkten: ausstehend.
Team-/Moderator-/Präsentationsreload, Stop und Reset: ausstehend.
Screenshots beider Erklärungen, Audience, Moderation, Teamaktion und Restzeit: ausstehend.

## Geänderte Bereiche

Pixel-Konfiguration/Editor, bestehender Interaction-Service mit neuem reinen
History-Helfer, rungebundener Pixel-Allokator, zentrale Bewertung, Slide-Builder,
Slide-Identität/-Titel, produktiver Präsentationsrenderer, Moderation und Teamformular,
gezielte Pixel-Aktionsstyles, additive Prisma-Migration und generierter Client,
Regressionstests, Living Specifications und AGENTS-Verweis.

Commits, Preview-Adresse und genaue Abnahmebelege werden nach Deployment ergänzt.
Keine unabhängigen Backlog-Bugs reproduziert oder nebenbei behoben.

## Preview-Nachweise

- Laufzeit-Commit: `c101e23a1658570f73a248e196def41ac300313d`.
- [Preview](https://pubquiz-llcm8un8i-just-phil-gud.vercel.app/quiz).
- [Preview-CI #135](https://github.com/justphilgud/pubquiz-web/actions/runs/34107583503): erfolgreich.
- [Feature-CI #136](https://github.com/justphilgud/pubquiz-web/actions/runs/34107583763): erfolgreich,
  einschließlich repositoryweitem ESLint ohne Restfehler.
- [Deployment #141](https://github.com/justphilgud/pubquiz-web/actions/runs/34107766916): erfolgreich,
  3m 6s einschließlich Datenbankidentitätsprüfung, additiver Migration, anschließender
  Migrationsprüfung, Vercel-Build und Smoke-Test.
- Deployment-ID: `dpl_6wuFqMu3a6VxEEVPmm2ySgQtsHQ4`.
- `main` bleibt `e76f57dce19f26488cf9db24b881ab06bf004fd6`; Production unverändert.
- Bestehende nichtblockierende GitHub-Actions-Warnung: checkout/setup-node v4
  deklarieren Node 20, werden auf Node 24 ausgeführt. Kein AP3-Laufzeitfehler.

Die Bestandsfrage #73 wurde auf dem vorigen Preview ausschließlich lesend geöffnet:
Pixel-Template, vier Medien und gespeicherte Lösung vorhanden. Die aktive
Review-/Berechtigungssperre wurde nicht umgangen. Die echte Bestands-/Modusabnahme
auf dem neuen Runtime-Commit ist damit noch nicht ersetzt.

Der neue Preview-Tab zeigt die Anmeldung. Nach Login folgen eigenes Testquiz,
drei Teamverläufe, Verschlimmbesserung, Reload/Stop/Reset, Bewertungsvergleich
und Screenshots. Bis dahin wird keine Browserabnahme als bestanden ausgegeben.

## Dateiliste des geprüften AP3-Stands

- AGENTS.md
- app/fragen/editor/components/PixelStageTimingFields.tsx
- app/fragen/editor/components/QuestionEditor.tsx
- app/fragen/editor/pixelTemplateConfig.ts
- app/fragen/editor/questionTemplateDraft.test.ts
- app/fragen/editor/questionTemplateDraft.ts
- app/fragen/editor/templates/pixelRules.ts
- app/fragen/editor/types.ts
- app/generated/prisma/internal/class.ts
- app/generated/prisma/internal/prismaNamespace.ts
- app/generated/prisma/internal/prismaNamespaceBrowser.ts
- app/generated/prisma/models/quiz_interaction_runs.ts
- app/generated/prisma/models/team_antworten.ts
- app/globals.css
- app/quiz/[quizId]/antworten/QuizAntwortClient.tsx
- app/quiz/[quizId]/moderation/ModerationClient.tsx
- app/quiz/[quizId]/praesentation/buildPraesentationSlides.test.ts
- app/quiz/[quizId]/praesentation/buildPraesentationSlides.ts
- app/quiz/actions.ts
- app/quiz/evaluation/evaluation.server.ts
- app/quiz/interaction/interaction.server.ts
- app/quiz/interaction/pixelLiveInteraction.test.ts
- app/quiz/interaction/pixelLiveInteraction.ts
- app/quiz/interaction/pixelStageHistory.ts
- app/rendering/presentation/PresentationSlideRenderer.test.ts
- app/rendering/presentation/PresentationSlideRenderer.tsx
- app/rendering/presentation/PresentationStorybookQuestionTypes.tsx
- app/rendering/presentation/presentationLiveState.ts
- app/rendering/presentation/presentationSlideMetadata.ts
- docs/architecture/answer-interaction.md
- docs/architecture/pixel-question.md
- docs/architecture/quiz-lifecycle.md
- docs/architecture/submission-live-state.md
- docs/reports/ap3-pixel.md
- prisma/migrations/20260907180000_pixel_stage_history/migration.sql
- prisma/schema.prisma

Code-Commits: e004e0b, 61faad2, c101e23. Letzte Ergänzung: ein parametrisiertes Batch-UPDATE für alle Team-Snapshots einer Grenze; keine Datenbank-Roundtrips je Team. Gezielte Regressionen (34 Tests), Typecheck und ESLint danach erfolgreich. Vollständiger letzter Stand wird zusätzlich durch Preview-CI geprüft.
