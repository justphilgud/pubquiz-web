import { handleUpload } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import {
  getBlobUploadAuthentication,
  getMediaUploadPathnamePrefix,
  logMediaUploadFailure,
} from "@/app/fragen/editor/mediaUploadEnvironment";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const blobAuthentication = getBlobUploadAuthentication();
    const mediaPrefix = getMediaUploadPathnamePrefix("media");
    const jsonResponse = await handleUpload({
      body,
      request,
      ...blobAuthentication,
      onBeforeGenerateToken: async (pathname) => {
        const erlaubtePraefixe = [
          `${mediaPrefix}audio/intro/`,
          `${mediaPrefix}video/intro/`,
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
    logMediaUploadFailure("legacy-client-token", error);

    return NextResponse.json(
      { error: "Upload konnte nicht vorbereitet werden." },
      { status: 400 }
    );
  }
}
