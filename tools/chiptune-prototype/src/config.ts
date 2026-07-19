export const PROTOTYPE_VERSION = 3 as const;
export const INTERNAL_SAMPLE_RATE = 22_050;
export const MIN_INPUT_DURATION_SECONDS = 3;
export const MAX_INPUT_DURATION_SECONDS = 60;
export const MAX_INPUT_BYTES = 50 * 1024 * 1024;
export const SUPPORTED_INPUT_EXTENSIONS = new Set([".wav", ".mp3", ".flac", ".ogg", ".m4a"]);
export const SUPPORTED_OUTPUT_EXTENSIONS = new Set([".wav", ".mp3"]);

export const STEM_CONFIG = {
  demucsVersion: "4.1.0",
  model: "htdemucs",
  separatorTimeoutMs: 15 * 60 * 1_000,
  vocalsMixGain: 0.6,
  otherMixGain: 0.4,
  mixedStemPeak: 0.92,
} as const;

export const ANALYSIS_CONFIG = {
  frameSize: 2_048,
  hopSize: 512,
  minimumNoteSeconds: 0.08,
  quantizationDivision: 4,
  melodyMidiMin: 55,
  melodyMidiMax: 88,
  bassMidiMin: 36,
  bassMidiMax: 55,
  maximumMelodyVoices: 1,
  tempoMinBpm: 60,
  tempoMaxBpm: 180,
} as const;

export const SYNTH_CONFIG = {
  melodyDutyCycle: 0.25,
  harmonyDutyCycle: 0.5,
  melodyGain: 0.34,
  harmonyGain: 0.13,
  bassGain: 0.24,
  percussionGain: 0.16,
  attackSeconds: 0.006,
  releaseSeconds: 0.035,
  masterPeak: 0.88,
  fadeSeconds: 0.012,
  randomSeed: 0x3c020001,
} as const;
