import assert from "node:assert/strict";
import test from "node:test";
import {Client} from "pg";
import {execFileSync} from "node:child_process";
import {mkdtemp, readFile, writeFile, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join, resolve} from "node:path";
import {createCipheriv, createDecipheriv, randomBytes} from "node:crypto";
import sharp from "sharp";
import {collectSnapshot, compareSnapshots, sha256} from "./snapshot";
import {pgTool, type PgSession} from "./pg-session";
import {restoreSql} from "./acceptance-restore";
import {captureMedia, verifyMediaFiles} from "./private-artifacts";
import {RESTORE_TARGET} from "./acceptance-policy";
import {temporaryDatabaseMarker} from "./temporary-restore-target";
import roleGuards from "./schema-reference/role-guard-routines.json";
import {ARCHIVE_CAPTURE_FIXTURE_SQL} from "./production-preflight-archive-delta";

test("real PostgreSQL17: archive dump/guarded restore retains encrypted PNG, keys, source bytes and exact routines", {skip: !process.env.RESTORE_CI_DATABASE_URL}, async () => {
  const url = new URL(process.env.RESTORE_CI_DATABASE_URL!);
  assert.equal(process.env.CI, "true"); assert.equal(url.hostname, "postgres"); assert.equal(url.pathname, "/restore_ci");
  const admin = new Client({connectionString: url.toString()}); await admin.connect();
  const directory = await mkdtemp(join(tmpdir(), "meme-archive-restore-fixture-"));
  const id = "c".repeat(32), targetName = `ap94_restore_${id}`, sourceName = "meme_archive_backup_source_ci";
  const connect = async (database: string, user = "postgres") => {const c = new Client({host: "postgres", database, user}); await c.connect(); return c;};
  const environment = (database: string, user = "postgres") => ({PATH: process.env.PATH, PGHOST: "postgres", PGUSER: user, PGDATABASE: database});
  const snapshot = async (client: Client) => {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; SET LOCAL search_path=pg_catalog");
    try {return await collectSnapshot({json: async (sql: string) => Object.values((await client.query(sql)).rows[0])[0]} as unknown as PgSession);}
    finally {await client.query("ROLLBACK");}
  };
  let source: Client | undefined, target: Client | undefined;
  try {
    await admin.query("CREATE ROLE neondb_owner LOGIN");
    await admin.query("CREATE DATABASE meme_archive_backup_source_ci");
    await admin.query(`CREATE DATABASE ${targetName} OWNER neondb_owner TEMPLATE template0`);
    const lease = {version: 1 as const, id, ...RESTORE_TARGET, database: targetName, createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3600000).toISOString(), backupId: "production/acceptance/run-123-1", manifestSha256: "b".repeat(64)};
    const marker = temporaryDatabaseMarker(lease);
    await admin.query(`COMMENT ON DATABASE ${targetName} IS '${marker}'; REVOKE CONNECT,TEMPORARY ON DATABASE ${targetName} FROM PUBLIC`);
    source = await connect(sourceName); target = await connect(targetName, "neondb_owner");
    let schema = await readFile("prisma/schema.prisma", "utf8");
    // Same fixture supports the pre-release baseline and later archive-aware main.
    schema = schema.replace(/^\s*meme_archive_sources meme_archive_sources\[\]\r?\n/m, "")
      .replace(/model meme_archive_sources \{[\s\S]*?^\}/m, "").replace(/model meme_archive_entries \{[\s\S]*?^\}/m, "");
    const schemaPath = join(directory, "baseline.prisma"); await writeFile(schemaPath, schema);
    const ddl = execFileSync(process.execPath, [resolve("node_modules/prisma/build/index.js"), "migrate", "diff", "--from-empty", "--to-schema", schemaPath, "--script"],
      {encoding: "utf8", env: {...process.env, DATABASE_URL: "postgresql://postgres@postgres:5432/restore_ci", JITI_CACHE: "false"}});
    await source.query(ddl.slice(ddl.indexOf("-- CreateSchema")));
    const migration = (await readFile("scripts/operations/schema-reference/meme-archive-migration.sql", "utf8")).replaceAll("\r\n", "\n");
    assert.equal(sha256(migration), "99a4b9d18e55d2294383a31cf35fb30973e6a30f9750c3c5da752f102818f641");
    await source.query(migration);
    // Prisma schema baselines omit routines/triggers: install the actual immutable PR130 guards.
    for (const reviewed of roleGuards.migrations) {
      const text = (await readFile(`prisma/migrations/${reviewed.name}/migration.sql`, "utf8")).replaceAll("\r\n", "\n");
      assert.equal(sha256(text), reviewed.sha256);
      for (const match of text.matchAll(/CREATE FUNCTION pubquiz\.[\s\S]*?\$\$;/g)) await source.query(match[0]);
      for (const match of text.matchAll(/CREATE TRIGGER[\s\S]*?EXECUTE FUNCTION[^;]+;/g)) await source.query(match[0]);
    }
    await source.query(ARCHIVE_CAPTURE_FIXTURE_SQL);
    const png = await sharp({create: {width: 3, height: 2, channels: 4, background: "#ff8800"}}).png().toBuffer();
    const key = randomBytes(32), nonce = randomBytes(12), cipher = createCipheriv("aes-256-gcm", key, nonce);
    const encrypted = Buffer.concat([cipher.update(png), cipher.final()]);
    const bytes = Buffer.concat([nonce, cipher.getAuthTag(), encrypted]);
    const entryId = (await source.query("SELECT entry_id FROM pubquiz.meme_archive_entries")).rows[0].entry_id as string;
    const blob = `https://bix6h2j23vjzi240.public.blob.vercel-storage.com/prod/meme-archive/${entryId}.bin`;
    await source.query("UPDATE pubquiz.meme_archive_sources SET image_url='https://bix6h2j23vjzi240.public.blob.vercel-storage.com/deleted-original.png',image_bytes=$1", [png]);
    await source.query("UPDATE pubquiz.meme_archive_entries SET status='READY',blob_url=$1,encryption_key=$2,png_sha256=$3,png_size=$4", [blob, key, sha256(png), png.length]);
    const expected = await snapshot(source);
    assert.ok(expected.archiveSchema); assert.deepEqual(expected.archiveSchema.roleGuardMigrations, roleGuards.migrations); assert.deepEqual(expected.media, [blob]);
    const records = await captureMedia(expected.media, directory, (async (url, options) => {
      assert.equal(url, blob); assert.equal(options?.redirect, "error"); return new Response(new Uint8Array(bytes));
    }) as typeof fetch);
    assert.equal((await verifyMediaFiles(records, directory)).restoredOriginals, 1);
    const dump = join(directory, "database.dump");
    pgTool("pg_dump", ["--format=custom", "--no-owner", "--no-acl", "--no-comments", "--schema=public", "--schema=pubquiz", "--exclude-table-data=pubquiz.users", "--exclude-table-data=pubquiz.teams", "--file", dump], environment(sourceName));
    const sql = restoreSql(directory, expected.authRows, {expected}, environment(targetName), {database: targetName, marker});
    // The real restore boundary is a single transaction; a failure leaves no archive.
    assert.throws(() => pgTool("psql", ["-X", "-q", "-v", "ON_ERROR_STOP=1", "--single-transaction", "--file=-"], environment(targetName, "neondb_owner"), sql + "\nSELECT 1/0;"));
    assert.equal((await target.query("SELECT to_regclass('pubquiz.meme_archive_entries') AS relation")).rows[0].relation, null);
    pgTool("psql", ["-X", "-q", "-v", "ON_ERROR_STOP=1", "--single-transaction", "--file=-"], environment(targetName, "neondb_owner"), sql);
    compareSnapshots(expected, await snapshot(target));
    await assert.rejects(target.query("INSERT INTO pubquiz.benutzer_eventartrollen DEFAULT VALUES"), {code:"42501"}, "restored role guard remains active");
    assert.equal((await target.query("SELECT count(*) FROM pubquiz.meme_archive_entries")).rows[0].count, "1", "post-data trigger does not backfill during restore");
    const restored = (await target.query("SELECT encryption_key,png_sha256 FROM pubquiz.meme_archive_entries")).rows[0] as {encryption_key: Buffer; png_sha256: string};
    const restoredBytes = await readFile(join(directory, records[0].name));
    const decipher = createDecipheriv("aes-256-gcm", restored.encryption_key, restoredBytes.subarray(0, 12)); decipher.setAuthTag(restoredBytes.subarray(12, 28));
    const restoredPng = Buffer.concat([decipher.update(restoredBytes.subarray(28)), decipher.final()]);
    assert.deepEqual(restoredPng, png); assert.equal(sha256(restoredPng), restored.png_sha256);
    assert.equal((await sharp(restoredPng).metadata()).width, 3);
    await target.query("ALTER FUNCTION pubquiz.capture_confirmed_meme() SECURITY DEFINER");
    await assert.rejects(snapshot(target), /SCHEMA_SECURITY_REVIEW_REQUIRED/);
    await target.query("ALTER FUNCTION pubquiz.capture_confirmed_meme() SECURITY INVOKER; ALTER TABLE pubquiz.team_answer_submissions DISABLE TRIGGER capture_confirmed_meme");
    await assert.rejects(snapshot(target), /SCHEMA_SECURITY_REVIEW_REQUIRED/);
    await target.query("ALTER TABLE pubquiz.team_answer_submissions ENABLE TRIGGER capture_confirmed_meme; CREATE FUNCTION public.unreviewed() RETURNS int LANGUAGE SQL AS 'SELECT 1'");
    await assert.rejects(snapshot(target), /SCHEMA_SECURITY_REVIEW_REQUIRED/);
    compareSnapshots(expected, await snapshot(source));
  } finally {
    await source?.end(); await target?.end();
    await admin.query(`DROP DATABASE IF EXISTS ${targetName}`);
    await admin.query(`DROP DATABASE IF EXISTS ${sourceName}`);
    await admin.query("DROP ROLE IF EXISTS neondb_owner");
    await admin.end(); await rm(directory, {recursive: true, force: true});
  }
});
