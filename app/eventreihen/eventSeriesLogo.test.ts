import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import sharp from "sharp";
import { buildEventSeriesLogoPath, isAllowedEventSeriesLogoPath, isPublicLogoBlobUrl, validateEventSeriesLogoFile } from "./eventSeriesLogo";
import { verifyLogoImageBytes } from "./eventSeriesLogoImage";

test("logo uploads bind environment and series and reject unsafe paths/types/sizes", () => {
  const prefix = `preview/${"a".repeat(64)}` as const;
  const path = buildEventSeriesLogoPath(prefix, 12, "Mein Logo.png");
  assert.ok(isAllowedEventSeriesLogoPath(path, prefix, 12));
  assert.ok(!isAllowedEventSeriesLogoPath(path, "prod", 12));
  assert.ok(!isAllowedEventSeriesLogoPath(path, prefix, 13));
  for (const name of ["../a.png", "%2e%2e%2fa.png", "a.svg", "a.png/evil.png", "a.png?x"]) {
    assert.ok(!isAllowedEventSeriesLogoPath(`prod/event-series/12/logo/${name}`, "prod", 12));
  }
  assert.equal(validateEventSeriesLogoFile({ name: "a.png", type: "image/png", size: 5 * 1024 * 1024 }), null);
  for (const file of [{ name: "a.svg", type: "image/svg+xml", size: 10 }, { name: "a.png", type: "text/html", size: 10 }, { name: "a.png", type: "image/png", size: 0 }, { name: "a.png", type: "image/png", size: 5 * 1024 * 1024 + 1 }]) {
    assert.ok(validateEventSeriesLogoFile(file));
  }
  assert.ok(isPublicLogoBlobUrl("https://store.public.blob.vercel-storage.com/prod/a.png"));
  for (const url of ["http://store.public.blob.vercel-storage.com/a.png", "https://evil.example/a.png", "https://store.public.blob.vercel-storage.com.evil.example/a.png", "https://user@store.public.blob.vercel-storage.com/a.png"]) assert.ok(!isPublicLogoBlobUrl(url));
});

test("decoded logos preserve wide aspect and alpha; disguised non-images and SVG fail", async () => {
  const bytes = await sharp({ create: { width: 300, height: 100, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 0.5 } } }).png().toBuffer();
  const info = await verifyLogoImageBytes(bytes);
  assert.equal(info.width, 300); assert.equal(info.height, 100); assert.equal(info.hasAlpha, true);
  await assert.rejects(verifyLogoImageBytes(Buffer.from("not a PNG")));
  await assert.rejects(verifyLogoImageBytes(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>')));
});

test("logo persistence is additive, authorized, race-safe and does not delete shared blobs", () => {
  const migration = readFileSync("prisma/migrations/20261024090000_event_series_logo/migration.sql", "utf8");
  assert.match(migration, /ADD COLUMN "logo_url" VARCHAR\(2048\)/);
  assert.doesNotMatch(migration, /UPDATE|DELETE|DROP|NOT NULL/);
  const action = readFileSync("app/eventreihen/eventSeriesLogoActions.ts", "utf8");
  assert.match(action, /requireEventSeriesEditor\(id\)/);
  assert.match(action, /verifyEventSeriesLogo\(url, id\)/);
  assert.match(action, /logo_url: expectedUrl/);
  assert.doesNotMatch(action, /\bdel\(/);
  const route = readFileSync("app/api/question-media-upload/route.ts", "utf8");
  assert.match(route, /requireEventSeriesEditor\(context.eventSeriesId\)/);
  assert.match(route, /maximumSizeInBytes: eventSeriesLogoRule.maximumSizeInBytes/);
});

test("create and edit forms stage logos until save, preserving created IDs on upload failure", () => {
  const manager = readFileSync("app/admin/eventreihen/EventSeriesManager.tsx", "utf8");
  assert.match(manager, /<EventSeriesLogoField/);
  assert.match(manager, /logoDraft !== undefined/);
  assert.match(manager, /editingId \?\? result.eventSeriesId/);
  assert.ok(manager.indexOf("setEditingId(savedId)") < manager.indexOf("await uploadEventSeriesLogo"));
  assert.match(manager, /<fieldset disabled=\{saving\}/);
  assert.match(manager, /if \(!result.success\) return/);
  assert.match(manager, /setLogoUrl\(entry.logoUrl\)/);
  assert.match(manager, /setLogoUrl\(null\); setLogoDraft\(undefined\)/);
  const field = readFileSync("app/eventreihen/EventSeriesLogoField.tsx", "utf8");
  assert.doesNotMatch(field, /uploadPresigned|saveEventSeriesLogo/);
  assert.match(field, /validateEventSeriesLogoFile\(file\)/);
  assert.match(field, /reader.abort\(\)/);
  const detail = readFileSync("app/eventreihen/EventSeriesLogoEditor.tsx", "utf8");
  assert.match(detail, /uploadEventSeriesLogo\(file, id, environmentPrefix\)/);
});
