import { Client } from "pg";
import { resolvePrismaCliConnection } from "./prisma-cli-connection";
import { validateDeploymentEnvironment } from "./validate-deployment-environment";

async function main() {
  if (process.env.DEPLOYMENT_ENV !== "preview") return;
  validateDeploymentEnvironment({
    deploymentEnvironment: process.env.DEPLOYMENT_ENV,
    deploymentEvent: process.env.DEPLOYMENT_EVENT,
    deploymentRef: process.env.DEPLOYMENT_REF,
    deploymentRepository: process.env.DEPLOYMENT_REPOSITORY,
    databaseUrl: process.env.DATABASE_URL,
    expectedDatabaseBranch: process.env.EXPECTED_DATABASE_BRANCH,
    expectedDatabaseHost: process.env.EXPECTED_DATABASE_HOST,
    expectedDatabaseName: process.env.EXPECTED_DATABASE_NAME,
  });
  const client = new Client({
    connectionString: resolvePrismaCliConnection(process.env.DATABASE_URL!, "preview"),
    application_name: "ap1-preview-lock-inspection",
    connectionTimeoutMillis: 10000,
    statement_timeout: 10000,
  });
  try {
    await client.connect();
    const locks = await client.query(`
      SELECT a.pid, a.application_name, a.state, a.xact_start IS NULL AS no_transaction,
        a.wait_event_type, a.wait_event, l.granted,
        EXTRACT(EPOCH FROM (now() - a.state_change))::int AS state_age_seconds,
        a.query = 'SELECT pg_advisory_lock(72707369)' AS last_query_is_migration_lock,
        a.query LIKE '%pg_advisory_unlock%' AS last_query_is_unlock
      FROM pg_locks l JOIN pg_stat_activity a ON a.pid = l.pid
      WHERE l.locktype = 'advisory' AND l.classid = 0 AND l.objid = 72707369
        AND l.database = (SELECT oid FROM pg_database WHERE datname = current_database())
    `);
    console.info("Preview migration lock inspection:", JSON.stringify(locks.rows));
    const releaseArgument = process.argv.find((value) => value.startsWith("--release-idle-pid="));
    if (releaseArgument) {
      const pid = Number(releaseArgument.split("=")[1]);
      if (!Number.isSafeInteger(pid) || pid <= 0) throw new Error("Invalid PID");
      const released = await client.query(`
        SELECT a.pid, pg_terminate_backend(a.pid) AS released
        FROM pg_stat_activity a
        WHERE a.pid = $1 AND a.datname = current_database()
          AND a.application_name = 'pgbouncer' AND a.state = 'idle'
          AND a.xact_start IS NULL AND a.wait_event = 'ClientRead'
          AND a.state_change < now() - interval '2 minutes'
          AND EXISTS (
            SELECT 1 FROM pg_locks l WHERE l.pid = a.pid
              AND l.locktype = 'advisory' AND l.classid = 0
              AND l.objid = 72707369 AND l.granted
          )
      `, [pid]);
      console.info("Targeted idle Preview migration session release:", JSON.stringify(released.rows));
    }
  } finally {
    await client.end();
  }
}

void main().catch(() => {
  console.error("Preview migration lock operation failed; inspect the preceding diagnostic result.");
  process.exitCode = 1;
});
