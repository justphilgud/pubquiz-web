import { readdir } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

async function getUnterordner(ordner: string) {
  try {
    const basisPfad = path.join(process.cwd(), "public", "medien", ordner);
    const eintraege = await readdir(basisPfad, { withFileTypes: true });

    return eintraege
      .filter((eintrag) => eintrag.isDirectory())
      .map((eintrag) => eintrag.name)
      .sort();
  } catch {
    return [];
  }
}

export async function GET() {
  const [bilder, audio, video] = await Promise.all([
    getUnterordner("bilder"),
    getUnterordner("audio"),
    getUnterordner("video"),
  ]);

  return NextResponse.json({
    bilder,
    audio,
    video,
  });
}