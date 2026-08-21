<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data.

Before writing or modifying code, read the relevant documentation from:

node_modules/next/dist/docs/

Always follow the documented APIs and conventions of the installed Next.js version.

Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

# PubQuiz Development Rules

## Project architecture

For work on the new Question Editor, Presentation, Moderation and future features, also read:

docs/architecture/editor-principles.md

Before changing answer forms, live interactions, drafts, submissions, polls, Pixel question behavior, or answer evaluation, also read:

docs/architecture/answer-interaction.md

Before changing Quiz Runtime, Ordering, Presentation Flow, Evaluation, Special Question Runtime or Calendar Subscription, read and preserve:

docs/architecture/quiz-runtime-contracts.md

Run the regression tests referenced there for the affected contract.

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
