import assert from "node:assert/strict";
import test from "node:test";
import { parseCliArguments } from "../src/cli";
import { PrototypeInputError } from "../src/io";

test("CLI accepts fixed transcriber, separator and stem values while treating shell characters as path text", () => {
  assert.deepEqual(parseCliArguments(["--input", "song & echo owned.wav", "--output", "result.wav", "--variant", "direct", "--transcriber", "basic-pitch", "--separator", "demucs", "--stem", "vocals", "--debug"]), {
    input: "song & echo owned.wav",
    output: "result.wav",
    variant: "direct",
    transcriber: "basic-pitch",
    separator: "demucs",
    stem: "vocals",
    compare: false,
    compareStems: false,
    debug: true,
  });
  assert.throws(() => parseCliArguments(["--input", "song.wav", "--output", "result.wav", "--variant", "nes"]), (error: unknown) => error instanceof PrototypeInputError && error.code === "VARIANT_INVALID");
  assert.throws(() => parseCliArguments(["--input", "song.wav", "--output", "result.wav", "--exec", "calc"]), (error: unknown) => error instanceof PrototypeInputError && error.code === "ARGUMENT_UNKNOWN");
  assert.throws(() => parseCliArguments(["--input", "song.wav", "--output", "result.wav", "--transcriber", "midi"]), (error: unknown) => error instanceof PrototypeInputError && error.code === "TRANSCRIBER_INVALID");
  assert.throws(() => parseCliArguments(["--input", "song.wav", "--output", "result.wav", "--stem", "vocals"]), (error: unknown) => error instanceof PrototypeInputError && error.code === "STEM_SEPARATOR_REQUIRED");
  assert.throws(() => parseCliArguments(["--input", "song.wav", "--output", "result.wav", "--separator", "demucs", "--compare-stems"]), (error: unknown) => error instanceof PrototypeInputError && error.code === "STEM_COMPARE_TRANSCRIBER_REQUIRED");
  assert.deepEqual(parseCliArguments(["--input", "song.wav", "--output", "result.wav", "--separator", "demucs", "--transcriber", "basic-pitch", "--compare-stems"]).compareStems, true);
});
