import assert from "node:assert/strict";
import test from "node:test";
import { EnvironmentConfigurationError, getDatabaseConnectionInfo } from "./environment";

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
