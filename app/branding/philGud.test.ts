import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { isAdministrationPath } from "./adminAppearancePolicy";
import { PHIL_GUD } from "./philGud";
import { getPresentationTemplate, getAnswerFormTemplate, SYSTEM_PRESENTATION_TEMPLATE_ID, type PresentationTemplate } from "@/app/rendering/templateRegistry";
import { parsePresentationTemplateConfig } from "@/app/rendering/presentationTemplates/presentationTemplate";
import { buildPresentationQualityFixture, qualityScenarios } from "@/app/rendering/presentation/presentationQualityFixtures";
import PresentationSlideRenderer from "@/app/rendering/presentation/PresentationSlideRenderer";

test("admin appearance excludes every live/public route and the renderer reference", () => {
  assert.equal(isAdministrationPath("/bingo/26000000-0000-4000-8000-000000000001/moderation"), true);
  assert.equal(isAdministrationPath("/bingo/praesentation/26000000-0000-4000-8000-000000000002"), false);
  for (const path of ["/", "/login", "/settings", "/hilfe", "/profil/passwort", "/content", "/admin/users", "/quiz", "/quiz/31", "/quiz/31/slides/intro", "/workspaces/117/quiz/new-question", "/templates"])
    assert.equal(isAdministrationPath(path), true, path);
  for (const path of ["/quiz/31/praesentation", "/quiz/31/moderation", "/quiz/31/antworten", "/quiz/31/test", "/frage-einreichen", "/calendar/public.ics", "/templates/presentation-quality"])
    assert.equal(isAdministrationPath(path), false, path);
});

test("Phil Gud is explicit, preserves defaults and survives config validation", () => {
  const presentation: PresentationTemplate = getPresentationTemplate("phil-gud")!;
  const answer = getAnswerFormTemplate("phil-gud")!;
  assert.equal(SYSTEM_PRESENTATION_TEMPLATE_ID, "ungegoogelt-default");
  assert.equal(getPresentationTemplate("lovd-ungegoogelt")!.tokens.assets.logo, "/branding/lovd/lovd-stelp-creme-rgb.png");
  assert.equal(presentation.tokens.typography.family, PHIL_GUD.bodyFont);
  assert.equal(presentation.tokens.typography.displayFamily, PHIL_GUD.displayFont);
  const result = parsePresentationTemplateConfig({version:1,tokens:presentation.tokens,design:presentation.design,surfaces:{presentation:presentation.variant,moderation:"BRANDED",answerForm:answer.variant}});
  assert.ok(result, "Phil Gud configuration must validate");
  assert.equal(result.tokens.typography.displayFamily, PHIL_GUD.displayFont);
});

test("verified original font is versioned unchanged and has swap without installed-font dependency", () => {
  const font = readFileSync("public/branding/phil-gud/phil-gud.woff");
  assert.equal(createHash("sha256").update(font).digest("hex"), "ab4436805cd8dc4f947279b81a34d8103a3bf42da578e685368df6452631658d");
  const css = readFileSync("app/branding/philGud.css", "utf8");
  assert.match(css,/font-display: swap/);
  assert.doesNotMatch(css,/local\(/);
  assert.match(css,/data-quiz-theme-version/);
});

for (const scenario of qualityScenarios) test(`Phil Gud renders complete existing scenario: ${scenario}`, () => {
  const fixture = buildPresentationQualityFixture(scenario, "PHIL_GUD");
  const html = renderToStaticMarkup(createElement(PresentationSlideRenderer, fixture));
  assert.match(html,/data-phil-gud-template="true"/);
  assert.doesNotMatch(html,/Knowledge · People · Progress/);
  if (fixture.slide.typ === "frage" || fixture.slide.typ === "aufloesung") assert.ok(html.includes(fixture.slide.frage.frage.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;")), scenario);
});

test("existing design worlds never acquire the Phil Gud font marker", () => {
  for (const style of ["NEON","EDITORIAL","KOMM_ONE","BIRTHDAY"] as const) {
    const fixture = buildPresentationQualityFixture("short", style);
    const html = renderToStaticMarkup(createElement(PresentationSlideRenderer, fixture));
    assert.doesNotMatch(html,/data-phil-gud-template/);
    assert.equal(fixture.theme.appearance.displayFontFamily, undefined);
  }
});
