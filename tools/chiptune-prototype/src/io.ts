import { spawn } from "node:child_process";
import { copyFile, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, extname, join, resolve } from "node:path";
import ffmpegPath from "ffmpeg-static";
import {
  INTERNAL_SAMPLE_RATE,
  MAX_INPUT_BYTES,
  MAX_INPUT_DURATION_SECONDS,
  MIN_INPUT_DURATION_SECONDS,
  SUPPORTED_INPUT_EXTENSIONS,
  SUPPORTED_OUTPUT_EXTENSIONS,
} from "./config";
import type { PcmAudio } from "./types";
import { decodePcm16Wav } from "./wav";

export const TEMP_DIRECTORY_PREFIX = "pubquiz-chiptune-";

export class PrototypeInputError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "PrototypeInputError";
  }
}

function looksLikeUrl(value: string) {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(value.trim());
}

export async function validatePaths(inputValue: string, outputValue: string) {
  if (looksLikeUrl(inputValue)) throw new PrototypeInputError("INPUT_URL_FORBIDDEN", "Streaming- und URL-Eingaben sind nicht erlaubt.");
  const input = resolve(inputValue);
  const output = resolve(outputValue);
  if (input === output) throw new PrototypeInputError("OUTPUT_EQUALS_INPUT", "Eingabe und Ausgabe müssen verschieden sein.");
  if (!SUPPORTED_INPUT_EXTENSIONS.has(extname(input).toLowerCase())) {
    throw new PrototypeInputError("INPUT_FORMAT_UNSUPPORTED", "Das Eingabeformat wird nicht unterstützt.");
  }
  if (!SUPPORTED_OUTPUT_EXTENSIONS.has(extname(output).toLowerCase())) {
    throw new PrototypeInputError("OUTPUT_FORMAT_UNSUPPORTED", "Die Ausgabe muss WAV oder MP3 sein.");
  }
  let inputStats;
  try {
    inputStats = await stat(input);
  } catch {
    throw new PrototypeInputError("INPUT_NOT_FOUND", "Die lokale Eingabedatei wurde nicht gefunden.");
  }
  if (!inputStats.isFile() || inputStats.size === 0) throw new PrototypeInputError("INPUT_EMPTY", "Die Eingabedatei ist leer oder keine Datei.");
  if (inputStats.size > MAX_INPUT_BYTES) throw new PrototypeInputError("INPUT_TOO_LARGE", "Die Eingabedatei überschreitet 50 MiB.");
  try {
    const parentStats = await stat(dirname(output));
    if (!parentStats.isDirectory()) throw new Error("not-directory");
  } catch {
    throw new PrototypeInputError("OUTPUT_DIRECTORY_MISSING", "Der Ausgabeordner existiert nicht.");
  }
  return { input, output, inputDisplayName: basename(input), outputDisplayName: basename(output) };
}

async function runFfmpeg(args: readonly string[]) {
  const executable = ffmpegPath;
  if (typeof executable !== "string" || executable.length === 0) throw new Error("FFMPEG_UNAVAILABLE");
  await new Promise<void>((resolvePromise, reject) => {
    const child = spawn(executable, [...args], { shell: false, windowsHide: true, stdio: ["ignore", "ignore", "pipe"] });
    child.stderr.resume();
    child.once("error", () => reject(new Error("FFMPEG_START_FAILED")));
    child.once("close", (code: number | null) => code === 0 ? resolvePromise() : reject(new Error(`FFMPEG_FAILED_${code ?? "UNKNOWN"}`)));
  });
}

export async function decodeLocalAudio(input: string, temporaryDirectory: string): Promise<{ audio: PcmAudio; normalizedWav: Buffer; normalizedPath: string }> {
  const normalizedPath = join(temporaryDirectory, "normalized.wav");
  try {
    await runFfmpeg([
      "-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-i", input,
      "-vn", "-map_metadata", "-1", "-ac", "2", "-ar", String(INTERNAL_SAMPLE_RATE),
      "-c:a", "pcm_s16le", "-t", String(MAX_INPUT_DURATION_SECONDS + 0.25), normalizedPath,
    ]);
  } catch {
    throw new PrototypeInputError("INPUT_DECODE_FAILED", "Die Eingabedatei konnte nicht als Audio dekodiert werden.");
  }
  const normalizedWav = await readFile(normalizedPath);
  const audio = decodePcm16Wav(normalizedWav);
  if (audio.durationSeconds < MIN_INPUT_DURATION_SECONDS) {
    throw new PrototypeInputError("INPUT_TOO_SHORT", `Der Ausschnitt muss mindestens ${MIN_INPUT_DURATION_SECONDS} Sekunden lang sein.`);
  }
  if (audio.durationSeconds > MAX_INPUT_DURATION_SECONDS) {
    throw new PrototypeInputError("INPUT_TOO_LONG", `Der Ausschnitt darf höchstens ${MAX_INPUT_DURATION_SECONDS} Sekunden lang sein.`);
  }
  return { audio, normalizedWav, normalizedPath };
}

export async function writePrototypeOutput(wav: Buffer, output: string, temporaryDirectory: string) {
  if (extname(output).toLowerCase() === ".wav") {
    const temporaryOutput = join(temporaryDirectory, "final.wav");
    await writeFile(temporaryOutput, wav);
    await copyFile(temporaryOutput, output);
    return;
  }
  const source = join(temporaryDirectory, "final-source.wav");
  const encoded = join(temporaryDirectory, "final.mp3");
  await writeFile(source, wav);
  await runFfmpeg(["-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-i", source, "-map_metadata", "-1", "-codec:a", "libmp3lame", "-b:a", "192k", encoded]);
  await copyFile(encoded, output);
}

export async function withTemporaryDirectory<T>(work: (directory: string) => Promise<T>) {
  const directory = await mkdtemp(join(tmpdir(), TEMP_DIRECTORY_PREFIX));
  try {
    return await work(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
