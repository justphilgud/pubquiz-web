import type { RawTranscription, TranscriberId } from "../types";

export type TranscriberInput = {
  audioPath: string;
  samples: Float32Array;
  sampleRate: number;
  temporaryDirectory: string;
};

export interface MusicTranscriber {
  readonly id: TranscriberId;
  transcribe(input: TranscriberInput): Promise<RawTranscription>;
}
