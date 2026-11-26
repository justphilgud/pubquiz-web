import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Client } from "pg";
import bcrypt from "bcryptjs";
import { BINGO_EVENING_REVIEW_DATABASE as review, validateDeploymentEnvironment } from "../validate-deployment-environment";

// Only a new, empty, exact synthetic database. Never resets, truncates or repairs a database.
async function main() {
  const url = new URL(process.env.BINGO_EVENING_DIRECT_DATABASE_URL ?? "");
  validateDeploymentEnvironment({ deploymentEnvironment: "preview", deploymentEvent: "workflow_dispatch",
    deploymentRepository: "justphilgud/pubquiz-web", deploymentRef: "refs/heads/" + review.branch,
    databaseUrl: url.toString(), expectedDatabaseHost: review.host, expectedDatabaseName: review.name, expectedDatabaseBranch: review.endpoint });
  const db = new Client({ connectionString: url.toString() });
  await db.connect();
  try {
    const existing = await db.query("SELECT count(*)::int n FROM pg_tables WHERE schemaname='pubquiz'");
    assert.equal(existing.rows[0].n, 0, "EMPTY_SYNTHETIC_DATABASE_REQUIRED");
    const schema = readFileSync('.codex-tmp/bingo-evening-base.sql', 'utf8').replace(/^\\(?:un)?restrict.*$/gm, '');
    assert.ok(!schema.includes('CREATE TABLE pubquiz.game_ceremonies'));
    await db.query(schema);
    await db.query(readFileSync('prisma/migrations/20261126120000_event_ceremony/migration.sql', 'utf8'));
    const account = JSON.parse(readFileSync('.env.bingo-evening-accounts.json', 'utf8')) as {email: string; password: string};
    assert.equal(account.email, 'bingo.evening.admin@example.invalid');
    await db.query('BEGIN');
    await db.query("INSERT INTO pubquiz.users(id,name,email,password_hash,role,is_active,must_change_password,updated_at) VALUES(1,'Bingo evening synthetic admin',$1,$2,'USER',true,false,NOW())", [account.email, await bcrypt.hash(account.password, 10)]);
    await db.query("INSERT INTO pubquiz.benutzer_rollenzuweisungen(benutzer_id,rolle,scope_typ,eventreihe_id) VALUES(1,'ADMIN','GLOBAL',NULL)");
    await db.query("INSERT INTO pubquiz.eventreihen(eventreihe_id,name,slug) VALUES(10,'Binglöckchen · isolierte Abnahme','bingo-evening-review'),(20,'Bingo · fremde Testreihe','bingo-evening-foreign')");
    await db.query("INSERT INTO pubquiz.eventarten(kennung,name) VALUES('QUIZ','Quiz'),('BINGO','Bingo'),('POWERPOINT_KARAOKE','PowerPoint-Karaoke')");
    await db.query("INSERT INTO pubquiz.eventreihe_eventarten(eventreihe_id,eventart,ist_freigeschaltet) SELECT id,t,true FROM unnest(ARRAY[10,20]) id CROSS JOIN unnest(ARRAY['QUIZ','BINGO','POWERPOINT_KARAOKE']) t");
    await db.query('COMMIT');
    console.info('Empty exact synthetic Preview database initialized from local schema only; committed ceremony migration and synthetic admin/series installed. No historical bootstrap replay claimed.');
  } finally { await db.end(); }
}
void main().catch(() => { console.error('BINGO_EVENING_SYNTHETIC_SETUP_FAILED'); process.exitCode = 1; });
