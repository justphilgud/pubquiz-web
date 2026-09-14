import { spawnSync } from "node:child_process";
import { assertOperationTransport, databaseIdentity, OperationsError, requireCondition } from "./guards";

// Called only after the source/target/role guards. Do not inherit PGHOSTADDR,
// PGSERVICE, PGSSLROOTCERT=system or PGOPTIONS from the operator's shell.
export function libpqEnvironment(connectionString: string, env: Readonly<Record<string, string | undefined>>): NodeJS.ProcessEnv {
  const identity = databaseIdentity(connectionString);
  const url = new URL(connectionString);
  assertOperationTransport(url);
  return {
    NODE_ENV: "production",
    PATH: env.PATH, SystemRoot: env.SystemRoot,
    PGHOST: identity.host, PGPORT: "5432", PGDATABASE: identity.name,
    PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password),
    PGSSLMODE: url.searchParams.get("sslmode")!, PGCHANNELBINDING: "require",
    PGCONNECT_TIMEOUT: "30", PGCLIENTENCODING: "UTF8",
    PGOPTIONS: "-c default_transaction_read_only=on -c statement_timeout=600000",
  };
}

type QueryRunner = (args: string[], env: NodeJS.ProcessEnv) => { status: number | null; stdout: string; error?: unknown };
const runPsql: QueryRunner = (args, env) => spawnSync("psql", args, {
  env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
  timeout: 90000, maxBuffer: 1024 * 1024,
});

export function readOnlyQuery<T>(connectionString: string, query: string, env: Readonly<Record<string, string | undefined>>, run: QueryRunner = runPsql): { rows: T[] } {
  // Only internal SELECTs. One psql invocation owns the whole read-only transaction.
  requireCondition(/^\s*SELECT\b/i.test(query) && !query.includes(";"), "OPERATIONS_SELECT_REQUIRED");
  const sql = `BEGIN READ ONLY; SELECT coalesce(json_agg(result), '[]'::json) FROM (${query}) result; COMMIT;`;
  const result = run(["-X", "-w", "-qAt", "-v", "ON_ERROR_STOP=1", "-c", sql], libpqEnvironment(connectionString, env));
  requireCondition(!result.error && result.status === 0, "OPERATIONS_LIBPQ_QUERY_FAILED");
  try {
    const rows: unknown = JSON.parse(result.stdout);
    requireCondition(Array.isArray(rows), "OPERATIONS_LIBPQ_RESULT_INVALID");
    return { rows: rows as T[] };
  } catch { throw new OperationsError("OPERATIONS_LIBPQ_RESULT_INVALID"); }
}
