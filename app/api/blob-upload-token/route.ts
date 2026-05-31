import { handleUpload } from "@vercel/blob/client";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json();

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const erlaubtePraefixe = [
          "medien/audio/intro/",
          "medien/video/intro/",
        ];

        const istErlaubt = erlaubtePraefixe.some((prefix) =>
          pathname.startsWith(prefix)
        );

        if (!istErlaubt) {
          throw new Error("Ungültiger Upload-Pfad.");
        }

        return {
          allowedContentTypes: [
            "audio/mpeg",
            "audio/mp3",
            "video/mp4",
            "video/webm",
            "video/quicktime",
          ],
          maximumSizeInBytes: 100 * 1024 * 1024,
        };
      },
      onUploadCompleted: async () => {
        // URL wird im Client ins Formular geschrieben und danach in Neon gespeichert.
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    console.error("Blob Upload Token Fehler:", error);

    return NextResponse.json(
      { error: "Upload konnte nicht vorbereitet werden." },
      { status: 400 }
    );
  }
}