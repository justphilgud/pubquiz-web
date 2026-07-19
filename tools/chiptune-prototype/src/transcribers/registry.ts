import type { TranscriberId } from "../types";
import { createBasicPitchTranscriber } from "./basicPitch";
import { fftTranscriber } from "./fft";
import type { MusicTranscriber } from "./types";

export function getTranscriber(id: TranscriberId): MusicTranscriber {
  return id === "basic-pitch" ? createBasicPitchTranscriber() : fftTranscriber;
}
