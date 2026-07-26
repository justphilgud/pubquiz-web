import assert from "node:assert/strict";
import test from "node:test";

import { resolvePresentationLiveState } from "./presentationLiveState";

test("missing presentation state resolves to a safe read-only display state", () => {
  assert.deepEqual(resolvePresentationLiveState(null), {
    slideIndex: 0,
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
  assert.equal(state.revealCount, 3);
  assert.equal(state.mediaOverlayActive, true);
  assert.equal(state.playbackCommand, "pause");
  assert.deepEqual(state.estimation, { phase: "SOLUTION", questionId: 42 });
});
