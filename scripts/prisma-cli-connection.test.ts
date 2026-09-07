import assert from "node:assert/strict";
import test from "node:test";
import { resolvePrismaCliConnection } from "./prisma-cli-connection";

const pooled = "postgresql://test:example@ep-test-123-pooler.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require&schema=pubquiz";

test("Preview Prisma CLI uses the same Neon endpoint without the pooler", () => {
  const original = new URL(pooled);
  const resolved = new URL(resolvePrismaCliConnection(pooled, "preview"));
  assert.equal(resolved.hostname, "ep-test-123.c-3.eu-central-1.aws.neon.tech");
  resolved.hostname = original.hostname;
  assert.equal(resolved.toString(), original.toString());
});

test("Production, local and other providers retain their exact connection", () => {
  for (const environment of [undefined, "production", "development"]) {
    assert.equal(resolvePrismaCliConnection(pooled, environment), pooled);
  }
  const other = "postgresql://test:example@pooler.example.com/test";
  assert.equal(resolvePrismaCliConnection(other, "preview"), other);
  const direct = pooled.replace("-pooler.", ".");
  assert.equal(resolvePrismaCliConnection(direct, "preview"), direct);
});
