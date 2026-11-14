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

test("the planning baseline excludes the entry countdown and uses configured time once per active slide", () => {
  const flow = (type: string, anchorType: string, durationSeconds?: number) =>
    ({ typ: "ablauf", element: { type, anchorType, config: { durationSeconds } } }) as Slide;
  const meme = { typ: "frage", frage: { templateId: "meme_beschriften", memeConfig: {
    timerEnabled: true, responseDurationSeconds: 180,
  } } } as Slide;
  const slides = [
    flow("WAITING", "BEFORE_QUIZ"), flow("START_SEQUENCE", "BEFORE_QUIZ", 600),
    flow("COUNTDOWN", "BEFORE_QUIZ", 600), flow("WELCOME", "BEFORE_QUIZ"),
    slide("frage"), meme, slide("aufloesung"),
    flow("BREAK", "ROUND_END", 240), flow("COUNTDOWN", "ROUND_END", 90),
    flow("IMAGE", "AFTER_QUIZ", 50),
  ];
  assert.equal(estimateRemainingSeconds(slides, {}), 20 + 120 + 180 + 30 + 240 + 90 + 50);
  assert.equal(estimateRemainingSeconds(slides, { "frage:meme_beschriften": [240] }), 20 + 120 + 240 + 30 + 240 + 90 + 50);
  assert.equal(estimateRemainingSeconds([flow("BREAK", "ROUND_END"), flow("IMAGE", "AFTER_QUIZ")], {}), 320);
});
