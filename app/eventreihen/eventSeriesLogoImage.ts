import sharp from "sharp";
import { eventSeriesLogoRule } from "./eventSeriesLogo";

export async function verifyLogoImageBytes(bytes: Uint8Array) {
  if (!bytes.byteLength || bytes.byteLength > eventSeriesLogoRule.maximumSizeInBytes) throw new Error("Ungültige Logogröße.");
  const image = sharp(bytes, { limitInputPixels: 40_000_000 });
  const info = await image.metadata();
  if (!info.width || !info.height || !["png", "jpeg", "webp"].includes(info.format ?? "")) {
    throw new Error("Bitte ein gültiges PNG-, JPEG- oder WebP-Bild verwenden.");
  }
  // Decode pixels as well: a valid header alone does not prove the file is intact.
  await image.stats();
  return info;
}
