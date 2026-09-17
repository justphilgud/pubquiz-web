import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parseQuestionSponsor } from "./questionSponsor";
import { normalizeQuestionTemplateConfig } from "@/app/fragen/editor/pixelTemplateConfig";
import { buildPresentationQualityFixture } from "./presentationQualityFixtures";
import PresentationSlideRenderer from "./PresentationSlideRenderer";
import { buildPraesentationSlides, getPresentationSlideKey } from "@/app/quiz/[quizId]/praesentation/buildPraesentationSlides";
import { parsePresentationSlideKey } from "./presentationLiveState";
import { sponsorAnimationFrame } from "./sponsorAnimationFrame";

test("sponsor transition preserves source and target bounds in scaled moderation canvases", () => {
  for (const scale of [1, 2 / 3, 0.32]) {
    const origin = { left: 137, top: 159, width: 1920 * scale, height: 1080 * scale };
    for (const box of [
      { left: 400, top: 300, width: 1100, height: 600 },
      { left: 1450, top: 20, width: 150, height: 90 },
    ]) {
      const measured = { left: origin.left + box.left * scale, top: origin.top + box.top * scale, width: box.width * scale, height: box.height * scale };
      const frame = sponsorAnimationFrame(measured, origin, { width: 1920, height: 1080 }, "24px");
      for (const key of ["left", "top", "width", "height"] as const) {
        assert.ok(Math.abs(parseFloat(frame[key]) - box[key]) < 0.0001, `${scale}: ${key}`);
      }
      assert.equal(frame.padding, "24px");
    }
  }
});

test("sponsor metadata round-trips without changing existing question configuration", () => {
  const plain = normalizeQuestionTemplateConfig({});
  const sponsor = { logo: "/branding/sponsors/placeholder.svg", line: "Unterstützt von" };
  assert.deepEqual(normalizeQuestionTemplateConfig({ ...plain, sponsor }), { ...plain, sponsor });
  assert.equal(parseQuestionSponsor({ logo: sponsor.logo })?.line, "Präsentiert von");
  assert.equal(parseQuestionSponsor(undefined), undefined);
  for (const logo of ["javascript:alert(1)", "//evil.example/logo.png", "https://evil.example/logo.png"]) {
    assert.equal(parseQuestionSponsor({ logo }), null);
  }
  assert.equal(normalizeQuestionTemplateConfig({ sponsor: { logo: sponsor.logo, line: "a".repeat(81) } }), null);
});

test("optional sponsor renders on open/closed branded questions, never on other designs or solution", () => {
  for (const style of ["EDITORIAL", "KOMM_ONE"] as const) {
    for (const scenario of ["sponsor-open", "sponsor-choice"] as const) {
      const fixture = buildPresentationQualityFixture(scenario, style);
      assert.match(renderToStaticMarkup(createElement(PresentationSlideRenderer, fixture)), /Sponsor dieser Frage/);
      if (fixture.slide.typ !== "frage") throw new Error("question fixture required");
      const solution = { ...fixture, slide: { ...fixture.slide, typ: "aufloesung" as const } };
      assert.doesNotMatch(renderToStaticMarkup(createElement(PresentationSlideRenderer, solution)), /Sponsor dieser Frage/);
    }
  }
  for (const scenario of ["sponsor-open", "sponsor-choice"] as const) {
    for (const style of ["NEON", "CORPORATE", "BIRTHDAY"] as const) {
      const other = buildPresentationQualityFixture(scenario, style);
      assert.doesNotMatch(renderToStaticMarkup(createElement(PresentationSlideRenderer, other)), /Sponsor dieser Frage/);
    }
  }
  assert.doesNotMatch(renderToStaticMarkup(createElement(PresentationSlideRenderer, buildPresentationQualityFixture("normal", "EDITORIAL"))), /presentation-question-sponsor/);
  assert.doesNotMatch(renderToStaticMarkup(createElement(PresentationSlideRenderer, buildPresentationQualityFixture("normal", "KOMM_ONE"))), /presentation-question-sponsor/);
});

test("sponsor adds only a noninteractive presentation position and retains all question/reveal identities", () => {
  const fixture = buildPresentationQualityFixture("sponsor-open", "EDITORIAL");
  const withSponsor = buildPraesentationSlides(fixture.quiz).map(getPresentationSlideKey);
  const without = structuredClone(fixture.quiz);
  delete without.fragen[0].templateConfig?.sponsor;
  assert.deepEqual(withSponsor.filter(key => !key.startsWith("sponsor:")), buildPraesentationSlides(without).map(getPresentationSlideKey));
  const intro = buildPresentationQualityFixture("sponsor-intro", "EDITORIAL");
  assert.equal(intro.slide.typ, "ablauf");
  assert.notEqual(parsePresentationSlideKey(getPresentationSlideKey(intro.slide))?.kind, "QUESTION");
  assert.match(renderToStaticMarkup(createElement(PresentationSlideRenderer, intro)), /Präsentiert von/);

  const kommOneIntro = buildPresentationQualityFixture("sponsor-intro", "KOMM_ONE");
  assert.match(renderToStaticMarkup(createElement(PresentationSlideRenderer, kommOneIntro)), /Präsentiert von/);
});
