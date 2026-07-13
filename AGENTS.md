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
