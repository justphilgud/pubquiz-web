import { INTERNAL_SAMPLE_RATE, SYNTH_CONFIG } from "./config";
import type { ChiptuneArrangement, NoteEvent } from "./types";
import { encodePcm16Wav } from "./wav";

function midiFrequency(midi: number) {
  return 440 * 2 ** ((midi - 69) / 12);
}

function envelope(time: number, duration: number) {
  const attack = Math.min(1, time / SYNTH_CONFIG.attackSeconds);
  const release = Math.min(1, Math.max(0, duration - time) / SYNTH_CONFIG.releaseSeconds);
  return Math.max(0, Math.min(attack, release));
}

function addPulse(target: Float32Array, note: NoteEvent, gain: number, dutyCycle: number) {
  const start = Math.max(0, Math.round(note.startSeconds * INTERNAL_SAMPLE_RATE));
  const end = Math.min(target.length, Math.round(note.endSeconds * INTERNAL_SAMPLE_RATE));
  const frequency = midiFrequency(note.midi);
  const duration = Math.max(0, note.endSeconds - note.startSeconds);
  for (let index = start; index < end; index += 1) {
    const time = (index - start) / INTERNAL_SAMPLE_RATE;
    const phase = (time * frequency) % 1;
    target[index] += (phase < dutyCycle ? 1 : -1) * gain * envelope(time, duration);
  }
}

function addTriangle(target: Float32Array, note: NoteEvent, gain: number) {
  const start = Math.max(0, Math.round(note.startSeconds * INTERNAL_SAMPLE_RATE));
  const end = Math.min(target.length, Math.round(note.endSeconds * INTERNAL_SAMPLE_RATE));
  const frequency = midiFrequency(note.midi);
  const duration = Math.max(0, note.endSeconds - note.startSeconds);
  for (let index = start; index < end; index += 1) {
    const time = (index - start) / INTERNAL_SAMPLE_RATE;
    const phase = (time * frequency) % 1;
    const triangle = 1 - 4 * Math.abs(Math.round(phase) - phase);
    target[index] += triangle * gain * envelope(time, duration);
  }
}

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4_294_967_296;
  };
}

function addPercussion(target: Float32Array, event: ChiptuneArrangement["percussion"][number], eventIndex: number) {
  const start = Math.max(0, Math.round(event.timeSeconds * INTERNAL_SAMPLE_RATE));
  const duration = event.kind === "kick" ? 0.12 : event.kind === "snare" ? 0.09 : 0.035;
  const end = Math.min(target.length, start + Math.round(duration * INTERNAL_SAMPLE_RATE));
  const random = seededRandom(SYNTH_CONFIG.randomSeed + eventIndex * 2_654_435_761);
  let previousNoise = 0;
  for (let index = start; index < end; index += 1) {
    const time = (index - start) / INTERNAL_SAMPLE_RATE;
    const decay = Math.max(0, 1 - time / duration) ** 2;
    let sample: number;
    if (event.kind === "kick") {
      const frequency = 115 - 65 * (time / duration);
      sample = Math.sin(2 * Math.PI * frequency * time) * decay;
    } else {
      const noise = random() * 2 - 1;
      const highPassed = noise - previousNoise * 0.82;
      previousNoise = noise;
      sample = highPassed * decay * (event.kind === "hat" ? 0.55 : 1);
    }
    target[index] += sample * SYNTH_CONFIG.percussionGain;
  }
}

export function synthesizeArrangement(arrangement: ChiptuneArrangement) {
  const sampleCount = Math.max(1, Math.ceil(arrangement.durationSeconds * INTERNAL_SAMPLE_RATE));
  const samples = new Float32Array(sampleCount);
  for (const note of arrangement.melody) addPulse(samples, note, SYNTH_CONFIG.melodyGain, SYNTH_CONFIG.melodyDutyCycle);
  for (const note of arrangement.harmony) addPulse(samples, note, SYNTH_CONFIG.harmonyGain, SYNTH_CONFIG.harmonyDutyCycle);
  for (const note of arrangement.bass) addTriangle(samples, note, SYNTH_CONFIG.bassGain);
  arrangement.percussion.forEach((event, index) => addPercussion(samples, event, index));

  let peak = 0;
  for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
  const scale = peak > 0 ? Math.min(1, SYNTH_CONFIG.masterPeak / peak) : 1;
  const fadeSamples = Math.max(1, Math.round(SYNTH_CONFIG.fadeSeconds * INTERNAL_SAMPLE_RATE));
  for (let index = 0; index < samples.length; index += 1) {
    const fadeIn = Math.min(1, index / fadeSamples);
    const fadeOut = Math.min(1, (samples.length - 1 - index) / fadeSamples);
    samples[index] *= scale * Math.max(0, Math.min(fadeIn, fadeOut));
  }
  return { samples, wav: encodePcm16Wav(samples, INTERNAL_SAMPLE_RATE), peakBeforeMastering: peak };
}
