import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  LOCAL_ENV_FILE,
  loadLocalEnvironment,
} from "./load-local-environment";

const managedTestVariables = [
  "DATABASE_URL",
  "AUTH_SECRET",
  "VERCEL",
  "CI",
] as const;

function preserveProcessState() {
  const cwd = process.cwd();
  const values = new Map(
    managedTestVariables.map((name) => [name, process.env[name]] as const),
  );

  return () => {
    process.chdir(cwd);
    for (const [name, value] of values) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  };
}

test("explicit process variables take precedence over the local env file", () => {
  const restore = preserveProcessState();
  const directory = mkdtempSync(join(tmpdir(), "pubquiz-env-"));

  try {
    writeFileSync(
      join(directory, LOCAL_ENV_FILE),
      [
        "DATABASE_URL=postgresql://file-user:file-pass@file.invalid/file-db",
        "AUTH_SECRET=from-local-file",
      ].join("\n"),
    );
    process.chdir(directory);
    delete process.env.VERCEL;
    delete process.env.CI;
    process.env.DATABASE_URL =
      "postgresql://shell-user:shell-pass@shell.invalid/shell-db";
    delete process.env.AUTH_SECRET;

    const result = loadLocalEnvironment({ required: true });

    assert.equal(result.loaded, true);
    assert.equal(
      process.env.DATABASE_URL,
      "postgresql://shell-user:shell-pass@shell.invalid/shell-db",
    );
    assert.equal(process.env.AUTH_SECRET, "from-local-file");
    assert.deepEqual(result.preservedVariables, ["DATABASE_URL"]);
  } finally {
    restore();
    rmSync(directory, { recursive: true, force: true });
  }
});

for (const platformVariable of ["VERCEL", "CI"] as const) {
  test(`${platformVariable} never loads the local env file`, () => {
    const restore = preserveProcessState();
    const directory = mkdtempSync(join(tmpdir(), "pubquiz-env-"));

    try {
      writeFileSync(
        join(directory, LOCAL_ENV_FILE),
        "DATABASE_URL=postgresql://file.invalid/file-db",
      );
      process.chdir(directory);
      delete process.env.VERCEL;
      delete process.env.CI;
      process.env[platformVariable] = "1";
      process.env.DATABASE_URL =
        "postgresql://platform.invalid/platform-db";

      const result = loadLocalEnvironment({ required: true });

      assert.equal(result.loaded, false);
      assert.equal(result.path, null);
      assert.equal(
        process.env.DATABASE_URL,
        "postgresql://platform.invalid/platform-db",
      );
    } finally {
      restore();
      rmSync(directory, { recursive: true, force: true });
    }
  });
}
