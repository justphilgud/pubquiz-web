import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const service = readFileSync("app/admin/artwork-canon-import/service.server.ts", "utf8");
const route = readFileSync("app/api/admin/artwork-canon-import/route.ts", "utf8");

test("import adapter is admin-only and fail-closed to preview", () => {
  assert.match(route, /canManageEverything/);
  assert.match(service, /process\.env\.VERCEL_ENV !== "preview"/);
  assert.match(service, /getLogicalEnvironment\(\) !== "preview"/);
  assert.match(service, /environmentPrefix !== "preview"/);
  assert.doesNotMatch(service, /"prod"\s*,\s*"QUESTION"/);
});

test("import is resumable by QID and preserves the Mona Lisa reference", () => {
  assert.match(service, /ARTWORK_CANON_V1;QID=/);
  assert.match(service, /work\.status === "neu"/);
  assert.match(service, /Mona Lisa/);
  assert.match(service, /reference\.created_by_user_id/);
  assert.match(service, /allowOverwrite: true/);
});

test("media is verified before and after upload", () => {
  assert.match(service, /SOURCE_METADATA_MISMATCH/);
  assert.match(service, /SOURCE_HASH_MISMATCH/);
  assert.match(service, /OUTPUT_MANIFEST_MISMATCH/);
  assert.match(service, /READBACK_HASH_MISMATCH/);
  assert.match(service, /sharp\(readbackBytes/);
});

test("legacy cleanup can only target the two inventoried preview E2E questions", () => {
  assert.match(service, /questionId: 109, artist: "Vincent van Gogh", title: "Sternennacht"/);
  assert.match(service, /questionId: 110, artist: "Edvard Munch", title: "Der Schrei"/);
  assert.match(service, /ARTWORK_IMPORT_LEGACY_SET_MISMATCH/);
});
