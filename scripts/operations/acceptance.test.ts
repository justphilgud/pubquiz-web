import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { AUTH_COLUMNS, RESTORE_TARGET, assertManualAcceptance, assertRestoreAcceptance, auditColumns, inspectRow, inspectValue, pinnedRestoreConnection, projection, type Column } from "./acceptance-policy";
import { templateRegistry } from "../../app/rendering/templateRegistry";
import { PrivateArtifacts, artifactName, backupKey, boundedBytes, captureMedia, verifyArtifact, verifyMediaFiles } from "./private-artifacts";
import { authInsertSql, compareSnapshots, sha256, type Snapshot } from "./snapshot";
import { canonicalCatalog, canonicalCatalogDefinition } from "./catalog-comparison";
import catalogCastCases from "./fixtures/run19-catalog-casts.json";
import { backupPhaseError, backupUploadPlan, dumpArguments, uploadBackupData } from "./acceptance-backup";
import { backupFailureCodes, backupFailureEvidence, backupPhase } from "./backup-diagnostics";
import { PgSession, sessionFailureCategory } from "./pg-session";
import { OperationsError, safeError } from "./guards";
import { BlobAccessError, BlobFileTooLargeError, BlobError, BlobServiceRateLimited } from "@vercel/blob";
import { privateBlobOperation } from "./blob-diagnostics";
const env = { GITHUB_REPOSITORY: "justphilgud/pubquiz-web", GITHUB_REF: "refs/heads/main", GITHUB_EVENT_NAME: "workflow_dispatch", AP94_MANUAL_ACCEPTANCE: "true", BACKUP_AUTOMATION_ENABLED: "false", BACKUP_RETENTION_VERIFIED: "false" };
const columns = Object.keys(AUTH_COLUMNS).map(key => { const [schema, table, column] = key.split("."); return { schema, table, column, type: "text", generated: "", identity: "", nullable: true, default: null } satisfies Column; });
test("backup upload plan is sequential and publishes the manifest last", () => {
  const media = [`media-${"a".repeat(64)}.bin`, `media-${"b".repeat(64)}.bin`];
  const plan = backupUploadPlan(media);
  assert.deepEqual(plan.data.map(item => item.name), ["database.dump", "auth-redacted.json", ...media]);
  assert.equal(plan.manifest.name, "manifest.json");
  assert.deepEqual(plan.data.map(item => item.position.index), [1, 2, 3, 4]);
  assert.deepEqual(plan.manifest.position, { index: 5, total: 5 });
  assert.ok(plan.data.every(item => item.position.total === 5));
});
test("failed data upload stops the series before manifest publication", async () => {
  const media = [`media-${"a".repeat(64)}.bin`, `media-${"b".repeat(64)}.bin`];
  const plan = backupUploadPlan(media); const calls: string[] = [];
  await assert.rejects(uploadBackupData(plan, async name => Buffer.from(name), async (name, bytes) => {
    calls.push(name); if (name === media[0]) throw new OperationsError("PRIVATE_UPLOAD_MEDIA_HTTP_503_SERVICE_UNAVAILABLE");
    return { name, bytes: bytes.length, sha256: sha256(bytes) };
  }), /PRIVATE_UPLOAD_MEDIA_HTTP_503_SERVICE_UNAVAILABLE/);
  assert.deepEqual(calls, ["database.dump", "auth-redacted.json", media[0]]);
  assert.ok(!calls.includes(plan.manifest.name)); assert.ok(!calls.includes(media[1]));
});
test("Run 19 catalog: all seven CHECKs and partial unique index survive PG array-cast deparsing", () => {
  assert.equal(catalogCastCases.length, 8);
  const empty: Snapshot = { columns: [], catalog: {}, tables: [], media: [], authRows: {}, resultRows: [] };
  for (const pair of catalogCastCases) {
    const expected = { ...empty, catalog: { [pair.section]: [pair.expected] } };
    const actual = { ...empty, catalog: { [pair.section]: [pair.actual] } };
    const before = JSON.stringify([expected, actual]);
    assert.notDeepEqual(expected.catalog, actual.catalog);
    assert.doesNotThrow(() => compareSnapshots(expected, actual));
    assert.doesNotThrow(() => compareSnapshots(actual, expected));
    assert.equal(JSON.stringify([expected, actual]), before, "evidence must not be mutated");
  }
});
test("catalog equivalence preserves real constraint/index differences and every other snapshot gate", () => {
  const empty: Snapshot = { columns: [], catalog: {}, tables: [], media: [], authRows: {}, resultRows: [] };
  for (const pair of catalogCastCases) {
    const field = pair.section === "constraints" ? "definition" : "indexdef";
    const entry = pair.actual as Record<string, unknown>;
    const definition = entry[field] as string;
    const mutations = [
      { ...entry, [field]: definition.replace(/'[A-Z_]+/, "'DIFFERENT") },
      { ...entry, [field]: definition.replace("= ANY", "<> ALL") },
      { ...entry, [field]: definition.replace("::character varying", "::character(1)") },
      { ...entry, [field]: definition.replace("::text", "::varchar") },
      { ...entry, schema: "other" }, { ...entry, unexpected: true },
      ...(pair.section === "constraints" ? [{ ...entry, validated: false }] : [
        { ...entry, indexdef: definition.replace("UNIQUE ", "") },
        { ...entry, indexdef: definition.replace("fragen_id, generator_id", "generator_id, fragen_id") },
      ]),
    ];
    for (const changed of mutations) assert.throws(() => compareSnapshots(
      { ...empty, catalog: { [pair.section]: [pair.expected] } },
      { ...empty, catalog: { [pair.section]: [changed] } }), /RESTORE_CATALOG_MISMATCH/);
  }
  for (const part of ["columns", "catalog", "tables", "media", "resultRows"] as const) {
    assert.throws(() => compareSnapshots(empty, { ...empty, [part]: ["changed"] }), new RegExp(`RESTORE_${part.toUpperCase()}_MISMATCH`));
  }
  assert.notDeepEqual(canonicalCatalog({ schemas: ["public"], constraints: [] }), canonicalCatalog({ schemas: ["public", "other"], constraints: [] }));
});
test("catalog cast rewrite is narrow, quote-aware and retains literal order and surrounding logic", () => {
  const source = "(ARRAY['A'::character varying, 'B'::character varying])::text[]";
  const target = "ARRAY[('A'::character varying)::text, ('B'::character varying)::text]";
  assert.equal(canonicalCatalogDefinition(source), target);
  assert.equal(canonicalCatalogDefinition(`(${source}) OR (${source})`), `(${target}) OR (${target})`);
  for (const unsupported of [
    `'${source.replaceAll("'", "''")}'`, `"${source}"`, `$tag$${source}$tag$`,
    `/* ${source} */`, `-- ${source}`, `E'\\n' || ${source}`,
    source.replace("'A'", "NULL"), source.replace("'A'", "some_column"),
    source.replace("'A'", "'a'"), source.replace("'A'", "'A''B'"),
    source.replaceAll("character varying", "character(1)"),
    source.replace("::text[]", "::integer[]"), source.replace("::text[]", "::pubquiz.custom[]"),
  ]) assert.equal(canonicalCatalogDefinition(unsupported), unsupported);
  assert.notEqual(canonicalCatalogDefinition(source.replace("'A'", "'C'")), target);
  assert.notEqual(canonicalCatalogDefinition(source.replace("'A'", "'B'").replace(", 'B'", ", 'A'")), target);
  assert.notEqual(canonicalCatalogDefinition(`x IS NULL OR ${source}`), canonicalCatalogDefinition(`x IS NOT NULL OR ${source}`));
});
test("private Blob errors identify operation/category without exposing messages or causes", async () => {
  const secret = "SYNTHETIC_SECRET_NEVER_LOG";
  const cases: [unknown, string][] = [
    [new BlobAccessError(), "ACCESS_DENIED"], [new BlobFileTooLargeError(secret), "FILE_TOO_LARGE"],
    [new BlobServiceRateLimited(30), "RATE_LIMITED"], [new BlobError(secret), "REQUEST_REJECTED"],
    [new TypeError(secret, { cause: { code: "ECONNRESET", secret } }), "CONNECTION_FAILED"],
    [{ code: "ENOTFOUND", message: secret }, "DNS_FAILED"],
    [{ cause: { code: "CERT_HAS_EXPIRED", message: secret } }, "TLS_FAILED"],
    [{ cause: { code: "UND_ERR_CONNECT_TIMEOUT", message: secret } }, "TIMEOUT"],
    [new Error(secret), "UNKNOWN"],
  ];
  for (const operation of ["UPLOAD", "READBACK"] as const) for (const [error, category] of cases) {
    await assert.rejects(privateBlobOperation(operation, async () => { throw error; }), actual => {
      assert.equal(safeError(actual), `PRIVATE_BLOB_${operation}_${category}`);
      assert.doesNotMatch(String(actual), new RegExp(secret));
      assert.equal((actual as Error).cause, undefined); return true;
    });
  }
  const guard = new OperationsError("ARTIFACT_SIZE_LIMIT");
  await assert.rejects(privateBlobOperation("READBACK", async () => { throw guard; }), error => error === guard);
  assert.equal(await privateBlobOperation("UPLOAD", async () => "success"), "success");
});
test("backup phase diagnostics expose only fixed phases and preserve existing safety gates", () => {
  const error = new Error("postgresql://owner:SYNTHETIC_SECRET@host/db", { cause: { token: "SYNTHETIC_SECRET" } });
  for (const phase of ["SOURCE_SESSION", "SOURCE_CAPTURE", "DB_EXPORT", "MEDIA_CAPTURE", "AUTH_OVERLAY_FILE", "DATA_UPLOAD", "MANIFEST_UPLOAD", "ANONYMOUS_READBACK", "CLEANUP"] as const) {
    const classified = backupPhaseError(error, phase);
    assert.equal(safeError(classified), backupFailureCodes[phase]);
    assert.doesNotMatch(String(classified), /SYNTHETIC_SECRET|postgresql|owner|host/);
    assert.equal(classified.cause, undefined);
  }
  const gate = new OperationsError("AUTH_TABLE_DATA_IN_DUMP");
  assert.equal(backupPhaseError(gate, "DB_EXPORT").code, "DB_EXPORT_FAILED");
  assert.throws(() => backupPhaseError(error, "SYNTHETIC_SECRET" as never), /BACKUP_DIAGNOSTIC_PHASE_INVALID/);
});
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
test("reviewed display weights include LOVD 400 and reject unreviewed values", () => {
  const baseTokens = structuredClone(templateRegistry.presentation[0].tokens);
  const rowForWeight = (displayWeight: number) => ({
    theme_config_json: {
      version: 1,
      tokens: {
        ...structuredClone(baseTokens),
        typography: { ...baseTokens.typography, displayWeight },
      },
    },
  });

  for (const displayWeight of [400, 700, 800, 900]) {
    assert.doesNotThrow(() => inspectRow(rowForWeight(displayWeight), new Set(), "pubquiz", "presentation_templates"));
  }

  assert.throws(
    () => inspectRow(rowForWeight(500), new Set(), "pubquiz", "presentation_templates"),
    /DESIGN_TOKEN_VALUE_REVIEW_REQUIRED/,
  );
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
test("workflow schedules only the existing backup core and keeps restore behind its explicit reviewer boundary", () => {
  const text = readFileSync(new URL("../../.github/workflows/ap94-acceptance.yml", import.meta.url), "utf8");
  assert.match(text, /environment: operations-backup/); assert.match(text, /environment: operations-restore/);
  assert.match(text, /schedule:/); assert.match(text, /cron: '30 2 \* \* \*'/);
  assert.match(text, /restore_after_backup/); assert.match(text, /AP96_RUN_RESTORE: \$\{\{ inputs.mode == 'restore-preflight' && 'false' \|\| 'true' \}\}/);
  assert.match(text, /BACKUP_AUTOMATION_ENABLED/); assert.match(text, /BACKUP_RETENTION_VERIFIED/);
  assert.match(text, /steps\.backup\.outcome == 'success'/);
  assert.match(text, /retention-dry-run/); assert.match(text, /AP96_RETENTION_REUSE_EXISTING/);
  assert.match(text, /inputs\.mode == 'retention-dry-run' && 'false'/);
  assert.ok(text.indexOf("acceptance-cli.ts backup") < text.indexOf("retention-cli.ts"));
  assert.match(text, /needs: \[backup, verify-existing-backup\]/); assert.match(text, /group: ap94-manual-acceptance/);
  assert.equal((text.match(/actions\/upload-artifact@v4/g) ?? []).length, 3);
  assert.match(text, /name: external-import-backup-evidence[\s\S]+path: \$\{\{ runner\.temp \}\}\/external-import-backup-evidence\.json/);
  assert.doesNotMatch(text, /path:.*(?:database\.dump|auth-redacted\.json|manifest\.json|pubquiz-ap94)/);
  assert.doesNotMatch(text, /environment: production|db:deploy|--prod|contents: write|BACKUP_BLOB_READ_WRITE_TOKEN/);
});
test("restore remains explicit workflow-dispatch only and is independent from automation switches", () => {
  const restore = { ...env, AP96_RUN_RESTORE: "true", BACKUP_AUTOMATION_ENABLED: "true", BACKUP_RETENTION_VERIFIED: "true" };
  assert.doesNotThrow(() => assertRestoreAcceptance(restore));
  for (const [key, value] of Object.entries({ AP96_RUN_RESTORE: "false", GITHUB_EVENT_NAME: "schedule", GITHUB_REF: "refs/heads/other" })) {
    assert.throws(() => assertRestoreAcceptance({ ...restore, [key]: value }), /MANUAL_RESTORE_ACCEPTANCE_REQUIRED/);
  }
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

for (const phase of Object.keys(backupFailureCodes) as (keyof typeof backupFailureCodes)[]) {
  test(`safe diagnostic ${phase}: failure aborts and cannot leak or mark success`, async () => {
    const artifacts = Object.freeze({ previous: "immutable-old-backup" });
    let completed = false; let nextPhase = false;
    const error = new Error("postgresql://owner:SYNTHETIC_SECRET@host/db", { cause: { token: "SYNTHETIC_SECRET" } });
    try {
      await backupPhase(phase, async () => { throw error; });
      nextPhase = true; completed = true;
    } catch (caught) {
      assert.deepEqual(backupFailureEvidence(caught), { version: 1, status: "FAIL", phase, code: backupFailureCodes[phase] });
      assert.doesNotMatch(JSON.stringify(backupFailureEvidence(caught)), /SYNTHETIC_SECRET|postgresql|owner|host/);
      assert.equal((caught as Error).cause, undefined);
    }
    assert.equal(completed, false); assert.equal(nextPhase, false);
    assert.deepEqual(artifacts, { previous: "immutable-old-backup" });
  });
}
test("actual private upload distinguishes PUT, readback and checksum failure", async () => {
  for (const phase of ["DATA_UPLOAD", "PRIVATE_READBACK", "ARTIFACT_INTEGRITY"] as const) {
    const calls: string[] = [];
    const store = Object.create(PrivateArtifacts.prototype) as PrivateArtifacts;
    Object.assign(store, { client: {
      upload: async () => { calls.push("upload"); if (phase === "DATA_UPLOAD") throw new Error("SYNTHETIC_SECRET"); },
      read: async () => { calls.push("read"); if (phase === "PRIVATE_READBACK") throw new Error("SYNTHETIC_SECRET"); return Buffer.from("corrupt"); },
    } });
    await assert.rejects(backupPhase("DATA_UPLOAD", () => store.upload("database.dump", Buffer.from("original"))), error => {
      assert.equal(backupFailureEvidence(error).phase, phase); return true;
    });
    assert.deepEqual(calls, phase === "DATA_UPLOAD" ? ["upload"] : ["upload", "read"]);
  }
});
test("nested manifest verification failure remains readback/integrity, not manifest upload", async () => {
  await assert.rejects(backupPhase("MANIFEST_UPLOAD", () => backupPhase("PRIVATE_READBACK", async () => { throw new Error("secret"); })), error => {
    assert.equal(backupFailureEvidence(error).code, "PRIVATE_READBACK_FAILED"); return true;
  });
});
test("failure artifact is gated, minimal, and cannot enable success/restore/retention", () => {
  const workflow=readFileSync(".github/workflows/ap94-acceptance.yml","utf8");
  assert.match(workflow, /if: failure\(\) && steps\.backup\.outcome == 'failure'/);
  assert.match(workflow, /name: backup-failure-code/);
  assert.match(workflow, /path: \$\{\{ runner\.temp \}\}\/backup-failure\.json/);
  const cli=readFileSync("scripts/operations/acceptance-cli.ts","utf8");
  assert.ok(cli.indexOf("process.exitCode = 1") < cli.indexOf("backupFailureEvidence(error)"));
  assert.match(cli, /flag: "wx"/);
  const core=readFileSync("scripts/operations/acceptance-backup.ts","utf8");
  assert.match(core, /if \(!failed\) throw backupPhaseError/);
  for (const phase of ["DB_EXPORT","DUMP_INTEGRITY","MANIFEST_UPLOAD","ANONYMOUS_READBACK"]) assert.ok(core.includes(`phase = "${phase}"`));
});

test("real backup CLI fails closed and creates only safe new evidence", async () => {
  const directory = await mkdtemp(join(tmpdir(), "backup-safe-test-"));
  const path = join(directory, "failure.json");
  const run = () => new Promise<{ code: number | null; stdout: string; stderr: string }>(resolve => {
    const child = spawn(process.execPath, ["--import", "tsx", "scripts/operations/acceptance-cli.ts", "backup"], {
      env: { NODE_ENV: "test", PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, BACKUP_FAILURE_EVIDENCE_PATH: path,
        GITHUB_REPOSITORY: "invalid/SYNTHETIC_SECRET", PRODUCTION_BACKUP_DATABASE_URL: "postgresql://owner:SYNTHETIC_SECRET@invalid/db" },
      windowsHide: true,
    });
    let stdout = ""; let stderr = "";
    child.stdout.on("data", value => { stdout += value; }); child.stderr.on("data", value => { stderr += value; });
    child.on("close", code => resolve({ code, stdout, stderr }));
  });
  try {
    const result = await run();
    assert.equal(result.code, 1); assert.equal(result.stdout, "");
    assert.doesNotMatch(result.stderr, /SYNTHETIC_SECRET|postgresql|owner|invalid/);
    assert.deepEqual(JSON.parse(readFileSync(path,"utf8")), { version: 1, status: "FAIL", phase: "PREPARATION", code: "BACKUP_PREPARATION_FAILED" });
    await writeFile(path,"existing-protected-evidence");
    const repeated = await run();
    assert.equal(repeated.code,1); assert.equal(readFileSync(path,"utf8"),"existing-protected-evidence");
    assert.match(repeated.stderr,/BACKUP_DIAGNOSTIC_WRITE_FAILED/);
  } finally { await rm(directory,{recursive:true,force:true}); }
});
