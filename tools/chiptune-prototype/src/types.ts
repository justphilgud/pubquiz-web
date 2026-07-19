export type PrototypeVariant = "direct" | "center-reduced";
export type TranscriberId = "fft" | "basic-pitch";
export type SeparatorId = "none" | "demucs";
export type StemName = "vocals" | "bass" | "drums" | "other";
export type StemSelection = "full" | "vocals" | "other" | "vocals-other" | "bass";

export type PcmAudio = {
  sampleRate: number;
  channels: Float32Array[];
  durationSeconds: number;
};

export type NoteEvent = {
  startSeconds: number;
  endSeconds: number;
  midi: number;
  confidence: number;
};

export type RawTranscription = {
  tempoBpm: number;
  rawMelody: NoteEvent[];
  rawBass: NoteEvent[];
  totalDetectedNotes: number;
  midiEventCount: number;
  warnings: string[];
  peakRssBytes?: number;
};

export type CleanedTranscription = RawTranscription & {
  melody: NoteEvent[];
  bass: NoteEvent[];
};

export type PercussionEvent = {
  timeSeconds: number;
  kind: "kick" | "snare" | "hat";
};

export type ChiptuneArrangement = {
  durationSeconds: number;
  tempoBpm: number;
  melody: NoteEvent[];
  harmony: NoteEvent[];
  bass: NoteEvent[];
  percussion: PercussionEvent[];
};

export type PrototypeReport = {
  prototypeVersion: 3;
  variant: PrototypeVariant;
  transcriber: TranscriberId;
  inputDurationSeconds: number;
  outputDurationSeconds: number;
  tempoBpm: number;
  rawMelodyNotes: number;
  totalDetectedNotes: number;
  midiEventCount: number;
  cleanedMelodyNotes: number;
  bassNotes: number;
  discardedNotes: number;
  warnings: string[];
  timingsMs: Record<string, number>;
  nodePeakRssBytes: number;
  transcriberPeakRssBytes: number;
  peakRssBytes: number;
};
