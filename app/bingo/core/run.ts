import { requireId } from "./cards";
import { appendDraw, createRound, type BingoRound } from "./round";

export type BingoRun = Readonly<{
  version: 1; id: string; gameId: string; status: "PREPARED" | "RUNNING" | "PAUSED" | "ENDED";
  rounds: readonly BingoRound[]; activeMs: number; activeSince: number | null; lastTransitionAt: number;
}>;

function clock(run: BingoRun, now: number): void {
  if (!Number.isSafeInteger(now) || now < run.lastTransitionAt) throw new Error("INVALID_CLOCK");
}

export function createRun(id: string, gameId: string, now: number): BingoRun {
  requireId(id);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(gameId)) throw new Error("GAME_UUID_REQUIRED");
  if (!Number.isSafeInteger(now) || now < 0) throw new Error("INVALID_CLOCK");
  return { version: 1, id, gameId, status: "PREPARED", rounds: [], activeMs: 0, activeSince: null, lastTransitionAt: now };
}

export function addRound(run: BingoRun, id: string, target = 30): BingoRun {
  if (run.status === "ENDED") throw new Error("RUN_ENDED");
  if (run.rounds.some(r => r.id === id)) throw new Error("DUPLICATE_ROUND_ID");
  return { ...run, rounds: [...run.rounds, createRound(id, target)] };
}

/** Caller supplies the complete relevant set; durable/concurrent enforcement is outside this module. */
export function assertSingleActiveRun(runs: readonly BingoRun[], gameId: string): void {
  if (runs.filter(r => r.gameId === gameId && (r.status === "RUNNING" || r.status === "PAUSED")).length > 1) throw new Error("ACTIVE_RUN_EXISTS");
}

export function openRound(run: BingoRun, roundId: string): BingoRun {
  if (run.status !== "RUNNING") throw new Error("RUN_NOT_RUNNING");
  if (run.rounds.some(r => r.status === "OPEN")) throw new Error("OPEN_ROUND_EXISTS");
  const round = run.rounds.find(r => r.id === roundId);
  if (!round || round.status !== "PREPARED") throw new Error("ROUND_NOT_PREPARED");
  return { ...run, rounds: run.rounds.map(r => r.id === roundId ? { ...r, status: "OPEN" } : r) };
}

export function startRun(run: BingoRun, roundId: string, now: number, otherRuns: readonly BingoRun[]): BingoRun {
  clock(run, now);
  if (run.status !== "PREPARED") throw new Error("RUN_NOT_PREPARED");
  if (otherRuns.some(r => r.id === run.id)) throw new Error("RUN_SET_CONTAINS_SELF");
  const next: BingoRun = { ...run, status: "RUNNING", activeSince: now, lastTransitionAt: now };
  assertSingleActiveRun([...otherRuns, next], run.gameId);
  return openRound(next, roundId);
}

export function activeElapsedMs(run: BingoRun, now: number): number {
  clock(run, now);
  return run.activeMs + (run.activeSince === null ? 0 : now - run.activeSince);
}

export function pauseRun(run: BingoRun, now: number): BingoRun {
  clock(run, now);
  if (run.status !== "RUNNING") throw new Error("RUN_NOT_RUNNING");
  return { ...run, status: "PAUSED", activeMs: activeElapsedMs(run, now), activeSince: null, lastTransitionAt: now };
}

export function resumeRun(run: BingoRun, now: number): BingoRun {
  clock(run, now);
  if (run.status !== "PAUSED") throw new Error("RUN_NOT_PAUSED");
  return { ...run, status: "RUNNING", activeSince: now, lastTransitionAt: now };
}

export function closeRound(run: BingoRun, roundId: string): BingoRun {
  if (run.status !== "RUNNING" && run.status !== "PAUSED") throw new Error("RUN_NOT_ACTIVE");
  const round = run.rounds.find(r => r.id === roundId);
  if (!round || round.status !== "OPEN") throw new Error("ROUND_NOT_OPEN");
  return { ...run, rounds: run.rounds.map(r => r.id === roundId ? { ...r, status: "CLOSED" } : r) };
}

/** Aggregate entry for live draws: unlike round arithmetic it also enforces the run pause. */
export function drawNumber(run: BingoRun, roundId: string, drawId: string, number: number): BingoRun {
  if (run.status !== "RUNNING") throw new Error("RUN_NOT_RUNNING");
  const round = run.rounds.find(r => r.id === roundId);
  if (!round) throw new Error("ROUND_NOT_FOUND");
  const updated = appendDraw(round, drawId, number);
  return { ...run, rounds: run.rounds.map(r => r.id === roundId ? updated : r) };
}

export function endRun(run: BingoRun, now: number): BingoRun {
  clock(run, now);
  if (run.status !== "RUNNING" && run.status !== "PAUSED") throw new Error("RUN_NOT_ACTIVE");
  return {
    ...run, status: "ENDED", activeMs: activeElapsedMs(run, now), activeSince: null, lastTransitionAt: now,
    rounds: run.rounds.map(r => r.status === "OPEN" ? { ...r, status: "CLOSED" } : r),
  };
}
