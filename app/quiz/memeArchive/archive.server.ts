import "server-only";
import { readFile, realpath, stat } from "node:fs/promises";
import { resolve, sep } from "node:path";
import sharp from "sharp";
import { del, put } from "@vercel/blob";
import { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/app/lib/prisma";
import { lockQuizLifecycle } from "../quizLifecycle.server";
import { buildMediaUploadPathname, getMediaVerificationServerConfig } from "@/app/fragen/editor/mediaUploadEnvironment";
import { renderArchivedMeme } from "./png";
import { memeFilename, openPng, sealPng } from "./files";
import { parseMemeCaptionPayload } from "../memeCaption";
import { resolveMemeCaptionLayout } from "../memeCaptionZones";
import { isMemeCaptionPayloadReadable } from "../memeCaptionLayout";

const MAX_BYTES = 12_000_000;
async function boundedBlobFetch(url: string) {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.port ||
      !/^[a-z0-9-]+\.public\.blob\.vercel-storage\.com$/.test(parsed.hostname)) throw new Error("Nicht unterstützte Medienquelle.");
  const response = await fetch(parsed, { redirect: "error", cache: "no-store", signal: AbortSignal.timeout(8_000) });
  if (!response.ok || Number(response.headers.get("content-length") ?? 0) > MAX_BYTES || !response.body) throw new Error("Archivdatei nicht verfügbar.");
  const parts: Uint8Array[] = []; let size = 0;
  const reader = response.body.getReader();
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.length;
      if (size > MAX_BYTES) { await reader.cancel(); throw new Error("Bilddatei ist zu groß."); }
      parts.push(part.value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(parts);
}

async function loadSourceImage(url: string) {
  let bytes: Buffer;
  if (url.startsWith("/medien/") || (!url.includes(":") && !url.startsWith("/"))) {
    const root = await realpath(resolve("public/medien"));
    const path = await realpath(resolve(root, decodeURIComponent(url.replace(/^\/medien\//, ""))));
    if (!path.startsWith(root + sep)) throw new Error("Ungültiger Medienpfad.");
    if ((await stat(path)).size > MAX_BYTES) throw new Error("Bilddatei ist zu groß.");
    bytes = await readFile(path);
    if (bytes.length > MAX_BYTES) throw new Error("Bilddatei ist zu groß.");
  } else bytes = await boundedBlobFetch(url);
  const normalized = await sharp(bytes, { limitInputPixels: 40_000_000 }).autoOrient().resize(1200, 1200, { fit: "inside", withoutEnlargement: true }).png().toBuffer();
  if (normalized.length > MAX_BYTES) throw new Error("Bilddatei ist zu groß.");
  return normalized;
}

/** Durable outbox; all operations on one quiz share its lifecycle lock. */
export async function processMemeArchive(quizId: number, maximum = 3, retry = false) {
  const candidates = await prisma.meme_archive_entries.findMany({
    where: { source: { quiz_id: quizId }, OR: [{ status: "PENDING" }, { status: "ERROR", ...(retry ? {} : { attempts: { lt: 3 } }) }] },
    orderBy: [{ attempts: "asc" }, { submitted_at: "asc" }], take: Math.min(3, maximum), select: { entry_id: true, source_id: true },
  });
  for (const candidate of candidates) {
    try {
      // Commit recoverable image bytes BEFORE attempting any downstream PNG/Blob I/O.
      await prisma.$transaction(async tx => {
        await lockQuizLifecycle(tx, quizId);
        const source = await tx.meme_archive_sources.findUniqueOrThrow({ where: { source_id: candidate.source_id } });
        if (!source.image_bytes) await tx.meme_archive_sources.update({ where: { source_id: source.source_id }, data: { image_bytes: new Uint8Array(await loadSourceImage(source.image_url)) } });
      }, { timeout: 20_000 });
      await prisma.$transaction(async tx => {
        await lockQuizLifecycle(tx, quizId);
        const entry = await tx.meme_archive_entries.findUniqueOrThrow({ where: { entry_id: candidate.entry_id }, include: { source: true } });
        if (!["PENDING", "ERROR"].includes(entry.status)) return;
        if (entry.pending_file) return;
        const png = await renderArchivedMeme(entry.source.image_bytes!, entry.payload, entry.source.layout);
        const sealed = sealPng(png);
        await tx.meme_archive_entries.update({ where: { entry_id: entry.entry_id }, data: {
          pending_file: new Uint8Array(sealed.bytes), encryption_key: sealed.key, png_sha256: sealed.sha256, png_size: png.length,
        } });
      }, { timeout: 20_000 });
      // Retrying an interrupted upload always writes the SAME encrypted bytes/key.
      // A cached earlier attempt therefore cannot disagree with the committed key.
      await prisma.$transaction(async tx => {
        await lockQuizLifecycle(tx, quizId);
        const entry = await tx.meme_archive_entries.findUniqueOrThrow({ where: { entry_id: candidate.entry_id } });
        if (!["PENDING", "ERROR"].includes(entry.status) || !entry.pending_file) return;
        const config = getMediaVerificationServerConfig();
        const object = await put(buildMediaUploadPathname("meme-archive", [entry.entry_id + ".bin"]), Buffer.from(entry.pending_file), {
          ...config.blobAuthentication, access: "public", addRandomSuffix: false, allowOverwrite: true, contentType: "application/octet-stream", cacheControlMaxAge: 60, abortSignal: AbortSignal.timeout(8_000),
        });
        await tx.meme_archive_entries.update({ where: { entry_id: entry.entry_id }, data: {
          status: "READY", error_message: null, attempts: { increment: 1 }, blob_url: object.url,
          pending_file: null,
        } });
      }, { timeout: 30_000 });
    } catch {
      // Never expose internal URLs/credentials or change a successful answer.
      await prisma.meme_archive_entries.updateMany({ where: { entry_id: candidate.entry_id, status: { in: ["PENDING", "ERROR"] } },
        data: { status: "ERROR", attempts: { increment: 1 }, error_message: "Bildsicherung oder PNG-Erstellung fehlgeschlagen. Bitte erneut versuchen." } });
    }
  }
}

export type MemeArchiveItem = {
  id: string; quizId: number; revision: number; sourceId: number; teamName: string;
  question: string; submittedAt: string; status: string; error: string | null; filename: string;
};
type ArchiveRow = { entry_id: string; quiz_id: number; lifecycle_revision: number; source_id: number;
  team_name: string; question_text: string; submitted_at: Date; status: string; error_message: string | null };

export async function availableMemeRevisions(quizId: number) {
  const rows = await prisma.meme_archive_sources.findMany({ where: { quiz_id: quizId }, distinct: ["lifecycle_revision"], select: { lifecycle_revision: true }, orderBy: { lifecycle_revision: "desc" } });
  return rows.map(row => row.lifecycle_revision);
}

export async function listMemeArchive(quizId: number, sessionId?: number, revision?: number): Promise<MemeArchiveItem[]> {
  const rows = await prisma.$queryRaw<ArchiveRow[]>(Prisma.sql`
    SELECT * FROM (
      SELECT DISTINCT ON (e.source_id,e.session_id) e.entry_id,e.team_name,e.submitted_at,e.status,e.error_message,
        s.quiz_id,s.lifecycle_revision,s.source_id,s.question_text
      FROM pubquiz.meme_archive_entries e JOIN pubquiz.meme_archive_sources s USING(source_id)
      WHERE s.quiz_id=${quizId} ${sessionId === undefined ? Prisma.empty : Prisma.sql`AND e.session_id=${sessionId}`}
        ${revision === undefined ? Prisma.empty : Prisma.sql`AND s.lifecycle_revision=${revision}`}
      ORDER BY e.source_id,e.session_id,e.submission_version DESC,e.submission_id DESC
    ) latest WHERE status <> 'DELETED' ORDER BY lifecycle_revision DESC,source_id,submitted_at LIMIT 501`);
  if (rows.length > 500) throw new Error("Archiv enthält mehr als 500 Memes; bitte den Export eingrenzen.");
  return rows.map(row => {
    const item = { id: row.entry_id, quizId: row.quiz_id, revision: row.lifecycle_revision, sourceId: row.source_id,
      teamName: row.team_name, question: row.question_text, submittedAt: row.submitted_at.toISOString(), status: row.status, error: row.error_message };
    return { ...item, filename: memeFilename(item) };
  });
}

/** Caller has verified manager or signed team session; latest-version check prevents old-ID access. */
export async function loadArchivedPng(quizId: number, id: string, sessionId?: number) {
  const entry = await prisma.meme_archive_entries.findFirst({ where: { entry_id: id, source: { quiz_id: quizId }, ...(sessionId === undefined ? {} : { session_id: sessionId }) },
    select: { entry_id: true, source_id: true, session_id: true, team_name: true, status: true, blob_url: true, encryption_key: true, png_sha256: true, source: { select: { lifecycle_revision: true } } } });
  if (!entry || entry.status !== "READY" || !entry.blob_url || !entry.encryption_key || !entry.png_sha256) throw new Error("Meme wird noch erstellt oder ist nicht berechtigt.");
  const latest = await prisma.meme_archive_entries.findFirst({ where: { source_id: entry.source_id, session_id: entry.session_id }, orderBy: [{ submission_version: "desc" }, { submission_id: "desc" }], select: { entry_id: true } });
  if (latest?.entry_id !== id) throw new Error("Diese Version ist nicht mehr aktuell.");
  const png = openPng(await boundedBlobFetch(entry.blob_url), entry.encryption_key, entry.png_sha256);
  return { png, filename: memeFilename({ id, quizId, revision: entry.source.lifecycle_revision, sourceId: entry.source_id, teamName: entry.team_name }) };
}

export async function deleteArchivedMeme(quizId: number, id: string) {
  await prisma.$transaction(async tx => {
    await lockQuizLifecycle(tx, quizId);
    const entry = await tx.meme_archive_entries.findFirst({ where: { entry_id: id, source: { quiz_id: quizId } } });
    if (!entry) throw new Error("Meme nicht gefunden.");
    await tx.meme_archive_entries.updateMany({ where: { source_id: entry.source_id, session_id: entry.session_id, status: { not: "DELETED" } }, data: { status: "DELETING", error_message: null } });
  });
  // A failed delete stays DELETING (inaccessible) and can be retried explicitly.
  await prisma.$transaction(async tx => {
    await lockQuizLifecycle(tx, quizId);
    const entry = await tx.meme_archive_entries.findFirstOrThrow({ where: { entry_id: id, source: { quiz_id: quizId } } });
    const versions = await tx.meme_archive_entries.findMany({ where: { source_id: entry.source_id, session_id: entry.session_id, status: "DELETING" } });
    for (const version of versions) {
      // Deterministic path also removes an upload whose DB transaction was interrupted.
      const config = getMediaVerificationServerConfig();
      await del(version.blob_url ?? buildMediaUploadPathname("meme-archive", [version.entry_id + ".bin"]), { ...config.blobAuthentication, abortSignal: AbortSignal.timeout(8_000) });
      await tx.meme_archive_entries.update({ where: { entry_id: version.entry_id }, data: {
        status: "DELETED", payload: {}, team_name: "", blob_url: null, encryption_key: null, png_sha256: null, png_size: null, pending_file: null, error_message: null,
      } });
    }
    const remaining = await tx.meme_archive_entries.count({ where: { source_id: entry.source_id, status: { not: "DELETED" } } });
    if (!remaining) await tx.meme_archive_sources.update({ where: { source_id: entry.source_id }, data: { image_bytes: null } });
  }, { timeout: 30_000 });
}

export async function assertMemeArchiveResetSafe(tx: Prisma.TransactionClient, quizId: number) {
  await tx.$queryRaw`SELECT pubquiz.assert_meme_archive_reset_safe(${quizId})`;
}

/** Explicit manager operation only; migration/reads never backfill historical answers. */
export async function captureExistingMemes(quizId: number) {
  await prisma.$transaction(async tx => {
    await lockQuizLifecycle(tx, quizId);
    const submissions = await tx.team_answer_submissions.findMany({ where: { interaction_type: "MEME_CAPTION", status: { in: ["SUBMITTED", "AUTO_FINALIZED"] }, interaction_run: { quiz_id: quizId } }, include: { interaction_run: true } });
    for (const submission of submissions) {
      const payload = parseMemeCaptionPayload(submission.payload);
      const config = submission.interaction_run.config_snapshot as { interaction?: { layout?: unknown } };
      if (!payload || !isMemeCaptionPayloadReadable(payload, resolveMemeCaptionLayout(config.interaction?.layout))) throw new Error("Eine ältere Meme-Abgabe ist nicht lesbar validierbar. Bitte redaktionell prüfen; der Lauf bleibt erhalten.");
      await tx.$queryRaw`SELECT pubquiz.archive_meme_submission(a) FROM pubquiz.team_answer_submissions a WHERE a.team_answer_submission_id=${submission.team_answer_submission_id}`;
    }
  }, { timeout: 30_000 });
  await processMemeArchive(quizId);
}
