import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

type Node = { type: string; props: Record<string, unknown> };
type Result = { success: boolean; quizId?: number; message: string };
function harness(copy: () => Promise<Result>) {
  const states: unknown[] = ["Eigene Kopie", "2026-09-08", "", false];
  const refs: { current: unknown }[] = [];
  let stateIndex = 0, refIndex = 0, closed = 0;
  const location = { href: "/quiz/30" };
  const exports: { QuizCopyDialog?: (props: unknown) => Node } = {};
  const jsx = (type: string, props: Record<string, unknown>) => ({ type, props });
  const code = ts.transpileModule(readFileSync(new URL("./QuizCopyDialog.tsx", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  runInNewContext(code, { exports, window: { location }, require: (name: string) => {
    if (name === "react/jsx-runtime") return { jsx, jsxs: jsx };
    if (name === "react") return {
      useEffect: () => {},
      useRef: (value: unknown) => refs[refIndex++] ?? (refs[refIndex - 1] = { current: value }),
      useState: () => { const index = stateIndex++; return [states[index], (value: unknown) => { states[index] = value; }]; },
    };
    if (name === "./actions") return { copyQuiz: copy };
    return { DocumentDuplicateIcon: "icon" };
  } });
  function render() {
    stateIndex = 0; refIndex = 0;
    const root = exports.QuizCopyDialog!({ quizId: 30, quizTitle: "Quelle" });
    refs[0].current = { close: () => { closed++; } };
    const nodes: Node[] = [];
    function walk(value: unknown) {
      if (Array.isArray(value)) value.forEach(walk);
      else if (value && typeof value === "object" && "props" in value) { const node = value as Node; nodes.push(node); walk(node.props.children); }
    }
    walk(root);
    return nodes;
  }
  const submit = () => { (render().find(node => node.type === "form")!.props.onSubmit as (event: unknown) => void)({ preventDefault() {} }); };
  return { render, submit, states, location, closed: () => closed };
}
const settle = () => new Promise<void>(resolve => setImmediate(resolve));

test("copy is the native submit; cancel closes without invoking the server", () => {
  let calls = 0;
  const h = harness(async () => { calls++; return { success: true, quizId: 31, message: "OK" }; });
  const nodes = h.render();
  assert.equal(nodes.find(node => node.type === "form")!.props.method, undefined);
  const cancel = nodes.find(node => node.props.children === "Abbrechen")!;
  assert.equal(cancel.props.type, "button");
  (cancel.props.onClick as () => void)();
  assert.equal(calls, 0); assert.equal(h.closed(), 1);
  assert.equal(nodes.find(node => node.props.children === "Kopie anlegen")!.props.type, "submit");
  assert.ok(nodes.filter(node => node.type === "input").every(node => node.props.required));
});

test("simultaneous submissions and submission before navigation create only one copy", async () => {
  let calls = 0;
  let resolve!: (value: Result) => void;
  const h = harness(() => { calls++; return new Promise(done => { resolve = done; }); });
  h.submit(); h.submit();
  assert.equal(calls, 1);
  assert.ok(h.render().filter(node => node.type === "input" || node.props.children === "Abbrechen" || node.props.children === "Wird kopiert …").every(node => node.props.disabled));
  let prevented = false;
  (h.render().find(node => node.type === "dialog")!.props.onCancel as (event: unknown) => void)({ preventDefault: () => { prevented = true; } });
  assert.equal(prevented, true);
  resolve({ success: true, quizId: 31, message: "OK" }); await settle();
  assert.equal(h.location.href, "/quiz/31");
  h.submit(); assert.equal(calls, 1);
});

for (const failure of ["result", "exception"] as const) test(`${failure} shows an error and allows a retry`, async () => {
  let calls = 0;
  const h = harness(async () => { calls++; if (failure === "exception") throw new Error("Offline"); return { success: false, message: "Ungültiges Datum" }; });
  h.submit(); await settle();
  assert.equal(h.states[3], false);
  assert.ok(h.render().some(node => node.props.role === "alert"));
  assert.equal(h.location.href, "/quiz/30");
  h.submit(); await settle(); assert.equal(calls, 2);
});

test("empty title or date never invokes copying", () => {
  let calls = 0;
  const h = harness(async () => { calls++; return { success: false, message: "" }; });
  h.states[0] = "  "; h.submit(); h.states[0] = "Titel"; h.states[1] = ""; h.submit();
  assert.equal(calls, 0);
});
