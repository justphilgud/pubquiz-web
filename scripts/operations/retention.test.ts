import assert from "node:assert/strict";
import test from "node:test";
import { backupMetadataFromEnvironment, validateBackupMetadata, type BackupMetadata } from "./backup-metadata";
import type { AcceptanceManifest } from "./acceptance-backup";
import { RESTORE_TARGET } from "./acceptance-policy";
import type { InventoryObject } from "./bridge/lib/contract";
import { applyRetentionPlan, createRetentionPlan } from "./retention";
import { sha256 } from "./snapshot";

const now = Date.UTC(2026, 8, 17, 12);

function backup(run: number, ageDays: number, metadata: BackupMetadata | null) {
  const key = `production/acceptance/run-${run}-1`;
  const snapshotAt = new Date(now - ageDays * 86_400_000).toISOString();
  const manifest: AcceptanceManifest = {
    version: metadata ? 3 : 2,
    mode: metadata ? "production-backup" : "ap94-manual",
    ...(metadata ? { backup: metadata } : {}),
    key, snapshotAt, completedAt: new Date(Date.parse(snapshotAt) + 60_000).toISOString(),
    release: "a".repeat(40), operationsCommit: "b".repeat(40),
    source: { host: "ep-dawn-paper-alws45vx.c-3.eu-central-1.aws.neon.tech", name: "neondb", schema: "pubquiz" },
    target: RESTORE_TARGET,
    authExcluded: ["pubquiz.users.password_hash", "pubquiz.teams.team_passwort"],
    expected: { columns: [], catalog: {}, tables: [], media: [], resultRows: [] },
    artifacts: [
      { name: "database.dump", bytes: 100, sha256: "c".repeat(64) },
      { name: "auth-redacted.json", bytes: 20, sha256: "d".repeat(64) },
    ],
    media: [], sequenceSql: [], timings: { backupMs: 1, mediaMs: 0 },
  };
  const bytes = Buffer.from(JSON.stringify(manifest));
  const objects: InventoryObject[] = [
    { pathname: `${key}/database.dump`, size: 100, uploadedAt: snapshotAt, etag: `db-${run}` },
    { pathname: `${key}/auth-redacted.json`, size: 20, uploadedAt: snapshotAt, etag: `auth-${run}` },
    { pathname: `${key}/manifest.json`, size: bytes.length, uploadedAt: snapshotAt, etag: `manifest-${run}` },
  ];
  return { key, bytes, objects };
}

test("backup execution distinguishes disabled schedule from protected manual types", () => {
  const base = { GITHUB_REPOSITORY: "justphilgud/pubquiz-web", GITHUB_REF: "refs/heads/main",
    BACKUP_AUTOMATION_ENABLED: "false", BACKUP_RETENTION_VERIFIED: "false" };
  assert.throws(() => backupMetadataFromEnvironment({ ...base, GITHUB_EVENT_NAME: "schedule" }), /BACKUP_AUTOMATION_DISABLED/);
  assert.deepEqual(backupMetadataFromEnvironment({ ...base, GITHUB_EVENT_NAME: "schedule", BACKUP_AUTOMATION_ENABLED: "true" }),
    { type: "scheduled", protected: false, trigger: "schedule" });
  assert.deepEqual(backupMetadataFromEnvironment({ ...base, GITHUB_EVENT_NAME: "workflow_dispatch", AP94_MANUAL_ACCEPTANCE: "true",
    AP96_BACKUP_TYPE: "pre-event", AP96_BACKUP_PROTECTED: "false" }),
    { type: "pre-event", protected: true, trigger: "workflow_dispatch" });
  assert.throws(() => validateBackupMetadata({ type: "scheduled", protected: true, trigger: "schedule" }));
});

test("retention keeps latest, daily, weekly, protected and legacy backups while selecting only eligible old points", () => {
  const current = backup(900, 0, { type: "manual", protected: false, trigger: "workflow_dispatch" });
  const daily = backup(899, 5, { type: "scheduled", protected: false, trigger: "schedule" });
  const weekly = backup(898, 20, { type: "scheduled", protected: false, trigger: "schedule" });
  const weeklyDuplicate = backup(897, 21, { type: "scheduled", protected: false, trigger: "schedule" });
  const old = backup(896, 80, { type: "scheduled", protected: false, trigger: "schedule" });
  const protectedBackup = backup(895, 100, { type: "pre-event", protected: true, trigger: "workflow_dispatch" });
  const legacy = backup(894, 200, null);
  const incomplete: InventoryObject = { pathname: "production/acceptance/run-893-1/database.dump", size: 55,
    uploadedAt: new Date(now).toISOString(), etag: "incomplete" };
  const foreign: InventoryObject = { pathname: "production/acceptance/unexpected.bin", size: 10,
    uploadedAt: new Date(now).toISOString(), etag: "foreign" };
  const backups = [current, daily, weekly, weeklyDuplicate, old, protectedBackup, legacy];
  const inventory = [...backups.flatMap(item => item.objects), incomplete, foreign];
  const manifests = new Map<string, Buffer>(backups.map(item => [item.key, item.bytes]));
  const plan = createRetentionPlan(inventory, manifests, current.key, sha256(current.bytes), now);
  const decision = (key: string) => plan.decisions.find(item => item.key === key)!;
  assert.deepEqual([decision(current.key).action, decision(current.key).reason], ["keep", "latest-valid"]);
  assert.equal(decision(daily.key).reason, "daily-window");
  assert.equal(decision(weekly.key).reason, "weekly-point");
  assert.deepEqual([decision(weeklyDuplicate.key).action, decision(weeklyDuplicate.key).reason], ["delete", "weekly-duplicate"]);
  assert.deepEqual([decision(old.key).action, decision(old.key).reason], ["delete", "outside-policy"]);
  assert.equal(decision(protectedBackup.key).reason, "protected");
  assert.equal(decision(legacy.key).reason, "legacy-protected");
  assert.equal(decision("production/acceptance/run-893-1").reason, "incomplete-or-invalid");
  assert.deepEqual(plan.foreignObjects, [foreign]);
  assert.equal(plan.afterBytes, plan.beforeBytes - decision(weeklyDuplicate.key).bytes - decision(old.key).bytes);
});

test("retention dry run never deletes and enabled execution rechecks inventory and removes manifest first", async () => {
  const current = backup(910, 0, { type: "scheduled", protected: false, trigger: "schedule" });
  const old = backup(909, 90, { type: "scheduled", protected: false, trigger: "schedule" });
  const inventory = [...current.objects, ...old.objects];
  const manifests = new Map<string, Buffer>([[current.key, current.bytes], [old.key, old.bytes]]);
  const plan = createRetentionPlan(inventory, manifests, current.key, sha256(current.bytes), now);
  const calls: string[] = [];
  assert.equal(await applyRetentionPlan(plan, false, inventory, [], async (_key, object) => { calls.push(object.pathname); }), 0);
  assert.equal(calls.length, 0);
  assert.equal(await applyRetentionPlan(plan, true, inventory, [...inventory], async (_key, object) => { calls.push(object.pathname); }), 3);
  assert.equal(calls[0], `${old.key}/manifest.json`);
  await assert.rejects(applyRetentionPlan(plan, true, inventory, inventory.slice(1), async () => undefined), /RETENTION_INVENTORY_CHANGED/);
});

test("retention rejects a nonlatest current backup and never treats malformed current data as valid", () => {
  const current = backup(920, 2, { type: "manual", protected: false, trigger: "workflow_dispatch" });
  const newer = backup(921, 0, { type: "scheduled", protected: false, trigger: "schedule" });
  const manifests = new Map<string, Buffer>([[current.key, current.bytes], [newer.key, newer.bytes]]);
  assert.throws(() => createRetentionPlan([...current.objects, ...newer.objects], manifests, current.key, sha256(current.bytes), now),
    /RETENTION_CURRENT_BACKUP_NOT_LATEST/);
  assert.throws(() => createRetentionPlan(current.objects, new Map<string, Buffer>([[current.key, Buffer.from("{}")]]), current.key, sha256(current.bytes), now),
    /RETENTION_CURRENT_BACKUP_NOT_VALID/);
});
