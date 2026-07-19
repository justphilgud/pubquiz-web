import { analyzeFftRaw } from "../analysis";
import type { MusicTranscriber } from "./types";

export const fftTranscriber: MusicTranscriber = {
  id: "fft",
  async transcribe(input) {
    return analyzeFftRaw(input.samples, input.sampleRate);
  },
};
