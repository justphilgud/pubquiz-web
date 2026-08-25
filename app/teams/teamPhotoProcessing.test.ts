import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { normalizeTeamPhoto } from "./teamPhotoProcessing";

test("team photos are normalized to a small square webp without carrying source metadata", async () => {
  const source = await sharp({ create: { width: 1200, height: 700, channels: 3, background: "#b45309" } })
    .withMetadata({ orientation: 6 })
    .jpeg()
    .toBuffer();
  const output = await normalizeTeamPhoto(source);
  const metadata = await sharp(output).metadata();
  assert.equal(metadata.format, "webp");
  assert.equal(metadata.width, 640);
  assert.equal(metadata.height, 640);
  assert.equal(metadata.exif, undefined);
  assert.equal(metadata.comments, undefined);
});
