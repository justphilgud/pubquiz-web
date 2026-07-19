import assert from "node:assert/strict";
import test from "node:test";
import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ffmpegPath from "ffmpeg-static";
import { BITCRUSH_SAMPLE_RATE, bitcrushAudio } from "./audioBitcrush";

function createToneWav() {
  const sampleRate = 44_100;
  const samples = sampleRate;
  const buffer = Buffer.alloc(44 + samples * 2);
  buffer.write("RIFF", 0); buffer.writeUInt32LE(buffer.length - 8, 4); buffer.write("WAVEfmt ", 8);
  buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24); buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34); buffer.write("data", 36); buffer.writeUInt32LE(samples * 2, 40);
  for (let index = 0; index < samples; index += 1) {
    buffer.writeInt16LE(Math.round(Math.sin(2 * Math.PI * 440 * index / sampleRate) * 20_000), 44 + index * 2);
  }
  return buffer;
}

async function inspectAudio(path: string) {
  return await new Promise<string>((resolve, reject) => {
    const child = spawn(ffmpegPath!, ["-hide_banner", "-i", path, "-f", "null", "-"], { windowsHide: true });
    let diagnostics = "";
    child.stderr.on("data", (chunk) => { diagnostics += String(chunk); });
    child.once("error", reject);
    child.once("close", (code) => code === 0 ? resolve(diagnostics) : reject(new Error(`ffmpeg exit ${code}`)));
  });
}

test("bitcrush produces a valid reduced-rate MP3 without mutating the source", async () => {
  assert.ok(ffmpegPath);
  const input = createToneWav();
  const unchanged = Buffer.from(input);
  const output = await bitcrushAudio(input);
  assert.deepEqual(input, unchanged);
  assert.notDeepEqual(output, input);
  const directory = await mkdtemp(join(tmpdir(), "pubquiz-bitcrush-test-"));
  try {
    const outputPath = join(directory, "output.mp3");
    await writeFile(outputPath, output);
    const diagnostics = await inspectAudio(outputPath);
    assert.match(diagnostics, new RegExp(`${BITCRUSH_SAMPLE_RATE} Hz`));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("bitcrush rejects empty input", async () => {
  await assert.rejects(() => bitcrushAudio(new Uint8Array()), { code: "GENERATOR_INPUT_INVALID" });
  await assert.rejects(() => bitcrushAudio(new Uint8Array(25 * 1024 * 1024 + 1)), { code: "GENERATOR_INPUT_INVALID" });
  await assert.rejects(() => bitcrushAudio(Buffer.from("not-audio")), { code: "GENERATOR_PROCESSING_FAILED" });
});
