import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { pixelateImageStages } from "./imagePixelate";

async function uniqueColors(bytes: Buffer) {
  const raw = await sharp(bytes).raw().toBuffer({ resolveWithObject: true });
  const colors = new Set<string>();
  for (let index = 0; index < raw.data.length; index += raw.info.channels) {
    colors.add(raw.data.subarray(index, index + raw.info.channels).toString("hex"));
  }
  return colors.size;
}

test("pixel processor creates three ordered, distinct PNG stages with alpha and equal dimensions", async () => {
  const width = 320;
  const height = 180;
  const pixels = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    const offset = (y * width + x) * 4;
    pixels[offset] = x % 256; pixels[offset + 1] = y % 256;
    pixels[offset + 2] = (x + y) % 256; pixels[offset + 3] = x < width / 2 ? 96 : 255;
  }
  const input = await sharp(pixels, { raw: { width, height, channels: 4 } }).png().toBuffer();
  const unchanged = Buffer.from(input);
  const outputs = await pixelateImageStages(input);
  assert.deepEqual(input, unchanged);
  assert.deepEqual(outputs.map((output) => output.slotKey), ["pixel_stage_3_image", "pixel_stage_2_image", "pixel_stage_1_image"]);
  assert.equal(outputs.every((output) => output.contentType === "image/png" && output.width === width && output.height === height), true);
  assert.equal(new Set(outputs.map((output) => output.bytes.toString("base64"))).size, 3);
  const colors = await Promise.all(outputs.map((output) => uniqueColors(output.bytes)));
  assert.ok(colors[0] < colors[1] && colors[1] < colors[2], `expected increasing detail, got ${colors.join("/")}`);
  const stage3 = await sharp(outputs[0].bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.ok(stage3.data[3] < 255);
  const at = (x: number, y: number) => stage3.data.subarray((y * width + x) * 4, (y * width + x) * 4 + 4);
  assert.deepEqual(at(8, 8), at(10, 8));
});

test("all stages apply EXIF orientation and keep identical aspect ratio", async () => {
  const input = await sharp({ create: { width: 40, height: 20, channels: 3, background: "#336699" } })
    .jpeg().withMetadata({ orientation: 6 }).toBuffer();
  const outputs = await pixelateImageStages(input);
  assert.equal(outputs.every((output) => output.width === 20 && output.height === 40), true);
});

test("three-stage pixelation supports JPEG and WebP and rejects invalid input", async () => {
  const source = sharp({ create: { width: 32, height: 24, channels: 3, background: "#cc8844" } });
  const jpeg = await pixelateImageStages(await source.clone().jpeg().toBuffer());
  const webp = await pixelateImageStages(await source.clone().webp().toBuffer());
  assert.equal(jpeg.length, 3); assert.equal(webp.length, 3);
  assert.equal(jpeg.every((output) => output.contentType === "image/jpeg"), true);
  assert.equal(webp.every((output) => output.contentType === "image/webp"), true);
  await assert.rejects(() => pixelateImageStages(new Uint8Array()), { code: "GENERATOR_INPUT_INVALID" });
  await assert.rejects(() => pixelateImageStages(new Uint8Array(10 * 1024 * 1024 + 1)), { code: "GENERATOR_INPUT_INVALID" });
  await assert.rejects(() => pixelateImageStages(Buffer.from("not-an-image")), { code: "GENERATOR_PROCESSING_FAILED" });
});
