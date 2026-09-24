import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { MemeRenderer } from "./MemeRenderer";

function render(topText = "", bottomText = "") {
  return renderToStaticMarkup(createElement(MemeRenderer, {
    imageUrl: "/meme.webp",
    alt: "Meme",
    topText,
    bottomText,
  }));
}

test("caption rows disappear independently while the image remains", () => {
  const imageOnly = render();
  assert.doesNotMatch(imageOnly, /data-meme-caption=/);
  assert.match(imageOnly, /data-meme-image=/);
  assert.match(imageOnly, /grid-template-rows:minmax\(0, 1fr\)/);

  const topOnly = render("Nur oben");
  assert.match(topOnly, /data-meme-caption="top"/);
  assert.doesNotMatch(topOnly, /data-meme-caption="bottom"/);
  assert.ok(topOnly.indexOf("Nur oben") < topOnly.indexOf("data-meme-image"));

  const bottomOnly = render("", "Nur unten");
  assert.doesNotMatch(bottomOnly, /data-meme-caption="top"/);
  assert.match(bottomOnly, /data-meme-caption="bottom"/);
  assert.ok(bottomOnly.indexOf("data-meme-image") < bottomOnly.indexOf("Nur unten"));
});

test("both captions render in separate modern bands around the shared image", () => {
  const html = render("Oben", "Unten");
  assert.match(html, /grid-template-rows:21% minmax\(0, 1fr\) 21%/);
  assert.equal((html.match(/<figcaption/g) ?? []).length, 2);
  assert.match(html, /bg-slate-100/);
  assert.doesNotMatch(html, /Impact|text-shadow|-webkit-text-stroke|absolute/);
  assert.ok(html.indexOf("Oben") < html.indexOf("data-meme-image"));
  assert.ok(html.indexOf("data-meme-image") < html.indexOf("Unten"));
});

test("legacy topText and bottomText payloads remain directly renderable", () => {
  const html = render("Bestehender Text oben", "Bestehender Text unten");
  assert.match(html, /Bestehender Text oben/);
  assert.match(html, /Bestehender Text unten/);
  assert.match(html, /data-auto-fit-text=/);
});
