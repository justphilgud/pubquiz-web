import { mkdir, readdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

async function getErlaubteZielordner() {
  const gruppen = ["bilder", "audio", "video"];
  const erlaubteOrdner: string[] = [];

  for (const gruppe of gruppen) {
    const basisPfad = path.join(process.cwd(), "public", "medien", gruppe);

    try {
      const eintraege = await readdir(basisPfad, { withFileTypes: true });

      for (const eintrag of eintraege) {
        if (eintrag.isDirectory()) {
          erlaubteOrdner.push(`${gruppe}/${eintrag.name}`);
        }
      }
    } catch {
      // Ordner existiert noch nicht
    }
  }

  return erlaubteOrdner;
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

    const erlaubteZielordner = await getErlaubteZielordner();

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

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const originalName = file.name
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9._-]/g, "");

    const fileName = `${Date.now()}-${originalName}`;

    const uploadDir = path.join(
      process.cwd(),
      "public",
      "medien",
      zielordner
    );

    await mkdir(uploadDir, { recursive: true });
    await writeFile(path.join(uploadDir, fileName), buffer);

    return NextResponse.json({
      success: true,
      datei: `${zielordner}/${fileName}`,
      message: "Datei wurde hochgeladen.",
    });
  } catch (error) {
    console.error("Upload fehlgeschlagen:", error);

    return NextResponse.json(
      { success: false, message: "Upload fehlgeschlagen." },
      { status: 500 }
    );
  }
}