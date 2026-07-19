import assert from "node:assert/strict";
import test from "node:test";
import { deQuestionEditorMessages } from "@/app/i18n/messages/de/questionEditor";
import { getQuestionMediaSummary, hasQuestionMediaProblem } from "./QuestionMediaSection";

const base = { slots: [], media: [], uploadStatuses: {}, generatorRuns: [] } as const;

test("media summary covers empty, image, audio and mixed media", () => {
  assert.equal(getQuestionMediaSummary(base, deQuestionEditorMessages), "Keine Medien");
  const image = { slotKey: "question_image", operation: "NEW", url: "https://blob/image", mediaType: "IMAGE", existingMediaId: null, existingMediaCount: 0 } as const;
  const audio = { slotKey: "question_audio", operation: "NEW", url: "https://blob/audio", mediaType: "AUDIO", existingMediaId: null, existingMediaCount: 0 } as const;
  assert.equal(getQuestionMediaSummary({ ...base, media: [image] }, deQuestionEditorMessages), "1 Bild");
  assert.equal(getQuestionMediaSummary({ ...base, media: [audio] }, deQuestionEditorMessages), "1 Audio");
  assert.equal(getQuestionMediaSummary({ ...base, media: [image, audio] }, deQuestionEditorMessages), "1 Bild und 1 Audio");
});

test("media section detects required and stale states", () => {
  assert.equal(hasQuestionMediaProblem({ ...base, slots: [{ key: "music_original_audio", required: true }] as never }), true);
  assert.equal(hasQuestionMediaProblem({ ...base, generatorRuns: [{ status: "STALE" }] as never }), true);
});
