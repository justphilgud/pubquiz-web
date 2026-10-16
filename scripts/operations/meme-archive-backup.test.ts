import assert from "node:assert/strict";
import test from "node:test";
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import reference from "./schema-reference/meme-archive-routines.json";
import {MEME_ARCHIVE_EXECUTABLE_SQL, reviewMemeArchiveExecutables, inspectMemeArchiveRow} from "./meme-archive-backup-policy";
import {collectSnapshot, compareSnapshots, type Snapshot} from "./snapshot";
import type {PgSession} from "./pg-session";

const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const sql = readFileSync(new URL("./schema-reference/meme-archive-migration.sql", import.meta.url), "utf8").replaceAll("\r\n", "\n");
const sources = new Map([...sql.matchAll(/CREATE FUNCTION pubquiz\.(\w+)\([^)]*\) RETURNS \w+ LANGUAGE plpgsql AS \$\$([\s\S]*?)\$\$;/g)].map(([, name, source]) => [name, source]));
function executableFixture() {
  return {tables: ["meme_archive_entries", "meme_archive_sources"],
    routines: reference.routines.map(({sourceSha256: _hash, ...attributes}) => {void _hash; return {...attributes, source: sources.get(attributes.name)!};}),
    triggers: [{schema: "pubquiz", name: "capture_confirmed_meme", table: "team_answer_submissions", functionSchema: "pubquiz", functionName: "capture_confirmed_meme",
      type: 5, enabled: "O", deferrable: false, deferred: false, constraint: false, columns: "", arguments: "", condition: null}]};
}

test("reviewed executable reference comes from the exact approved immutable SQL", () => {
  assert.equal(hash(sql), "99a4b9d18e55d2294383a31cf35fb30973e6a30f9750c3c5da752f102818f641");
  assert.equal(reference.migrationSha256, hash(sql));
  assert.equal(sources.size, 3);
  for (const routine of reference.routines) {
    assert.equal(routine.sourceSha256, hash(sources.get(routine.name)!));
    assert.equal(routine.securityDefiner, false); assert.equal(routine.leakproof, false);
    assert.equal(routine.configuration, null); assert.equal(routine.language, "plpgsql");
  }
  assert.equal(reviewMemeArchiveExecutables({tables: [], routines: [], triggers: []}), undefined);
  const fixture = executableFixture();
  const proof = reviewMemeArchiveExecutables(fixture);
  assert.equal(proof?.migrationSha256, reference.migrationSha256);
  const encoded = JSON.stringify(proof);
  assert.ok(!encoded.includes("source")); assert.match(proof!.executableSha256, /^[a-f0-9]{64}$/);
  fixture.routines.forEach(r => {r.source = r.source.replaceAll("\n", "\r\n");});
  assert.deepEqual(reviewMemeArchiveExecutables(fixture), proof);
});

test("unknown/missing routines, changed body or security attributes and changed triggers fail closed", () => {
  const mutations = [
    (f: ReturnType<typeof executableFixture>) => {f.tables.pop();},
    (f: ReturnType<typeof executableFixture>) => {f.routines.pop();},
    (f: ReturnType<typeof executableFixture>) => {f.routines.push({...f.routines[0], name: "unreviewed"});},
    (f: ReturnType<typeof executableFixture>) => {f.routines[0].source += " ";},
    (f: ReturnType<typeof executableFixture>) => {f.routines[0].securityDefiner = true;},
    (f: ReturnType<typeof executableFixture>) => {f.routines[0].argumentTypes = ["text"];},
    (f: ReturnType<typeof executableFixture>) => {f.triggers[0].enabled = "D";},
    (f: ReturnType<typeof executableFixture>) => {f.triggers[0].table = "quiz";},
    (f: ReturnType<typeof executableFixture>) => {f.triggers.push({...f.triggers[0], name: "unreviewed"});},
  ];
  for (const mutate of mutations) {const fixture = executableFixture(); mutate(fixture); assert.throws(() => reviewMemeArchiveExecutables(fixture), /SCHEMA_SECURITY_REVIEW_REQUIRED/);}
});

test("snapshot rejects executable drift before reading or exporting any table rows", async () => {
  const statements: string[] = [];
  const session = {json: async (statement: string) => {statements.push(statement); if (statement === MEME_ARCHIVE_EXECUTABLE_SQL) {const f = executableFixture(); f.routines[0].source += "bad"; return f;} return 0;}};
  await assert.rejects(collectSnapshot(session as unknown as PgSession), /SCHEMA_SECURITY_REVIEW_REQUIRED/);
  assert.equal(statements.length, 2); assert.ok(!statements.some(s => s.includes("row_to_json")));
});

test("archive binary/key bytes are retained; only live required external objects are collected", () => {
  const original = "https://bix6h2j23vjzi240.public.blob.vercel-storage.com/deleted-original.png";
  const source = {source_id: 1, image_url: original, image_bytes: "\\x89504e47", layout: {mode: "STANDARD"}};
  const media = new Set<string>(); const before = JSON.stringify(source);
  inspectMemeArchiveRow(source, media, "meme_archive_sources", new Set()); assert.equal(media.size, 0);
  assert.equal(JSON.stringify(source), before);
  inspectMemeArchiveRow({...source, image_bytes: null}, media, "meme_archive_sources", new Set([1])); assert.ok(media.has(original));
  const id = "11111111-1111-4111-8111-111111111111";
  const url = `https://bix6h2j23vjzi240.public.blob.vercel-storage.com/prod/meme-archive/${id}.bin`;
  const entry = {entry_id: id, status: "READY", blob_url: url, encryption_key: "\\x" + "aa".repeat(32), png_sha256: "a".repeat(64), png_size: 42, pending_file: null, payload: {topText: "ÄÖÜ"}};
  media.clear(); inspectMemeArchiveRow(entry, media, "meme_archive_entries", new Set()); assert.deepEqual([...media], [url]);
  media.clear(); inspectMemeArchiveRow({...entry, status: "DELETING"}, media, "meme_archive_entries", new Set()); assert.equal(media.size, 0);
  for (const changed of [{...entry, encryption_key: "\\xaa"}, {...entry, blob_url: url.replace("/prod/", "/preview/")}, {...entry, payload: {api_key: "not-permitted"}}]) {
    assert.throws(() => inspectMemeArchiveRow(changed, new Set(), "meme_archive_entries", new Set()));
  }
});

test("restore cannot omit or substitute registered executable evidence", () => {
  const base: Snapshot = {columns: [], catalog: {}, tables: [], media: [], authRows: {}, resultRows: []};
  const archive = {...base, archiveSchema: reviewMemeArchiveExecutables(executableFixture())!};
  assert.doesNotThrow(() => compareSnapshots(archive, archive));
  assert.throws(() => compareSnapshots(archive, base), /RESTORE_ARCHIVESCHEMA_MISMATCH/);
  assert.throws(() => compareSnapshots(base, archive), /RESTORE_ARCHIVESCHEMA_MISMATCH/);
});
