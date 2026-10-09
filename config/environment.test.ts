import assert from "node:assert/strict";
import test from "node:test";
import { EnvironmentConfigurationError, getDatabaseConnectionInfo, getLogicalEnvironment, getBlobEnvironmentPrefix, getBlobReadWriteToken } from "./environment";

test("database connection summary contains no credentials", () => {
  const secretUrl = "postgresql://secret-user:secret-password@ep-dev-pooler.example.neon.tech/neondb?schema=pubquiz";
  const summary = getDatabaseConnectionInfo(secretUrl);
  assert.deepEqual(summary, { host: "ep-dev-pooler.example.neon.tech", database: "neondb", schema: "pubquiz" });
  assert.equal(JSON.stringify(summary).includes("secret-password"), false);
  assert.equal(JSON.stringify(summary).includes("secret-user"), false);
});

test("invalid database URLs fail with a structured configuration error", () => {
  assert.throws(() => getDatabaseConnectionInfo("not-a-url"), (error) => error instanceof EnvironmentConfigurationError && error.code === "DATABASE_URL_INVALID");
});

test("explicit media environment cannot contradict the Vercel runtime", () => {
  const originalMediaEnvironment = process.env.MEDIA_UPLOAD_ENV;
  const originalVercelEnvironment = process.env.VERCEL_ENV;
  try {
    process.env.MEDIA_UPLOAD_ENV = "development";
    process.env.VERCEL_ENV = "preview";
    assert.throws(
      () => getLogicalEnvironment(),
      (error) =>
        error instanceof EnvironmentConfigurationError &&
        error.code === "MEDIA_UPLOAD_ENV_MISMATCH",
    );
    process.env.MEDIA_UPLOAD_ENV = "preview";
    assert.equal(getLogicalEnvironment(), "preview");
  } finally {
    if (originalMediaEnvironment === undefined) delete process.env.MEDIA_UPLOAD_ENV;
    else process.env.MEDIA_UPLOAD_ENV = originalMediaEnvironment;
    if (originalVercelEnvironment === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = originalVercelEnvironment;
  }
});


test("Vercel Preview media fails closed and uses stable branch namespaces", () => {
  const keys = ["VERCEL_ENV", "VERCEL_GIT_COMMIT_REF", "MEDIA_UPLOAD_ENV", "MEDIA_UPLOAD_STORE_ENV", "BLOB_STORE_ID", "BLOB_READ_WRITE_TOKEN"];
  const original = new Map(keys.map((key) => [key, process.env[key]]));
  try {
    process.env.VERCEL_ENV = "preview";
    process.env.MEDIA_UPLOAD_ENV = "preview";
    process.env.MEDIA_UPLOAD_STORE_ENV = "nonproduction";
    process.env.BLOB_STORE_ID = "store_VzfNwjccgkzhc9bi";
    process.env.BLOB_READ_WRITE_TOKEN = "vercel_blob_rw_VzfNwjccgkzhc9bi_dummy_only";
    process.env.VERCEL_GIT_COMMIT_REF = "codex/branch-a";
    const prefixA = getBlobEnvironmentPrefix();
    assert.match(prefixA, /^preview\/[a-f0-9]{64}$/);
    assert.equal(getBlobEnvironmentPrefix(), prefixA);
    assert.doesNotThrow(() => getBlobReadWriteToken());
    delete process.env.BLOB_READ_WRITE_TOKEN;
    assert.throws(() => getBlobReadWriteToken(), (e) => e instanceof EnvironmentConfigurationError && e.code === "BLOB_READ_WRITE_TOKEN_MISSING");
    process.env.BLOB_READ_WRITE_TOKEN = "vercel_blob_rw_VzfNwjccgkzhc9bi_dummy_only";
    delete process.env.MEDIA_UPLOAD_STORE_ENV;
    assert.throws(() => getBlobReadWriteToken(), (e) => e instanceof EnvironmentConfigurationError && e.code === "PREVIEW_MEDIA_STORE_MISMATCH");
    process.env.MEDIA_UPLOAD_STORE_ENV = "nonproduction";
    process.env.VERCEL_GIT_COMMIT_REF = "codex-branch-a";
    assert.notEqual(getBlobEnvironmentPrefix(), prefixA);
    delete process.env.VERCEL_GIT_COMMIT_REF;
    assert.throws(() => getBlobEnvironmentPrefix(), (e) => e instanceof EnvironmentConfigurationError && e.code === "PREVIEW_MEDIA_BRANCH_MISSING");
    process.env.VERCEL_GIT_COMMIT_REF = "codex/branch-a";
    process.env.BLOB_READ_WRITE_TOKEN = "vercel_blob_rw_bIx6H2j23vJzi240_dummy_only";
    assert.throws(() => getBlobReadWriteToken(), (e) => e instanceof EnvironmentConfigurationError && e.code === "PREVIEW_MEDIA_CREDENTIAL_MISMATCH");
    process.env.BLOB_STORE_ID = "store_bIx6H2j23vJzi240";
    assert.throws(() => getBlobReadWriteToken(), (e) => e instanceof EnvironmentConfigurationError && e.code === "PREVIEW_MEDIA_STORE_MISMATCH");
    process.env.VERCEL_ENV = "production";
    process.env.MEDIA_UPLOAD_ENV = "production";
    assert.equal(getBlobEnvironmentPrefix(), "prod");
    process.env.VERCEL_ENV = "development";
    process.env.MEDIA_UPLOAD_ENV = "development";
    assert.equal(getBlobEnvironmentPrefix(), "dev");
  } finally {
    for (const [key, value] of original) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});
