import assert from "node:assert/strict";
import test from "node:test";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ffmpegPath from "ffmpeg-static";
import { reverseAudio } from "./audioReverse";

function createTwoToneWav() {
  const sampleRate = 8_000;
  const samples = sampleRate;
  const buffer = Buffer.alloc(44 + samples * 2);
  buffer.write("RIFF", 0); buffer.writeUInt32LE(buffer.length - 8, 4); buffer.write("WAVEfmt ", 8);
  buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24); buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34); buffer.write("data", 36); buffer.writeUInt32LE(samples * 2, 40);
  for (let index = 0; index < samples; index += 1) {
    const frequency = index < samples / 2 ? 220 : 880;
    buffer.writeInt16LE(Math.round(Math.sin(2 * Math.PI * frequency * index / sampleRate) * 12_000), 44 + index * 2);
  }
  return buffer;
}

function decodeMp3(input: string, output: string) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(ffmpegPath!, ["-nostdin", "-loglevel", "error", "-y", "-i", input, "-ac", "1", "-ar", "8000", "-f", "s16le", output], { windowsHide: true });
    child.once("error", reject);
    child.once("close", (code) => code === 0 ? resolve() : reject(new Error(`ffmpeg exit ${code}`)));
  });
}

function zeroCrossings(samples: Int16Array, start: number, end: number) {
  let count = 0;
  for (let index = start + 1; index < end; index += 1) {
    if ((samples[index - 1] < 0 && samples[index] >= 0) || (samples[index - 1] >= 0 && samples[index] < 0)) count += 1;
  }
  return count;
}

test("audio reverse creates MP3 with reversed temporal tone order", async () => {
  assert.ok(ffmpegPath, "ffmpeg-static binary must be available");
  const original = createTwoToneWav();
  const unchanged = Buffer.from(original);
  const output = await reverseAudio(original);
  assert.deepEqual(original, unchanged);
  assert.equal(output.subarray(0, 3).toString("ascii"), "ID3");

  const directory = await mkdtemp(join(tmpdir(), "pubquiz-audio-test-"));
  try {
    const mp3 = join(directory, "output.mp3");
    const pcm = join(directory, "output.pcm");
    await writeFile(mp3, output);
    await decodeMp3(mp3, pcm);
    const decoded = await readFile(pcm);
    const samples = new Int16Array(decoded.buffer, decoded.byteOffset, Math.floor(decoded.byteLength / 2));
    const first = zeroCrossings(samples, 800, 3_200);
    const second = zeroCrossings(samples, 4_800, 7_200);
    assert.ok(first > second * 2, `expected reversed 880Hz before 220Hz, crossings ${first}/${second}`);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("audio reverse rejects an empty input", async () => {
  await assert.rejects(() => reverseAudio(new Uint8Array()), { code: "GENERATOR_INPUT_INVALID" });
});
