import assert from "node:assert/strict";
import { readdir, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { PrototypeInputError, TEMP_DIRECTORY_PREFIX, validatePaths, withTemporaryDirectory } from "../src/io";

test("streaming URLs and unsupported formats are rejected with controlled messages", async () => {
  await assert.rejects(validatePaths("https://example.test/song.mp3", join(tmpdir(), "output.wav")), (error: unknown) => {
    assert.ok(error instanceof PrototypeInputError);
    assert.equal(error.code, "INPUT_URL_FORBIDDEN");
    assert.doesNotMatch(error.message, /C:\\|Users|https:\/\//);
    return true;
  });
  await assert.rejects(validatePaths(join(tmpdir(), "song.exe"), join(tmpdir(), "output.wav")), (error: unknown) => error instanceof PrototypeInputError && error.code === "INPUT_FORMAT_UNSUPPORTED");
});

test("temporary directories are removed after success and failure", async () => {
  const before = new Set((await readdir(tmpdir())).filter((entry) => entry.startsWith(TEMP_DIRECTORY_PREFIX)));
  await withTemporaryDirectory(async (directory) => {
    await writeFile(join(directory, "work.txt"), "test");
    assert.equal((await stat(directory)).isDirectory(), true);
  });
  await assert.rejects(withTemporaryDirectory(async () => {
    throw new Error("expected");
  }));
  const after = (await readdir(tmpdir())).filter((entry) => entry.startsWith(TEMP_DIRECTORY_PREFIX) && !before.has(entry));
  assert.deepEqual(after, []);
});
