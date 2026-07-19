import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GeneratorProcessorError } from "./errors";
import { runFfmpeg } from "./ffmpeg";

const MAX_INPUT_BYTES = 25 * 1024 * 1024;
export const BITCRUSH_SAMPLE_RATE = 12_000;
export const BITCRUSH_EFFECTIVE_BITS = 8;

export async function bitcrushAudio(input: Uint8Array) {
  if (input.byteLength === 0 || input.byteLength > MAX_INPUT_BYTES) {
    throw new GeneratorProcessorError("GENERATOR_INPUT_INVALID", "Audioeingabe ist leer oder zu groß.");
  }
  const directory = await mkdtemp(join(tmpdir(), "pubquiz-audio-bitcrush-"));
  const inputPath = join(directory, "input");
  const outputPath = join(directory, "output.mp3");
  try {
    await writeFile(inputPath, input);
    await runFfmpeg([
      "-nostdin", "-hide_banner", "-loglevel", "error", "-y",
      "-i", inputPath, "-vn",
      "-af", `acrusher=bits=${BITCRUSH_EFFECTIVE_BITS}:mode=lin:mix=1:samples=4:aa=0.25,aresample=${BITCRUSH_SAMPLE_RATE}`,
      "-ar", String(BITCRUSH_SAMPLE_RATE),
      "-codec:a", "libmp3lame", "-b:a", "96k", outputPath,
    ]);
    return await readFile(outputPath);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
