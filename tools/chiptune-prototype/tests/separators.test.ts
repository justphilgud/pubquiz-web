import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createStemCacheKey, readStemCache, stemPaths, writeStemCacheManifest, type StemCacheConfiguration } from "../src/separators/cache";
import { buildDemucsArguments, controlledDemucsError, createDemucsSeparator } from "../src/separators/demucs";
import { getSeparator } from "../src/separators/registry";
import { mixStemSamples, resolveStemInput } from "../src/separators/stems";
import { PrototypeInputError } from "../src/io";
import type { PcmAudio } from "../src/types";
import { encodePcm16Wav } from "../src/wav";

const configuration: StemCacheConfiguration = { separatorVersion: "4.1.0", model: "htdemucs", parameters: { device: "cpu" } };

async function withDirectory(work: (directory: string) => Promise<void>) {
  const directory = await mkdtemp(join(tmpdir(), "pubquiz-separator-test-"));
  try { await work(directory); } finally { await rm(directory, { recursive: true, force: true }); }
}

test("separator registry exposes only the fixed Demucs implementation", () => {
  assert.equal(getSeparator("demucs").id, "demucs");
  assert.throws(() => getSeparator("none"), (error: unknown) => error instanceof PrototypeInputError && error.code === "SEPARATOR_INVALID");
});

test("cache keys are deterministic and include model parameters", () => {
  const key = createStemCacheKey("input-hash", configuration);
  assert.equal(key, createStemCacheKey("input-hash", configuration));
  assert.notEqual(key, createStemCacheKey("input-hash", { ...configuration, model: "other-model" }));
  assert.match(key, /^[a-f0-9]{64}$/);
});

test("cache reports miss, hit, and missing stem without accepting incomplete entries", async () => {
  await withDirectory(async (directory) => {
    const cacheKey = createStemCacheKey("fingerprint", configuration);
    assert.equal(await readStemCache(directory, cacheKey, configuration), null);
    const paths = stemPaths(directory);
    await Promise.all(Object.values(paths).map((path) => writeFile(path, Buffer.alloc(64, 1))));
    await writeStemCacheManifest(directory, {
      schemaVersion: 1, cacheKey, inputFingerprint: "fingerprint", configuration,
      metadata: { demucsVersion: "4.1.0", pythonVersion: "3.11.9", separationDurationMs: 10, peakRssBytes: 100, warnings: [] },
    });
    assert.ok(await readStemCache(directory, cacheKey, configuration));
    await rm(paths.vocals);
    assert.equal(await readStemCache(directory, cacheKey, configuration), null);
  });
});

test("vocals and other are mixed with fixed gains, mono channel normalization, common duration and clipping protection", () => {
  const vocals: PcmAudio = { sampleRate: 44_100, durationSeconds: 3 / 44_100, channels: [new Float32Array([1, 1, 1]), new Float32Array([1, -1, 1])] };
  const other: PcmAudio = { sampleRate: 44_100, durationSeconds: 2 / 44_100, channels: [new Float32Array([1, 1])] };
  const mixed = mixStemSamples(vocals, other);
  assert.equal(mixed.samples.length, 2);
  assert.ok(mixed.samples.every((sample) => Math.abs(sample) <= 0.920_001));
  assert.ok(mixed.samples[0] > mixed.samples[1]);
  assert.throws(() => mixStemSamples(vocals, { ...other, sampleRate: 22_050 }), (error: unknown) => error instanceof PrototypeInputError && error.code === "STEM_SAMPLE_RATE_MISMATCH");
});

test("empty selected stems fail with a controlled error", async () => {
  await withDirectory(async (directory) => {
    const paths = stemPaths(directory);
    await Promise.all(Object.values(paths).map((path) => writeFile(path, encodePcm16Wav(new Float32Array(100), 44_100))));
    const separation = {
      separator: "demucs" as const, model: "htdemucs", demucsVersion: "4.1.0", pythonVersion: "3.11.9",
      stems: paths, separationDurationMs: 1, invocationDurationMs: 1, peakRssBytes: 1, cacheKey: "x", cacheHit: false, warnings: [],
    };
    await assert.rejects(resolveStemInput("vocals", "original.wav", separation, directory), (error: unknown) => error instanceof PrototypeInputError && error.code === "STEM_EMPTY");
  });
});

test("Demucs process arguments remain discrete and exit failures are sanitized", () => {
  const args = buildDemucsArguments("song & calc.wav", "safe output", "models");
  assert.ok(args.includes("song & calc.wav"));
  assert.ok(args.includes("--model"));
  assert.equal(args[args.indexOf("--model") + 1], "htdemucs");
  assert.equal(controlledDemucsError(null, true).code, "DEMUCS_TIMEOUT");
  assert.equal(controlledDemucsError(5, false).code, "DEMUCS_OUT_OF_MEMORY");
  assert.doesNotMatch(controlledDemucsError(1, false).message, /Users|C:\\/);
});

test("missing isolated environment is reported before process start", async () => {
  await withDirectory(async (directory) => {
    const separator = createDemucsSeparator({ pythonPath: join(directory, "missing-python.exe"), modelsPath: join(directory, "missing-models"), cacheRoot: join(directory, "cache") });
    await assert.rejects(separator.separate(join(directory, "input.wav")), (error: unknown) => error instanceof PrototypeInputError && error.code === "DEMUCS_ENVIRONMENT_MISSING");
  });
});
