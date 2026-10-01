import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(path, "utf8");

test("the root layout is neutral and management boundaries own AppHeader", () => {
  assert.doesNotMatch(read("app/layout.tsx"), /AppHeader/);
  assert.match(read("app/admin/layout.tsx"), /AppHeader/);
  assert.match(read("app/fragen/layout.tsx"), /AppHeader/);
  assert.match(read("app/quiz/page.tsx"), /AppHeader/);
  assert.match(read("app/quiz/[quizId]/page.tsx"), /AppHeader/);
});

test("moderation, presentation, and answer form do not import AppHeader", () => {
  for (const path of [
    "app/quiz/[quizId]/moderation/page.tsx",
    "app/quiz/[quizId]/praesentation/page.tsx",
    "app/quiz/[quizId]/antworten/page.tsx",
  ]) {
    assert.doesNotMatch(read(path), /AppHeader/);
  }
  assert.match(read("app/quiz/[quizId]/moderation/ModerationClient.tsx"), /backToQuizLabel/);
});
