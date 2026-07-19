import { ANALYSIS_CONFIG } from "./config";
import type { ChiptuneArrangement, CleanedTranscription, NoteEvent, PcmAudio, PrototypeVariant, RawTranscription } from "./types";

type FramePitch = { timeSeconds: number; midi: number; confidence: number } | null;

function rms(samples: Float32Array) {
  let sum = 0;
  for (const sample of samples) sum += sample * sample;
  return Math.sqrt(sum / Math.max(1, samples.length));
}

export function selectAnalysisWaveform(audio: PcmAudio, variant: PrototypeVariant) {
  const left = audio.channels[0];
  const right = audio.channels[1] ?? left;
  const direct = new Float32Array(left.length);
  const side = new Float32Array(left.length);
  for (let index = 0; index < left.length; index += 1) {
    direct[index] = (left[index] + right[index]) * 0.5;
    side[index] = (left[index] - right[index]) * 0.5;
  }
  if (variant === "direct") return { samples: direct, warnings: [] as string[] };
  if (rms(side) < Math.max(0.0005, rms(direct) * 0.08)) {
    return { samples: direct, warnings: ["CENTER_REDUCTION_INEFFECTIVE_FALLBACK_DIRECT"] };
  }
  return { samples: side, warnings: [] as string[] };
}

function fftMagnitudes(samples: Float32Array, offset: number, size: number) {
  const real = new Float64Array(size);
  const imaginary = new Float64Array(size);
  for (let index = 0; index < size; index += 1) {
    const window = 0.5 - 0.5 * Math.cos((2 * Math.PI * index) / (size - 1));
    real[index] = (samples[offset + index] ?? 0) * window;
  }
  for (let index = 1, reversed = 0; index < size; index += 1) {
    let bit = size >> 1;
    while (reversed & bit) {
      reversed ^= bit;
      bit >>= 1;
    }
    reversed ^= bit;
    if (index < reversed) {
      [real[index], real[reversed]] = [real[reversed], real[index]];
      [imaginary[index], imaginary[reversed]] = [imaginary[reversed], imaginary[index]];
    }
  }
  for (let length = 2; length <= size; length <<= 1) {
    const angle = (-2 * Math.PI) / length;
    for (let base = 0; base < size; base += length) {
      for (let index = 0; index < length / 2; index += 1) {
        const cos = Math.cos(angle * index);
        const sin = Math.sin(angle * index);
        const even = base + index;
        const odd = even + length / 2;
        const oddReal = real[odd] * cos - imaginary[odd] * sin;
        const oddImaginary = real[odd] * sin + imaginary[odd] * cos;
        real[odd] = real[even] - oddReal;
        imaginary[odd] = imaginary[even] - oddImaginary;
        real[even] += oddReal;
        imaginary[even] += oddImaginary;
      }
    }
  }
  const magnitudes = new Float64Array(size / 2);
  for (let index = 0; index < magnitudes.length; index += 1) magnitudes[index] = Math.hypot(real[index], imaginary[index]);
  return magnitudes;
}

function midiFrequency(midi: number) {
  return 440 * 2 ** ((midi - 69) / 12);
}

function selectPitch(magnitudes: Float64Array, sampleRate: number, midiMin: number, midiMax: number): Omit<NonNullable<FramePitch>, "timeSeconds"> | null {
  let bestMidi = midiMin;
  let bestScore = 0;
  let scoreTotal = 0;
  const fftSize = magnitudes.length * 2;
  for (let midi = midiMin; midi <= midiMax; midi += 1) {
    const fundamental = Math.max(1, Math.round((midiFrequency(midi) * fftSize) / sampleRate));
    const magnitude = (magnitudes[fundamental - 1] ?? 0) + (magnitudes[fundamental] ?? 0) * 2 + (magnitudes[fundamental + 1] ?? 0);
    const second = magnitudes[fundamental * 2] ?? 0;
    const third = magnitudes[fundamental * 3] ?? 0;
    const score = magnitude + second * 0.45 + third * 0.22;
    scoreTotal += score;
    if (score > bestScore) {
      bestScore = score;
      bestMidi = midi;
    }
  }
  const confidence = bestScore / Math.max(bestScore, scoreTotal * 0.12, 1e-9);
  return bestScore > 0.01 && confidence >= 0.3 ? { midi: bestMidi, confidence: Math.min(1, confidence) } : null;
}

function estimateTempo(energies: number[], sampleRate: number) {
  const flux = energies.map((energy, index) => Math.max(0, energy - (energies[index - 1] ?? energy)));
  let bestBpm = 120;
  let bestScore = 0;
  for (let bpm = ANALYSIS_CONFIG.tempoMinBpm; bpm <= ANALYSIS_CONFIG.tempoMaxBpm; bpm += 1) {
    const lag = Math.round((60 * sampleRate) / (bpm * ANALYSIS_CONFIG.hopSize));
    let score = 0;
    for (let index = lag; index < flux.length; index += 1) score += flux[index] * flux[index - lag];
    if (score > bestScore) {
      bestScore = score;
      bestBpm = bpm;
    }
  }
  return bestScore > 1e-8 ? bestBpm : 120;
}

export function estimateTempoFromSamples(samples: Float32Array, sampleRate: number) {
  const energies: number[] = [];
  for (let offset = 0; offset + ANALYSIS_CONFIG.frameSize <= samples.length; offset += ANALYSIS_CONFIG.hopSize) {
    let energy = 0;
    for (let index = 0; index < ANALYSIS_CONFIG.frameSize; index += 1) energy += samples[offset + index] ** 2;
    energies.push(Math.sqrt(energy / ANALYSIS_CONFIG.frameSize));
  }
  return estimateTempo(energies, sampleRate);
}

function framesToNotes(frames: FramePitch[], sampleRate: number) {
  const notes: NoteEvent[] = [];
  let current: NoteEvent | null = null;
  const frameSeconds = ANALYSIS_CONFIG.frameSize / sampleRate;
  for (const frame of frames) {
    if (!frame) {
      if (current) notes.push(current);
      current = null;
      continue;
    }
    if (current && Math.abs(current.midi - frame.midi) <= 1 && frame.timeSeconds - current.endSeconds <= ANALYSIS_CONFIG.hopSize / sampleRate * 1.5) {
      current.endSeconds = frame.timeSeconds + frameSeconds;
      current.confidence = Math.max(current.confidence, frame.confidence);
      current.midi = Math.round((current.midi + frame.midi) / 2);
    } else {
      if (current) notes.push(current);
      current = { startSeconds: frame.timeSeconds, endSeconds: frame.timeSeconds + frameSeconds, midi: frame.midi, confidence: frame.confidence };
    }
  }
  if (current) notes.push(current);
  return notes;
}

function foldIntoRange(midi: number, min: number, max: number, previous?: number) {
  let folded = midi;
  while (folded < min) folded += 12;
  while (folded > max) folded -= 12;
  if (previous !== undefined) {
    const candidates = [folded - 12, folded, folded + 12].filter((entry) => entry >= min && entry <= max);
    folded = candidates.sort((left, right) => Math.abs(left - previous) - Math.abs(right - previous))[0] ?? folded;
  }
  return folded;
}

export function cleanAndQuantizeNotes(notes: readonly NoteEvent[], tempoBpm: number, midiMin: number, midiMax: number) {
  const grid = 60 / tempoBpm / ANALYSIS_CONFIG.quantizationDivision;
  const cleaned: NoteEvent[] = [];
  for (const note of notes.filter((entry) => entry.endSeconds - entry.startSeconds >= ANALYSIS_CONFIG.minimumNoteSeconds && entry.confidence >= 0.3)) {
    const startSeconds = Math.max(0, Math.round(note.startSeconds / grid) * grid);
    const endSeconds = Math.max(startSeconds + grid, Math.round(note.endSeconds / grid) * grid);
    const midi = foldIntoRange(note.midi, midiMin, midiMax, cleaned.at(-1)?.midi);
    const previous = cleaned.at(-1);
    if (previous && startSeconds < previous.endSeconds) {
      if (note.confidence <= previous.confidence) continue;
      if (startSeconds <= previous.startSeconds) {
        cleaned.pop();
      } else {
        previous.endSeconds = startSeconds;
      }
    }
    cleaned.push({ startSeconds, endSeconds, midi, confidence: note.confidence });
  }
  return cleaned;
}

export function analyzeFftRaw(samples: Float32Array, sampleRate: number): RawTranscription {
  const melodyFrames: FramePitch[] = [];
  const bassFrames: FramePitch[] = [];
  const energies: number[] = [];
  for (let offset = 0; offset + ANALYSIS_CONFIG.frameSize <= samples.length; offset += ANALYSIS_CONFIG.hopSize) {
    let energy = 0;
    for (let index = 0; index < ANALYSIS_CONFIG.frameSize; index += 1) energy += samples[offset + index] ** 2;
    energy = Math.sqrt(energy / ANALYSIS_CONFIG.frameSize);
    energies.push(energy);
    if (energy < 0.003) {
      melodyFrames.push(null);
      bassFrames.push(null);
      continue;
    }
    const magnitudes = fftMagnitudes(samples, offset, ANALYSIS_CONFIG.frameSize);
    const timeSeconds = offset / sampleRate;
    const melody = selectPitch(magnitudes, sampleRate, ANALYSIS_CONFIG.melodyMidiMin, ANALYSIS_CONFIG.melodyMidiMax);
    const bass = selectPitch(magnitudes, sampleRate, ANALYSIS_CONFIG.bassMidiMin, ANALYSIS_CONFIG.bassMidiMax);
    melodyFrames.push(melody ? { ...melody, timeSeconds } : null);
    bassFrames.push(bass ? { ...bass, timeSeconds } : null);
  }
  const tempoBpm = estimateTempo(energies, sampleRate);
  const rawMelody = framesToNotes(melodyFrames, sampleRate);
  const rawBass = framesToNotes(bassFrames, sampleRate);
  return {
    tempoBpm,
    rawMelody,
    rawBass,
    totalDetectedNotes: rawMelody.length + rawBass.length,
    midiEventCount: rawMelody.length + rawBass.length,
    warnings: [],
  };
}

export function cleanTranscription(raw: RawTranscription): CleanedTranscription {
  const { tempoBpm, rawMelody, rawBass } = raw;
  const melody = cleanAndQuantizeNotes(rawMelody, tempoBpm, ANALYSIS_CONFIG.melodyMidiMin, ANALYSIS_CONFIG.melodyMidiMax);
  let bass = cleanAndQuantizeNotes(rawBass, tempoBpm, ANALYSIS_CONFIG.bassMidiMin, ANALYSIS_CONFIG.bassMidiMax);
  if (bass.length < Math.max(1, melody.length / 5)) {
    bass = melody.filter((_, index) => index % 2 === 0).map((note) => ({ ...note, midi: foldIntoRange(note.midi, ANALYSIS_CONFIG.bassMidiMin, ANALYSIS_CONFIG.bassMidiMax), confidence: note.confidence * 0.8 }));
  }
  return { ...raw, melody, bass };
}

export function analyzeMusic(samples: Float32Array, sampleRate: number) {
  return cleanTranscription(analyzeFftRaw(samples, sampleRate));
}

export function createArrangement(analysis: CleanedTranscription, durationSeconds: number): ChiptuneArrangement {
  const harmony = analysis.melody.filter((_, index) => index % 2 === 0).map((note) => ({
    ...note,
    midi: foldIntoRange(note.midi - 7, 48, 76),
    confidence: note.confidence * 0.65,
  }));
  const percussion: ChiptuneArrangement["percussion"] = [];
  const beatSeconds = 60 / analysis.tempoBpm;
  for (let beat = 0, timeSeconds = 0; timeSeconds < durationSeconds; beat += 1, timeSeconds += beatSeconds) {
    percussion.push({ timeSeconds, kind: beat % 4 === 0 || beat % 4 === 2 ? "kick" : "snare" });
    percussion.push({ timeSeconds, kind: "hat" });
    if (timeSeconds + beatSeconds / 2 < durationSeconds) percussion.push({ timeSeconds: timeSeconds + beatSeconds / 2, kind: "hat" });
  }
  return { durationSeconds, tempoBpm: analysis.tempoBpm, melody: analysis.melody, harmony, bass: analysis.bass, percussion };
}
