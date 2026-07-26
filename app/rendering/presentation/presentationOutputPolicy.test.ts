import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const player = readFileSync(
  "app/quiz/[quizId]/praesentation/QuizPraesentationPlayer.tsx",
  "utf8",
);
const renderer = readFileSync(
  "app/rendering/presentation/PresentationSlideRenderer.tsx",
  "utf8",
);
const moderation = readFileSync(
  "app/quiz/[quizId]/moderation/ModerationClient.tsx",
  "utf8",
);
const toolbar = readFileSync(
  "app/quiz/[quizId]/moderation/components/ModerationToolbar.tsx",
  "utf8",
);
const statusActions = readFileSync(
  "app/quiz/[quizId]/praesentation/statusActions.ts",
  "utf8",
);

test("presentation is a read-only live-state consumer", () => {
  for (const mutation of [
    "setPraesentationSlideIndex",
    "freigabeQuizBlock",
    "schliesseQuizBlock",
    "setAktuelleQuizFrage",
    "setEndstandRevealCount",
    "setSchaetzfrageStatus",
    "setMediumOverlayAktiv",
    "setAudioAktion",
    "starteQuiz",
  ]) {
    assert.doesNotMatch(player, new RegExp(mutation));
  }

  assert.doesNotMatch(player, /<button|ArrowRight|ArrowLeft|PageDown|PageUp/);
  assert.match(player, /getPraesentationStatus/);
  assert.match(player, /initialLiveState/);
  assert.match(player, /event\.key\.toLowerCase\(\) !== "f"/);
});

test("existing moderation owns navigation, releases and live decisions", () => {
  assert.match(toolbar, /label="Zurück"/);
  assert.match(toolbar, /label="Weiter"/);
  assert.match(toolbar, /Block schließen|Block freigeben/);
  assert.match(toolbar, /Schätzfrage starten/);
  assert.match(toolbar, /Audio\/Video abspielen oder pausieren/);
  assert.match(moderation, /setPraesentationSlideIndex/);
  assert.match(moderation, /setAktuelleQuizFrage/);
  assert.match(moderation, /templateData\?\.kind === "GOOGLE_REVIEWS"/);
  assert.match(moderation, /await starteQuiz\(quizId\)/);
});

test("shared stored reveal state drives Google reviews and final ranking", () => {
  assert.match(
    moderation,
    /setEndstandRevealCount\(\{[\s\S]*revealCount: nextRevealCount/,
  );
  assert.match(renderer, /reviews\.slice\(0, templateRevealCount\)/);
  assert.match(renderer, /endstandRevealCount/);
  assert.doesNotMatch(renderer, /setTemplateReveal|Nächste Rezension/);
});

test("media is commanded by moderation and preview mode never autoplays it", () => {
  assert.match(moderation, /setAudioAktion/);
  assert.match(moderation, /setMediumOverlayAktiv/);
  assert.match(statusActions, /audio_aktion: "stop"/);
  assert.match(renderer, /renderMode !== "PRESENTATION"/);
  assert.doesNotMatch(renderer, /<audio[^>]*controls|<video[^>]*controls/);
  assert.doesNotMatch(renderer, /setOverlayMedien/);
});
