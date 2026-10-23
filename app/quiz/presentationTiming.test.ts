import assert from "node:assert/strict";
import test from "node:test";
import { estimateRemainingSeconds, slideTimerTone, timingCategory } from "./presentationTiming";
import type { Slide } from "./[quizId]/praesentation/buildPraesentationSlides";

const slide = (typ: string, templateId = "standard") => ({ typ, frage: { templateId } }) as Slide;
test("the same elapsed slide timer changes only at the specified exact boundaries", () => {
  for (const [seconds, color] of [[0,"red"], [59,"red"], [60,"orange"], [89,"orange"], [90,"green"], [150,"green"], [151,"orange"], [179,"orange"], [180,"red"], [1000,"red"]] as const) assert.equal(slideTimerTone(seconds), `text-${color}-400`);
  assert.equal(slideTimerTone(null), "");
});
test("waiting never trains or contributes; questions and solutions have independent type samples", () => {
  const waiting = { typ: "ablauf", element: { type: "WAITING" } } as Slide;
  assert.equal(timingCategory(waiting), null);
  const remaining = [waiting, slide("frage"), slide("aufloesung"), slide("frage", "pixelbild")];
  assert.equal(estimateRemainingSeconds(remaining, {}), 270);
  assert.equal(estimateRemainingSeconds(remaining, { "frage:standard": [40,60], "aufloesung:standard": [10], other: [600] }), 180);
  const pause = { typ: "ablauf", element: { type: "BREAK", config: { durationSeconds: 180 } } } as Slide;
  assert.equal(estimateRemainingSeconds([pause], { pause: [1] }), 180);
});
