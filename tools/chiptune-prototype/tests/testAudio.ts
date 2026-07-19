import { INTERNAL_SAMPLE_RATE } from "../src/config";
import { encodePcm16Wav } from "../src/wav";

export function createSyntheticMelody(durationSeconds = 6) {
  const samples = new Float32Array(Math.round(durationSeconds * INTERNAL_SAMPLE_RATE));
  const notes = [60, 64, 67, 72, 67, 64];
  const noteSeconds = 0.5;
  for (let index = 0; index < samples.length; index += 1) {
    const time = index / INTERNAL_SAMPLE_RATE;
    const noteIndex = Math.floor(time / noteSeconds) % notes.length;
    const localTime = time % noteSeconds;
    const frequency = 440 * 2 ** ((notes[noteIndex] - 69) / 12);
    const envelope = Math.min(1, localTime / 0.01, (noteSeconds - localTime) / 0.03);
    const melody = Math.sin(2 * Math.PI * frequency * time) * 0.48 * Math.max(0, envelope);
    const bassFrequency = frequency / 4;
    const bass = Math.sin(2 * Math.PI * bassFrequency * time) * 0.18;
    const beatPosition = time % 0.5;
    const click = beatPosition < 0.015 ? (1 - beatPosition / 0.015) * 0.2 : 0;
    samples[index] = Math.max(-1, Math.min(1, melody + bass + click));
  }
  return { samples, wav: encodePcm16Wav(samples, INTERNAL_SAMPLE_RATE) };
}
