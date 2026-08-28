import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const structureSource = readFileSync(
  "app/quiz/[quizId]/QuizFragenSortableTable.tsx",
  "utf8",
);
const questionSource = readFileSync(
  "app/quiz/[quizId]/QuizQuestionItem.tsx",
  "utf8",
);
const elementCardSource = readFileSync(
  "app/quiz/[quizId]/QuizEditorElementCard.tsx",
  "utf8",
);

test("quiz structure DndContext has one stable quiz-specific id", () => {
  assert.equal(structureSource.match(/<DndContext\b/g)?.length, 1);
  assert.match(
    structureSource,
    /<DndContext[\s\S]*?id=\{`quiz-structure-\$\{quizId\}`\}/,
  );
  assert.doesNotMatch(
    structureSource,
    /id=\{[^}]*?(?:Math\.random|Date\.now)/,
  );
});

test("block and question drag handles retain sortable accessibility attributes", () => {
  const blockHandle = structureSource.slice(
    structureSource.indexOf("function BlockDragHandle"),
    structureSource.indexOf("function DroppableBlock"),
  );
  const questionHandle = elementCardSource.slice(
    elementCardSource.indexOf("<button"),
    elementCardSource.indexOf("</button>") + "</button>".length,
  );

  assert.match(blockHandle, /\{\.\.\.attributes\}/);
  assert.match(blockHandle, /\{\.\.\.listeners\}/);
  assert.match(questionHandle, /\{\.\.\.dragAttributes\}/);
  assert.match(questionHandle, /\{\.\.\.dragListeners\}/);
  assert.match(structureSource, /attributes,[\s\S]*listeners,[\s\S]*useSortable\(/);
  assert.match(questionSource, /attributes,[\s\S]*listeners,[\s\S]*useSortable\(/);
});

test("existing quiz structure sensors and drag handlers stay connected", () => {
  assert.match(structureSource, /useSensor\(PointerSensor/);
  assert.match(structureSource, /onDragOver=\{handleDragOver\}/);
  assert.match(structureSource, /onDragEnd=\{handleDragEnd\}/);
  assert.match(structureSource, /<SortableContext/);
});
