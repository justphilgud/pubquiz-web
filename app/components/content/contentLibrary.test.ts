import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
  assert.deepEqual(filters, { query: "musik", contentType: "ALL", storyType: "AUDIO", status: "ACTIVE", media: "WITH", usage: "USED" });
  assert.equal(serializeContentFilters(filters).toString(), "q=musik&storyType=AUDIO&status=ACTIVE&media=WITH&usage=USED");
});

test("content library uses common actions and quiz assignment without a block picker", () => {
  const actions = readFileSync(new URL("./ContentActions.tsx", import.meta.url), "utf8");
  const assignment = readFileSync(new URL("./ContentQuizAssignment.tsx", import.meta.url), "utf8");
  assert.ok(actions.indexOf("Bearbeiten") < actions.indexOf("Klonen"));
  assert.ok(actions.indexOf("Klonen") < actions.indexOf("Archivieren"));
  assert.ok(actions.indexOf("Archivieren") < actions.indexOf("Details"));
  assert.match(assignment, /Quiz auswählen/);
  assert.doesNotMatch(assignment, /Block auswählen|sectionId/);
});

test("both editors use the shared editor header", () => {
  const questionEditor = readFileSync(new URL("../../fragen/editor/components/QuestionEditor.tsx", import.meta.url), "utf8");
  const storyEditorPage = readFileSync(new URL("../../story-elemente/[storyElementId]/page.tsx", import.meta.url), "utf8");
  assert.match(questionEditor, /ContentEditorHeader/);
  assert.match(storyEditorPage, /ContentEditorHeader/);
});

test("shared result row contains common and type-specific metrics", () => {
  const row = readFileSync(new URL("./ContentResultRow.tsx", import.meta.url), "utf8");
  for (const component of ["StatusBadge", "ScopeBadge", "MediaBadge", "UsageSummary", "ContentActions"]) assert.match(row, new RegExp(component));
  for (const metric of ["Antworten", "Schwierigkeit", "Antwortart", "Story-Typ", "Verknüpfte Fragen"]) assert.match(row, new RegExp(metric));
});

test("question and story library assignments both persist without a block", () => {
  const questionActions = readFileSync(new URL("../../quiz/actions.ts", import.meta.url), "utf8");
  const storyActions = readFileSync(new URL("../../story-elemente/actions.ts", import.meta.url), "utf8");
  assert.match(questionActions, /quiz_abschnitt_id: null/);
  assert.match(storyActions, /anker_schluessel: "UNASSIGNED"/);
  assert.match(storyActions, /quiz_abschnitt_id: null/);
  assert.match(storyActions, /ist_sichtbar: false/);
});

test("direct and common creation entries remain available", () => {
  const workspace = readFileSync(new URL("./ContentWorkspace.tsx", import.meta.url), "utf8");
  const creationPage = readFileSync(new URL("../../content/new/page.tsx", import.meta.url), "utf8");
  assert.match(workspace, /href="\/content\/new"/);
  for (const href of ["/fragen/editor", "/story-elemente/new"]) {
    assert.match(workspace, new RegExp(`href="${href}"`));
    assert.match(creationPage, new RegExp(`href="${href}"`));
  }
});
