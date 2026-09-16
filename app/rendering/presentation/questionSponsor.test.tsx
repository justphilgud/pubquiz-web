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

test("optional sponsor renders on open/closed LOVD questions, never on other designs or solution", () => {
  for (const scenario of ["sponsor-open", "sponsor-choice"] as const) {
    const fixture = buildPresentationQualityFixture(scenario, "EDITORIAL");
    assert.match(renderToStaticMarkup(createElement(PresentationSlideRenderer, fixture)), /Sponsor dieser Frage/);
    if (fixture.slide.typ !== "frage") throw new Error("question fixture required");
    const solution = { ...fixture, slide: { ...fixture.slide, typ: "aufloesung" as const } };
    assert.doesNotMatch(renderToStaticMarkup(createElement(PresentationSlideRenderer, solution)), /Sponsor dieser Frage/);
    for (const style of ["NEON", "CORPORATE", "BIRTHDAY"] as const) {
      const other = buildPresentationQualityFixture(scenario, style);
      assert.doesNotMatch(renderToStaticMarkup(createElement(PresentationSlideRenderer, other)), /Sponsor dieser Frage/);
    }
  }
  assert.doesNotMatch(renderToStaticMarkup(createElement(PresentationSlideRenderer, buildPresentationQualityFixture("normal", "EDITORIAL"))), /presentation-question-sponsor/);
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
});
