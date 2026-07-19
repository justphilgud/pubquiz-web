import assert from "node:assert/strict";
import { access, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import test from "node:test";
import ffmpegPath from "ffmpeg-static";
import { runPrototype } from "../src/pipeline";
import { decodePcm16Wav, encodePcm16Wav } from "../src/wav";
import { INTERNAL_SAMPLE_RATE } from "../src/config";
import { createSyntheticMelody } from "./testAudio";

async function withTestDirectory(work: (directory: string) => Promise<void>) {
  const directory = await mkdtemp(join(tmpdir(), "pubquiz-chiptune-test-"));
  try {
    await work(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function encodeMp3(input: string, output: string) {
  assert.equal(typeof ffmpegPath, "string");
  await new Promise<void>((resolve, reject) => {
    const child = spawn(ffmpegPath!, ["-nostdin", "-loglevel", "error", "-y", "-i", input, output], { shell: false, windowsHide: true });
    child.once("error", reject);
    child.once("close", (code) => code === 0 ? resolve() : reject(new Error(`ffmpeg ${code}`)));
  });
}

async function assertDecodable(input: string) {
  assert.equal(typeof ffmpegPath, "string");
  await new Promise<void>((resolve, reject) => {
    const child = spawn(ffmpegPath!, ["-nostdin", "-loglevel", "error", "-i", input, "-f", "null", "-"], { shell: false, windowsHide: true });
    child.once("error", reject);
    child.once("close", (code) => code === 0 ? resolve() : reject(new Error(`ffmpeg ${code}`)));
  });
}

async function runCli(args: string[]) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, ["--import", "tsx", join(process.cwd(), "tools", "chiptune-prototype", "src", "cli.ts"), ...args], {
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "ignore", "pipe"],
    });
    child.stderr.resume();
    child.once("error", reject);
    child.once("close", (code) => code === 0 ? resolve() : reject(new Error(`cli ${code}`)));
  });
}

test("valid WAV creates a decoded, non-silent, deterministic synthesized cover and debug artifacts", async () => {
  await withTestDirectory(async (directory) => {
    const source = createSyntheticMelody();
    const input = join(directory, "legal-synthetic.wav");
    const outputA = join(directory, "result-a.wav");
    const outputB = join(directory, "result-b.wav");
    const debugDirectory = join(directory, "debug");
    await writeFile(input, source.wav);
    const first = await runPrototype({ input, output: outputA, variant: "direct", debugDirectory });
    const second = await runPrototype({ input, output: outputB, variant: "direct" });
    const outputBufferA = await readFile(outputA);
    const outputBufferB = await readFile(outputB);
    assert.deepEqual(outputBufferA, outputBufferB);
    assert.notDeepEqual(outputBufferA, source.wav);
    assert.ok(decodePcm16Wav(outputBufferA).channels[0].some((sample) => Math.abs(sample) > 0.01));
    assert.ok(first.report.cleanedMelodyNotes > 0);
    assert.deepEqual(first.report.warnings, second.report.warnings);
    assert.deepEqual((await readdir(debugDirectory)).sort(), [
      "arrangement.json", "cleaned-notes.json", "final-synthesized.wav", "normalized-input.wav", "raw-transcription.json", "report.json",
    ]);
  });
});

test("Basic Pitch uses the same downstream synthesizer and is deterministic", async (context) => {
  const pythonPath = join(process.cwd(), "tools", "chiptune-prototype", "python", ".runtime", "python.exe");
  try {
    await access(pythonPath);
  } catch {
    context.skip("isolated Basic Pitch environment is not installed");
    return;
  }
  await withTestDirectory(async (directory) => {
    const input = join(directory, "basic-pitch-input.wav");
    const outputA = join(directory, "basic-pitch-a.wav");
    const outputB = join(directory, "basic-pitch-b.wav");
    await writeFile(input, createSyntheticMelody(3.2).wav);
    const first = await runPrototype({ input, output: outputA, variant: "direct", transcriber: "basic-pitch" });
    const second = await runPrototype({ input, output: outputB, variant: "direct", transcriber: "basic-pitch" });
    const firstBuffer = await readFile(outputA);
    assert.deepEqual(firstBuffer, await readFile(outputB));
    assert.ok(decodePcm16Wav(firstBuffer).channels[0].some((sample) => Math.abs(sample) > 0.01));
    assert.equal(first.report.transcriber, "basic-pitch");
    assert.ok(first.report.totalDetectedNotes > 0);
    assert.ok(first.report.midiEventCount > 0);
    assert.ok(first.report.peakRssBytes > 0);
    assert.deepEqual(first.report.cleanedMelodyNotes, second.report.cleanedMelodyNotes);
  });
});

test("compare CLI creates FFT and Basic Pitch outputs plus structured comparison JSON", async (context) => {
  const pythonPath = join(process.cwd(), "tools", "chiptune-prototype", "python", ".runtime", "python.exe");
  try {
    await access(pythonPath);
  } catch {
    context.skip("isolated Basic Pitch environment is not installed");
    return;
  }
  await withTestDirectory(async (directory) => {
    const input = join(directory, "compare-input.wav");
    const output = join(directory, "compare.wav");
    await writeFile(input, createSyntheticMelody(3.2).wav);
    await runCli(["--input", input, "--output", output, "--compare"]);
    const comparison = JSON.parse(await readFile(join(directory, "comparison.json"), "utf8")) as {
      prototypeVersion: number;
      results: Array<Record<string, unknown>>;
    };
    assert.equal(comparison.prototypeVersion, 3);
    assert.deepEqual(comparison.results.map((entry) => entry.transcriber), ["fft", "basic-pitch"]);
    assert.ok(comparison.results.every((entry) => Number(entry.runtimeMs) > 0 && Number(entry.outputBytes) > 0 && Number(entry.durationSeconds) > 0));
    await assertDecodable(join(directory, "compare.fft.wav"));
    await assertDecodable(join(directory, "compare.basic-pitch.wav"));
  });
});

test("MP3 input and output are supported through argument-list FFmpeg calls", async () => {
  await withTestDirectory(async (directory) => {
    const wavInput = join(directory, "source & safe.wav");
    const mp3Input = join(directory, "source & safe.mp3");
    const mp3Output = join(directory, "output.mp3");
    await writeFile(wavInput, createSyntheticMelody(3.5).wav);
    await encodeMp3(wavInput, mp3Input);
    await runPrototype({ input: mp3Input, output: mp3Output, variant: "direct" });
    assert.ok((await readFile(mp3Output)).length > 1_000);
    await assertDecodable(mp3Output);
  });
});

test("empty, defective, too short and too long inputs fail without output", async () => {
  await withTestDirectory(async (directory) => {
    const output = join(directory, "output.wav");
    const empty = join(directory, "empty.wav");
    const broken = join(directory, "broken.wav");
    const short = join(directory, "short.wav");
    const long = join(directory, "long.wav");
    await writeFile(empty, Buffer.alloc(0));
    await writeFile(broken, "not audio");
    await writeFile(short, encodePcm16Wav(new Float32Array(INTERNAL_SAMPLE_RATE), INTERNAL_SAMPLE_RATE));
    await writeFile(long, encodePcm16Wav(new Float32Array(Math.ceil(INTERNAL_SAMPLE_RATE * 60.1)), INTERNAL_SAMPLE_RATE));
    await assert.rejects(runPrototype({ input: empty, output, variant: "direct" }), { code: "INPUT_EMPTY" });
    await assert.rejects(runPrototype({ input: broken, output, variant: "direct" }), { code: "INPUT_DECODE_FAILED" });
    await assert.rejects(runPrototype({ input: short, output, variant: "direct" }), { code: "INPUT_TOO_SHORT" });
    await assert.rejects(runPrototype({ input: long, output, variant: "direct" }), { code: "INPUT_TOO_LONG" });
  });
});
