import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { DEFAULT_NEW_QUIZ_SOLUTION_STRATEGY } from "./flow/quizFlow";

const read = (path: string) => readFileSync(path, "utf8");
const quizActions = read("app/quiz/actions.ts");
const quizForm = read("app/quiz/QuizForm.tsx");
const quizDetail = read("app/quiz/[quizId]/page.tsx");
const questionPicker = read("app/quiz/[quizId]/QuizFragenHinzufuegen.tsx");
const structureEditor = read("app/quiz/[quizId]/QuizFragenSortableTable.tsx");
const flowActions = read("app/quiz/[quizId]/ablauf/actions.ts");
const storyPicker = read("app/story-elemente/StoryElementQuizPicker.tsx");
const quizAccess = read("app/quiz/quizAccess.server.ts");
const eventSeriesManager = read("app/admin/eventreihen/EventSeriesManager.tsx");
const quizTemplateResolver = read("app/rendering/resolveQuizTemplates.server.ts");

test("new quizzes persist the blockwise solution strategy by default", () => {
  assert.equal(DEFAULT_NEW_QUIZ_SOLUTION_STRATEGY, "END_OF_BLOCK");
  assert.match(
    quizActions,
    /aufloesungsstrategie:\s*\n?\s*data\.solutionStrategy \?\? DEFAULT_NEW_QUIZ_SOLUTION_STRATEGY/,
  );
  assert.match(quizForm, /solutionStrategy: DEFAULT_NEW_QUIZ_SOLUTION_STRATEGY/);
});

test("presentation selection is the only template choice in event series and quiz forms", () => {
  assert.doesNotMatch(eventSeriesManager, /defaultAnswerFormTemplateId/);
  assert.doesNotMatch(quizForm, /answerFormTemplateId/);
  assert.doesNotMatch(quizTemplateResolver, /answer_form_template_id/);
  assert.match(
    quizTemplateResolver,
    /resolveAnswerFormTemplate\(\{[\s\S]*quizTemplateId: quiz\.presentation_template_id,[\s\S]*eventSeriesTemplateId: quiz\.eventreihe\.default_presentation_template_id/,
  );
});

test("quiz overview and editor expose compact, distinct settings and content actions", () => {
  assert.match(quizForm, /title="Quiz-Einstellungen"/);
  assert.match(quizForm, /title="Quizinhalt bearbeiten"/);
  assert.match(quizForm, /href=\{`\/quiz\/\$\{quiz\.quiz_id\}`\}/);
  assert.match(quizDetail, /aria-label="Quiz-Einstellungen öffnen"/);
  assert.doesNotMatch(quizDetail, />Produktive Oberflächen</);
  assert.doesNotMatch(quizDetail, />Effektives Präsentationstemplate</);
});

test("question and story additions share one visible entry workflow without full reloads", () => {
  assert.match(questionPicker, /Quiz-Element hinzufügen/);
  assert.match(questionPicker, /ContentSearchControls/);
  assert.match(questionPicker, /Story-Element auswählen/);
  assert.match(questionPicker, /frage\.status_hinweis/);
  assert.match(questionPicker, /frage\.ist_bereits_im_quiz \|\| !frage\.ist_verwendbar/);
  assert.match(questionPicker, /Verknüpfte Story-Elemente ebenfalls hinzufügen/);
  for (const source of [questionPicker, structureEditor, storyPicker]) {
    assert.doesNotMatch(source, /window\.location\.reload\(\)/);
  }
  assert.match(questionPicker, /router\.refresh\(\)/);
  assert.match(quizDetail, /key=\{quiz\.fragen\.map\(\(frage\) => frage\.quiz_fragen_id\)\.join\("-"\)\}/);
  assert.match(storyPicker, /router\.refresh\(\)/);
});

test("draft questions are discoverable but server assignment retains eligibility checks", () => {
  assert.match(quizActions, /ist_archiviert: false,[\s\S]*review_status: frage\.review_status/);
  assert.match(quizActions, /Entwurf – noch nicht freigegeben/);
  assert.match(
    quizActions,
    /findFirst\(\{[\s\S]*fragen_id: data\.fragenId,[\s\S]*buildQuestionEligibilityWhere\(eventSeriesId, getBerlinDate\(\)\)/,
  );
});

test("intro and outro reject regular block, question and story mutations", () => {
  assert.match(quizAccess, /requireQuizQuestionSection[\s\S]*isQuestionSection\(section\)/);
  assert.match(structureEditor, /droppable:[\s\S]*gruppe\.blockTyp !== "kein-block"/);
  assert.match(structureEditor, /zielAbschnitt && !isQuestionSection\(zielAbschnitt\)/);
  assert.ok((quizActions.match(/requireQuizQuestionSection\(/g)?.length ?? 0) >= 7);
  assert.match(quizActions, /sortierung: index \+ 2/);
  assert.ok((flowActions.match(/requireQuizQuestionSection\(/g)?.length ?? 0) >= 6);
});
