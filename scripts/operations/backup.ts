import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { get, put } from "@vercel/blob";
import { Client } from "pg";
import { assertDatabase, assertDumpIntegrity, backupPolicy, requireCondition } from "./guards";

// Uploads only to a separately provisioned PRIVATE store; never fall back to app media.
export async function backupProduction(env: Readonly<Record<string, string | undefined>>) {
  const identity = assertDatabase(env.PRODUCTION_BACKUP_DATABASE_URL, "production");
  const policy = backupPolicy(env.BACKUP_KIND ?? "daily");
  const token = env.BACKUP_BLOB_READ_WRITE_TOKEN;
  const host = env.BACKUP_PRIVATE_BLOB_HOST;
  requireCondition(token && host && /^[a-z0-9]+\.private\.blob\.vercel-storage\.com$/.test(host), "BLOCKED_PRIVATE_BACKUP_STORAGE_REQUIRED");
  // Same store-ID extraction as the installed @vercel/blob SDK; reject mismatch before export.
  const storeId = /^vercel_blob_rw_([A-Za-z0-9]+)_/.exec(token)?.[1];
  requireCondition(storeId && `${storeId.toLowerCase()}.private.blob.vercel-storage.com` === host, "BACKUP_TOKEN_STORE_MISMATCH");
  requireCondition(env.BACKUP_RETENTION_VERIFIED === "true", "BLOCKED_RETENTION_SETUP_REQUIRED");
  requireCondition(/^[a-f0-9]{40}$/.test(env.PRODUCTION_RELEASE_SHA ?? ""), "RELEASE_SHA_REQUIRED");
  const url = new URL(env.PRODUCTION_BACKUP_DATABASE_URL!);
  requireCondition(decodeURIComponent(url.username) === "pubquiz_backup_reader", "READ_ONLY_BACKUP_ROLE_REQUIRED");
  url.hostname = identity.host;
  url.searchParams.delete("schema");
  // Reject connection options that could override host/db or execute session setup.
  for (const key of url.searchParams.keys()) requireCondition(key === "sslmode", "DATABASE_OPTION_REJECTED");
  requireCondition(url.searchParams.get("sslmode") === "verify-full", "DATABASE_TLS_VERIFY_FULL_REQUIRED");
  const client = new Client({ connectionString: url.toString(), options: "-c default_transaction_read_only=on" });
  try {
    await client.connect();
    const role = await client.query<{ unsafe: boolean }>(`
      SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = current_user
        AND (rolsuper OR rolcreaterole OR rolcreatedb OR rolreplication OR rolbypassrls))
        OR EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
          WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_toast%'
          AND c.relkind IN ('r','p','v','m','f') AND
          (pg_has_role(c.relowner, 'USAGE') OR has_table_privilege(c.oid, 'INSERT,UPDATE,DELETE,TRUNCATE,TRIGGER')))
        OR EXISTS (SELECT 1 FROM pg_namespace WHERE nspname NOT LIKE 'pg_%'
          AND nspname <> 'information_schema' AND has_schema_privilege(oid, 'CREATE'))
        OR has_database_privilege(current_database(), 'CREATE') AS unsafe`);
    requireCondition(role.rows[0]?.unsafe === false, "BACKUP_ROLE_HAS_WRITE_PRIVILEGES");
  } finally { await client.end(); }

  const directory = await mkdtemp(join(tmpdir(), "pubquiz-backup-"));
  const path = join(directory, "database.dump");
  const pgEnv: NodeJS.ProcessEnv = {
    NODE_ENV: "production",
    PATH: env.PATH, SystemRoot: env.SystemRoot,
    PGHOST: identity.host, PGPORT: "5432", PGDATABASE: identity.name,
    PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password),
    PGSSLMODE: "verify-full", PGCONNECT_TIMEOUT: "30",
    PGOPTIONS: "-c default_transaction_read_only=on -c statement_timeout=600000",
  };
  try {
    const dump = spawnSync("pg_dump", ["--format=custom", "--no-owner", "--no-acl", "--file", path], { env: pgEnv, stdio: "ignore", timeout: 900000 });
    const bytes = await stat(path).then(s => s.size).catch(() => 0);
    const list = dump.status === 0 && bytes > 0
      ? spawnSync("pg_restore", ["--list", path], { env: { NODE_ENV: "production", PATH: env.PATH, SystemRoot: env.SystemRoot }, stdio: "ignore", timeout: 60000 })
      : { status: null };
    assertDumpIntegrity(dump.status, bytes, list.status);
    const localHash = createHash("sha256");
    for await (const chunk of createReadStream(path)) localHash.update(chunk);
    const sha256 = localHash.digest("hex");
    const createdAt = new Date().toISOString();
    const key = `production/${policy.kind}/${createdAt.replace(/[:.]/g, "-")}-${env.PRODUCTION_RELEASE_SHA}-${randomUUID()}`;
    const blob = await put(`${key}/database.dump`, createReadStream(path), { token, access: "private", addRandomSuffix: false, allowOverwrite: false, contentType: "application/octet-stream" });
    requireCondition(new URL(blob.url).hostname === host, "BACKUP_STORE_IDENTITY_MISMATCH");
    const restored = await get(blob.url, { token, access: "private", useCache: false });
    requireCondition(restored?.statusCode === 200 && restored.stream, "BACKUP_READBACK_FAILED");
    const hash = createHash("sha256");
    const reader = restored.stream.getReader();
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        hash.update(chunk.value);
      }
    } finally { reader.releaseLock(); }
    requireCondition(hash.digest("hex") === sha256, "BACKUP_READBACK_CHECKSUM_FAILED");
    // The manifest is the completion marker. A failed upload never becomes valid.
    const manifest = { version: 1, environment: "production", database: identity, release: env.PRODUCTION_RELEASE_SHA, createdAt, ...policy, bytes, sha256, dumpKey: `${key}/database.dump`, restoredAndValidated: false };
    await writeFile(join(directory, "manifest.json"), JSON.stringify(manifest), { mode: 0o600 });
    await put(`${key}/manifest.json`, JSON.stringify(manifest), { token, access: "private", addRandomSuffix: false, allowOverwrite: false, contentType: "application/json" });
    return { createdAt, kind: policy.kind, bytes, sha256, integrity: "verified", restoreTest: "still required" };
  } finally { await rm(directory, { recursive: true, force: true }); }
}
