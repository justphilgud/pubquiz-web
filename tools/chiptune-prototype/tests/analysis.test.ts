import assert from "node:assert/strict";
import test from "node:test";
import { analyzeMusic, cleanAndQuantizeNotes, createArrangement, selectAnalysisWaveform } from "../src/analysis";
import { INTERNAL_SAMPLE_RATE } from "../src/config";
import { synthesizeArrangement } from "../src/synth";
import type { PcmAudio } from "../src/types";
import { decodePcm16Wav } from "../src/wav";
import { createSyntheticMelody } from "./testAudio";

test("known synthetic notes are detected and quantized reproducibly", () => {
  const source = createSyntheticMelody();
  const first = analyzeMusic(source.samples, INTERNAL_SAMPLE_RATE);
  const second = analyzeMusic(source.samples, INTERNAL_SAMPLE_RATE);
  assert.ok(first.melody.length >= 4);
  assert.ok(first.melody.some((note) => [60, 64, 67, 72].some((expected) => Math.abs(note.midi - expected) <= 1)));
  assert.deepEqual(first, second);
  assert.ok(first.melody.every((note) => note.startSeconds >= 0 && note.endSeconds > note.startSeconds));
});

test("cleanup removes short events, limits range and keeps a monophonic melody", () => {
  const cleaned = cleanAndQuantizeNotes([
    { startSeconds: 0, endSeconds: 0.02, midi: 100, confidence: 1 },
    { startSeconds: 0, endSeconds: 0.6, midi: 84, confidence: 0.8 },
    { startSeconds: 0.1, endSeconds: 0.5, midi: 60, confidence: 0.4 },
    { startSeconds: 0.6, endSeconds: 1.2, midi: 43, confidence: 0.9 },
  ], 120, 55, 88);
  assert.equal(cleaned.length, 2);
  assert.ok(cleaned.every((note) => note.midi >= 55 && note.midi <= 88));
  assert.ok(cleaned.every((note, index) => index === 0 || note.startSeconds >= cleaned[index - 1].endSeconds));
});

test("center-reduced analysis uses stereo side information and safely falls back for mono", () => {
  const left = new Float32Array([0.5, 0.2, -0.5]);
  const right = new Float32Array([0.1, 0.2, -0.1]);
  const stereo: PcmAudio = { sampleRate: INTERNAL_SAMPLE_RATE, channels: [left, right], durationSeconds: 3 / INTERNAL_SAMPLE_RATE };
  const reduced = selectAnalysisWaveform(stereo, "center-reduced");
  assert.deepEqual([...reduced.samples].map((entry) => Math.round(entry * 10)), [2, 0, -2]);
  assert.deepEqual(reduced.warnings, []);
  const mono: PcmAudio = { ...stereo, channels: [left] };
  assert.deepEqual(selectAnalysisWaveform(mono, "center-reduced").warnings, ["CENTER_REDUCTION_INEFFECTIVE_FALLBACK_DIRECT"]);
});

test("fixed arrangement uses controlled voices and deterministic original-free synthesis", () => {
  const source = createSyntheticMelody(4);
  const analysis = analyzeMusic(source.samples, INTERNAL_SAMPLE_RATE);
  const arrangement = createArrangement(analysis, 4);
  assert.ok(arrangement.melody.length > 0);
  assert.ok(arrangement.bass.every((note) => note.midi >= 36 && note.midi <= 55));
  assert.ok(arrangement.percussion.every((event) => event.kind === "kick" || event.kind === "snare" || event.kind === "hat"));
  const first = synthesizeArrangement(arrangement);
  const second = synthesizeArrangement(arrangement);
  assert.deepEqual(first.wav, second.wav);
  assert.notDeepEqual(first.wav, source.wav);
  const decoded = decodePcm16Wav(first.wav);
  assert.ok(decoded.channels[0].some((sample) => Math.abs(sample) > 0.01));
  assert.ok(decoded.channels[0].every((sample) => sample >= -1 && sample <= 1));
});
