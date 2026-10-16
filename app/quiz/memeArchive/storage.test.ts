import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as files from "./files";
import { Prisma } from "@/app/generated/prisma/client";
import * as captions from "../memeCaption";
import * as zones from "../memeCaptionZones";
import * as layout from "../memeCaptionLayout";

test("durable worker: upload failure preserves answer/source, retry is idempotent; deletion is inaccessible and retryable", async () => {
  let uploadFails = true; let deleteFails = true; let uploads = 0; let uploadedBytes = Buffer.alloc(0); let latestId = "11111111-1111-1111-1111-111111111111";
  const source = { source_id: 5, quiz_id: 1, quiz_question_id: 9, lifecycle_revision: 0, image_bytes: new Uint8Array([1]), layout: {}, image_url: "not-read" };
  const entry = { entry_id: "11111111-1111-1111-1111-111111111111", source_id: 5, session_id: 7, team_id: 4, status: "PENDING", attempts: 0, payload: { topText: "confirmed", bottomText: "" }, source, pending_file: null as Uint8Array | null, blob_url: null as string | null, encryption_key: null as Uint8Array | null, png_sha256: null as string | null, png_size: null as number | null, team_name: "Team", error_message: null as string | null };
  const answer = Object.freeze({ payload: "confirmed", evaluation: "unchanged" });
  const update = (data: Record<string, unknown>) => {
    for (const [key, value] of Object.entries(data)) {
      if (key === "attempts" && typeof value === "object") entry.attempts++;
      else Object.assign(entry, { [key]: value });
    }
    return entry;
  };
  const table = {
    findMany: async ({ where }: { where?: { status?: string } }) => where?.status === "DELETING" ? entry.status === "DELETING" ? [entry] : [] : ["PENDING", "ERROR"].includes(entry.status) ? [entry] : [],
    findUniqueOrThrow: async () => entry,
    findFirst: async ({ where }: { where: { entry_id?: string; source?: { quiz_id: number }; session_id?: number } }) => {
      if (!where.entry_id) return { entry_id: latestId };
      return where.entry_id === entry.entry_id && where.source?.quiz_id === 1 && (where.session_id === undefined || where.session_id === 7) ? entry : null;
    }, findFirstOrThrow: async () => entry,
    update: async ({ data }: { data: Record<string, unknown> }) => update(data),
    updateMany: async ({ data }: { data: Record<string, unknown> }) => update(data),
    count: async () => entry.status === "DELETED" ? 0 : 1,
  };
  const db = { $queryRaw: async () => [{ acquired: true }], meme_archive_entries: table, meme_archive_sources: { findUniqueOrThrow: async () => source, update: async ({ data }: { data: object }) => Object.assign(source, data) },
    $transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback(db) };
  const dependencies: Record<string, unknown> = {
    "server-only": {}, "node:fs/promises": {}, "node:path": {}, sharp: {},
    "@vercel/blob": { put: async (_path: string, bytes: Buffer) => { uploads++; uploadedBytes = Buffer.from(bytes); if (uploadFails) throw new Error("private detail must not escape"); return { url: "https://test.public.blob.vercel-storage.com/test.bin" }; }, del: async () => { if (deleteFails) throw new Error("delete failed"); } },
    "@/app/generated/prisma/client": { Prisma }, "@/app/lib/prisma": { prisma: db }, "../quizLifecycle.server": { lockQuizLifecycle: async () => { throw new Error("Archive I/O must not lock game submissions"); } },
    "@/app/fragen/editor/mediaUploadEnvironment": { getMediaVerificationServerConfig: () => ({ blobAuthentication: {} }), buildMediaUploadPathname: () => "dev/meme-archive/id.bin" },
    "./png": { renderArchivedMeme: async (_image: Uint8Array, payload: unknown) => { assert.deepEqual(payload, answer.payload === "confirmed" ? { topText: "confirmed", bottomText: "" } : {}); return Buffer.from("confirmed PNG"); } }, "./files": files,
    "../memeCaption": captions, "../memeCaptionZones": zones, "../memeCaptionLayout": layout,
  };
  const exports: Record<string, (...args: unknown[]) => Promise<unknown>> = {};
  runInNewContext(ts.transpileModule(readFileSync(new URL("./archive.server.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, Buffer, URL, AbortSignal, Uint8Array, console, fetch: async () => new Response(new Uint8Array(uploadedBytes)),
    require: (id: string) => { if (id in dependencies) return dependencies[id]; throw new Error(id); },
  });
  await exports.processMemeArchive(1); assert.equal(entry.status, "ERROR"); assert.equal(entry.attempts, 1);
  const encryptedAttempt = Buffer.from(entry.pending_file!); const retainedKey = Buffer.from(entry.encryption_key!);
  assert.ok(source.image_bytes); assert.deepEqual(answer, { payload: "confirmed", evaluation: "unchanged" });
  assert.doesNotMatch(entry.error_message!, /private detail/);
  uploadFails = false;
  await exports.processMemeArchive(1); assert.equal(entry.status, "READY"); assert.ok(entry.encryption_key); assert.equal(uploads, 2);
  assert.deepEqual(entry.encryption_key, retainedKey); assert.equal(entry.pending_file, null); assert.ok(encryptedAttempt.length > 28);
  assert.deepEqual(uploadedBytes, encryptedAttempt);
  assert.equal(((await exports.loadArchivedPng(1, entry.entry_id, 7)) as { png: Buffer }).png.toString(), "confirmed PNG");
  await assert.rejects(exports.loadArchivedPng(1, entry.entry_id, 8));
  await assert.rejects(exports.loadArchivedPng(2, entry.entry_id, 7));
  latestId = "22222222-2222-2222-2222-222222222222";
  await assert.rejects(exports.loadArchivedPng(1, entry.entry_id, 7)); latestId = entry.entry_id;
  await exports.processMemeArchive(1); assert.equal(uploads, 2); assert.equal(entry.status, "READY");
  await assert.rejects(exports.deleteArchivedMeme(1, entry.entry_id)); assert.equal(entry.status, "DELETING");
  deleteFails = false;
  await exports.deleteArchivedMeme(1, entry.entry_id); assert.equal(entry.status, "DELETED"); assert.equal(entry.encryption_key, null); assert.equal(entry.blob_url, null); assert.equal(entry.team_name, "");
  await exports.processMemeArchive(1); assert.equal(uploads, 2); assert.equal(entry.status, "DELETED");
});
