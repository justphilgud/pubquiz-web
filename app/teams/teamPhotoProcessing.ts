import sharp from "sharp";
import { validateTeamPhotoUpload } from "./teamPhotoUpload";

export function validateTeamPhotoFile(file: File) {
  validateTeamPhotoUpload(file);
}

export async function normalizeTeamPhoto(input: Buffer) {
  return sharp(input, { failOn: "error", limitInputPixels: 40_000_000, animated: false })
    .rotate()
    .resize(640, 640, { fit: "cover", position: "attention", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();
}
