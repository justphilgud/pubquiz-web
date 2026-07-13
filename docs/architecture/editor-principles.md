# PubQuiz – Editor Architecture & UX Principles

## Vision

The Question Editor is the central content management tool of the application.

Primary goal:

> A standard question can be created on a mobile device in less than 60 seconds.

The editor should be optimized for both experienced quiz creators and occasional community editors.

---

# General principles

## Mobile First

Every important workflow must work comfortably on a smartphone.

Avoid:

- unnecessary dialogs
- unnecessary tabs
- long navigation paths

Prefer:

- compact layouts
- large touch targets
- logical grouping
- minimal scrolling

---

## Component architecture

Keep components small.

Example:

QuestionEditor
├── TemplateSelector
├── QuestionSection
├── AnswersSection
│ └── AnswerCard
├── CategorySection
├── NotesSection
├── WorkflowSection
└── BottomToolbar

Each component should have exactly one responsibility.

---

## Business logic

Business logic should not live inside UI components.

UI components should primarily

- display data
- collect user input
- raise callbacks

Business rules belong into

- helper functions
- services
- server actions

---

## Templates

Templates are data driven.

Never hardcode business behaviour into individual components.

Templates may define:

- default question text
- answer field labels
- required media
- required fields
- helper texts

Examples:

- Standard Question
- Multiple Choice
- FaceMorph
- Music Reverse

---

## Question model

A question stores only the factual information.

It does NOT permanently store whether it is open or closed.

The default presentation is derived automatically.

Later, each quiz may override the presentation.

---

## Quiz specific behaviour

Quiz specific information belongs to the quiz.

Examples:

- answer order
- open / closed presentation
- answer labels A/B/C/D

The editor should never depend on quiz specific ordering.

---

## Answer fields

Templates may define answer field labels.

Examples:

- Person A
- Person B
- Artist
- Song title

These labels are editor guidance only.

They are NOT the visible quiz labels.

---

## User Experience

Avoid asking the user for information that can be derived automatically.

Examples:

Good:

- automatically detect open vs. closed question

Bad:

- ask the editor to choose open vs. closed

---

## Incomplete questions

The editor provides two save actions.

- Save as incomplete
- Save question

No additional checkbox is required.

---

## Roles

Never hardcode roles.

Prepare the editor for future roles.

Current examples:

- Admin
- Editor

Future examples:

- Reviewer
- Community Editor

Permissions should remain extensible.

---

## Categories

Editors may select categories.

Editors may NOT create categories.

Category requests are communicated via reviewer notes.

---

## Notes

Separate:

- Source / Remark
- Moderator Notes
- Reviewer Notes

Each has a different audience.

---

## Outdated questions

Questions may define an expiration date.

Expired questions:

- remain stored
- are searchable
- are editable
- are excluded from automatic quiz generation

---

## Character limits

Current limits:

Question

300

Answer

200

Answer information

500

Source / Remark

1000

Moderator notes

1000

Reviewer notes

1000

---

## Coding philosophy

Refactor continuously.

Prefer:

small components

clear responsibilities

strong typing

minimal duplication

simple APIs

Avoid:

God Components

duplicate business logic

large stateful UI files

deep prop chains

---

## Development workflow

For every implementation:

1. Understand the requirement.
2. Suggest architectural improvements.
3. Do not implement improvements outside the requested scope.
4. Implement only the requested feature.
5. Run typecheck.
6. Run lint.
7. Summarize the changes.
