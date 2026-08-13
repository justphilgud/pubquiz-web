import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { DEFAULT_NEW_QUIZ_SOLUTION_STRATEGY } from "./flow/quizFlow";

const read = (path: string) => readFileSync(path, "utf8");
const quizActions = read("app/quiz/actions.ts");
const quizForm = read("app/quiz/QuizForm.tsx");
const quizDetail = read("app/quiz/[quizId]/page.tsx");
const questionPicker = read("app/quiz/[quizId]/QuizFragenHinzufuegen.tsx");
const sharedSearchResult = read("app/quiz/[quizId]/QuizElementSearchResult.tsx");
const structureEditor = read("app/quiz/[quizId]/QuizFragenSortableTable.tsx");
const flowRepository = read("app/quiz/flow/quizFlowRepository.server.ts");
const flowActions = read("app/quiz/[quizId]/ablauf/actions.ts");
const storyPicker = read("app/story-elemente/StoryElementQuizPicker.tsx");
const storyActions = read("app/story-elemente/actions.ts");
const questionSettings = read("app/quiz/[quizId]/QuizQuestionSettings.tsx");
const questionPreview = read("app/quiz/[quizId]/QuizFrageVorschauButton.tsx");
const quizConfiguration = read("app/quiz/[quizId]/QuizConfigurationPanel.tsx");
const flowPage = read("app/quiz/[quizId]/ablauf/page.tsx");
const fixedSlideActions = read("app/quiz/[quizId]/slides/fixedSlideActions.ts");
const fixedSlideEditor = read("app/quiz/[quizId]/slides/FixedSlideEditor.tsx");
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
  assert.match(questionPicker, /Story-Elemente\s*<\/button>/);
  assert.match(questionPicker, /StoryElementQuizPicker/);
  assert.match(questionPicker, /frage\.status_hinweis/);
  assert.match(questionPicker, /frage\.ist_bereits_im_quiz \|\| !frage\.ist_verwendbar/);
  assert.match(questionPicker, /Verknüpfte Story-Elemente ebenfalls hinzufügen/);
  for (const source of [questionPicker, structureEditor, storyPicker]) {
    assert.doesNotMatch(source, /window\.location\.reload\(\)/);
  }
  assert.match(questionPicker, /router\.refresh\(\)/);
  assert.match(questionPicker, /QuizElementSearchResult/);
  assert.match(storyPicker, /QuizElementSearchResult/);
  assert.match(sharedSearchResult, /actionLabel/);
  assert.match(quizDetail, /quiz\.standaloneStoryElements\.map/);
  assert.match(storyPicker, /router\.refresh\(\)/);
  assert.match(storyPicker, /Keine Frage verknüpft/);
  assert.match(storyPicker, /Frage fehlt/);
  assert.match(storyPicker, /Noch nicht verwendbar/);
  assert.match(storyPicker, /addStoryElementToQuiz\(/);
  assert.doesNotMatch(storyPicker, /Block auswählen/);
  assert.match(structureEditor, /moveStandaloneStoryElementToSection/);
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
  assert.match(
    quizActions,
    /story_element_revision_id:\s*\{ not: null \}[\s\S]*anker_schluessel:\s*"UNASSIGNED"[\s\S]*quiz_abschnitte\.delete/,
  );
  assert.ok((flowActions.match(/requireQuizQuestionSection\(/g)?.length ?? 0) >= 6);
});

test("linked stories use only question-bound placements while standalone remains unlinked", () => {
  assert.match(flowActions, /frage_story_elemente\.findFirst/);
  assert.match(flowActions, /story_bezugs_quiz_fragen_id:\s*assignment\.quiz_fragen_id/);
  assert.match(flowActions, /story_beziehung:\s*null/);
  assert.match(flowActions, /darf nicht frei als Standalone platziert werden/);
  assert.match(flowActions, /updateQuizStoryPlacementOverride/);
  assert.match(flowActions, /isStoryPlacement\(data\.placementOverride\)/);
  assert.match(flowActions, /pg_advisory_xact_lock/);
  assert.match(storyActions, /darf nicht frei als Standalone hinzugef/);
  assert.match(storyActions, /pg_advisory_xact_lock/);
  assert.match(questionSettings, /Standard: \{defaultLabel\}/);
  assert.match(questionSettings, /BEFORE_QUESTION/);
  assert.match(questionSettings, /AFTER_SOLUTION/);
  assert.match(quizActions, /materializeQuizQuestionStoryItems/);
  assert.match(flowRepository, /!existingPlacement\.ist_sichtbar/);
  assert.match(flowRepository, /ist_sichtbar:\s*true/);
  assert.match(
    quizActions,
    /story_bezugs_quiz_fragen_id:\s*data\.quizFragenId[\s\S]*quiz_fragen\.delete/,
  );
});

test("central quiz configuration exposes story visibility and removes the redundant flow page", () => {
  assert.match(questionSettings, /Story-Element nicht anzeigen/);
  assert.match(questionSettings, /<Select/);
  assert.match(structureEditor, /Story-Elemente/);
  assert.match(questionPreview, /Verknüpfte Story-Elemente/);
  assert.match(questionPicker, /Story-Elemente: \{frage\.storyElements\.length\}/);
  assert.match(quizConfiguration, /Direkt nach jeder Frage/);
  assert.match(quizConfiguration, /Gesammelt am Ende des Blocks/);
  assert.match(flowPage, /redirect\(`\/quiz\/\$\{quizId\}`\)/);
  assert.match(structureEditor, /Block umbenennen/);
  assert.match(structureEditor, /\+ Block hinzufügen/);
});

test("fixed intro and outro slides persist visibility through existing flow items", () => {
  assert.match(fixedSlideEditor, /Slide in der Präsentation anzeigen/);
  assert.match(fixedSlideActions, /materializeDefaultQuizFlow/);
  assert.match(fixedSlideActions, /ist_sichtbar: enabled/);
});
