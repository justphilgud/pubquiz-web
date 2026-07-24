import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { deQuestionEditorMessages } from "@/app/i18n/messages/de/questionEditor";
import { getQuestionMediaSummary, hasQuestionMediaProblem } from "./QuestionMediaSection";

const base = { slots: [], media: [], uploadStatuses: {}, generatorRuns: [] } as const;
const imageSourceInputs = readFileSync(
  "app/fragen/editor/components/ImageSourceInputs.tsx",
  "utf8",
);
const mediaUploadSlot = readFileSync(
  "app/fragen/editor/components/MediaUploadSlot.tsx",
  "utf8",
);
const questionMediaSlot = readFileSync(
  "app/fragen/editor/components/QuestionMediaSlot.tsx",
  "utf8",
);
const answerMediaSlot = readFileSync(
  "app/fragen/editor/components/AnswerMediaSlot.tsx",
  "utf8",
);

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

test("image slots expose separate gallery and environment-camera inputs", () => {
  assert.match(imageSourceInputs, /label=\{galleryLabel\}/);
  assert.match(imageSourceInputs, /label=\{cameraLabel\}/);
  assert.equal(
    imageSourceInputs.match(/capture="environment"/g)?.length,
    1,
  );
  assert.equal(
    imageSourceInputs.match(/onChange=\{onFileChange\}/g)?.length,
    2,
  );
});

test("both image sources use the shared validation and upload path", () => {
  assert.match(
    mediaUploadSlot,
    /<ImageSourceInputs[\s\S]*onFileChange=\{handleFileInputChange\}/,
  );
  assert.match(
    mediaUploadSlot,
    /const file = input\.files\?\.\[0\];\s+if \(!file\) return;\s+void uploadFile\(file\)/,
  );
  assert.match(mediaUploadSlot, /validateQuestionMediaFile\(file, mediaType\)/);
});

test("question and answer image positions share MediaUploadSlot", () => {
  assert.match(questionMediaSlot, /<MediaUploadSlot/);
  assert.match(answerMediaSlot, /<MediaUploadSlot/);
});
