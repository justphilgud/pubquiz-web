import assert from "node:assert/strict";
import test from "node:test";
import { formatQuizDuration, formatQuizQuestionCount, getQuizComposition } from "./quizPlanning";

test("assignment counts cover empty, single and large quizzes; duration avoids second-level precision", () => {
  assert.equal(formatQuizQuestionCount(0), "0 Fragen");
  assert.equal(formatQuizQuestionCount(1), "1 Frage");
  assert.equal(formatQuizQuestionCount(24), "24 Fragen");
  assert.equal(formatQuizDuration(33), "unter 1 Min.");
  assert.equal(formatQuizDuration(3_774), "ca. 1 Std. 5 Min.");
  assert.deepEqual(getQuizComposition([]), { categories: [], templates: [] });
});

test("category membership is counted once per assignment per category and divided by all assignments", () => {
  assert.deepEqual(getQuizComposition([
    { templateId: null, vorlagenname: "", kategorien: [] },
    { templateId: "standard", vorlagenname: "Standard", kategorien: ["Musik", "Kultur", "Musik"] },
    { templateId: "paare_bilden", vorlagenname: "Paare bilden", kategorien: ["Musik", "Kultur"] },
  ]), {
    categories: [{ id: "Kultur", label: "Kultur", count: 2, share: 67 }, { id: "Musik", label: "Musik", count: 2, share: 67 },
      { id: null, label: "Ohne Kategorie", count: 1, share: 33 }],
    templates: [{ id: null, label: "Standardfrage", count: 2, share: 67 }, { id: "paare_bilden", label: "Paare bilden", count: 1, share: 33 }],
  });
});
