import { readFile } from "node:fs/promises";
import path from "node:path";
import { auth } from "@/auth";

const allowedScreenshots = new Set([
  "content-overview-eventmanager.jpg",
  "quiz-mixed-content-eventmanager.jpg",
  "live-drafts-moderation-eventmanager.jpg",
  "team-avatar-picker.jpg",
]);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const session = await auth();
  if (!session?.user) return new Response("Nicht angemeldet.", { status: 401 });

  const { name } = await params;
  if (!allowedScreenshots.has(name)) return new Response("Nicht gefunden.", { status: 404 });

  const image = await readFile(
    path.join(process.cwd(), "docs", "user-guide", "screenshots", name),
  );
  return new Response(image, {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
