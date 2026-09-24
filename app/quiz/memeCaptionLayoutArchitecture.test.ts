import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const renderer = readFileSync(
  new URL("../rendering/meme/MemeRenderer.tsx", import.meta.url),
  "utf8",
);
const interactionServer = readFileSync(
  new URL("./interaction/interaction.server.ts", import.meta.url),
  "utf8",
);
const answerRenderer = readFileSync(
  new URL("./[quizId]/antworten/GenericAnswerRenderer.tsx", import.meta.url),
  "utf8",
);

test("AP5 keeps one shared renderer and reusable AutoFitText", () => {
  assert.match(renderer, /AutoFitText/);
  assert.match(renderer, /data-meme-image/);
  assert.match(renderer, /gridRows/);
  assert.doesNotMatch(renderer, /Impact|WebkitTextStroke|textShadow/);
});

test("client and server both block unreadable final meme submissions", () => {
  assert.match(answerRenderer, /MEME_CAPTION_TOO_LONG_MESSAGE/);
  assert.match(answerRenderer, /onValidationChange/);
  assert.match(interactionServer, /MEME_CAPTION_TOO_LONG/);
  assert.match(interactionServer, /isReadableMemeSubmission/);
  assert.match(interactionServer, /continue;/);
});
