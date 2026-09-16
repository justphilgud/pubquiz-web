import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { aggregate, cardsFor, recordObservation, safeRelease, STALE_MS } from "./model";
import { fixture } from "./fixtures";
import { monitoringResponse } from "./endpoint";
import { createMonitorCache } from "./cache";
import { BACKUP_EVIDENCE } from "./backupEvidence";
import type { AuthorizationActor } from "@/app/roles/roleAssignmentPolicy";

const instant = new Date("2026-09-16T18:00:00Z");
const admin: AuthorizationActor = { userId: 1, assignments: [{ role: "ADMIN", scopeType: "GLOBAL", eventSeriesId: null }] };
const request = (query = "") => new Request(`https://preview.example/api/admin/monitoring${query}`);
const card = (scenario: Parameters<typeof fixture>[0], area: string, offset = 0) => cardsFor(fixture(scenario, instant), instant.getTime() + offset).find(c => c.area === area)!;

test("admin can read; editor, event manager, malformed admin and anonymous cannot even invoke collector", async () => {
  for (const [actor, status] of [[admin, 200], [null, 401],
    [{ userId: 2, assignments: [{ role: "EDITOR", scopeType: "GLOBAL", eventSeriesId: null }] }, 403],
    [{ userId: 3, assignments: [{ role: "EVENT_MANAGER", scopeType: "EVENT_SERIES", eventSeriesId: 1 }] }, 403],
    [{ userId: 4, assignments: [{ role: "ADMIN", scopeType: "EVENT_SERIES", eventSeriesId: 1 }] }, 403]] as const) {
    let reads = 0;
    const response = await monitoringResponse(request(), { actor: async () => actor, read: async () => { reads++; return fixture("healthy", instant); }, preview: () => true });
    assert.equal(response.status, status);
    assert.equal(reads, status === 200 ? 1 : 0);
    assert.match(response.headers.get("cache-control")!, /no-store/);
  }
});

test("health DB success, latency boundary, failed read, and stale evidence", () => {
  assert.equal(card("healthy", "database").severity, "green");
  assert.equal(card("warning", "database").severity, "yellow");
  assert.equal(card("error", "database").severity, "red");
  const snapshot = fixture("healthy", instant);
  snapshot.db.latencyMs = 500;
  assert.equal(cardsFor(snapshot, instant.getTime())[1].severity, "yellow");
  assert.equal(card("healthy", "application", STALE_MS + 1).severity, "yellow");
});

test("unchanged presentation is not stale; no active quiz is healthy; missing data is unknown", () => {
  assert.equal(card("healthy", "live").severity, "green");
  assert.equal(card("no-quiz", "live").summary, "Kein Quiz aktiv");
  assert.equal(card("no-quiz", "live").severity, "green");
  assert.equal(card("error", "live").severity, "yellow");
});

test("persisted save evidence cannot prove save successes, absence or failures", () => {
  const snapshot = fixture("healthy", instant);
  snapshot.live![0].savedAnswers = 12;
  const success = cardsFor(snapshot, instant.getTime()).find(c => c.area === "answers")!;
  assert.equal(success.severity, "yellow");
  assert.match(success.summary, /nicht messbar/);
  snapshot.live = null; // A failed monitor read proves no answer failure.
  assert.equal(cardsFor(snapshot, instant.getTime()).find(c => c.area === "answers")!.severity, "yellow");
  assert.match(success.detail, /Kein Save ohne Bestätigung wird als verloren/);
});

test("historical backup success remains qualified; missing backup is never green", () => {
  const snapshot = fixture("healthy", instant);
  assert.match(cardsFor(snapshot, instant.getTime())[4].summary, /Kein Backupnachweis/);
  snapshot.backup = BACKUP_EVIDENCE;
  assert.equal(cardsFor(snapshot, instant.getTime())[4].severity, "yellow");
  assert.match(cardsFor(snapshot, instant.getTime())[4].detail, /kein automatischer/);
});

test("green/yellow/red aggregate rules prioritize evidence of failure", () => {
  assert.equal(aggregate([{ severity: "green" }]), "green");
  assert.equal(aggregate([{ severity: "green" }, { severity: "yellow" }]), "yellow");
  assert.equal(aggregate([{ severity: "red" }, { severity: "yellow" }]), "red");
  assert.equal(aggregate(cardsFor(fixture("healthy", instant), instant.getTime())), "yellow");
});

test("release is SHA-only, config error is red", () => {
  assert.equal(safeRelease("postgresql://user:secret@host/db"), null);
  assert.equal(safeRelease("abc"), null);
  assert.equal(safeRelease("a".repeat(40)), "a".repeat(40));
  const snapshot = fixture("healthy", instant);
  snapshot.environment = "unknown";
  assert.equal(cardsFor(snapshot, instant.getTime())[0].severity, "red");
});

test("all thrown credential/DB errors are withheld, including auth failure", async () => {
  for (const authFailure of [true, false]) {
    const secret = "postgresql://owner:private-password@host/db?token=secret";
    const response = await monitoringResponse(request(), {
      actor: async () => { if (authFailure) throw new Error(secret); return admin; },
      read: async () => { throw new Error(secret); }, preview: () => true,
    });
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: "MONITORING_UNAVAILABLE" });
  }
});

test("synthetic scenarios require admin AND preview; never execute a database read", async () => {
  for (const preview of [true, false]) {
    const response = await monitoringResponse(request("?scenario=error"), {
      actor: async () => admin, preview: () => preview, read: async () => { throw new Error("must not read"); },
    });
    assert.equal(response.status, preview ? 200 : 400);
    if (preview) assert.equal((await response.json()).simulation, "error");
  }
  const response = await monitoringResponse(request("?scenario=error"), {
    actor: async () => null, preview: () => true, read: async () => fixture("healthy"),
  });
  assert.equal(response.status, 401);
});

test("cache coalesces parallel calls and preserves observation time until expiry", async () => {
  let clock = 0;
  let reads = 0;
  const cached = createMonitorCache(async () => ++reads, 30_000, () => clock);
  assert.deepEqual(await Promise.all([cached(), cached(), cached()]), [1, 1, 1]);
  clock = 29_999;
  assert.equal(await cached(), 1);
  clock = 30_000;
  assert.equal(await cached(), 2);
});

test("rejected collectors do not poison the cache or other work", async () => {
  let calls = 0;
  const read = createMonitorCache(async () => { if (++calls === 1) throw new Error("failure"); return "recovered"; }, 30_000);
  await assert.rejects(read());
  assert.equal(await read(), "recovered");
});

test("history bounded, deduplicated and distinguishes simulations", () => {
  let history = recordObservation([], { at: "1", severity: "yellow", source: "Monitoringread" });
  history = recordObservation(history, { at: "2", severity: "yellow", source: "Monitoringread" });
  assert.equal(history.length, 1);
  for (let i = 0; i < 30; i++) history = recordObservation(history, { at: String(i), severity: "yellow", source: `Simulation ${i}` });
  assert.equal(history.length, 20);
});

test("collector enforces read-only and bounded scoped queries, without live snapshot side effects", () => {
  const source = readFileSync(new URL("./collector.server.ts", import.meta.url), "utf8");
  assert.match(source, /SET TRANSACTION READ ONLY/);
  assert.match(source, /statement_timeout = '1500ms'/);
  assert.match(source, /maxWait: 1000, timeout: 4000/);
  assert.match(source, /LIMIT 7/);
  assert.match(source, /a.interaction_run_id = r.interaction_run_id/);
  assert.doesNotMatch(source, /getQuizLiveSnapshot|\.create\(|\.update\(|\.delete\(|console\.|antwort_text|teamname|password|token/i);
  const route = readFileSync(new URL("../../api/admin/monitoring/route.ts", import.meta.url), "utf8");
  assert.match(route, /getActorForSession/);
  assert.match(route, /VERCEL_ENV === "preview"/);
  assert.doesNotMatch(route, /export async function (POST|PUT|DELETE|PATCH)/);
});
