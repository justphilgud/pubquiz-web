import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ContentEditorActionBar from "./ContentEditorActionBar";
import { editorViewportInsets, observeEditorViewport } from "./contentEditorViewport";
import { EditorSaveActions } from "../../fragen/editor/components/EditorSaveActions";
import { QuestionEditorMessagesProvider } from "../../fragen/editor/components/QuestionEditorMessagesProvider";
import { loadQuestionEditorMessages } from "../../i18n/questionEditorMessages";
import type { QuestionEditorCapabilities } from "../../lib/permissions";
import { PresentationContentWarning } from "../../rendering/presentation/PresentationContentWarning";

const noop = () => {};
const baseCapabilities: QuestionEditorCapabilities = { canSaveDraft: true, canSubmitForReview: false, canApproveQuestion: false, canRequestQuestionChanges: false, canCloneQuestion: false, canArchiveQuestion: false, canDeleteQuestion: false, canManageCategories: false };
const messages = loadQuestionEditorMessages("de");

test("mobile and desktop share the same three actions and one stateful secondary option", () => {
  const html = renderToStaticMarkup(createElement(ContentEditorActionBar, { onCancel: noop, onSaveDraft: noop, onPublish: noop, secondaryOption: createElement("input", { type: "checkbox", name: "special-template" }) }));
  for (const label of ["Abbrechen", "Entwurf speichern", "Speichern und freigeben"]) assert.equal(html.split(label).length - 1, 1);
  assert.equal(html.split('name="special-template"').length - 1, 1);
  assert.match(html, /aria-expanded="false"/);
  assert.match(html, /aria-controls="[^"]+"/);
});

for (const role of ["draft", "editor", "reviewer"] as const) {
  test(`mobile action projection preserves ${role} capabilities and workflow labels`, () => {
    const capabilities = { ...baseCapabilities, canSubmitForReview: role === "editor", canApproveQuestion: role === "reviewer" };
    const html = renderToStaticMarkup(<QuestionEditorMessagesProvider locale="de" messages={messages}><EditorSaveActions capabilities={capabilities} pendingAction={null} message={null} onCancel={noop} onSaveDraft={noop} onRunWorkflow={noop} /></QuestionEditorMessagesProvider>);
    const primary = html.match(/<button[^>]*content-editor-primary[^>]*>(.*?)<\/button>/)?.[1];
    assert.equal(primary, role === "draft" ? messages.save.saveDraft : role === "editor" ? messages.save.submit : messages.save.saveAndApprove);
    assert.equal((html.match(/ disabled=""/g) ?? []).length, role === "draft" ? 1 : 0);
  });
}

test("pending disables primary, secondary, cancel and expansion controls", () => {
  const html = renderToStaticMarkup(createElement(ContentEditorActionBar, { pending: true, onCancel: noop, onSaveDraft: noop, onPublish: noop }));
  assert.match(html, /aria-busy="true"/);
  assert.equal((html.match(/<button/g) ?? []).length, 4);
  assert.equal((html.match(/ disabled=""/g) ?? []).length, 4);
});

test("AP5 warning threshold and complete explanation survive mobile disclosure", () => {
  assert.equal(renderToStaticMarkup(createElement(PresentationContentWarning, { text: "a".repeat(220), role: "question" })), "");
  const html = renderToStaticMarkup(createElement(PresentationContentWarning, { text: "a".repeat(221), role: "question" }));
  assert.match(html, /<details/);
  assert.match(html, /role="status"/);
  assert.match(html, /221 \/ empfohlen 220/);
  assert.match(html, /vollständig erhalten/);
});

test("viewport geometry supports resizing and overlay keyboards without guessing devices", () => {
  assert.deepEqual(editorViewportInsets(844, 440, 0), { height: 440, bottom: 404 });
  assert.deepEqual(editorViewportInsets(440, 440, 0), { height: 440, bottom: 0 });
  assert.deepEqual(editorViewportInsets(844, 440, 40), { height: 440, bottom: 364 });
  assert.deepEqual(editorViewportInsets(440, 844, 0), { height: 844, bottom: 0 });
});

test("viewport observers update on events, release listeners, and tolerate missing VisualViewport", () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "window");
  const viewport = Object.assign(new EventTarget(), { height: 440, offsetTop: 0 });
  const fakeWindow = Object.assign(new EventTarget(), { innerHeight: 844, visualViewport: viewport as typeof viewport | null });
  const styles = new Map<string, string>();
  const bar = { style: { setProperty: (key: string, value: string) => styles.set(key, value) } } as unknown as HTMLElement;
  Object.defineProperty(globalThis, "window", { value: fakeWindow, configurable: true });
  try {
    const cleanup = observeEditorViewport(bar);
    assert.equal(styles.get("--editor-viewport-bottom"), "404px");
    viewport.height = 600;
    viewport.dispatchEvent(new Event("resize"));
    assert.equal(styles.get("--editor-viewport-bottom"), "244px");
    cleanup();
    viewport.height = 844;
    viewport.dispatchEvent(new Event("resize"));
    fakeWindow.dispatchEvent(new Event("resize"));
    assert.equal(styles.get("--editor-viewport-bottom"), "244px");
    fakeWindow.visualViewport = null;
    const fallbackCleanup = observeEditorViewport(bar);
    assert.equal(styles.get("--editor-viewport-bottom"), "0px");
    fallbackCleanup();
  } finally {
    if (original) Object.defineProperty(globalThis, "window", original);
    else Reflect.deleteProperty(globalThis, "window");
  }
});

test("question, story and poll reuse the shared action bar without a layout request path", () => {
  for (const path of ["../../fragen/editor/components/EditorSaveActions.tsx", "../../story-elemente/StoryElementEditor.tsx", "../../umfragen/LivePollEditor.tsx"]) assert.match(readFileSync(new URL(path, import.meta.url), "utf8"), /ContentEditorActionBar/);
  const viewport = readFileSync(new URL("./contentEditorViewport.ts", import.meta.url), "utf8");
  assert.doesNotMatch(viewport, /setInterval|requestAnimationFrame|fetch\(/);
});
