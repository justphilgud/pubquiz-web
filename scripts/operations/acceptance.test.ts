import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { AUTH_COLUMNS, RESTORE_TARGET, assertManualAcceptance, auditColumns, inspectRow, inspectValue, pinnedRestoreConnection, projection, type Column } from "./acceptance-policy";
import { templateRegistry } from "../../app/rendering/templateRegistry";
import { artifactName, backupKey, boundedBytes, captureMedia, verifyArtifact, verifyMediaFiles } from "./private-artifacts";
import { authInsertSql, sha256 } from "./snapshot";
import { dumpArguments } from "./acceptance-backup";
import { PgSession, sessionFailureCategory } from "./pg-session";
import { safeError } from "./guards";
const env = { GITHUB_REPOSITORY: "justphilgud/pubquiz-web", GITHUB_REF: "refs/heads/main", GITHUB_EVENT_NAME: "workflow_dispatch", AP94_MANUAL_ACCEPTANCE: "true", BACKUP_AUTOMATION_ENABLED: "false", BACKUP_RETENTION_VERIFIED: "false" };
const columns = Object.keys(AUTH_COLUMNS).map(key => { const [schema, table, column] = key.split("."); return { schema, table, column, type: "text", generated: "", identity: "", nullable: true, default: null } satisfies Column; });
test("manual acceptance cannot enable schedules/retention or run from another branch/repository", () => {
  assert.doesNotThrow(() => assertManualAcceptance(env));
  for (const [key, value] of Object.entries({ GITHUB_REPOSITORY: "other/repo", GITHUB_REF: "refs/heads/feature", GITHUB_EVENT_NAME: "schedule", AP94_MANUAL_ACCEPTANCE: "false", BACKUP_AUTOMATION_ENABLED: "true", BACKUP_RETENTION_VERIFIED: "true" })) assert.throws(() => assertManualAcceptance({ ...env, [key]: value }));
});
test("native session diagnostics expose only fixed categories, never SQL, URLs or credentials", async () => {
  const secret = "SYNTHETIC_SECRET_NEVER_LOG";
  const cases = [
    [`FATAL: password authentication failed for user "${secret}"`, "AUTHENTICATION_REJECTED"],
    [`ERROR: permission denied for table ${secret}`, "PERMISSION_DENIED"],
    [`ERROR: syntax error at or near "${secret}"`, "SQL_SYNTAX_FAILED"],
    [`SSL error: certificate verify failed ${secret}`, "TLS_FAILED"],
    [`channel binding required ${secret}`, "CHANNEL_BINDING_FAILED"],
    [`could not translate host name ${secret}`, "DNS_FAILED"],
    [`connection refused ${secret}`, "NETWORK_FAILED"],
    [`unrecognized configuration parameter ${secret}`, "CONFIGURATION_REJECTED"],
    [`ERROR: relation "${secret}" does not exist`, "SQL_OBJECT_MISSING"],
    [`Unknown error postgresql://owner:${secret}@example.test/db`, "SESSION_FAILED"],
  ];
  for (const [diagnostic, expected] of cases) assert.equal(sessionFailureCategory(diagnostic), expected);
  const session = new PgSession("postgresql://owner:synthetic@127.0.0.1/neondb?sslmode=require&channel_binding=require", {}, (args, childEnv) => {
    assert.ok(args.includes("ON_ERROR_STOP=1")); assert.equal(childEnv.PGCHANNELBINDING, "require");
    assert.equal(childEnv.PGSSLMODE, "require"); assert.match(childEnv.PGOPTIONS!, /default_transaction_read_only=on/);
    return spawn(process.execPath, ["-e", `process.stdin.once('data',()=>{process.stderr.write('ERROR: permission ');setImmediate(()=>{process.stderr.write('denied for table ${secret}');process.exit(1);});});`], { stdio: "pipe", windowsHide: true });
  });
  try {
    await assert.rejects(session.sql("SELECT 1", "SOURCE_PRIVILEGES"), error => {
      assert.equal(safeError(error), "LIBPQ_PERMISSION_DENIED_SOURCE_PRIVILEGES");
      assert.doesNotMatch(String(error), new RegExp(secret)); return true;
    });
  } finally { session.close(); }
});
test("diagnostic phases preserve the successful native-session marker protocol", async () => {
  const session = new PgSession("postgresql://owner:synthetic@127.0.0.1/neondb?sslmode=require&channel_binding=require", {}, () =>
    spawn(process.execPath, ["-e", "process.stdin.once('data',chunk=>{const m=chunk.toString().match(/ap94_[a-f0-9]+/)[0];process.stdout.write('42\\n'+m+'\\n');});"], { stdio: "pipe", windowsHide: true }));
  try { assert.equal(await session.json<number>("SELECT 42", "SOURCE_IDENTITY"), 42); }
  finally { session.close(); }
});
test("restore pins exact j-host even when both configurable values name a different Neon", () => {
  const url = `postgresql://neondb_owner:synthetic@${RESTORE_TARGET.host}/neondb?sslmode=require&channel_binding=require`;
  assert.doesNotThrow(() => pinnedRestoreConnection({ RESTORE_TEST_DATABASE_URL: url, RESTORE_TEST_EXPECTED_HOST: RESTORE_TARGET.host }));
  for (const host of [RESTORE_TARGET.host.replace("b2j", "b2i"), RESTORE_TARGET.host.replace(".c-6", "-pooler.c-6"), "ep-other-branch.c-6.eu-central-1.aws.neon.tech"]) assert.throws(() => pinnedRestoreConnection({ RESTORE_TEST_DATABASE_URL: url.replace(RESTORE_TARGET.host, host), RESTORE_TEST_EXPECTED_HOST: host }));
  assert.throws(() => pinnedRestoreConnection({ RESTORE_TEST_DATABASE_URL: url.replace("neondb_owner", "pubquiz_backup_reader"), RESTORE_TEST_EXPECTED_HOST: RESTORE_TARGET.host }));
});
test("source projection never selects known auth values; unknown credential columns block", () => {
  auditColumns(columns); assert.match(projection(columns), /''::text AS "password_hash"/); assert.match(projection(columns), /NULL::text AS "team_passwort"/);
  assert.throws(() => auditColumns([...columns, { ...columns[0], column: "refresh_token" }]));
  assert.throws(() => auditColumns(columns.slice(1)));
  const args = dumpArguments("00000001-00000002-1", "test.dump");
  assert.ok(args.includes("--exclude-table-data=pubquiz.users")); assert.ok(args.includes("--exclude-table-data=pubquiz.teams"));
  assert.ok(args.includes("--snapshot=00000001-00000002-1"));
});
test("nested credentials and signed media URLs fail before export; normal facts survive", () => {
  for (const value of [{ nested: { api_key: "synthetic" } }, { json: '{"refresh_token":"synthetic"}' }, { link: "https://example.com/a?token=synthetic" }, { text: "postgresql://owner:synthetic@host/db" }]) assert.throws(() => inspectValue(value, new Set()));
  assert.doesNotThrow(() => inspectValue({ password_hash: "", team_passwort: null, must_change_password: true, answer: "42", points: 1.5 }, new Set()));
});
test("only fixed redacted auth overlays can enter SQL; original hashes are rejected", () => {
  const data = { "pubquiz.users": '[{"password_hash":""}]', "pubquiz.teams": '[{"team_passwort":null}]' };
  assert.match(authInsertSql(data, columns), /json_populate_recordset/);
  assert.throws(() => authInsertSql({ ...data, "pubquiz.users": '[{"password_hash":"synthetic-original"}]' }, columns));
  assert.throws(() => authInsertSql({ ...data, "public.other": "[]" }, columns));
});
test("persisted presentation design tokens survive unchanged only at the reviewed table/column", () => {
  for (const template of templateRegistry.presentation) {
    const row = { theme_config_json: { version: 1, tokens: structuredClone(template.tokens) } };
    const original = JSON.stringify(row);
    assert.throws(() => inspectValue(row, new Set()), /EMBEDDED_SECRET_REVIEW_REQUIRED/);
    inspectRow(row, new Set(), "pubquiz", "presentation_templates");
    assert.equal(JSON.stringify(row), original);
    assert.throws(() => inspectRow(row, new Set(), "public", "presentation_templates"));
    assert.throws(() => inspectRow(row, new Set(), "pubquiz", "other"));
  }
});
test("legacy palette preserves a missing correct color but rejects any other missing/extra field", () => {
  const colors: Record<string, unknown> = { ...templateRegistry.presentation[0].tokens.colors };
  delete colors.correct;
  const row = { theme_config_json: { version: 1, tokens: { ...structuredClone(templateRegistry.presentation[0].tokens), colors } } };
  const original = JSON.stringify(row);
  inspectRow(row, new Set(), "pubquiz", "presentation_templates");
  assert.equal(JSON.stringify(row), original);
  assert.equal(Object.hasOwn(colors, "correct"), false);
  for (const bad of [ { ...colors, correct: null }, { ...colors, correct: "synthetic" }, { ...colors, access_token: "synthetic" } ]) {
    assert.throws(() => inspectRow({ theme_config_json: { ...row.theme_config_json, tokens: { ...row.theme_config_json.tokens, colors: bad } } }, new Set(), "pubquiz", "presentation_templates"));
  }
  delete colors.warning;
  assert.throws(() => inspectRow(row, new Set(), "pubquiz", "presentation_templates"));
});
test("reviewed design structure cannot hide secrets or skip media validation", () => {
  const base = { theme_config_json: { version: 1, tokens: structuredClone(templateRegistry.presentation[0].tokens) } };
  const edits: ((row: typeof base) => void)[] = [
    row => Object.assign(row.theme_config_json.tokens, { access_token: "synthetic" }),
    row => Object.assign(row.theme_config_json.tokens.colors, { secret: "synthetic" }),
    row => Object.assign(row.theme_config_json.tokens.typography, { family: "synthetic" }),
    row => Object.assign(row.theme_config_json, { nested: { tokens: "synthetic" } }),
    row => Object.assign(row.theme_config_json.tokens.assets, { logo: "https://other.public.blob.vercel-storage.com/a.png" }),
    row => Object.assign(row.theme_config_json.tokens.assets, { logo: "https://example.com/a.png?token=synthetic" }),
    row => Object.assign(row.theme_config_json, { text: "postgresql://owner:synthetic@host/db" }),
  ];
  for (const edit of edits) {
    const row = structuredClone(base); edit(row);
    assert.throws(() => inspectRow(row, new Set(), "pubquiz", "presentation_templates"));
  }
  const media = new Set<string>();
  const logo = "https://bix6h2j23vjzi240.public.blob.vercel-storage.com/prod/test.png";
  Object.assign(base.theme_config_json.tokens.assets, { logo });
  inspectRow(base, media, "pubquiz", "presentation_templates");
  assert.ok(media.has(logo));
});
test("artifact corruption, path traversal and stream overflow fail closed", async () => {
  const bytes = Buffer.from("synthetic data"); const evidence = { name: "database.dump", bytes: bytes.length, sha256: sha256(bytes) };
  verifyArtifact(bytes, evidence); assert.throws(() => verifyArtifact(Buffer.from("changed"), evidence));
  for (const name of ["../x", "/x", "x/y", "..", "https://evil"]) assert.throws(() => artifactName(name));
  assert.throws(() => backupKey("production/../test"));
  await assert.rejects(boundedBytes(new ReadableStream({ start(c) { c.enqueue(new Uint8Array(20)); c.close(); } }), 10));
});
test("workflow keeps reviewer boundary and never invokes application deployment or retention", () => {
  const text = readFileSync(new URL("../../.github/workflows/ap94-acceptance.yml", import.meta.url), "utf8");
  assert.match(text, /environment: operations-backup/); assert.match(text, /environment: operations-restore/);
  assert.match(text, /needs: backup/); assert.doesNotMatch(text, /schedule:|environment: production|upload-artifact|db:deploy|--prod|contents: write/);
});
test("media original bytes roundtrip, content hash, URL mapping and corruption rejection", async t => {
  const directory = await mkdtemp(join(tmpdir(), "ap94-media-test-"));
  const bytes = Buffer.from("synthetic-media-original-bytes");
  t.mock.method(globalThis, "fetch", async (_url: string, init?: RequestInit) => {
    assert.equal(init?.redirect, "error");
    return new Response(bytes, { status: 200, headers: { "content-type": "image/png" } });
  });
  try {
    const records = await captureMedia(["https://bix6h2j23vjzi240.public.blob.vercel-storage.com/prod/test.png"], directory);
    assert.equal(records[0].sha256, sha256(bytes));
    assert.equal((await verifyMediaFiles(records, directory)).restoredOriginals, 1);
    await writeFile(join(directory, records[0].name), "corrupt");
    await assert.rejects(verifyMediaFiles(records, directory));
    await assert.rejects(captureMedia(["https://example.com/private.png"], directory));
  } finally { await rm(directory, { recursive: true, force: true }); }
});
