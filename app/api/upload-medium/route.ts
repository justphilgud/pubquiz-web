import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import {
  buildMediaUploadPathname,
  getBlobUploadAuthentication,
  logMediaUploadFailure,
} from "@/app/fragen/editor/mediaUploadEnvironment";

const erlaubteZielordner = [
  "bilder/unsortiert",
  "bilder/uploads",
  "bilder/facemorph",
  "bilder/flaggen",
  "bilder/kunst",
  "bilder/logo",
  "bilder/quiz_logo",
  "bilder/qr_codes",
  "bilder/wahrzeichen",
  "audio/unsortiert",
  "audio/uploads",
  "audio/8bit",
  "audio/intro",
  "audio/reverse",
  "video/unsortiert",
  "video/uploads",
  "video/intro",
  "video/preis",
];

function bereinigeDateiname(dateiname: string) {
  return dateiname
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9._-]/g, "");
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const zielordnerRaw = formData.get("zielordner");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { success: false, message: "Keine Datei empfangen." },
        { status: 400 }
      );
    }

    const zielordner =
      typeof zielordnerRaw === "string" &&
      erlaubteZielordner.includes(zielordnerRaw)
        ? zielordnerRaw
        : null;

    if (!zielordner) {
      return NextResponse.json(
        { success: false, message: "Ungültiger Zielordner." },
        { status: 400 }
      );
    }

    const originalName = bereinigeDateiname(file.name);
    const fileName = `${Date.now()}-${originalName}`;
    const blobPfad = buildMediaUploadPathname("media", [
      ...zielordner.split("/"),
      fileName,
    ]);
    const blobAuthentication = getBlobUploadAuthentication();

    const blob = await put(blobPfad, file, {
      ...blobAuthentication,
      access: "public",
      addRandomSuffix: false,
    });

    return NextResponse.json({
      success: true,
      datei: blob.url,
      message: "Datei wurde hochgeladen.",
    });
  } catch (error) {
    logMediaUploadFailure("legacy-server-upload", error);

    return NextResponse.json(
      { success: false, message: "Upload fehlgeschlagen." },
      { status: 500 }
    );
  }
}
