import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as queue from "./teamJoinQueue";
import { getDefaultTeamAvatarCode } from "@/app/teams/teamProfile";

const team = (id: number): queue.JoinedTeam => ({ participationId: id, teamId: id, teamName: `Team ${id}`, avatarCode: getDefaultTeamAvatarCode(id), photoUrl: null });
const observation = (ids: number[], revision = 0, lifecycle: queue.TeamJoinObservation["lifecycle"] = "PREPARATION"): queue.TeamJoinObservation => ({ lifecycleRevision: revision, lifecycle, teams: ids.map(team) });
const finish = (state: queue.TeamJoinQueue) => queue.finishTeamJoin(state, queue.teamJoinBatchKey(state));

test("AP6: existing teams form a silent baseline; empty baseline accepts one join with its assigned identity", () => {
  const existing = queue.observeTeamJoins(queue.emptyTeamJoinQueue(), observation([1, 2, 3]));
  assert.equal(existing.active.length, 0);
  assert.strictEqual(queue.observeTeamJoins(existing, observation([1, 2, 3])), existing);
  const joined = queue.observeTeamJoins(existing, observation([1, 2, 3, 4]));
  assert.deepEqual(joined.active, [team(4)]);
  assert.equal(joined.active[0].avatarCode, team(4).avatarCode);
  assert.deepEqual(queue.observeTeamJoins(queue.observeTeamJoins(queue.emptyTeamJoinQueue(), observation([])), observation([1])).active, [team(1)]);
});

test("AP6: polling, team reload/reconnect and changed profile objects never replay participation", () => {
  let state = queue.observeTeamJoins(queue.emptyTeamJoinQueue(), observation([]));
  state = finish(queue.observeTeamJoins(state, observation([1])));
  const changed = observation([1]);
  changed.teams[0].teamName = "Neuer Anzeigename";
  for (let i = 0; i < 100; i++) assert.strictEqual(queue.observeTeamJoins(state, structuredClone(changed)), state);
});

test("AP6: three quick arrivals remain ordered, exactly once, without overwriting active greeting", () => {
  let state = queue.observeTeamJoins(queue.emptyTeamJoinQueue(), observation([]));
  state = queue.observeTeamJoins(state, observation([1]));
  const active = state.active;
  state = queue.observeTeamJoins(state, observation([1, 2, 3]));
  assert.strictEqual(state.active, active);
  const shown: number[] = [];
  while (state.active.length) { shown.push(...state.active.map(t => t.participationId)); state = finish(state); }
  assert.deepEqual(shown, [1, 2, 3]);
});

test("AP6: a 40-team burst is one bounded batch after the active greeting, including joins beyond roster limit", () => {
  let state = queue.observeTeamJoins(queue.emptyTeamJoinQueue(), observation([]));
  state = queue.observeTeamJoins(state, observation([1]));
  state = queue.observeTeamJoins(state, observation(Array.from({ length: 41 }, (_, i) => i + 1)));
  assert.deepEqual(state.active, [team(1)]);
  state = finish(state);
  assert.equal(state.active.length, 40);
  assert.equal(state.active.at(-1)?.participationId, 41);
  assert.equal(finish(state).active.length, 0);
  assert.equal(queue.TEAM_JOIN_DISPLAY_MS, 4_000);
  assert.equal(queue.TEAM_JOIN_BURST_THRESHOLD, 4);
});

test("AP6: presentation reload and QR re-entry baseline existing teams without replay", () => {
  const reloaded = queue.observeTeamJoins(queue.emptyTeamJoinQueue(), observation([1, 2, 3]));
  assert.equal(reloaded.active.length, 0);
  assert.deepEqual(queue.observeTeamJoins(reloaded, observation([1, 2, 3, 4])).active, [team(4)]);
});

test("AP6: reset clears active/pending, ignores stale revision/timer, then accepts a new participation", () => {
  let state = queue.observeTeamJoins(queue.emptyTeamJoinQueue(), observation([]));
  state = queue.observeTeamJoins(state, observation([1, 2, 3]));
  const oldKey = queue.teamJoinBatchKey(state);
  state = queue.observeTeamJoins(state, observation([], 1));
  assert.equal(state.active.length + state.pending.length, 0);
  assert.strictEqual(queue.observeTeamJoins(state, observation([1, 2, 3], 0)), state);
  state = queue.observeTeamJoins(state, observation([5], 1));
  assert.deepEqual(state.active, [team(5)]);
  assert.strictEqual(queue.finishTeamJoin(state, oldKey), state);
});

test("AP6: STOPPED discards the full queue; RUNNING uses the same join contract", () => {
  let state = queue.observeTeamJoins(queue.emptyTeamJoinQueue(), observation([], 0, "RUNNING"));
  state = queue.observeTeamJoins(state, observation([1, 2, 3], 0, "RUNNING"));
  state = queue.observeTeamJoins(state, observation([1, 2, 3], 0, "STOPPED"));
  assert.equal(state.active.length + state.pending.length, 0);
  assert.strictEqual(queue.observeTeamJoins(state, observation([1, 2, 3, 4], 0, "STOPPED")), state);
});

test("AP6: observations are read-only and duplicate participation rows are deduplicated", () => {
  const input = observation([1, 1, 2]);
  const saved = structuredClone(input);
  const state = queue.observeTeamJoins(queue.observeTeamJoins(queue.emptyTeamJoinQueue(), observation([])), input);
  assert.deepEqual(input, saved);
  assert.deepEqual([...state.active, ...state.pending].map(t => t.participationId), [1, 2]);
});

test("AP6: actual welcome effects do not restart timers on equal snapshots, and unmount cleans up", () => {
  const source = readFileSync(new URL("./TeamJoinWelcome.tsx", import.meta.url), "utf8");
  // Execute the production effect/reducer body with deterministic hooks, as in B10a.
  const body = source.replace(/^import[\s\S]*?;\r?\n/gm, "").replace(/  if \(!queue.active.length[\s\S]*$/, "  return queue;\n}");
  const compiled = ts.transpileModule(body, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  type Effect = { deps: unknown[]; cleanup?: () => void };
  const effects = new Map<number, Effect>();
  const timers = new Map<number, () => void>();
  const slots: queue.TeamJoinQueue[] = [];
  let cursor = 0, dirty = false, starts = 0, sequence = 0;
  const pending: (() => void)[] = [];
  const exports: { TeamJoinWelcome?: (props: { observation: queue.TeamJoinObservation }) => queue.TeamJoinQueue } = {};
  runInNewContext(compiled, { exports, ...queue,
    useReducer: (reducer: (s: queue.TeamJoinQueue, a: unknown) => queue.TeamJoinQueue, _: unknown, init: () => queue.TeamJoinQueue) => {
      const index = cursor++; slots[index] ??= init();
      return [slots[index], (action: unknown) => { const next = reducer(slots[index], action); if (next !== slots[index]) { slots[index] = next; dirty = true; } }];
    },
    useEffect: (effect: () => (() => void) | undefined, deps: unknown[]) => {
      const index = cursor++, old = effects.get(index);
      if (!old || !deps.every((value, i) => Object.is(value, old.deps[i]))) pending.push(() => { old?.cleanup?.(); effects.set(index, { deps, cleanup: effect() }); });
    },
    window: { setTimeout: (fn: () => void, ms: number) => { assert.equal(ms, 4_000); starts++; timers.set(++sequence, fn); return sequence; }, clearTimeout: (id: number) => timers.delete(id) },
  });
  const render = (input: queue.TeamJoinObservation) => {
    let count = 0;
    do { assert.ok(++count < 10, "no render/effect feedback loop"); dirty = false; cursor = 0; exports.TeamJoinWelcome!({ observation: input }); pending.splice(0).forEach(run => run()); } while (dirty);
  };
  render(observation([]));
  render(observation([1]));
  for (let i = 0; i < 100; i++) render(observation([1]));
  render(observation([1, 2, 3]));
  assert.equal(starts, 1);
  assert.equal(timers.size, 1);
  effects.forEach(effect => effect.cleanup?.());
  assert.equal(timers.size, 0);
  assert.doesNotMatch(source, /fetch\(|setInterval\(|getQuizLiveSnapshot|server-only/);
});


test("AP6: stale RUNNING observation cannot restart a stopped revision", () => {
  const stopped = queue.observeTeamJoins(queue.emptyTeamJoinQueue(), observation([1], 0, "STOPPED"));
  assert.strictEqual(queue.observeTeamJoins(stopped, observation([1, 2], 0, "RUNNING")), stopped);
});

test("AP6: shared transport and QR-only display preserve B10a and targeted moderator notes", () => {
  const server = readFileSync(new URL("../../quiz/interaction/interaction.server.ts", import.meta.url), "utf8");
  const renderer = readFileSync(new URL("./PresentationSlideRenderer.tsx", import.meta.url), "utf8");
  const moderator = readFileSync(new URL("../../quiz/[quizId]/moderation/ModerationClient.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../../globals.css", import.meta.url), "utf8").split("/* AP6:")[1];
  assert.match(server, /participationId: team.quiz_team_session_id/);
  assert.match(server, /teams: visibleTeams.slice\(0, 12\)/);
  assert.match(renderer, /slide.element.type === "QR_CODE"/);
  assert.match(renderer, /<TeamJoinWelcome key=/);
  assert.match(moderator, /solutionStrategy !== "END_OF_BLOCK"/);
  assert.match(moderator, /getSlideModeratorNote\(aktuellerSlide\)/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /var\(--pres-title\)/);
  assert.doesNotMatch(css, /#[a-fA-F0-9]{3,8}/);
});
