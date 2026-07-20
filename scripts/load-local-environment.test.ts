import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  LOCAL_ENV_FILE,
  loadLocalEnvironment,
} from "./load-local-environment";

const relevantProcessVariables = [
  "DATABASE_URL",
  "AUTH_SECRET",
  "NEXTAUTH_SECRET",
  "AUTH_TRUST_HOST",
  "AUTH_URL",
  "NEXTAUTH_URL",
  "NEXT_PUBLIC_APP_ENV",
  "MEDIA_UPLOAD_ENV",
  "BLOB_READ_WRITE_TOKEN",
  "BLOB_WEBHOOK_PUBLIC_KEY",
  "VERCEL_BLOB_CALLBACK_URL",
  "PRODUCTION_DATABASE_HOST",
  "VERCEL",
  "CI",
] as const;

function preserveProcessState() {
  const cwd = process.cwd();
  const values = new Map(
    relevantProcessVariables.map((name) => [name, process.env[name]] as const),
  );

  for (const name of relevantProcessVariables) {
    delete process.env[name];
  }

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
    process.env.DATABASE_URL =
      "postgresql://shell-user:shell-pass@shell.invalid/shell-db";

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

test("multiple explicit process variables take precedence over the local env file", () => {
  const restore = preserveProcessState();
  const directory = mkdtempSync(join(tmpdir(), "pubquiz-env-"));

  try {
    writeFileSync(
      join(directory, LOCAL_ENV_FILE),
      [
        "DATABASE_URL=postgresql://file-user:file-pass@file.invalid/file-db",
        "BLOB_READ_WRITE_TOKEN=from-local-file",
      ].join("\n"),
    );
    process.chdir(directory);
    process.env.DATABASE_URL =
      "postgresql://shell-user:shell-pass@shell.invalid/shell-db";
    process.env.BLOB_READ_WRITE_TOKEN = "from-process";

    const result = loadLocalEnvironment({ required: true });

    assert.equal(result.loaded, true);
    assert.equal(
      process.env.DATABASE_URL,
      "postgresql://shell-user:shell-pass@shell.invalid/shell-db",
    );
    assert.equal(process.env.BLOB_READ_WRITE_TOKEN, "from-process");
    assert.deepEqual(result.preservedVariables, [
      "DATABASE_URL",
      "BLOB_READ_WRITE_TOKEN",
    ]);
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
