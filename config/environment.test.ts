import assert from "node:assert/strict";
import test from "node:test";
import { EnvironmentConfigurationError, getDatabaseConnectionInfo, getLogicalEnvironment } from "./environment";

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
