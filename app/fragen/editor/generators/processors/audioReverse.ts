import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GeneratorProcessorError } from "./errors";
import { isFfmpegAvailable, runFfmpeg } from "./ffmpeg";
const MAX_INPUT_BYTES = 25 * 1024 * 1024;

export function isAudioReverseProcessorAvailable() {
  return isFfmpegAvailable();
}

export async function reverseAudio(input: Uint8Array) {
  if (input.byteLength === 0 || input.byteLength > MAX_INPUT_BYTES) {
    throw new GeneratorProcessorError("GENERATOR_INPUT_INVALID", "Audioeingabe ist leer oder zu groß.");
  }

  const directory = await mkdtemp(join(tmpdir(), "pubquiz-audio-reverse-"));
  const inputPath = join(directory, "input");
  const outputPath = join(directory, "output.mp3");
  try {
    await writeFile(inputPath, input);
    await runFfmpeg([
      "-nostdin",
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      inputPath,
      "-vn",
      "-af",
      "areverse",
      "-codec:a",
      "libmp3lame",
      "-b:a",
      "192k",
      outputPath,
    ]);
    return await readFile(outputPath);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
