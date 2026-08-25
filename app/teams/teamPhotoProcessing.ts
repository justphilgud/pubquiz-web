import sharp from "sharp";

export const MAX_TEAM_PHOTO_UPLOAD_BYTES = 8 * 1024 * 1024;
export const ALLOWED_TEAM_PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function validateTeamPhotoFile(file: File) {
  if (!ALLOWED_TEAM_PHOTO_TYPES.has(file.type) || file.size <= 0 || file.size > MAX_TEAM_PHOTO_UPLOAD_BYTES) {
    throw new Error("Bitte ein JPG-, PNG- oder WebP-Bild bis 8 MB wählen.");
  }
}

export async function normalizeTeamPhoto(input: Buffer) {
  return sharp(input, { failOn: "error", limitInputPixels: 40_000_000, animated: false })
    .rotate()
    .resize(640, 640, { fit: "cover", position: "attention", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();
}
