import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { buildQuizEventImagePath, isAllowedQuizEventImagePath } from "./quizEventImage";

test("event image paths bind to quiz and environment and reject traversal and executable formats", () => {
  const path = buildQuizEventImagePath("preview", 7, "Christmas logo.png");
  assert.ok(isAllowedQuizEventImagePath(path, "preview", 7));
  assert.ok(!isAllowedQuizEventImagePath(path, "prod", 7));
  assert.ok(!isAllowedQuizEventImagePath(path, "preview", 8));
  for (const name of ["../other.png", "%2fother.png", "image.svg", "image.html", ""]) {
    assert.ok(!isAllowedQuizEventImagePath(`preview/media/quiz-events/7/${name}`, "preview", 7));
  }
});
test("image persistence is permission checked, compared with saved reference, and never deletes shared files", () => {
  const action = readFileSync("app/quiz/quizEventImageActions.ts", "utf8");
  assert.match(action, /requireQuizEditor\(id\)/); assert.match(action, /verifyEventImage/);
  assert.match(action, /veranstaltungsbild_url: expectedUrl/); assert.match(action, /ist_archiviert: false/);
  assert.doesNotMatch(action, /\bdel\(|deleteMany|\.delete\(/);
  const upload = readFileSync("app/api/question-media-upload/route.ts", "utf8");
  assert.match(upload, /context.target === "QUIZ_EVENT_IMAGE"/);
  assert.match(upload, /requireQuizEditor\(context.quizId\)/);
});
