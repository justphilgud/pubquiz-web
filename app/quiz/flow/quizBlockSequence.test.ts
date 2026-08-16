import assert from "node:assert/strict";
import test from "node:test";

import {
  getQuizBlockSequenceEntryKey,
  resolveQuizBlockSequence,
  type QuizBlockSequenceEntry,
} from "./quizBlockSequence";
import type { QuizFlowItem, QuizFlowItemType } from "./quizFlow";

const questions = [
  { quiz_fragen_id: 11, quiz_abschnitt_id: 7, sortierung: 1, frage: "Frage 1" },
  { quiz_fragen_id: 12, quiz_abschnitt_id: 7, sortierung: 2, frage: "Frage 2" },
];

function item(input: {
  id: number;
  type: QuizFlowItemType;
  order: number;
  questionAssignmentId?: number;
  storyQuestionAssignmentId?: number;
  storyRelationship?: string;
  storyDefaultRelationship?: string;
  storyElementRevisionId?: number;
  enabled?: boolean;
}): QuizFlowItem {
  return {
    id: `flow:${input.id}`,
    persistentId: input.id,
    type: input.type,
    anchorType: "BLOCK",
    anchorKey: "7",
    sectionId: 7,
    order: input.order,
    enabled: input.enabled ?? true,
    label: null,
    config: input.type === "TEXT"
      ? { version: 1, body: "Eine Anekdote" }
      : { version: 1 },
    configVersion: 1,
    questionAssignmentId: input.questionAssignmentId ?? null,
    storyQuestionAssignmentId: input.storyQuestionAssignmentId ?? null,
    storyRelationship: input.storyRelationship ?? null,
    storyDefaultRelationship: input.storyDefaultRelationship ?? null,
    storyElementRevisionId: input.storyElementRevisionId ?? null,
    isStandard: input.type === "QUESTION" || input.type === "QUESTION_SOLUTION",
  };
}

function compact(
  entries: readonly QuizBlockSequenceEntry<(typeof questions)[number]>[],
) {
  return entries.map((entry) =>
    entry.kind === "CONTENT"
      ? entry.item.type
      : `${entry.kind}:${entry.question.quiz_fragen_id}`,
  );
}

test("legacy blocks keep the historic question then solution default", () => {
  const result = resolveQuizBlockSequence({
    sectionId: 7,
    quizStrategy: undefined,
    sectionStrategy: null,
    questions,
    blockItems: [],
  });

  assert.equal(result.strategy, "AFTER_EACH_QUESTION");
  assert.deepEqual(compact(result.entries), [
    "QUESTION:11",
    "QUESTION_SOLUTION:11",
    "QUESTION:12",
    "QUESTION_SOLUTION:12",
  ]);
});

test("automatic strategies preserve story positions and derive solutions", () => {
  const blockItems = [
    item({ id: 1, type: "QUESTION", order: 1_000, questionAssignmentId: 11 }),
    item({ id: 2, type: "TEXT", order: 2_000 }),
    item({ id: 3, type: "QUESTION", order: 3_000, questionAssignmentId: 12 }),
  ];
  const direct = resolveQuizBlockSequence({
    sectionId: 7,
    quizStrategy: "AFTER_EACH_QUESTION",
    sectionStrategy: null,
    questions,
    blockItems,
  });
  const collected = resolveQuizBlockSequence({
    sectionId: 7,
    quizStrategy: "AFTER_EACH_QUESTION",
    sectionStrategy: "END_OF_BLOCK",
    questions,
    blockItems,
  });

  assert.deepEqual(compact(direct.entries), [
    "QUESTION:11",
    "QUESTION_SOLUTION:11",
    "TEXT",
    "QUESTION:12",
    "QUESTION_SOLUTION:12",
  ]);
  assert.deepEqual(compact(collected.entries), [
    "QUESTION:11",
    "TEXT",
    "QUESTION:12",
    "QUESTION_SOLUTION:11",
    "QUESTION_SOLUTION:12",
  ]);
});

test("editorial question order wins over divergent persisted flow order", () => {
  const result = resolveQuizBlockSequence({
    sectionId: 7,
    quizStrategy: "END_OF_BLOCK",
    sectionStrategy: null,
    questions,
    blockItems: [
      item({ id: 1, type: "QUESTION", order: 1_000, questionAssignmentId: 12 }),
      item({ id: 2, type: "TEXT", order: 1_500 }),
      item({ id: 3, type: "QUESTION", order: 2_000, questionAssignmentId: 11 }),
    ],
  });

  assert.deepEqual(compact(result.entries), [
    "QUESTION:11",
    "TEXT",
    "QUESTION:12",
    "QUESTION_SOLUTION:11",
    "QUESTION_SOLUTION:12",
  ]);
});

test("manual flow keeps content positions while canonicalizing question identities", () => {
  const result = resolveQuizBlockSequence({
    sectionId: 7,
    quizStrategy: "MANUAL",
    sectionStrategy: null,
    questions,
    blockItems: [
      item({ id: 1, type: "QUESTION", order: 1_000, questionAssignmentId: 12 }),
      item({ id: 2, type: "QUESTION_SOLUTION", order: 1_500, questionAssignmentId: 12 }),
      item({ id: 3, type: "TEXT", order: 2_000 }),
      item({ id: 4, type: "QUESTION", order: 3_000, questionAssignmentId: 11 }),
      item({ id: 5, type: "QUESTION_SOLUTION", order: 3_500, questionAssignmentId: 11 }),
    ],
  });

  assert.deepEqual(compact(result.entries), [
    "QUESTION:11",
    "QUESTION_SOLUTION:11",
    "TEXT",
    "QUESTION:12",
    "QUESTION_SOLUTION:12",
  ]);
});

test("manual sequences allow story elements between question and solution", () => {
  const result = resolveQuizBlockSequence({
    sectionId: 7,
    quizStrategy: "MANUAL",
    sectionStrategy: null,
    questions,
    blockItems: [
      item({ id: 1, type: "QUESTION", order: 1_000, questionAssignmentId: 11 }),
      item({ id: 2, type: "TEXT", order: 2_000 }),
      item({ id: 3, type: "QUESTION_SOLUTION", order: 3_000, questionAssignmentId: 11 }),
      item({ id: 4, type: "QUESTION", order: 4_000, questionAssignmentId: 12 }),
      item({ id: 5, type: "QUESTION_SOLUTION", order: 5_000, questionAssignmentId: 12 }),
    ],
  });

  assert.deepEqual(compact(result.entries), [
    "QUESTION:11",
    "TEXT",
    "QUESTION_SOLUTION:11",
    "QUESTION:12",
    "QUESTION_SOLUTION:12",
  ]);
});

test("manual invalid or duplicate solutions never precede their question", () => {
  const result = resolveQuizBlockSequence({
    sectionId: 7,
    quizStrategy: "MANUAL",
    sectionStrategy: null,
    questions,
    blockItems: [
      item({ id: 1, type: "QUESTION_SOLUTION", order: 500, questionAssignmentId: 11 }),
      item({ id: 2, type: "QUESTION", order: 1_000, questionAssignmentId: 11 }),
      item({ id: 3, type: "QUESTION_SOLUTION", order: 2_000, questionAssignmentId: 11 }),
    ],
  });

  assert.deepEqual(compact(result.entries), [
    "QUESTION:11",
    "QUESTION_SOLUTION:11",
    "QUESTION:12",
    "QUESTION_SOLUTION:12",
  ]);
});

test("hidden story elements are excluded from production but available to the editor", () => {
  const hidden = item({ id: 9, type: "TEXT", order: 500, enabled: false });
  const production = resolveQuizBlockSequence({
    sectionId: 7,
    quizStrategy: "END_OF_BLOCK",
    sectionStrategy: null,
    questions,
    blockItems: [hidden],
  });
  const editor = resolveQuizBlockSequence({
    sectionId: 7,
    quizStrategy: "END_OF_BLOCK",
    sectionStrategy: null,
    questions,
    blockItems: [hidden],
    includeDisabledItems: true,
  });

  assert.equal(compact(production.entries).includes("TEXT"), false);
  assert.equal(compact(editor.entries).includes("TEXT"), true);
  const content = editor.entries.find((entry) => entry.kind === "CONTENT");
  assert.equal(content ? getQuizBlockSequenceEntryKey(content) : null, "block-item:9");
});

test("linked AFTER_SOLUTION stories follow their solution in both standard strategies", () => {
  const linkedStory = item({
    id: 19,
    type: "ANECDOTE",
    order: 1_100,
    storyQuestionAssignmentId: 11,
    storyRelationship: "AFTER_SOLUTION",
    storyElementRevisionId: 91,
  });
  const blockItems = [
    item({ id: 1, type: "QUESTION", order: 1_000, questionAssignmentId: 11 }),
    linkedStory,
    item({ id: 2, type: "QUESTION", order: 2_000, questionAssignmentId: 12 }),
  ];
  const direct = resolveQuizBlockSequence({
    sectionId: 7,
    quizStrategy: "AFTER_EACH_QUESTION",
    sectionStrategy: null,
    questions,
    blockItems,
  });
  const collected = resolveQuizBlockSequence({
    sectionId: 7,
    quizStrategy: "END_OF_BLOCK",
    sectionStrategy: null,
    questions,
    blockItems,
  });

  assert.deepEqual(compact(direct.entries), [
    "QUESTION:11",
    "QUESTION_SOLUTION:11",
    "ANECDOTE",
    "QUESTION:12",
    "QUESTION_SOLUTION:12",
  ]);
  assert.deepEqual(compact(collected.entries), [
    "QUESTION:11",
    "QUESTION:12",
    "QUESTION_SOLUTION:11",
    "ANECDOTE",
    "QUESTION_SOLUTION:12",
  ]);
  const content = direct.entries.find((entry) => entry.kind === "CONTENT");
  assert.equal(content ? getQuizBlockSequenceEntryKey(content) : null, "story-placement:19");
});

test("linked BEFORE_QUESTION stories precede their question", () => {
  const result = resolveQuizBlockSequence({
    sectionId: 7,
    quizStrategy: "AFTER_EACH_QUESTION",
    sectionStrategy: null,
    questions,
    blockItems: [
      item({ id: 1, type: "QUESTION", order: 1_000, questionAssignmentId: 11 }),
      item({
        id: 20,
        type: "QUOTE",
        order: 1_100,
        storyQuestionAssignmentId: 11,
        storyDefaultRelationship: "RELATED",
        storyElementRevisionId: 92,
      }),
      item({ id: 2, type: "QUESTION", order: 2_000, questionAssignmentId: 12 }),
    ],
  });
  assert.deepEqual(compact(result.entries), [
    "QUOTE",
    "QUESTION:11",
    "QUESTION_SOLUTION:11",
    "QUESTION:12",
    "QUESTION_SOLUTION:12",
  ]);
});

test("quiz override wins and removing it restores the question default", () => {
  const build = (storyRelationship: string | undefined) =>
    resolveQuizBlockSequence({
      sectionId: 7,
      quizStrategy: "AFTER_EACH_QUESTION",
      sectionStrategy: null,
      questions: questions.slice(0, 1),
      blockItems: [
        item({ id: 1, type: "QUESTION", order: 1_000, questionAssignmentId: 11 }),
        item({
          id: 21,
          type: "ANECDOTE",
          order: 1_100,
          storyQuestionAssignmentId: 11,
          storyDefaultRelationship: "AFTER_SOLUTION",
          storyRelationship,
          storyElementRevisionId: 93,
        }),
      ],
    });

  assert.deepEqual(compact(build("RELATED").entries), [
    "ANECDOTE",
    "QUESTION:11",
    "QUESTION_SOLUTION:11",
  ]);
  assert.deepEqual(compact(build(undefined).entries), [
    "QUESTION:11",
    "QUESTION_SOLUTION:11",
    "ANECDOTE",
  ]);
});

test("unlinked story elements remain freely ordered standalone content", () => {
  const result = resolveQuizBlockSequence({
    sectionId: 7,
    quizStrategy: "AFTER_EACH_QUESTION",
    sectionStrategy: null,
    questions: questions.slice(0, 1),
    blockItems: [
      item({ id: 30, type: "TEXT", order: 500, storyElementRevisionId: 94 }),
      item({ id: 1, type: "QUESTION", order: 1_000, questionAssignmentId: 11 }),
    ],
  });
  assert.deepEqual(compact(result.entries), [
    "TEXT",
    "QUESTION:11",
    "QUESTION_SOLUTION:11",
  ]);
});
