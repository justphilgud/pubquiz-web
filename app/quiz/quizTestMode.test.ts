import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(path, "utf8");

test("internal quiz test mode is admin-only and reuses the productive live-state action", () => {
  const page = read("app/quiz/[quizId]/test/page.tsx");
  const client = read("app/quiz/[quizId]/test/QuizTestClient.tsx");
  assert.match(page, /await requireAdmin\(\)/);
  assert.match(client, /setPraesentationSlideIndex/);
  assert.match(client, /getPraesentationStatus/);
  assert.doesNotMatch(client, /storybook-experience/);
});

test("test mode links every productive surface and identifies hidden flow items", () => {
  const client = read("app/quiz/[quizId]/test/QuizTestClient.tsx");
  for (const route of [
    "moderation",
    "praesentation",
    "antworten",
    "auswertung",
    "ablauf",
  ]) {
    assert.match(client, new RegExp(`/\\$\\{quizId\\}/${route}`));
  }
  assert.match(client, /Ausgeblendete Elemente/);
  assert.match(client, /slide_key/);
  assert.match(client, /Quizfrage-Zuordnung/);
});

test("quiz workspace exposes the test entry only inside the existing admin condition", () => {
  const page = read("app/quiz/[quizId]/page.tsx");
  const adminCondition = page.indexOf("{canManageTemplates && (");
  const testLink = page.indexOf("Testansicht öffnen");
  assert.ok(adminCondition >= 0);
  assert.ok(testLink > adminCondition);
});
