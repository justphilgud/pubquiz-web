import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FaceMorphPixelQuestionOption } from "./FaceMorphPixelQuestionOption";

test("the FaceMorph pixel option is accessible, unchecked and mobile-safe", () => {
  const html = renderToStaticMarkup(
    React.createElement(FaceMorphPixelQuestionOption, {
      checked: false,
      disabled: false,
      label: "Zusätzlich später eine Pixelfrage aus diesem Bild erzeugen",
      onChange: () => undefined,
    }),
  );

  assert.match(html, /<label[^>]*w-full[^>]*min-w-0/);
  assert.match(html, /<input[^>]*type="checkbox"/);
  assert.doesNotMatch(html, /<input[^>]*checked/);
  assert.match(
    html,
    /Zusätzlich später eine Pixelfrage aus diesem Bild erzeugen/,
  );
});
