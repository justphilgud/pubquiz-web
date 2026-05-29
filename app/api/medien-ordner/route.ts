import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    bilder: [
      "unsortiert",
      "uploads",
      "facemorph",
      "flaggen",
      "kunst",
      "logo",
      "quiz_logo",
      "qr_codes",
      "wahrzeichen",
    ],
    audio: [
      "unsortiert",
      "uploads",
      "8bit",
      "intro",
      "reverse",
    ],
    video: [
      "unsortiert",
      "uploads",
      "intro",
      "preis",
    ],
  });
}