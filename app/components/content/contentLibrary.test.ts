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
  assert.match(questions, /initialType="QUESTION"/);
  assert.match(stories, /initialType="STORY_ELEMENT"/);
  assert.doesNotMatch(content, /initialType=/);
});

test("shared content filters parse and serialize mixed search state", () => {
  const filters = parseContentFilters(new URLSearchParams("q=musik&contentType=ALL&storyType=AUDIO&status=ACTIVE&media=WITH&usage=USED"), "QUESTION");
  assert.deepEqual(filters, { query: "musik", contentType: "ALL", categoryIds: [], storyType: "AUDIO", status: "ACTIVE", media: "WITH", usage: "USED", eventSeriesId: null });
  assert.equal(serializeContentFilters(filters).toString(), "q=musik&storyType=AUDIO&status=ACTIVE&media=WITH&usage=USED");
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
  assert.match(actions, /total: questionResult\.total \+ stories\.length/);
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
  for (const metric of ["Antworten", "Schwierigkeit", "Antwortart", "Story-Typ", "Verknüpfte Frage", "Quiz-Verwendungen", "Quelle"]) assert.match(row, new RegExp(metric));
});

test("question and story library assignments both persist without a block", () => {
  const questionActions = readFileSync(new URL("../../quiz/actions.ts", import.meta.url), "utf8");
  const storyActions = readFileSync(new URL("../../story-elemente/actions.ts", import.meta.url), "utf8");
  assert.match(questionActions, /quiz_abschnitt_id: null/);
  assert.match(storyActions, /anker_schluessel: "UNASSIGNED"/);
  assert.match(storyActions, /quiz_abschnitt_id: null/);
  assert.match(storyActions, /ist_sichtbar: false/);
});

test("content workspace links directly to canonical creation routes", () => {
  const workspace = readFileSync(new URL("./ContentWorkspace.tsx", import.meta.url), "utf8");
  for (const href of ["/content/questions/new", "/content/story-elements/new"]) {
    assert.match(workspace, new RegExp(`href="${href}"`));
  }
});

test("type changes discard irrelevant filters and preserve relevant ones", () => {
  assert.deepEqual(parseContentFilters(new URLSearchParams("contentType=QUESTION&storyType=AUDIO&categoryId=4")), {
    query: "", contentType: "QUESTION", categoryIds: [4], storyType: "ALL", status: "ALL", media: "ALL", usage: "ALL", eventSeriesId: null,
  });
  assert.deepEqual(parseContentFilters(new URLSearchParams("contentType=STORY_ELEMENT&storyType=AUDIO&categoryId=4")), {
    query: "", contentType: "STORY_ELEMENT", categoryIds: [], storyType: "AUDIO", status: "ALL", media: "ALL", usage: "ALL", eventSeriesId: null,
  });
});

test("legacy editor routes permanently redirect to canonical content routes", () => {
  const config = readFileSync(new URL("../../../next.config.ts", import.meta.url), "utf8");
  for (const route of ["/fragen/editor", "/fragen/editor/:questionId", "/story-elemente/new", "/story-elemente/:storyElementId"]) assert.match(config, new RegExp(route.replace(/[/:]/g, "\\$&")));
  assert.match(config, /permanent: true/);
});
