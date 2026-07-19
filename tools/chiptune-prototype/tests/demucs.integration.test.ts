import assert from "node:assert/strict";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createDemucsSeparator } from "../src/separators/demucs";
import { resolveStemInput } from "../src/separators/stems";
import { runPrototype } from "../src/pipeline";
import { decodePcm16Wav } from "../src/wav";
import { createSyntheticMelody } from "./testAudio";

test("real Demucs separation feeds a stem through Basic Pitch and the existing synthesizer", { skip: process.env.CHIPTUNE_RUN_DEMUCS_INTEGRATION !== "1" }, async () => {
  const pythonPath = join(process.cwd(), "tools", "chiptune-prototype", "python", "demucs", ".runtime", "python.exe");
  await access(pythonPath);
  const directory = await mkdtemp(join(tmpdir(), "pubquiz-demucs-integration-"));
  try {
    const input = join(directory, "synthetic.wav");
    const output = join(directory, "rendered.wav");
    await writeFile(input, createSyntheticMelody(3.2).wav);
    const separator = createDemucsSeparator({ cacheRoot: join(directory, "cache") });
    const separation = await separator.separate(input);
    assert.deepEqual(Object.keys(separation.stems).sort(), ["bass", "drums", "other", "vocals"]);
    const selected = await resolveStemInput("other", input, separation, directory);
    const result = await runPrototype({ input: selected, output, variant: "direct", transcriber: "basic-pitch" });
    const rendered = decodePcm16Wav(await readFile(output));
    assert.ok(rendered.channels[0].some((sample) => Math.abs(sample) > 0.01));
    assert.equal(result.report.transcriber, "basic-pitch");
    assert.ok(result.report.outputDurationSeconds >= 3);
    const cached = await separator.separate(input);
    assert.equal(cached.cacheHit, true);
    assert.ok(cached.invocationDurationMs < separation.invocationDurationMs);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
