import { parseManifest } from "./acceptance-restore";
import type { AcceptanceManifest } from "./acceptance-backup";
import type { BackupMetadata, BackupType } from "./backup-metadata";
import { BridgeClient } from "./bridge-client";
import { runKey, type InventoryObject } from "./bridge/lib/contract";
import { OperationsError, requireCondition } from "./guards";
import { artifactName, backupKey } from "./private-artifacts";
import { sha256 } from "./snapshot";

export const RETENTION_POLICY = {
  dailyDays: 14,
  weeklyWeeks: 8,
  monthlyMonths: 0,
} as const;

export type RetentionReason =
  | "latest-valid"
  | "protected"
  | "daily-window"
  | "weekly-point"
  | "outside-policy"
  | "weekly-duplicate"
  | "legacy-protected"
  | "incomplete-or-invalid"
  | "foreign-path";

export type RetentionDecision = {
  key: string;
  action: "keep" | "delete";
  reason: RetentionReason;
  type: BackupType | "legacy" | "unknown";
  protected: boolean;
  snapshotAt: string | null;
  ageDays: number | null;
  bytes: number;
  objects: InventoryObject[];
};

export type RetentionPlan = {
  policy: typeof RETENTION_POLICY;
  currentKey: string;
  generatedAt: string;
  decisions: RetentionDecision[];
  foreignObjects: InventoryObject[];
  beforeBytes: number;
  afterBytes: number;
  deleteBytes: number;
};

type LoadedManifest = { bytes: Buffer; manifest: AcceptanceManifest; metadata: BackupMetadata | null };

function utcWeek(value: number) {
  const date = new Date(value);
  const mondayOffset = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - mondayOffset);
  return date.toISOString().slice(0, 10);
}

function totalBytes(objects: readonly InventoryObject[]) {
  return objects.reduce((sum, object) => sum + object.size, 0);
}

function groupedInventory(objects: readonly InventoryObject[]) {
  const groups = new Map<string, InventoryObject[]>();
  const foreign: InventoryObject[] = [];
  const seen = new Set<string>();
  for (const object of objects) {
    requireCondition(!seen.has(object.pathname), "RETENTION_DUPLICATE_OBJECT");
    seen.add(object.pathname);
    const match = /^(production\/acceptance\/run-[1-9][0-9]{0,19}-[1-9][0-9]{0,5})\/([a-z0-9][a-z0-9.-]{0,100})$/.exec(object.pathname);
    if (!match || match[2].includes("..")) { foreign.push(object); continue; }
    const values = groups.get(match[1]) ?? [];
    values.push(object); groups.set(match[1], values);
  }
  return { groups, foreign };
}

function manifestInventory(key: string, objects: readonly InventoryObject[], bytes: Buffer): LoadedManifest {
  const manifest = parseManifest(bytes, sha256(bytes), key);
  const expected = new Map(manifest.artifacts.map(artifact => [artifactName(artifact.name), artifact.bytes]));
  expected.set("manifest.json", bytes.length);
  requireCondition(objects.length === expected.size, "RETENTION_BACKUP_OBJECT_SET_INVALID");
  for (const object of objects) {
    const name = object.pathname.slice(`${key}/`.length);
    requireCondition(expected.get(name) === object.size, "RETENTION_BACKUP_OBJECT_SET_INVALID");
  }
  return {
    bytes,
    manifest,
    metadata: manifest.version === 3 && manifest.backup ? manifest.backup : null,
  };
}

export function createRetentionPlan(
  objects: readonly InventoryObject[],
  manifests: ReadonlyMap<string, Buffer>,
  currentKey: string,
  currentManifestSha256: string,
  now = Date.now(),
): RetentionPlan {
  backupKey(currentKey);
  requireCondition(/^[a-f0-9]{64}$/.test(currentManifestSha256), "RETENTION_CURRENT_MANIFEST_SHA_INVALID");
  const { groups, foreign } = groupedInventory(objects);
  const valid: { key: string; objects: InventoryObject[]; loaded: LoadedManifest; snapshot: number }[] = [];
  const invalid: RetentionDecision[] = [];

  for (const [key, grouped] of groups) {
    const bytes = manifests.get(key);
    if (!bytes) {
      invalid.push({ key, action: "keep", reason: "incomplete-or-invalid", type: "unknown", protected: true,
        snapshotAt: null, ageDays: null, bytes: totalBytes(grouped), objects: grouped });
      continue;
    }
    try {
      const loaded = manifestInventory(key, grouped, bytes);
      const snapshot = Date.parse(loaded.manifest.snapshotAt);
      requireCondition(snapshot <= now + 5 * 60 * 1000, "RETENTION_SNAPSHOT_IN_FUTURE");
      valid.push({ key, objects: grouped, loaded, snapshot });
    } catch {
      invalid.push({ key, action: "keep", reason: "incomplete-or-invalid", type: "unknown", protected: true,
        snapshotAt: null, ageDays: null, bytes: totalBytes(grouped), objects: grouped });
    }
  }

  const current = valid.find(item => item.key === currentKey);
  requireCondition(current && sha256(current.loaded.bytes) === currentManifestSha256, "RETENTION_CURRENT_BACKUP_NOT_VALID");
  valid.sort((left, right) => right.snapshot - left.snapshot || right.key.localeCompare(left.key));
  const latest = valid[0];
  requireCondition(latest.key === currentKey, "RETENTION_CURRENT_BACKUP_NOT_LATEST");

  const usedWeeks = new Set<string>();
  const decisions: RetentionDecision[] = [];
  for (const item of valid) {
    const ageDays = Math.max(0, (now - item.snapshot) / 86_400_000);
    const metadata = item.loaded.metadata;
    const legacy = metadata === null;
    let action: "keep" | "delete" = "keep";
    let reason: RetentionReason;
    if (item.key === latest.key) reason = "latest-valid";
    else if (legacy) reason = "legacy-protected";
    else if (metadata!.protected) reason = "protected";
    else if (ageDays < RETENTION_POLICY.dailyDays) reason = "daily-window";
    else if (ageDays < RETENTION_POLICY.dailyDays + RETENTION_POLICY.weeklyWeeks * 7) {
      const week = utcWeek(item.snapshot);
      if (!usedWeeks.has(week)) { usedWeeks.add(week); reason = "weekly-point"; }
      else { action = "delete"; reason = "weekly-duplicate"; }
    } else { action = "delete"; reason = "outside-policy"; }
    decisions.push({ key: item.key, action, reason, type: legacy ? "legacy" : metadata!.type,
      protected: legacy || metadata!.protected, snapshotAt: item.loaded.manifest.snapshotAt, ageDays,
      bytes: totalBytes(item.objects), objects: item.objects });
  }
  decisions.push(...invalid);
  decisions.sort((left, right) => left.key.localeCompare(right.key));
  const beforeBytes = totalBytes(objects);
  const deleteBytes = decisions.filter(item => item.action === "delete").reduce((sum, item) => sum + item.bytes, 0);
  return { policy: RETENTION_POLICY, currentKey, generatedAt: new Date(now).toISOString(), decisions,
    foreignObjects: foreign, beforeBytes, afterBytes: beforeBytes - deleteBytes, deleteBytes };
}

function inventoryFingerprint(objects: readonly InventoryObject[]) {
  return objects.map(object => `${object.pathname}\0${object.size}\0${object.uploadedAt}\0${object.etag}`).sort().join("\n");
}

export async function applyRetentionPlan(
  plan: RetentionPlan,
  verified: boolean,
  initialInventory: readonly InventoryObject[],
  freshInventory: readonly InventoryObject[],
  remove: (key: string, object: InventoryObject) => Promise<void>,
) {
  if (!verified) return 0;
  requireCondition(inventoryFingerprint(freshInventory) === inventoryFingerprint(initialInventory), "RETENTION_INVENTORY_CHANGED");
  let deletedObjects = 0;
  for (const decision of plan.decisions.filter(item => item.action === "delete")) {
    requireCondition(decision.key !== plan.currentKey && decision.reason !== "latest-valid" && !decision.protected, "RETENTION_DELETE_GUARD_FAILED");
    const ordered = [...decision.objects].sort((left, right) =>
      Number(right.pathname.endsWith("/manifest.json")) - Number(left.pathname.endsWith("/manifest.json")) || left.pathname.localeCompare(right.pathname));
    for (const object of ordered) { await remove(decision.key, object); deletedObjects++; }
  }
  return deletedObjects;
}

export async function retentionAfterBackup(env: Readonly<Record<string, string | undefined>>, currentKey: string, currentManifestSha256: string) {
  requireCondition(env.BACKUP_RETENTION_VERIFIED === "true" || env.BACKUP_RETENTION_VERIFIED === "false", "BACKUP_RETENTION_SWITCH_INVALID");
  const client = new BridgeClient(env, "backup", retentionClientKey(env, currentKey));
  const inventory = await client.retentionInventory();
  const grouped = groupedInventory(inventory).groups;
  const manifests = new Map<string, Buffer>();
  for (const [key, objects] of grouped) {
    if (objects.some(object => object.pathname === `${key}/manifest.json`)) {
      try { manifests.set(key, await client.retentionReadManifest(key)); }
      catch (error) { if (key === currentKey) throw error; }
    }
  }
  const plan = createRetentionPlan(inventory, manifests, currentKey, currentManifestSha256);
  if (env.BACKUP_RETENTION_VERIFIED === "false") return { dryRun: true, deletedObjects: 0, plan };

  const fresh = await client.retentionInventory();
  const deletedObjects = await applyRetentionPlan(plan, true, inventory, fresh, (key, object) => client.retentionDelete(key, object));
  return { dryRun: false, deletedObjects, plan };
}

export function retentionClientKey(env: Readonly<Record<string, string | undefined>>, currentKey: string) {
  const executionKey = runKey("acceptance", env.GITHUB_RUN_ID ?? "", env.GITHUB_RUN_ATTEMPT ?? "");
  if (env.AP96_RETENTION_REUSE_EXISTING === "true") {
    requireCondition(env.BACKUP_RETENTION_VERIFIED === "false", "RETENTION_REUSE_MUST_BE_DRY_RUN");
    backupKey(currentKey);
  } else requireCondition(currentKey === executionKey, "RETENTION_CURRENT_RUN_REQUIRED");
  return executionKey;
}

export function safeRetentionError(error: unknown) {
  return error instanceof OperationsError ? error.code : "RETENTION_FAILED_DETAILS_WITHHELD";
}
