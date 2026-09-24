import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { MemeCaptionLayoutEditor } from "./MemeCaptionLayoutEditor";

test("author editor exposes presets, accessible geometry fields and the shared preview", () => {
  const html = renderToStaticMarkup(createElement(MemeCaptionLayoutEditor, {
    value: {
      version: 1,
      mode: "CUSTOM",
      zones: [{ id: "bubble", label: "Sprechblase", placement: "IMAGE", x: 50, y: 5, width: 40, height: 30, order: 1, maxLines: 2, required: true }],
    },
    imageUrl: "/meme.webp",
    disabled: false,
    onChange: () => undefined,
  }));
  assert.match(html, /data-meme-caption-layout-editor/);
  assert.match(html, /data-meme-zone-canvas/);
  for (const label of ["Oben außerhalb", "Unten außerhalb", "Oben im Bild", "Unten im Bild", "Oben links", "Oben rechts", "Unten links", "Unten rechts"]) {
    assert.match(html, new RegExp(label));
  }
  assert.match(html, /X \(%\)/);
  assert.match(html, /Breite \(%\)/);
  assert.match(html, /data-meme-renderer/);
  assert.match(html, /Erforderlich/);
});

test("standard mode remains the default two-field author workflow", () => {
  const html = renderToStaticMarkup(createElement(MemeCaptionLayoutEditor, {
    value: undefined,
    imageUrl: null,
    disabled: false,
    onChange: () => undefined,
  }));
  assert.match(html, /Standard: oben \/ unten/);
  assert.match(html, /Text oben/);
  assert.match(html, /Text unten/);
  assert.doesNotMatch(html, /data-meme-zone-canvas/);
});
