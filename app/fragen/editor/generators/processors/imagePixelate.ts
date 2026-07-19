import sharp from "sharp";
import {
  MAX_PIXEL_OUTPUT_EDGE,
  PIXEL_STAGE_CONFIG,
} from "../pixelConfiguration";
import type { MediaSlotKey } from "../../types";
import { GeneratorProcessorError } from "./errors";

const MAX_INPUT_BYTES = 10 * 1024 * 1024;
const MAX_INPUT_PIXELS = 40_000_000;

export type PixelStageOutput = {
  slotKey: MediaSlotKey;
  bytes: Buffer;
  contentType: "image/jpeg" | "image/png" | "image/webp";
  fileExtension: "jpg" | "png" | "webp";
  width: number;
  height: number;
};

export async function pixelateImageStages(input: Uint8Array): Promise<PixelStageOutput[]> {
  if (input.byteLength === 0 || input.byteLength > MAX_INPUT_BYTES) {
    throw new GeneratorProcessorError("GENERATOR_INPUT_INVALID", "Bildeingabe ist leer oder zu groß.");
  }
  try {
    const source = sharp(input, { failOn: "error", limitInputPixels: MAX_INPUT_PIXELS, animated: false });
    const metadata = await source.metadata();
    if (!metadata.width || !metadata.height || !metadata.format || (metadata.pages ?? 1) > 1) {
      throw new GeneratorProcessorError("GENERATOR_UNSUPPORTED_FORMAT", "Bildformat oder Bildabmessungen werden nicht unterstützt.");
    }
    if (!(["jpeg", "png", "webp"] as const).includes(metadata.format as "jpeg" | "png" | "webp")) {
      throw new GeneratorProcessorError("GENERATOR_UNSUPPORTED_FORMAT", "Nur JPEG, PNG und WebP werden unterstützt.");
    }

    const oriented = await source.autoOrient().toBuffer({ resolveWithObject: true });
    const sourceLongEdge = Math.max(oriented.info.width, oriented.info.height);
    const outputScale = Math.min(1, MAX_PIXEL_OUTPUT_EDGE / sourceLongEdge);
    const width = Math.max(1, Math.round(oriented.info.width * outputScale));
    const height = Math.max(1, Math.round(oriented.info.height * outputScale));

    return await Promise.all(PIXEL_STAGE_CONFIG.map(async (stage): Promise<PixelStageOutput> => {
      const targetLongEdge = Math.min(stage.targetLongEdge, Math.max(width, height));
      const pixelScale = targetLongEdge / Math.max(width, height);
      const pixelWidth = Math.max(1, Math.round(width * pixelScale));
      const pixelHeight = Math.max(1, Math.round(height * pixelScale));
      const reduced = await sharp(oriented.data)
        .resize({ width: pixelWidth, height: pixelHeight, fit: "fill", kernel: sharp.kernel.nearest })
        .toBuffer();
      let output = sharp(reduced).resize({ width, height, fit: "fill", kernel: sharp.kernel.nearest });
      let contentType: PixelStageOutput["contentType"];
      let fileExtension: PixelStageOutput["fileExtension"];
      if (metadata.format === "jpeg") {
        output = output.jpeg({ quality: 86, chromaSubsampling: "4:4:4" });
        contentType = "image/jpeg";
        fileExtension = "jpg";
      } else if (metadata.format === "png") {
        output = output.png({ compressionLevel: 9 });
        contentType = "image/png";
        fileExtension = "png";
      } else {
        output = output.webp({ quality: 86 });
        contentType = "image/webp";
        fileExtension = "webp";
      }
      return { slotKey: stage.slotKey, bytes: await output.toBuffer(), contentType, fileExtension, width, height };
    }));
  } catch (error) {
    if (error instanceof GeneratorProcessorError) throw error;
    throw new GeneratorProcessorError("GENERATOR_PROCESSING_FAILED", error instanceof Error ? error.message : "Bildverarbeitung fehlgeschlagen.");
  }
}
