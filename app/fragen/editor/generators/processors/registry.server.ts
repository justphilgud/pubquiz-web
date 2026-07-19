import "server-only";

import type { GeneratorId, GeneratorParameters, MediaSlotKey } from "../../types";
import { reverseAudio } from "./audioReverse";
import { bitcrushAudio } from "./audioBitcrush";
import { pixelateImageStages } from "./imagePixelate";

export type GeneratorProcessorOutput = {
  slotKey: MediaSlotKey;
  bytes: Buffer;
  contentType: string;
  fileExtension: string;
  width?: number;
  height?: number;
};

export type GeneratorProcessorResult = { outputs: GeneratorProcessorOutput[] };

export type GeneratorProcessor = (
  input: Uint8Array,
  context: { parameters: GeneratorParameters; inputContentType: string },
) => Promise<GeneratorProcessorResult>;

const processors: Partial<Record<GeneratorId, GeneratorProcessor>> = {
  audio_reverse: async (input) => ({
    outputs: [{ slotKey: "music_reverse_audio", bytes: await reverseAudio(input), contentType: "audio/mpeg", fileExtension: "mp3" }],
  }),
  audio_bitcrush: async (input) => ({
    outputs: [{ slotKey: "music_bitcrush_audio", bytes: await bitcrushAudio(input), contentType: "audio/mpeg", fileExtension: "mp3" }],
  }),
  image_pixelate: async (input) => ({ outputs: await pixelateImageStages(input) }),
};

export function getGeneratorProcessor(generatorId: GeneratorId) {
  return processors[generatorId] ?? null;
}
