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
  const questionHandle = questionSource.slice(
    questionSource.indexOf("function DragHandle"),
    questionSource.indexOf("export default function QuizQuestionItem"),
  );

  for (const handle of [blockHandle, questionHandle]) {
    assert.match(handle, /\{\.\.\.attributes\}/);
    assert.match(handle, /\{\.\.\.listeners\}/);
  }
  assert.match(structureSource, /attributes,[\s\S]*listeners,[\s\S]*useSortable\(/);
  assert.match(questionSource, /attributes,[\s\S]*listeners,[\s\S]*useSortable\(/);
});

test("existing quiz structure sensors and drag handlers stay connected", () => {
  assert.match(structureSource, /useSensor\(PointerSensor/);
  assert.match(structureSource, /onDragOver=\{handleDragOver\}/);
  assert.match(structureSource, /onDragEnd=\{handleDragEnd\}/);
  assert.match(structureSource, /<SortableContext/);
});
