import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as streams from "node:stream";

function load(file: string, dependencies: Record<string, unknown>) {
  const exports: Record<string, (...args: unknown[]) => Promise<Response>> = {};
  runInNewContext(ts.transpileModule(readFileSync(new URL(file, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, URL, Response, Buffer, console, require: (id: string) => {
      if (id in dependencies) return dependencies[id]; throw new Error(`Unexpected dependency: ${id}`);
    },
  });
  return exports;
}

test("archive HTTP boundary: manager permission, signed session ownership, no fallback, CSRF and confirmed deletion", async () => {
  let manager = false; let validSession = false; let deleted = 0; let processed = 0; let reads = 0; let captures = 0;
  const route = load("../../api/quiz/meme-archive/route.ts", {
    "node:stream": streams,
    "@/app/quiz/quizAccess.server": { requireQuizViewer: async () => { if (!manager) throw new Error("denied"); }, requireQuizAdmin: async () => { if (!manager) throw new Error("denied"); } },
    "@/app/quiz/participantSession.server": { resolveParticipantSession: async (quizId: number, token: string) => quizId === 1 && token === "signed-test-token" && validSession ? { quiz_team_session_id: 7 } : null },
    "@/app/quiz/memeArchive/archive.server": {
      listMemeArchive: async (_quiz: number, session?: number) => { reads++; assert.ok(session === undefined || session === 7); return []; },
      loadArchivedPng: async (_quiz: number, id: string, session?: number) => {
        if (session !== undefined && id !== "11111111-1111-1111-1111-111111111111") throw new Error("foreign entry");
        return { png: new Uint8Array([137, 80, 78, 71]), filename: "Quiz-1.png" };
      },
      processMemeArchive: async () => { processed++; }, deleteArchivedMeme: async () => { deleted++; },
      captureExistingMemes: async () => { captures++; },
      availableMemeRevisions: async () => [0],
    },
    "@/app/quiz/memeArchive/schedule.server": { scheduleMemeArchive: () => {} },
    "@/app/quiz/memeArchive/files": { zipPngs: () => { throw new Error("unexpected ZIP"); } },
  });
  const base = "https://quiz.example/api/quiz/meme-archive?quizId=1";
  assert.equal((await route.GET(new Request(base))).status, 403); assert.equal(reads, 0);
  manager = true;
  assert.equal((await route.GET(new Request(base))).status, 200);
  // Invalid team token never falls back to the manager cookie on the same browser.
  assert.equal((await route.GET(new Request(base + "&team=1"))).status, 403);
  validSession = true; manager = false;
  const auth = { Authorization: "Bearer signed-test-token" };
  assert.equal((await route.GET(new Request(base + "&team=1", { headers: auth }))).status, 200);
  const own = await route.GET(new Request(base + "&team=1&id=11111111-1111-1111-1111-111111111111", { headers: auth }));
  assert.equal(own.status, 200); assert.equal(own.headers.get("Cache-Control"), "private, no-store");
  assert.doesNotMatch(own.headers.get("Content-Disposition")!, /token/);
  assert.equal((await route.GET(new Request(base + "&team=1&id=22222222-2222-2222-2222-222222222222", { headers: auth }))).status, 403);
  assert.equal((await route.GET(new Request(base + "&team=1&revision=0", { headers: auth }))).status, 403);
  const post = (query: string, body: object, origin = "https://quiz.example") => route.POST(new Request(base + query, { method: "POST", headers: { ...auth, Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(body) }));
  assert.equal((await post("&team=1", { action: "retry" }, "https://evil.example")).status, 400); assert.equal(processed, 0);
  assert.equal((await post("&team=1&id=11111111-1111-1111-1111-111111111111", { action: "delete", confirmed: true })).status, 400); assert.equal(deleted, 0);
  manager = true;
  assert.equal((await post("", { action: "capture", confirmed: false })).status, 400); assert.equal(captures, 0);
  assert.equal((await post("&team=1", { action: "capture", confirmed: true })).status, 400); assert.equal(captures, 0);
  assert.equal((await post("", { action: "capture", confirmed: true })).status, 200); assert.equal(captures, 1);
  assert.equal((await post("&id=11111111-1111-1111-1111-111111111111", { action: "delete", confirmed: false })).status, 400);
  assert.equal((await post("&id=11111111-1111-1111-1111-111111111111", { action: "delete", confirmed: true })).status, 200); assert.equal(deleted, 1);
  validSession = false;
  assert.equal((await route.GET(new Request(base + "&team=1", { headers: auth }))).status, 403);
});
