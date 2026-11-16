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
const quizActions = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");

test("AP5 keeps one shared renderer and reusable AutoFitText", () => {
  assert.match(renderer, /AutoFitText/);
  assert.match(renderer, /data-meme-image/);
  assert.match(renderer, /gridRows/);
  assert.doesNotMatch(renderer, /Impact|WebkitTextStroke|textShadow/);
});

test("caption overflow warns independently of submission validation", () => {
  assert.match(answerRenderer, /validationError \?\? MEME_CAPTION_OVERFLOW_WARNING/);
  assert.match(answerRenderer, /onValidationChange\?\.\(validationError\)|current\?\.\(validationError\)/);
  assert.doesNotMatch(interactionServer, /MEME_CAPTION_TOO_LONG|isReadableMemeSubmission/);
  assert.match(interactionServer, /validateInteractionPayload/);
});

test("AP6 participant forms receive custom zones and preserve the immutable run snapshot", () => {
  assert.match(quizActions, /memeCaptionLayout:\s*templateConfig\?\.memeCaptionLayout/);
  assert.match(
    quizActions,
    /resolveParticipantInteractionFromSnapshot\([\s\S]*interactionRun\?\.config_snapshot[\s\S]*currentInteraction/,
  );
});
