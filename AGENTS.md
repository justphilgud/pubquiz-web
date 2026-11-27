<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data.

Before writing or modifying code, read the relevant documentation from:

node_modules/next/dist/docs/

Always follow the documented APIs and conventions of the installed Next.js version.

Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

# PubQuiz Development Rules

## Verbindlicher Release-Standard

Vor jedem Release `docs/operations/release-process.md` lesen und befolgen.
Der mit PR #194 eingeführte und für `ba484967` erfolgreich ausgeführte Ablauf
ist der Standard für künftige Releases:

- Den Release-Plan `release/plan.json` im normalen Feature-PR mitführen und
  prüfen: unabhängig bestätigte Production-Basis, Schema- und vollständige
  Migrationsprüfsummen. Kein zusätzlicher Operations-PR oder Operations-Merge
  nur zur Registrierung des nach dem Merge entstandenen Release-SHA-Paars.
- Aktuell unterstützt der allgemeine Pfad nur `NO_DELTA`. Bei neuen Migrationen
  müssen die enge Planvalidierung sowie isolierte Delta-, Kompatibilitäts- und
  Rückwegtests bereits in denselben Feature-PR. Unbekannte Planarten bleiben
  blockiert; keine pauschale SQL-Freigabe oder Rückkehr zur routinemäßigen
  zusätzlichen Operationsregistrierung.
- Feature-CI über `pull_request` ausführen, einschließlich Draft-PRs; keine
  zusätzliche gleichartige Push-CI auf Feature-Branches einführen. PR-CI prüft
  den exakten PR-Head. Die separate CI für den tatsächlichen `main`-Merge-Commit
  bleibt verpflichtend; Qualitäts-, Safety-, Bridge- und PostgreSQL-Prüfungen
  sowie ihre bestehenden Pfadfilter erhalten.
- Nur nach Freigabe und grünen Checks regulär mergen. Vor dem Release die
  erfolgreiche CI des exakten resultierenden `main`-Commits bestätigen.
- Den bestehenden geschützten Read-only-Preflight mit exaktem Kandidaten und
  unabhängig erwarteter Production-Basis ausführen. Production ausschließlich
  ausdrücklich über den manuellen geschützten Workflow mit genau diesem
  Release-SHA und der erfolgreichen Preflight-Lauf-ID starten. Keine automatischen
  Production-Deployments durch Feature-/Operations-Merges oder CI-Abschluss.
- GitHub-Environment-/Owner-Freigaben muss der vorgeschriebene Reviewer selbst
  erteilen. main-only, Featureflag, Serialisierung, Reader-Rechte, unveränderliche
  Artefakte, Herkunfts-/SHA-/CI-/Versuchsbindung, frische Alias-/Basisprüfung und
  DB-Identitäts-/Migrationsprüfungen unverändert erhalten. Keine Schutzmaßnahmen
  umgehen oder abschwächen; bei fehlenden oder widersprüchlichen Nachweisen stoppen.
- Das dokumentierte Backupverfahren bleibt gültig. Ein Backup-Verzicht benötigt
  eine ausdrückliche Freigabe für den konkreten Release; frühere Ausnahmen gelten
  nicht für spätere Releases.
- Nach dem Deployment Migrationsstatus, READY/Current, tatsächlichen Runtime-SHA,
  HTTP- und möglichst lesenden fachlichen Smoke-Test prüfen und dokumentieren.
  Keine echten Quizdaten oder Bewertungen für den Smoke-Test verändern; bekannte
  Messlücken und nicht ausgeführte Prüfungen ausdrücklich benennen.

## Living Specifications

Für relevante Funktionen, Komponenten und Templates gilt verbindlich:
Bestehende Spezifikation lesen → gegen die neue Anforderung prüfen → Änderung
implementieren → Regressionstests durchführen → Spezifikation aktualisieren.
Widersprüche werden bewusst entschieden und dokumentiert. Spezifikationen enthalten
Zweck, Verhalten, Zustände, Ein-/Ausgaben, Persistenz, Abhängigkeiten, Invarianten und Tests.
Vor Änderungen an Quiz-Lifecycle, Moderation, Präsentationsnavigation oder Teilnahme
zusätzlich `docs/architecture/quiz-lifecycle.md` lesen. AP1 dokumentiert nur diesen Bereich.
Bei Änderungen an Pixel-Fragen zusätzlich `docs/architecture/pixel-question.md` lesen.

## Project architecture

Before work on event-type navigation, event/series management, preparation, moderation or presentation entry points, read `docs/architecture/event-operation-standard.md`. Preserve its distinction between implemented contracts and planned UI requirements; document format-specific deviations.

For work on the new Question Editor, Presentation, Moderation and future features, also read:

docs/architecture/editor-principles.md

Before changing answer forms, live interactions, drafts, submissions, polls, Pixel question behavior, or answer evaluation, also read:

docs/architecture/answer-interaction.md

Before changing Quiz Runtime, Ordering, Presentation Flow, Evaluation, Special Question Runtime or Calendar Subscription, read and preserve:

docs/architecture/quiz-runtime-contracts.md

Run the regression tests referenced there for the affected contract.

Before any question-template change, read the binding surface matrix and variants in
`docs/architecture/presentation-rendering.md` ("Template-Verträge") and its specialized
runtime contracts. Check question, solution, participant and moderation surfaces.
Update specification and rendered/browser regressions together. New requirements
extend existing rules; identify genuine conflicts rather than changing tests to
accept unintended regressions. Document already approved changes without requesting
the same approval again.

Before any work on presentation templates, Storybook, Corporate, ungegoogelt design worlds, renderers, design systems, generators, UX, animation, typography, or imagery, read and follow:

docs/design/ungegoogelt-design-manifest.md

New designs may consciously evolve the manifest, but must not silently contradict it. If a request conflicts with the manifest, identify and explain the conflict before implementation begins.

## Working style

When implementing a task:

1. Read the requested files before modifying them.
2. Keep changes as small as possible.
3. Do not change business requirements unless explicitly requested.
4. Do not introduce new dependencies without approval.
5. Reuse existing UI components whenever appropriate.
6. Keep business logic outside UI components whenever possible.
7. Use strict TypeScript.
8. Run TypeScript typecheck after your changes.
9. Run ESLint for the modified files.
10. Clearly separate existing repository issues from newly introduced issues.

## Before implementation

Before changing code, briefly explain:

- why the proposed architecture is appropriate
- which responsibility stays in the existing component
- which responsibility moves into the new component

## After implementation

Always provide:

- changed files
- architecture summary
- typecheck result
- lint result
- open issues

If you discover improvements that are outside the requested scope:

- explain them briefly
- do NOT implement them
- continue with the requested task
