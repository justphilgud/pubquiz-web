import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { renderArchivedMeme } from "./png";
import { sealPng, openPng, memeFilename, zipPngs } from "./files";
import { resolveMemeCaptionLayout } from "../memeCaptionZones";

test("real PNG: 4:3, black bands, white text, umlauts, empty bands, long text and free zones", async () => {
  const image = await sharp({ create: { width: 400, height: 200, channels: 3, background: "#3355cc" } }).png().toBuffer();
  for (const payload of [
    { topText: "ÄÖÜ – Grüße", bottomText: "Schöne Überraschung" },
    { topText: "", bottomText: "Nur unten" },
    { topText: "Nur oben", bottomText: "" },
    { topText: "Heute beginnt die überraschend lustige Quizrunde für alle Freunde", bottomText: "Alles richtig gemacht" },
  ]) {
    const png = await renderArchivedMeme(image, payload, null);
    const metadata = await sharp(png).metadata();
    assert.equal(metadata.width, 1200); assert.equal(metadata.height, 900); assert.equal(metadata.format, "png");
    const pixels = await sharp(png).removeAlpha().raw().toBuffer();
    assert.deepEqual([...pixels.subarray(0, 3)], [0, 0, 0]);
    assert.ok(pixels.some((value, index) => index % 3 === 0 && value > 245 && pixels[index + 1] > 245 && pixels[index + 2] > 245), "white caption pixels");
    const sealed = sealPng(png);
    assert.ok(!sealed.bytes.subarray(0, 8).equals(png.subarray(0, 8)));
    assert.deepEqual(openPng(sealed.bytes, sealed.key, sealed.sha256), png);
    assert.throws(() => openPng(sealed.bytes, Buffer.alloc(32), sealed.sha256));
    assert.throws(() => openPng(sealed.bytes, sealed.key, "wrong checksum"));
  }
  const layout = resolveMemeCaptionLayout({ version: 1, mode: "CUSTOM", zones: [
    { id: "zone", label: "Mitte", placement: "IMAGE", x: 10, y: 10, width: 80, height: 30, order: 1, maxLines: 2, required: true },
  ] });
  const custom = await renderArchivedMeme(image, { captions: { zone: "Ärger? Nein!" } }, layout);
  assert.equal((await sharp(custom).metadata()).width, 1200);
  await assert.rejects(renderArchivedMeme(image, { topText: "X".repeat(81), bottomText: "" }, null), /Ungültige/);
});

test("archive captions use real proportional glyphs, including without installed system fonts", async () => {
  const image = await sharp({ create: { width: 400, height: 200, channels: 3, background: "#3355cc" } }).png().toBuffer();
  const glyphWidth = async (text: string) => {
    const png = await renderArchivedMeme(image, { topText: text, bottomText: "" }, null);
    const { data, info } = await sharp(png).extract({ left: 0, top: 0, width: 1200, height: 189 }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    let left = info.width; let right = -1;
    for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
      const offset = (y * info.width + x) * info.channels;
      if (data[offset] > 230 && data[offset + 1] > 230 && data[offset + 2] > 230) {
        left = Math.min(left, x); right = Math.max(right, x);
      }
    }
    assert.ok(right >= left, "caption has visible white glyphs");
    return right - left + 1;
  };
  assert.ok(await glyphWidth("WWWWWWWW") > 2 * await glyphWidth("IIIIIIII"), "missing-font boxes must not pass as readable text");
});

test("ZIP contains exact PNG bytes, independent names, valid headers and CRC; bounds reject invalid exports", async () => {
  const png = await sharp({ create: { width: 10, height: 10, channels: 3, background: "black" } }).png().toBuffer();
  const name = memeFilename({ quizId: 1, revision: 2, sourceId: 3, teamName: "../Ä <script>/Team", id: "abc-def" });
  assert.match(name, /^Quiz-1_Durchlauf-3_Frage-3_[a-zA-Z0-9_-]+_abc-def\.png$/);
  const chunks: Uint8Array[] = [];
  for await (const chunk of zipPngs([{ name, load: async () => png }])) chunks.push(chunk);
  const zip = Buffer.concat(chunks);
  assert.equal(zip.readUInt32LE(0), 0x04034b50);
  assert.deepEqual(zip.subarray(30 + Buffer.byteLength(name), 30 + Buffer.byteLength(name) + png.length), png);
  assert.equal(zip.readUInt32LE(zip.length - 22), 0x06054b50);
  assert.equal(zip.readUInt16LE(zip.length - 12), 1);
  const crcFixture: Uint8Array[] = [];
  for await (const chunk of zipPngs([{ name: "known.png", load: async () => Buffer.from("123456789") }])) crcFixture.push(chunk);
  assert.equal(Buffer.concat(crcFixture).readUInt32LE(14), 0xcbf43926, "standard CRC-32 check vector");
  await assert.rejects(async () => { for await (const chunk of zipPngs([])) void chunk; });
  await assert.rejects(async () => { for await (const chunk of zipPngs([{ name: "../a.png", load: async () => png }])) void chunk; });
});
