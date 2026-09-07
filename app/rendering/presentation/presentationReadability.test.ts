import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import PresentationSlideRenderer from "./PresentationSlideRenderer";
import { PresentationContentWarning } from "./PresentationContentWarning";
import { buildPresentationQualityFixture, longOptions, longQuestion, qualityRules, qualityScenarios, storyText } from "./presentationQualityFixtures";
import { presentationContentWarning, presentationRecommendations, presentationTextDensity, templatePresentationTexts } from "./presentationReadability";

test("PRES-INV-01/02/04: text lengths select only three bounded typography variants", () => {
  for (const role of ["question", "answer", "title", "body", "information"] as const) {
    assert.equal(presentationTextDensity(0, role), "regular");
    assert.equal(presentationTextDensity(1, role), "regular");
    assert.equal(presentationTextDensity(presentationRecommendations[role], role), "compact");
    assert.equal(presentationTextDensity(100_000, role), "extended");
  }
  const css = readFileSync(new URL("./presentationReadability.css", import.meta.url), "utf8");
  const sizes = [...css.matchAll(/--pres-\w+: clamp\(([\d.]+)rem, ([\d.]+)cqw, ([\d.]+)rem\)/g)];
  assert.ok(sizes.length >= 10);
  for (const [, minimum, , maximum] of sizes) {
    assert.ok(Number(minimum) >= 1);
    assert.ok(Number(maximum) >= Number(minimum));
    assert.ok(Number(maximum) <= 4.25);
  }
  assert.doesNotMatch(css, /line-clamp|text-overflow:\s*ellipsis/);
});

test("PRES-INV-08: warnings begin above recommendations and never block editing", () => {
  assert.equal(presentationContentWarning("A".repeat(220), "question"), null);
  assert.match(presentationContentWarning("A".repeat(221), "question")!, /221 \/ empfohlen 220/);
  const html = renderToStaticMarkup(createElement(PresentationContentWarning, { text: longQuestion, role: "question" }));
  assert.match(html, /role="status"/);
  assert.match(html, /vollständig erhalten/);
  assert.equal(renderToStaticMarkup(createElement(PresentationContentWarning, { text: "Berlin", role: "answer" })), "");
  assert.equal(templatePresentationTexts({ kind: "TRUE_FALSE", correctAnswer: true, explanation: "Erläuterung" })[0].role, "information");
  const text = "Eine außergewöhnlich lange Antwort ".repeat(10);
  assert.ok(templatePresentationTexts({ kind: "ORDERING", scoring: "EXACT", items: [{ id: "1", text, explanation: "" }] }).some((entry) => presentationContentWarning(entry.text, entry.role)));
});

for (const style of ["NEON", "EDITORIAL", "BIRTHDAY", "CORPORATE"] as const) {
  test(`PRES-INV-03/05/12: ${style} preserves complete long choices and legacy text`, () => {
    for (const scenario of qualityScenarios) {
      const fixture = buildPresentationQualityFixture(scenario, style);
      const html = renderToStaticMarkup(createElement(PresentationSlideRenderer, fixture));
      assert.match(html, new RegExp(`data-design-style="${style}"`));
      if (scenario === "choice-long") for (const option of longOptions) assert.ok(html.includes(option));
      if (["long", "legacy", "solution-long"].includes(scenario)) assert.ok(html.includes(longQuestion));
      if (fixture.slide.typ === "frage") assert.ok(html.includes(fixture.slide.frage.frage));
      if (scenario.startsWith("story")) assert.ok(html.includes(storyText));
      if (scenario.startsWith("rules")) {
        for (const rule of qualityRules) assert.ok(html.includes(rule));
        assert.match(html, new RegExp(`data-rule-count="${scenario === "rules" ? 4 : 8}"`));
        if (scenario === "rules-legacy") assert.equal(html.split(storyText).length - 1, 8);
      }
      if (scenario === "legacy") assert.equal(html.split(longQuestion).length - 1, 3);
      if (scenario === "choice6") for (const option of ["Berlin", "Wien", "Prag", "Budapest", "Paris", "Rom"]) assert.ok(html.includes(option));
      assert.match(html, /Präsentationsinhalt/);
    }
  });
  test(`B06 ${style}: structured audio uses existing media URL and remains silent in preview`, () => {
    const fixture = buildPresentationQualityFixture("structured-audio", style);
    assert.equal(fixture.slide.typ, "frage");
    const html = renderToStaticMarkup(createElement(PresentationSlideRenderer, { ...fixture, displayState: { ...fixture.displayState, renderMode: "PRESENTATION" } }));
    assert.match(html, /data-presentation-layout="STRUCTURED_RESPONSE"/);
    assert.match(html, /<audio[^>]*src="\/medien\/audio\/unsortiert\/Test.wav"/);
    assert.equal((html.match(/<audio/g) ?? []).length, 1);
    assert.match(html, /preload="metadata"/);
    assert.doesNotMatch(html, /autoPlay|autoplay|controls=""/);
    const preview = renderToStaticMarkup(createElement(PresentationSlideRenderer, fixture));
    assert.doesNotMatch(preview, /<audio/);
    assert.match(preview, /Audio bereit/);
    const empty = renderToStaticMarkup(createElement(PresentationSlideRenderer, buildPresentationQualityFixture("structured-empty", style)));
    assert.doesNotMatch(empty, /<audio|data-audio-visualization/);
  });
}

test("B06: absolute Blob URLs remain unchanged, without a second path resolver", () => {
  const fixture = buildPresentationQualityFixture("structured-audio");
  assert.equal(fixture.slide.typ, "frage");
  if (fixture.slide.typ !== "frage") return;
  const url = "https://example.public.blob.vercel-storage.com/preview/test.wav";
  fixture.slide.frage.medien[0].datei = url;
  const html = renderToStaticMarkup(createElement(PresentationSlideRenderer, { ...fixture, displayState: { ...fixture.displayState, renderMode: "PRESENTATION", playbackCommand: "stop", playbackCommandId: 3 } }));
  assert.ok(html.includes(`src="${url}"`));
  assert.doesNotMatch(html, /autoplay/);
});
