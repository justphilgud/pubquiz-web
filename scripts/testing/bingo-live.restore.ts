import assert from "node:assert/strict";
import { Client } from "pg";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { collectSnapshot, compareSnapshots, type Snapshot } from "../operations/snapshot";
import type { PgSession } from "../operations/pg-session";

/** Full disposable schema+data restore, never accepts production or an existing target. */
export async function verifyBingoRestore(source: URL, expected: Snapshot) {
  assert.ok(["localhost", "127.0.0.1", "ep-dry-dust-aljik09f-pooler.c-3.eu-central-1.aws.neon.tech"].includes(source.hostname));
  assert.match(source.pathname, /^\/bingo_ap2_qa_\d+$/);
  const targetName = `bingo_ap3_restore_${Date.now()}`;
  const controlUrl = new URL(source); controlUrl.pathname = source.hostname.includes("neon.tech") ? "/neondb" : "/editorial_import_ci";
  const control = new Client({ connectionString: controlUrl.toString() }); await control.connect();
  const temp = mkdtempSync(join(tmpdir(), "bingo-ap3-restore-")), dump = join(temp, "isolated.dump");
  const container = process.env.BINGO_PG_CONTAINER;
  if (container) assert.match(container, /^[a-f0-9]{12,64}$/);
  const tool = (name: string, args: string[], database: string, input?: Buffer) => {
    const env = { ...process.env, PGHOST: source.hostname, PGPORT: source.port || "5432", PGUSER: decodeURIComponent(source.username), PGPASSWORD: decodeURIComponent(source.password), PGDATABASE: database, PGSSLMODE: source.hostname.includes("neon.tech") ? "require" : "disable" };
    if (container) return execFileSync("docker", ["exec", "-i", "-e", "PGPASSWORD", container, name, "-h", "127.0.0.1", "-U", env.PGUSER, "-d", database, ...args], { env, input, maxBuffer: 100 * 1024 * 1024 });
    const windows = `C:/Program Files/PostgreSQL/18/bin/${name}.exe`;
    return execFileSync(existsSync(windows) ? windows : name, name === "pg_restore" ? ["-d", database, ...args] : args, { env, input, maxBuffer: 100 * 1024 * 1024 });
  };
  let created = false;
  try {
    await control.query(`CREATE DATABASE ${targetName}`); created = true;
    const targetUrl = new URL(source); targetUrl.pathname = "/" + targetName;
    const target = new Client({ connectionString: targetUrl.toString() }); await target.connect();
    try {
      assert.equal((await target.query("SELECT current_database() db")).rows[0].db, targetName);
      const count = (await target.query("SELECT count(*)::int n FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','pubquiz')")).rows[0].n;
      assert.equal(count, 0, "fresh restore target must be empty");
      await target.query("DROP SCHEMA public");
      writeFileSync(dump, tool("pg_dump", ["--format=custom", "--no-owner", "--no-acl", "--no-comments", "--schema=public", "--schema=pubquiz"], source.pathname.slice(1)));
      tool("pg_restore", ["--no-owner", "--no-acl", "--exit-on-error", "--single-transaction"], targetName, readFileSync(dump));
      await target.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; SET LOCAL search_path=pg_catalog");
      const restored = await collectSnapshot({ json: async (sql: string) => Object.values((await target.query(sql)).rows[0])[0] } as unknown as PgSession);
      await target.query("ROLLBACK");
      compareSnapshots(expected, restored);
      const broken = await target.query("SELECT count(*)::int n FROM pubquiz.bingo_live_cards rc LEFT JOIN pubquiz.bingo_cards c ON c.id=rc.card_id LEFT JOIN pubquiz.bingo_live_runs r ON r.id=rc.run_id WHERE c.id IS NULL OR r.id IS NULL");
      assert.equal(broken.rows[0].n, 0);
      console.info("AP3 full disposable dump/restore, catalog/rows/assets/references and complete collectSnapshot comparison: PASS");
    } finally { await target.end(); }
  } finally {
    try {
      // Only the database created by this invocation. Pooler-held idle sessions
      // must not leave an otherwise completed disposable restore hanging.
      if (created) { assert.match(targetName, /^bingo_ap3_restore_\d+$/); await control.query(`DROP DATABASE ${targetName} WITH (FORCE)`); }
    } finally {
      await control.end();
      // Fresh function-owned tmpdir only.
      rmSync(temp, { recursive: true, force: true });
    }
  }
}
