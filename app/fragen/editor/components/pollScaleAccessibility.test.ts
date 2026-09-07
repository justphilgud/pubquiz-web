import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as jsxRuntime from "react/jsx-runtime";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

type Data = { kind: "POLL_SCALE"; min: number; max: number; step: number; minLabel: string; maxLabel: string };
type Props = { data: Data; disabled: boolean };
const source = readFileSync(new URL("./StructuredTemplateEditor.tsx", import.meta.url), "utf8");
const body = source.slice(source.indexOf("function PollScaleEditor("), source.indexOf("const editors:"));
function render(disabled = false) {
  const changes: Data[] = [];
  const exports: { PollScaleEditor?: (props: Props) => ReactElement } = {};
  runInNewContext(ts.transpileModule(`export ${body}`, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, {
    exports, require: () => jsxRuntime, inputClass: "min-h-11", commit: (_props: Props, data: Data) => changes.push(data),
  });
  const data: Data = { kind: "POLL_SCALE", min: 1, max: 5, step: 1, minLabel: "Gar nicht", maxLabel: "Vollkommen" };
  const element = exports.PollScaleEditor!({ data, disabled });
  const fields: ReactElement<Record<string, unknown>>[] = [];
  function walk(node: ReactNode) {
    if (Array.isArray(node)) node.forEach(walk);
    else if (isValidElement<Record<string, unknown>>(node)) { if (node.type === "input") fields.push(node); walk(node.props.children as ReactNode); }
  }
  walk(element);
  return { html: renderToStaticMarkup(element), changes, fields, data };
}
test("each scale boundary has one independent visible label and input", () => {
  const { html } = render();
  const labels = [...html.matchAll(/<label[^>]*>([\s\S]*?)<\/label>/g)].map(match => match[1]);
  for (const name of ["Beschriftung links", "Beschriftung rechts"]) {
    const label = labels.find(text => text.startsWith(name));
    assert.ok(label); assert.equal((label.match(/<input/g) ?? []).length, 1);
    assert.equal(label.includes(name === "Beschriftung links" ? "Beschriftung rechts" : "Beschriftung links"), false);
  }
});
test("editing either boundary preserves the opposite value and scale settings", () => {
  const { fields, changes, data } = render();
  for (const [index, key] of [[3, "minLabel"], [4, "maxLabel"]] as const) {
    (fields[index].props.onChange as (event: unknown) => void)({ target: { value: "Neue Grenze" } });
    assert.deepEqual({ ...changes.at(-1) }, { ...data, [key]: "Neue Grenze" });
  }
  assert.ok(render(true).fields.every(field => field.props.disabled));
});
