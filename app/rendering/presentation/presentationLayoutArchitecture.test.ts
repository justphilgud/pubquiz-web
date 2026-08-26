import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const actionsSource = readFileSync(
  new URL("../../quiz/actions.ts", import.meta.url),
  "utf8",
);
const rendererSource = readFileSync(
  new URL("./PresentationSlideRenderer.tsx", import.meta.url),
  "utf8",
);
const settingsSource = readFileSync(
  new URL(
    "../../quiz/[quizId]/QuizQuestionSettings.tsx",
    import.meta.url,
  ),
  "utf8",
);

test("presentation data resolves question and solution layouts centrally", () => {
  assert.match(actionsSource, /resolvePresentationLayout\(\{/);
  assert.match(actionsSource, /phase: "QUESTION"/);
  assert.match(actionsSource, /phase: "SOLUTION"/);
  assert.match(actionsSource, /presentationLayouts:/);
  assert.match(actionsSource, /slotKey: medium\.slot_key/);
});

test("the shared renderer consumes the resolved layouts for both phases", () => {
  assert.match(
    rendererSource,
    /frage\.presentationLayouts\.question\.variant/,
  );
  assert.match(
    rendererSource,
    /frage\.presentationLayouts\.solution\.variant/,
  );
  assert.match(
    rendererSource,
    /frage\.presentationLayouts\.question\.contentRole === "FACE_MORPH"/,
  );
  assert.match(rendererSource, /data-presentation-layout=\{layoutVariant\}/);
  assert.doesNotMatch(
    rendererSource,
    /frage\.praesentationslayout \?\? "standard"/,
  );
});

test("normal quiz maintenance exposes only the resolved layout", () => {
  assert.match(settingsSource, /resolvedPresentationLayout/);
  assert.match(settingsSource, /Automatisch/);
  assert.doesNotMatch(settingsSource, /onLayoutChange/);
  assert.doesNotMatch(settingsSource, /value="bild_fokus"/);
  assert.doesNotMatch(actionsSource, /function updatePraesentationslayout/);
});
