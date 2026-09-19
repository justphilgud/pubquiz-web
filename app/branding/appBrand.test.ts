import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { APP_BRAND } from "./appBrand";

function pngMetadata(path: string) {
  const png = readFileSync(path);
  assert.equal(png.subarray(1, 4).toString("ascii"), "PNG", path);
  return {
    width: png.readUInt32BE(16),
    height: png.readUInt32BE(20),
    colorType: png.readUInt8(25),
  };
}

function relativeLuminance(hex: string) {
  const channels = hex.match(/[\da-f]{2}/gi)?.map((channel) => {
    const value = Number.parseInt(channel, 16) / 255;
    return value <= 0.03928
      ? value / 12.92
      : ((value + 0.055) / 1.055) ** 2.4;
  });
  assert.equal(channels?.length, 3, hex);
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(first: string, second: string) {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  return (
    (Math.max(firstLuminance, secondLuminance) + 0.05) /
    (Math.min(firstLuminance, secondLuminance) + 0.05)
  );
}

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

test("the app brand exposes colors sampled from the supplied logo assets", () => {
  assert.deepEqual(APP_BRAND.colors, {
    yellow: "#F0FC15",
    pink: "#FDC1E1",
    darkSurface: "#000000",
  });
  assert.ok(contrastRatio(APP_BRAND.colors.yellow, APP_BRAND.colors.darkSurface) >= 7);
  assert.ok(contrastRatio(APP_BRAND.colors.pink, APP_BRAND.colors.darkSurface) >= 7);
});

test("the app icons preserve transparency at browser and mobile sizes", () => {
  assert.deepEqual(pngMetadata("app/icon.png"), {
    width: 64,
    height: 64,
    colorType: 6,
  });
  assert.deepEqual(pngMetadata("app/apple-icon.png"), {
    width: 180,
    height: 180,
    colorType: 6,
  });
});

test("the branded login keeps its styling scoped to the auth card", () => {
  const authCard = readFileSync("components/ui/AuthCard.tsx", "utf8");
  const loginPage = readFileSync("app/login/page.tsx", "utf8");

  assert.match(loginPage, /appearance="brand"/);
  assert.match(authCard, /APP_BRAND\.colors\.yellow/);
  assert.match(authCard, /var\(--app-brand-yellow\)/);
  assert.match(authCard, /button\[type=submit\]/);
  assert.doesNotMatch(authCard, /blue-/);
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
