import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";
import { build } from "esbuild";
import { PDFArray, PDFDocument, PDFRawStream, decodePDFRawStream } from "pdf-lib";
import { generateCard } from "../core/cards";
import { getPresentationTemplate, type PresentationTemplate } from "@/app/rendering/templateRegistry";
import type { SharedDesign } from "@/app/rendering/sharedDesign/sharedDesign";
import { parsePrintSnapshot } from "./printSnapshot";

test("actual Phil Gud and LOVD PDF export embeds original frozen fonts/logo, paginates and reexports", { timeout: 120000 }, async () => {
  const bundled = await build({ stdin: { contents: "export * from './app/bingo/preparation/pdf.server'; export * from './app/bingo/preparation/printAssets.server';", resolveDir: process.cwd() }, bundle: true, write: false, platform: "node", format: "cjs", packages: "external", plugins: [{ name: "server-marker", setup(b) {
    b.onResolve({ filter: /^server-only$/ }, () => ({ path: "server-only", namespace: "fixture" }));
    b.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ contents: "" }));
  } }] });
  const runtime = { exports: {} };
  // Execute our own compiled module in the host realm: pdf-lib deliberately
  // validates Array/Uint8Array identities across its API boundary.
  new Function("require", "module", "exports", bundled.outputFiles[0].text)(createRequire(import.meta.url), runtime, runtime.exports);
  const api = runtime.exports as typeof import("./pdf.server") & typeof import("./printAssets.server");
  for (const id of ["phil-gud", "lovd-ungegoogelt"]) {
    const template: PresentationTemplate = getPresentationTemplate(id)!;
    const design: SharedDesign = { version: 1, templateId: id, name: id, config: { version: 1, tokens: template.tokens, design: template.design, surfaces: { presentation: template.variant, moderation: template.moderationVariant ?? "BRANDED", answerForm: "BRANDED" } } };
    const snapshot = await api.capturePrintSnapshot(design, "Bingo – gemeinsam spielen", "Runde 1");
    assert.ok(snapshot.body.bytes.length > 1000); assert.ok(snapshot.display.bytes.length > 1000); assert.ok(snapshot.logo);
    assert.doesNotThrow(() => parsePrintSnapshot(JSON.parse(JSON.stringify(snapshot))));
    assert.throws(() => parsePrintSnapshot({ ...snapshot, logo: null }), "a configured logo must have its actual frozen bytes");
    const corrupt = structuredClone(snapshot); corrupt.body.bytes = corrupt.body.bytes.slice(4);
    assert.throws(() => parsePrintSnapshot(corrupt));
    const cards = Array.from({ length: 9 }, (_, i) => ({ ...generateCard(`card-${i}`, () => (i + 1) / 11), ordinal: i + 1, code: `BG-0123456789AB-${String(i + 1).padStart(4, "0")}` }));
    const bytes = await api.createCardsPdf(snapshot, cards), again = await api.createCardsPdf(snapshot, cards);
    assert.equal((await PDFDocument.load(bytes)).getPageCount(), 3); assert.equal((await PDFDocument.load(again)).getPageCount(), 3);
    const doc = await PDFDocument.load(bytes);
    const contents = doc.getPage(0).node.Contents();
    assert.ok(contents instanceof PDFArray);
    const operators = Array.from({ length: contents.size() }, (_, i) => { const stream = doc.context.lookup(contents.get(i)); assert.ok(stream instanceof PDFRawStream); return Buffer.from(decodePDFRawStream(stream).decode()).toString("utf8"); }).join("\n");
    assert.ok((operators.match(/ (?:c|v|y)\n/g) ?? []).length > 100, "visible original glyph curves must accompany embedded searchable text; variable-font viewer defects must not remove letters");
    assert.match(operators, /BT[\s\S]*?Tj[\s\S]*?ET/, "searchable embedded text remains present");
    assert.ok(Math.abs(doc.getPage(0).getWidth() - 595.276) < 0.1); assert.ok(Math.abs(doc.getPage(0).getHeight() - 841.89) < 0.1);
    if (process.env.PDF_EXAMPLE_DIR) { mkdirSync(process.env.PDF_EXAMPLE_DIR, { recursive: true }); writeFileSync(join(process.env.PDF_EXAMPLE_DIR, `bingo-${id}.pdf`), bytes); writeFileSync(join(process.env.PDF_EXAMPLE_DIR, `bingo-${id}-cards.json`), JSON.stringify(cards)); }
    const many = Array.from({ length: 200 }, (_, i) => ({ ...cards[i % 9], id: `max-${i}`, ordinal: i + 1, code: `BG-0123456789AB-${String(i + 1).padStart(4, "0")}` }));
    assert.equal((await PDFDocument.load(await api.createCardsPdf(snapshot, many))).getPageCount(), 50);
    await assert.rejects(api.createCardsPdf(snapshot, [...many, { ...many[0], id: "extra" }]), /Kartenmenge/);
    await assert.rejects(api.createCardsPdf(snapshot, [cards[0], cards[0]]), /Kartenmenge/);
    await assert.rejects(api.createCardsPdf({ ...snapshot, title: "Bingo 🦄" }, cards), /nicht alle Zeichen/);
  }
  for (const url of ["https://example.com/logo.png", "http://localhost/logo.png", "https://example.public.blob.vercel-storage.com/logo.png?secret=x", "/branding/phil-gud/website-logo.jpg?url=https://example.com", "/../docs/acceptance/bingo-preparation/images/cards-mobile.jpg", "/%2e%2e/docs/acceptance/bingo-preparation/images/cards-mobile.jpg"]) await assert.rejects(api.loadPrintLogo(url));
});
