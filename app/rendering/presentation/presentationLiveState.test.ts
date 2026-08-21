import assert from "node:assert/strict";
import test from "node:test";

import {
  parsePresentationSlideKey,
  resolvePresentationAudienceState,
  resolvePresentationLiveState,
  resolvePresentationSequenceIndex,
} from "./presentationLiveState";

test("missing presentation state resolves to a safe read-only display state", () => {
  assert.deepEqual(resolvePresentationLiveState(null), {
    slideIndex: 0,
    slideKey: null,
    slideStartedAt: null,
    quizStartedAt: null,
    revealCount: 1,
    mediaOverlayActive: false,
    playbackCommand: null,
    playbackCommandId: 0,
    countdownDurationSeconds: null,
    countdownStartedAt: null,
    countdownStatus: "idle",
    estimation: { phase: "HIDDEN", questionId: null },
    updatedAt: null,
  });
});

test("stored state restores slide, reveal, media and estimation after reload", () => {
  const state = resolvePresentationLiveState({
    slide_index: 4,
    slide_key: "flow:12:BREAK",
    endstand_reveal_count: 3,
    medium_overlay_aktiv: true,
    audio_aktion: "pause",
    audio_aktion_id: 7,
    countdown_dauer_sekunden: 300,
    countdown_started_at: "2026-07-26T18:00:00.000Z",
    countdown_status: "running",
    show_schaetzfrage: true,
    zeige_schaetzantwort: true,
    schaetzfrage_id: 42,
    updated_at: "2026-07-26T18:01:00.000Z",
  });

  assert.equal(state.slideIndex, 4);
  assert.equal(state.slideKey, "flow:12:BREAK");
  assert.equal(state.revealCount, 3);
  assert.equal(state.mediaOverlayActive, true);
  assert.equal(state.playbackCommand, "pause");
  assert.deepEqual(state.estimation, { phase: "SOLUTION", questionId: 42 });
});

test("question keys resolve assignment and question phase without copying question data into the status", () => {
  const questions = [
    { questionAssignmentId: 12, questionId: 101, sectionId: 16 },
  ];
  assert.deepEqual(
    resolvePresentationAudienceState(
      { slideKey: "question:12:question" },
      questions,
    ),
    {
      kind: "QUESTION",
      phase: "QUESTION",
      slideKey: "question:12:question",
      questionAssignmentId: 12,
      questionId: 101,
      sectionId: 16,
    },
  );
  assert.equal(
    resolvePresentationAudienceState(
      { slideKey: "question:12:solution" },
      questions,
    ).phase,
    "SOLUTION",
  );
});

test("non-question keys resolve to neutral answer-form states", () => {
  const examples = [
    ["default:BEFORE_QUIZ:QUIZ:WELCOME", "Das Quiz startet gleich"],
    ["default:ROUND_START:16:ROUND_INTRO", "Die nächste Runde beginnt gleich"],
    ["flow:12:BREAK", "Pause"],
    ["flow:13:INTERMEDIATE_STANDINGS", "Der Zwischenstand wird gezeigt"],
    ["default:AFTER_QUIZ:QUIZ:FINAL_STANDINGS", "Das Quiz ist beendet"],
    ["default:AFTER_QUIZ:QUIZ:WINNER", "Das Quiz ist beendet"],
    ["default:AFTER_QUIZ:QUIZ:CLOSING", "Das Quiz ist beendet"],
    ["default:AFTER_QUIZ:QUIZ:CALENDAR_SUBSCRIPTION", "Das Quiz ist beendet"],
  ] as const;

  for (const [slideKey, statusText] of examples) {
    assert.deepEqual(
      resolvePresentationAudienceState({ slideKey }, []),
      {
        kind: "NON_QUESTION",
        phase: "NON_QUESTION",
        slideKey,
        slideType: slideKey.split(":").at(-1),
        statusText,
      },
    );
  }
});

test("editorial block item keys resolve to a neutral answer state", () => {
  const state = resolvePresentationAudienceState(
    { slideKey: "block-item:77" },
    [],
  );

  assert.deepEqual(state, {
    kind: "NON_QUESTION",
    phase: "NON_QUESTION",
    slideKey: "block-item:77",
    slideType: "BLOCK_ITEM",
    statusText: "Bitte folgt der Präsentation",
  });
});

test("story element placements resolve to a neutral answer state", () => {
  const state = resolvePresentationAudienceState(
    { slideKey: "story-placement:77" },
    [],
  );

  assert.deepEqual(state, {
    kind: "NON_QUESTION",
    phase: "NON_QUESTION",
    slideKey: "story-placement:77",
    slideType: "STORY_ELEMENT",
    statusText: "Bitte folgt der Präsentation",
  });
});

test("unknown keyed state never falls back to a question or legacy index", () => {
  assert.deepEqual(parsePresentationSlideKey("question:999:question"), {
    kind: "QUESTION",
    phase: "QUESTION",
    questionAssignmentId: 999,
  });
  assert.equal(
    resolvePresentationAudienceState(
      { slideKey: "question:999:question" },
      [{ questionAssignmentId: 12, questionId: 101, sectionId: 16 }],
    ).kind,
    "UNKNOWN",
  );
  assert.deepEqual(
    resolvePresentationSequenceIndex(
      { slideIndex: 0, slideKey: "question:999:question" },
      ["question:12:question"],
    ),
    { index: -1, resolution: "UNRESOLVED" },
  );
});

test("legacy status without a key still uses the bounded slide index", () => {
  assert.deepEqual(
    resolvePresentationSequenceIndex(
      { slideIndex: 12, slideKey: null },
      ["one", "two"],
    ),
    { index: 1, resolution: "LEGACY_INDEX" },
  );
  assert.equal(
    resolvePresentationAudienceState({ slideKey: null }, []).kind,
    "LEGACY",
  );
});
