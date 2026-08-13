import assert from "node:assert/strict";
import test from "node:test";
import { validateEventSeriesInput } from "@/app/eventreihen/eventSeriesPolicy";
import {
  buildQuizCopyMasterData,
  validateQuizMasterData,
} from "@/app/quiz/quizMasterData";

test("event series accepts registered defaults and rejects unknown IDs", () => {
  const valid = validateEventSeriesInput({
    name: "Reihe",
    isPublic: false,
    defaultPresentationTemplateId: "ungegoogelt-dark",
  });
  assert.equal(valid.ok, true);

  const invalid = validateEventSeriesInput({
    name: "Reihe",
    isPublic: false,
    defaultPresentationTemplateId: "custom-css",
  });
  assert.equal(invalid.ok, false);
  if (!invalid.ok) assert.ok(invalid.errors.defaultPresentationTemplateId);
});

test("quiz accepts inheritance and registered overrides but rejects unknown IDs", () => {
  const inherited = validateQuizMasterData({
    eventSeriesId: 1,
    title: "Quiz",
    date: "2026-07-20",
    presentationTemplateId: null,
  });
  assert.equal(inherited.ok, true);

  const invalid = validateQuizMasterData({
    eventSeriesId: 1,
    title: "Quiz",
    date: "2026-07-20",
    presentationTemplateId: "unknown",
  });
  assert.equal(invalid.ok, false);
  if (!invalid.ok) assert.ok(invalid.errors.presentationTemplateId);
});

test("quiz copies preserve the presentation override", () => {
  const copy = buildQuizCopyMasterData(
    {
      eventSeriesId: 1,
      time: null,
      venueName: null,
      mapUrl: null,
      internalNote: null,
      presentationTemplateId: "ungegoogelt-dark",
    },
    { title: "Kopie", date: "2026-07-21" },
  );
  assert.equal(copy.presentationTemplateId, "ungegoogelt-dark");
});
