import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const rendererSource = readFileSync(
  new URL("./PresentationSlideRenderer.tsx", import.meta.url),
  "utf8",
);
const playerSource = readFileSync(
  new URL(
    "../../quiz/[quizId]/praesentation/QuizPraesentationPlayer.tsx",
    import.meta.url,
  ),
  "utf8",
);
const moderationPreviewSource = readFileSync(
  new URL(
    "../../quiz/[quizId]/moderation/components/CurrentSlidePanel.tsx",
    import.meta.url,
  ),
  "utf8",
);

test("renderer covers the central slide types without player orchestration", () => {
  for (const slideType of [
    '"fixer-slide"',
    '"block"',
    '"frage"',
    '"aufloesung"',
    '"pause"',
    '"zwischenstand"',
    '"endstand"',
  ]) {
    assert.match(rendererSource, new RegExp(slideType));
  }

  assert.match(rendererSource, /templateData\?\.kind === "GOOGLE_REVIEWS"/);
  assert.match(rendererSource, /renderMedienKarte/);
  for (const editorialType of [
    "IMAGE",
    "IMAGE_GALLERY",
    "TEXT",
    "QUOTE",
    "PORTRAIT",
    "MEDIA_SEQUENCE",
    "AUDIO",
    "VIDEO",
  ]) {
    assert.match(rendererSource, new RegExp(`type === "${editorialType}"`));
  }
  assert.match(rendererSource, /SynchronizedMedia kind="audio"/);
  assert.match(rendererSource, /SynchronizedMedia kind="video"/);
  assert.match(rendererSource, /type === "CALENDAR_SUBSCRIPTION"/);
  assert.match(rendererSource, /QRCode value=\{calendarUrl\}/);
  assert.doesNotMatch(rendererSource, /statusActions/);
  assert.doesNotMatch(
    rendererSource,
    /freigabeQuizBlock|schliesseQuizBlock|setPraesentationSlideIndex|starteQuiz/,
  );
  assert.doesNotMatch(rendererSource, /Zurück|Weiter →|setPraesentationSlideIndex/);
});

test("player and moderation preview share the presentation renderer", () => {
  assert.match(playerSource, /<PresentationSlideRenderer/);
  assert.match(moderationPreviewSource, /<PresentationSlideRenderer/);
  assert.doesNotMatch(moderationPreviewSource, /<SlidePreview/);
});

test("calendar CTA leaves the team join QR payload and overflow UI intact", () => {
  assert.match(rendererSource, /QRCode value=\{answerUrl\}/);
  assert.match(rendererSource, /teamJoinState\.teamNames\.map/);
  assert.match(rendererSource, /teamJoinState\.remainingTeams > 0/);
  assert.match(rendererSource, /\+ \{teamJoinState\.remainingTeams\} weitere/);
});
