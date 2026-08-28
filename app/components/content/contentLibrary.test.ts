import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import {
  parseContentFilters,
  resolveContentFilterDraft,
  serializeContentFilters,
  type ContentFilterDraft,
} from "./contentLibrary";

test("content routes keep their domain-specific initial filter", () => {
  assert.equal(parseContentFilters(new URLSearchParams(), "QUESTION").contentType, "QUESTION");
  assert.equal(parseContentFilters(new URLSearchParams(), "STORY_ELEMENT").contentType, "STORY_ELEMENT");
  assert.equal(parseContentFilters(new URLSearchParams(), "POLL").contentType, "POLL");
  assert.equal(parseContentFilters(new URLSearchParams()).contentType, "ALL");
});

test("content filter draft follows URL and type changes without remounting", () => {
  const draft: ContentFilterDraft = {
    initialType: "QUESTION",
    paramsKey: "",
    filters: parseContentFilters(new URLSearchParams(), "QUESTION"),
  };
  assert.equal(resolveContentFilterDraft(draft, "QUESTION", "").contentType, "QUESTION");
  assert.equal(resolveContentFilterDraft(draft, "STORY_ELEMENT", "").contentType, "STORY_ELEMENT");
  assert.equal(resolveContentFilterDraft(draft, undefined, "").contentType, "ALL");
  assert.equal(resolveContentFilterDraft(draft, "QUESTION", "contentType=STORY_ELEMENT").contentType, "STORY_ELEMENT");
});

test("content search effect has one static dependency contract", () => {
  const source = readFileSync(new URL("./ContentSearch.tsx", import.meta.url), "utf8");
  assert.match(source, /\}, \[initialType, paramsKey\]\);/);
  assert.doesNotMatch(source, /useEffect\([^]*\?\s*\[/);
  assert.doesNotMatch(source, /<ContentSearchState key=/);
});

test("content entry routes declare the expected initial filters", () => {
  const questions = readFileSync(new URL("../../fragen/page.tsx", import.meta.url), "utf8");
  const stories = readFileSync(new URL("../../story-elemente/page.tsx", import.meta.url), "utf8");
  const content = readFileSync(new URL("../../content/page.tsx", import.meta.url), "utf8");
  const polls = readFileSync(new URL("../../content/polls/page.tsx", import.meta.url), "utf8");
  assert.match(questions, /initialType="QUESTION"/);
  assert.match(stories, /initialType="STORY_ELEMENT"/);
  assert.doesNotMatch(content, /initialType=/);
  assert.match(polls, /initialType="POLL"/);
});

test("shared content filters parse and serialize mixed search state", () => {
  const filters = parseContentFilters(new URLSearchParams("q=musik&contentType=ALL&storyType=AUDIO&status=ACTIVE&media=WITH&usage=USED"), "QUESTION");
  assert.deepEqual(filters, { query: "musik", contentType: "ALL", categoryIds: [], storyType: "AUDIO", status: "ACTIVE", questionLifecycle: "ALL", media: "WITH", usage: "USED", eventSeriesId: null });
  assert.equal(serializeContentFilters(filters).toString(), "q=musik&storyType=AUDIO&status=ACTIVE&media=WITH&usage=USED");
});

test("question lifecycle filters round-trip and are removed for story-only views", () => {
  const questionFilters = parseContentFilters(
    new URLSearchParams("contentType=QUESTION&questionLifecycle=REVIEW_DUE"),
  );
  assert.equal(questionFilters.questionLifecycle, "REVIEW_DUE");
  assert.equal(
    serializeContentFilters(questionFilters).toString(),
    "contentType=QUESTION&questionLifecycle=REVIEW_DUE",
  );
  assert.equal(
    parseContentFilters(
      new URLSearchParams("contentType=STORY_ELEMENT&questionLifecycle=OUTDATED"),
    ).questionLifecycle,
    "ALL",
  );
});

test("category filters preserve multiple independently removable selections", () => {
  const filters = parseContentFilters(new URLSearchParams("categoryId=4&categoryId=7&categoryId=4"));
  assert.deepEqual(filters.categoryIds, [4, 7]);
  assert.equal(serializeContentFilters(filters).toString(), "categoryId=4&categoryId=7");

  const questionSearch = readFileSync(new URL("../../fragen/actions.ts", import.meta.url), "utf8");
  assert.match(questionSearch, /fragenkategorie_id:\s*data\.kategorieIds\?\.length\s*\?\s*\{ in: data\.kategorieIds \}/);

  const controls = readFileSync(new URL("./ContentFilters.tsx", import.meta.url), "utf8");
  assert.match(controls, /placeholder="Kategorien suchen …"/);
  assert.match(controls, /visibleCategories/);
  assert.doesNotMatch(serializeContentFilters(filters).toString(), /categoryQuery|Kategorien suchen/);
});

test("content library uses common actions and quiz assignment without a block picker", () => {
  const actions = readFileSync(new URL("./ContentActions.tsx", import.meta.url), "utf8");
  const assignment = readFileSync(new URL("./ContentQuizAssignment.tsx", import.meta.url), "utf8");
  assert.ok(actions.indexOf("Bearbeiten") < actions.indexOf("Klonen"));
  assert.ok(actions.indexOf("Klonen") < actions.indexOf("Archivieren"));
  assert.ok(actions.indexOf("Archivieren") < actions.indexOf("Details"));
  assert.match(assignment, /Quiz auswählen/);
  assert.doesNotMatch(assignment, /Block auswählen|sectionId/);
  assert.doesNotMatch(assignment, />Hinzufügen<|window\.location\.reload/);
  assert.match(assignment, /onChange=\{\(event\) => assign\(event\.target\.value\)\}/);
});

test("search exposes the current result total and permission-derived event series filters", () => {
  const search = readFileSync(new URL("./ContentSearch.tsx", import.meta.url), "utf8");
  const actions = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");
  const page = readFileSync(new URL("./ContentLibraryPage.tsx", import.meta.url), "utf8");
  assert.match(search, /result\.items\.length.*result\.total/);
  assert.match(actions, /total: questionResult\.total \+ stories\.length \+ pollItems\.length/);
  assert.match(page, /getAssignableQuestionEventSeries/);
});

test("template picker exposes standard question as an explicit non-template option", () => {
  const picker = readFileSync(new URL("../../fragen/editor/components/TemplateSelector.tsx", import.meta.url), "utf8");
  assert.match(picker, /Standardfrage/);
  assert.match(picker, /onClearSelection\(\)/);
  assert.match(picker, /aria-pressed=\{selectedTemplateId === null\}/);
});

test("both editors share scope and fixed action foundations with discard state", () => {
  const sharedScope = readFileSync(new URL("./ContentScopeSection.tsx", import.meta.url), "utf8");
  const storyEditor = readFileSync(new URL("../../story-elemente/StoryElementEditor.tsx", import.meta.url), "utf8");
  const questionEditor = readFileSync(new URL("../../fragen/editor/components/QuestionEditor.tsx", import.meta.url), "utf8");
  assert.match(sharedScope, /role="radiogroup"/);
  assert.match(sharedScope, /role="combobox"/);
  assert.match(questionEditor, /import ContentScopeSection[^]*@\/app\/components\/content\/ContentScopeSection/);
  assert.match(storyEditor, /import ContentScopeSection[^]*@\/app\/components\/content\/ContentScopeSection/);
  assert.match(questionEditor, /<ContentScopeSection/);
  assert.match(storyEditor, /<ContentScopeSection/);
  assert.equal(existsSync(new URL("../../fragen/editor/components/QuestionScopeSection.tsx", import.meta.url)), false);
  assert.doesNotMatch(storyEditor, /Verfügbarkeit<\/span><select/);
  assert.match(storyEditor, /ContentEditorActionBar/);
  assert.match(questionEditor, /savedDraftRef/);
  assert.match(questionEditor, /cancelChanges/);
});

test("both editors use the shared editor shell", () => {
  const questionEditor = readFileSync(new URL("../../fragen/editor/components/QuestionEditor.tsx", import.meta.url), "utf8");
  const storyEditorPage = readFileSync(new URL("../../story-elemente/[storyElementId]/page.tsx", import.meta.url), "utf8");
  assert.match(questionEditor, /ContentEditorShell/);
  assert.match(storyEditorPage, /ContentEditorShell/);
});

test("shared result row contains common and type-specific metrics", () => {
  const row = readFileSync(new URL("./ContentResultRow.tsx", import.meta.url), "utf8");
  for (const component of ["StatusBadge", "ScopeBadge", "MediaBadge", "UsageSummary", "ContentActions"]) assert.match(row, new RegExp(component));
  for (const metric of ["Antworten", "Schwierigkeit", "Antwortart", "Story-Typ", "Verknüpfte Frage", "Quiz-Verwendungen", "Quelle", "Umfragetyp", "Veröffentlichung"]) assert.match(row, new RegExp(metric));
});

test("question, story and poll library assignments persist without a block", () => {
  const questionActions = readFileSync(new URL("../../quiz/actions.ts", import.meta.url), "utf8");
  const storyActions = readFileSync(new URL("../../story-elemente/actions.ts", import.meta.url), "utf8");
  const pollActions = readFileSync(new URL("../../umfragen/actions.ts", import.meta.url), "utf8");
  assert.match(questionActions, /quiz_abschnitt_id: null/);
  assert.match(storyActions, /anker_schluessel: "UNASSIGNED"/);
  assert.match(storyActions, /quiz_abschnitt_id: null/);
  assert.match(storyActions, /ist_sichtbar: false/);
  assert.match(pollActions, /anker_schluessel: anchorKey/);
  assert.match(pollActions, /quiz_abschnitt_id: section\?\.quiz_abschnitt_id \?\? null/);
  assert.match(pollActions, /ist_sichtbar: section !== null/);
});

test("content workspace links directly to canonical creation routes", () => {
  const workspace = readFileSync(new URL("./ContentWorkspace.tsx", import.meta.url), "utf8");
  const actions = readFileSync(new URL("./ContentCreateActions.tsx", import.meta.url), "utf8");
  assert.match(workspace, /<ContentCreateActions/);
  for (const href of ["/content/questions/new", "/content/story-elements/new", "/content/polls/new"]) {
    assert.match(actions, new RegExp(`href: "${href}"`));
  }
  assert.doesNotMatch(actions, /<details|<summary/);
});

test("type changes discard irrelevant filters and preserve relevant ones", () => {
  assert.deepEqual(parseContentFilters(new URLSearchParams("contentType=QUESTION&storyType=AUDIO&categoryId=4")), {
    query: "", contentType: "QUESTION", categoryIds: [4], storyType: "ALL", status: "ALL", questionLifecycle: "ALL", media: "ALL", usage: "ALL", eventSeriesId: null,
  });
  assert.deepEqual(parseContentFilters(new URLSearchParams("contentType=STORY_ELEMENT&storyType=AUDIO&categoryId=4")), {
    query: "", contentType: "STORY_ELEMENT", categoryIds: [], storyType: "AUDIO", status: "ALL", questionLifecycle: "ALL", media: "ALL", usage: "ALL", eventSeriesId: null,
  });
  assert.deepEqual(parseContentFilters(new URLSearchParams("contentType=POLL&storyType=AUDIO&categoryId=4&questionLifecycle=OUTDATED")), {
    query: "", contentType: "POLL", categoryIds: [], storyType: "ALL", status: "ALL", questionLifecycle: "ALL", media: "ALL", usage: "ALL", eventSeriesId: null,
  });
});

test("polls participate in shared discovery and the quiz add dialog", () => {
  const actions = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");
  const filters = readFileSync(new URL("./ContentFilters.tsx", import.meta.url), "utf8");
  const quizAdd = readFileSync(new URL("../../quiz/[quizId]/QuizFragenHinzufuegen.tsx", import.meta.url), "utf8");
  const quizPage = readFileSync(new URL("../../quiz/[quizId]/page.tsx", import.meta.url), "utf8");
  assert.match(filters, /<option value="POLL">Umfragen<\/option>/);
  assert.match(actions, /includePolls \? listLivePolls\(actor\)/);
  assert.match(actions, /poll\.prompt\.toLocaleLowerCase\("de-DE"\)\.includes\(normalizedQuery\)/);
  assert.match(actions, /contentType: "POLL"/);
  assert.match(quizPage, /searchContent\(parseContentFilters\(new URLSearchParams\("contentType=POLL"\)\)\)/);
  assert.match(quizAdd, /visiblePolls\.map/);
  assert.match(quizAdd, /assignContentToQuiz\(\{/);
  assert.match(quizAdd, /href="\/content\/polls\/new"/);
});

test("legacy editor routes permanently redirect to canonical content routes", () => {
  const config = readFileSync(new URL("../../../next.config.ts", import.meta.url), "utf8");
  for (const route of ["/fragen/editor", "/fragen/editor/:questionId", "/story-elemente/new", "/story-elemente/:storyElementId"]) assert.match(config, new RegExp(route.replace(/[/:]/g, "\\$&")));
  assert.match(config, /permanent: true/);
});
