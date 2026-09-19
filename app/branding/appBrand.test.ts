import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { APP_BRAND } from "./appBrand";

function sourceFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(?:css|ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

test("the app brand exposes dedicated public assets", () => {
  assert.equal(APP_BRAND.name, "Phil Gud Entertainment");
  assert.equal(APP_BRAND.assets.fullLogo, "/branding/phil-gud/phil-gud-entertainment.png");
  assert.equal(APP_BRAND.assets.mark, "/branding/phil-gud/gudi.png");
  assert.ok(existsSync(`public${APP_BRAND.assets.fullLogo}`));
  assert.ok(existsSync(`public${APP_BRAND.assets.mark}`));
});

test("app branding stays outside presentation runtime sources", () => {
  const presentationRoots = [
    "app/rendering",
    "app/quiz/[quizId]/praesentation",
    "app/quiz/[quizId]/show",
  ];

  for (const path of presentationRoots.flatMap(sourceFiles)) {
    const source = readFileSync(path, "utf8");
    assert.doesNotMatch(source, /Phil Gud|branding\/phil-gud/i, path);
  }
});
