import { Readable } from "node:stream";
import { requireQuizAdmin, requireQuizViewer } from "@/app/quiz/quizAccess.server";
import { resolveParticipantSession } from "@/app/quiz/participantSession.server";
import { availableMemeRevisions, captureExistingMemes, deleteArchivedMeme, listMemeArchive, loadArchivedPng, processMemeArchive } from "@/app/quiz/memeArchive/archive.server";
import { scheduleMemeArchive } from "@/app/quiz/memeArchive/schedule.server";
import { zipPngs } from "@/app/quiz/memeArchive/files";

export const runtime = "nodejs";
export const maxDuration = 120;
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Vary": "Cookie, Authorization" };

async function access(request: Request, admin = false) {
  const url = new URL(request.url);
  const quizId = Number(url.searchParams.get("quizId"));
  if (!Number.isSafeInteger(quizId) || quizId <= 0) throw new Error("Ungültiges Quiz.");
  if (url.searchParams.get("team") === "1") {
    if (admin) throw new Error("Keine Berechtigung.");
    const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
    const session = await resolveParticipantSession(quizId, token);
    if (!session) throw new Error("Team-Sitzung ungültig. Bitte erneut beitreten.");
    return { url, quizId, sessionId: session.quiz_team_session_id };
  }
  if (admin) await requireQuizAdmin(quizId); else await requireQuizViewer(quizId);
  return { url, quizId, sessionId: undefined };
}
function entryId(url: URL) {
  const id = url.searchParams.get("id");
  if (!id || !/^[a-f0-9-]{36}$/.test(id)) throw new Error("Ungültige Archiv-ID.");
  return id;
}
export async function GET(request: Request) {
  try {
    const { url, quizId, sessionId } = await access(request);
    if (url.searchParams.has("id")) {
      const file = await loadArchivedPng(quizId, entryId(url), sessionId);
      return new Response(new Uint8Array(file.png), { headers: { ...headers, "Content-Type": "image/png",
        "Content-Disposition": `${url.searchParams.get("inline") === "1" ? "inline" : "attachment"}; filename="${file.filename}"` } });
    }
    if (url.searchParams.has("revision")) {
      if (sessionId !== undefined) throw new Error("Keine Berechtigung für ZIP-Export.");
      const revision = Number(url.searchParams.get("revision"));
      const selected = await listMemeArchive(quizId, undefined, revision);
      if (!Number.isSafeInteger(revision) || !selected.length) throw new Error("Dieser Durchlauf enthält keine Memes.");
      if (selected.some(item => item.status !== "READY")) throw new Error("Bitte zuerst ausstehende Bilder erstellen oder Fehler beheben.");
      const stream = Readable.toWeb(Readable.from(zipPngs(selected.map(item => ({ name: item.filename, load: async () => (await loadArchivedPng(quizId, item.id)).png })))));
      return new Response(stream as ReadableStream<Uint8Array>, { headers: { ...headers, "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="Quiz-${quizId}_Durchlauf-${revision + 1}.zip"` } });
    }
    const revisions = sessionId === undefined ? await availableMemeRevisions(quizId) : [];
    const selectedRevision = url.searchParams.has("listRevision") ? Number(url.searchParams.get("listRevision")) : revisions[0];
    if (selectedRevision !== undefined && (!Number.isSafeInteger(selectedRevision) || !revisions.includes(selectedRevision))) throw new Error("Unbekannter Durchlauf.");
    const items = await listMemeArchive(quizId, sessionId, selectedRevision);
    if (items.some(item => ["PENDING", "ERROR"].includes(item.status))) scheduleMemeArchive(quizId);
    return Response.json({ items, revisions }, { headers });
  } catch {
    return Response.json({ error: "Archiv nicht verfügbar. Bitte Anmeldung, Team-Sitzung und Bildstatus prüfen." }, { status: 403, headers });
  }
}
export async function POST(request: Request) {
  try {
    if (request.headers.get("origin") !== new URL(request.url).origin) throw new Error("Ungültiger Ursprung.");
    const body = await request.json() as { action?: string; confirmed?: boolean };
    const deleting = body.action === "delete";
    const capturing = body.action === "capture";
    const { url, quizId } = await access(request, deleting || capturing);
    if (deleting) {
      if (body.confirmed !== true) throw new Error("Löschen muss bestätigt werden.");
      await deleteArchivedMeme(quizId, entryId(url));
    } else if (capturing) {
      if (body.confirmed !== true) throw new Error("Sicherung muss bestätigt werden.");
      await captureExistingMemes(quizId);
    } else if (body.action === "retry") await processMemeArchive(quizId, 3, true);
    else throw new Error("Ungültige Aktion.");
    return Response.json({ ok: true }, { headers });
  } catch {
    return Response.json({ error: "Aktion fehlgeschlagen. Anmeldung und Bildstatus prüfen; anschließend erneut versuchen." }, { status: 400, headers });
  }
}
