import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { MemeRenderer } from "./MemeRenderer";
import { resolveMemeCaptionLayout } from "@/app/quiz/memeCaptionZones";

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

test("short captions render in dynamic black bands around the shared image", () => {
  const html = render("Oben", "Unten");
  assert.match(html, /grid-template-rows:13% minmax\(0, 1fr\) 13%/);
  assert.equal((html.match(/<figcaption/g) ?? []).length, 2);
  assert.match(html, /bg-black text-white/);
  assert.match(html, /font-family:Arial, Helvetica, sans-serif/);
  assert.doesNotMatch(html, /bg-slate-100|Impact|-webkit-text-stroke/);
  assert.ok(html.indexOf("Oben") < html.indexOf("data-meme-image"));
  assert.ok(html.indexOf("data-meme-image") < html.indexOf("Unten"));
});

test("two-line captions grow their own band without changing the 4:3 canvas", () => {
  const html = render("Das ist ein längerer Memetext mit mehreren kurzen Wörtern", "Kurz");
  assert.match(html, /grid-template-rows:21% minmax\(0, 1fr\) 13%/);
  assert.match(html, /aspect-\[4\/3\]/);
});

test("legacy topText and bottomText payloads remain directly renderable", () => {
  const html = render("Bestehender Text oben", "Bestehender Text unten");
  assert.match(html, /Bestehender Text oben/);
  assert.match(html, /Bestehender Text unten/);
  assert.match(html, /data-auto-fit-text=/);
});

test("custom image zones use the same renderer and relative geometry", () => {
  const layout = resolveMemeCaptionLayout({
    version: 1,
    mode: "CUSTOM",
    zones: [{
      id: "speech",
      label: "Sprechblase",
      placement: "IMAGE",
      x: 12,
      y: 18,
      width: 42,
      height: 28,
      order: 1,
      maxLines: 2,
      required: true,
    }],
  });
  const html = renderToStaticMarkup(createElement(MemeRenderer, {
    imageUrl: "/meme.webp",
    alt: "Meme",
    captions: { speech: "Hallo Zone" },
    layout,
  }));
  assert.match(html, /data-meme-layout="CUSTOM"/);
  assert.match(html, /data-meme-image-zone="speech"/);
  assert.match(html, /left:12%;top:18%;width:42%;height:28%/);
  assert.match(html, /Hallo Zone/);
});
