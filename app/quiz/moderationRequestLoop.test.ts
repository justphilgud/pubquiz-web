import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";
import * as deck from "./[quizId]/praesentation/buildPraesentationSlides";
import * as live from "../rendering/presentation/presentationLiveState";

const filename = "app/quiz/[quizId]/moderation/ModerationClient.tsx";
const original = readFileSync(filename, "utf8");

type Effect = { dependencies: readonly unknown[]; cleanup?: () => void };
type View = { funnyQuestionIds: Set<number>; funnyAnswers: unknown[]; slideIndex: number; antwortStatus: { antwortenEingegangen: number }; lifecycleState: typeof initialState };
const initialState: live.PresentationLiveState = { ...live.resolvePresentationLiveState(null), lifecycle: "RUNNING" as const, slideKey: "question:101:question" };

/** Executes the actual component body/effects with deterministic React hook semantics.
 * Only the JSX view and imported UI/server boundaries are replaced. The real deck
 * and live-state projection run unchanged. Real React/browser acceptance is separate.
 */
function harness(source = original) {
  const parsed = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const imports: Record<string, unknown> = {};
  for (const statement of parsed.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    const clause = statement.importClause;
    if (clause?.name) imports[clause.name.text] = () => undefined;
    if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings)) {
      for (const element of clause.namedBindings.elements) imports[element.name.text] = () => undefined;
    }
  }
  const body = source.slice(source.indexOf("type QuizLiveSnapshot"), source.indexOf("\n  return (", source.indexOf("  useModerationHotkeys"))) +
    "\n return { funnyQuestionIds, funnyAnswers, slideIndex, antwortStatus, lifecycleState };\n}";
  const compiled = ts.transpileModule(body, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  let cursor = 0;
  let dirty = false;
  let mounted = true;
  let time = 0;
  let timerId = 0;
  const slots: unknown[] = [];
  const effects = new Map<number, Effect>();
  const pendingEffects: Array<() => void> = [];
  const timers = new Map<number, { due: number; repeat?: number; callback: () => void }>();
  const counts = { snapshot: 0, funny: 0, progress: 0 };
  const signals: AbortSignal[] = [];
  const pendingFunny: Array<(answers: unknown[]) => void> = [];
  let deferFunny = false;
  let answers: unknown[] = [];
  let state = { ...initialState };
  const question = (id: number) => ({ quiz_fragen_id: id, fragen_id: id, quiz_abschnitt_id: 10, sortierung: id, frage: `Frage ${id}`, funnyRevealAvailable: false, medien: [], antworten: [] });
  const props = { quizId: 1, quiz: { quiz_id: 1, titel: "B10a", fragen: [question(101), question(102)], abschnitte: [{ quiz_abschnitt_id: 10, titel: "Runde", abschnitt_typ: "fragenblock", sortierung: 1 }], ablaufElemente: [] }, initialLiveState: state, initialEstimationQuestion: null, initialAntwortStatus: { antwortenEingegangen: 0 }, theme: {}, backToQuizLabel: "Zurück" };
  const same = (a: readonly unknown[], b: readonly unknown[]) => a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
  const memoSlot = (factory: () => unknown, dependencies: unknown[]) => {
    const index = cursor++;
    const old = slots[index] as { value: unknown; dependencies: unknown[] } | undefined;
    if (!old || !same(old.dependencies, dependencies)) slots[index] = { value: factory(), dependencies };
    return (slots[index] as { value: unknown }).value;
  };
  const schedule = (callback: () => void, delay: number, repeat?: number) => { const id = ++timerId; timers.set(id, { callback, due: time + delay, repeat }); return id; };
  const exported: { default?: (input: typeof props) => View } = {};
  runInNewContext(compiled, {
    ...imports, ...deck, ...live, exports: exported, AbortController, console,
    window: { setTimeout: (fn: () => void, delay: number) => schedule(fn, delay), clearTimeout: (id: number) => timers.delete(id), setInterval: (fn: () => void, delay: number) => schedule(fn, delay, delay), clearInterval: (id: number) => timers.delete(id) },
    document: { hidden: false },
    useMemo: memoSlot, useCallback: (fn: unknown, deps: unknown[]) => memoSlot(() => fn, deps),
    useRef: (value: unknown) => { const i = cursor++; slots[i] ??= { current: value }; return slots[i]; },
    useState: (initial: unknown) => {
      const i = cursor++;
      if (!(i in slots)) slots[i] = typeof initial === "function" ? initial() : initial;
      const set = (next: unknown) => { const value = typeof next === "function" ? next(slots[i]) : next; if (!Object.is(value, slots[i])) { slots[i] = value; dirty = true; } };
      return [slots[i], set];
    },
    useEffect: (effect: () => (() => void) | undefined, dependencies: unknown[]) => {
      const i = cursor++;
      const old = effects.get(i);
      if (!old || !same(old.dependencies, dependencies)) pendingEffects.push(() => { old?.cleanup?.(); effects.set(i, { dependencies, cleanup: effect() }); });
    },
    fetch: async (_url: string, options: { signal: AbortSignal }) => {
      counts.snapshot++; signals.push(options.signal);
      return { ok: true, json: async () => ({ presentationState: { ...state }, questionHidden: false, pixelState: null, serverNow: new Date().toISOString(), pollState: null, livePollState: null, liveResultState: null, teamJoinState: null, blockState: null }) };
    },
    getPresentationFunnyAnswers: async () => { counts.funny++; return deferFunny ? new Promise<unknown[]>(resolve => pendingFunny.push(resolve)) : [...answers]; },
    getAntwortStatus: async () => { counts.progress++; return { teamsAngemeldet: 1, antwortenEingegangen: 1, finaleAntworten: 0, prozent: 100, letzteAntwortAt: null }; },
  });
  let view: View;
  const render = () => { assert.ok(mounted); cursor = 0; dirty = false; view = exported.default!(props); pendingEffects.splice(0).forEach(effect => effect()); };
  const settle = async () => {
    for (let i = 0; i < 40; i++) { await Promise.resolve(); if (dirty) render(); }
    assert.ok(counts.funny < 15, "unchanged state must not sustain the B10 funny/snapshot feedback loop");
  };
  const advance = async (ms: number) => {
    const end = time + ms;
    while (true) {
      const next = [...timers].filter(([, timer]) => timer.due <= end).sort((a, b) => a[1].due - b[1].due)[0];
      if (!next) break;
      const [id, timer] = next; time = timer.due; timers.delete(id);
      if (timer.repeat) timers.set(id, { ...timer, due: time + timer.repeat });
      timer.callback(); await settle();
    }
    time = end;
  };
  render();
  return { counts, props, signals, timers, pendingFunny, render, settle, advance, view: () => view!, setAnswers: (value: unknown[]) => { answers = value; }, defer: () => { deferFunny = true; }, change: (patch: Partial<typeof state>) => { state = { ...state, ...patch }; }, unmount: () => { effects.forEach(effect => effect.cleanup?.()); effects.clear(); mounted = false; } };
}

test("B10a: unchanged empty funny state and reconstructed quiz do not restart requests", async () => {
  const h = harness(); await h.settle();
  const set = h.view().funnyQuestionIds;
  for (let i = 0; i < 10; i++) { h.props.quiz = structuredClone(h.props.quiz); h.render(); await h.settle(); }
  assert.equal(h.view().funnyQuestionIds, set);
  assert.deepEqual(h.counts, { snapshot: 1, funny: 1, progress: 1 });
  await h.advance(3_000);
  assert.deepEqual(h.counts, { snapshot: 5, funny: 1, progress: 3 });
  assert.equal(h.view().antwortStatus.antwortenEingegangen, 1);
  h.unmount(); assert.equal(h.timers.size, 0);
});

test("B10a: the historical unconditional Set and object dependencies fail the same runtime regression", async () => {
  const old = original
    .replace(/\s*if \(current\.has\(presentationQuestionAssignmentId\) === \(answers\.length > 0\)\) return current;/, "")
    .replace("[presentationQuestionAssignmentId, currentSlideType, quizId, lifecycleState.lifecycleRevision, lifecycleState.lifecycle]", "[aktuellerSlide, quizId, lifecycleState.lifecycleRevision]");
  const h = harness(old);
  await assert.rejects(h.settle(), /feedback loop/);
  h.unmount();
});

test("B10a: actual additions/removals alter the deck once; unchanged nonempty results remain stable", async () => {
  const h = harness(); await h.settle();
  h.setAnswers([{ answerText: "lustig" }]);
  h.change({ lifecycleRevision: 1 }); await h.advance(750);
  assert.equal(h.view().funnyQuestionIds.has(101), true);
  const set = h.view().funnyQuestionIds;
  const count = h.counts.funny;
  h.render(); await h.settle(); await h.advance(1_500);
  assert.equal(h.counts.funny, count);
  assert.equal(h.view().funnyQuestionIds, set);
  h.setAnswers([]); h.change({ lifecycleRevision: 2 }); await h.advance(750);
  assert.equal(h.view().funnyQuestionIds.has(101), false);
  h.unmount();
});

test("B10a: question, slide phase, reset revision, quiz and lifecycle invalidate the correct context", async () => {
  const h = harness(); await h.settle();
  for (const patch of [{ slideKey: "question:102:question" }, { slideKey: "question:102:solution" }, { lifecycleRevision: 1 }, { lifecycle: "STOPPED" as typeof initialState.lifecycle }]) {
    const before = h.counts.funny;
    h.change(patch); await h.advance(750);
    assert.equal(h.counts.funny, before + 1);
  }
  const before = h.counts.funny;
  h.props.quizId = 2; h.render(); await h.settle();
  assert.equal(h.counts.funny, before + 1);
  await h.advance(3_000); // STOPPED still observes resets under the existing contract.
  assert.ok(h.counts.snapshot > 4);
  h.unmount(); assert.equal(h.timers.size, 0);
  assert.ok(h.signals.every(signal => signal.aborted));
});

test("B10a: obsolete funny responses cannot populate another question, reset or unmounted view", async () => {
  const h = harness(); await h.settle(); h.defer();
  h.change({ slideKey: "question:102:question" }); await h.advance(750);
  h.change({ lifecycleRevision: 1 }); await h.advance(750);
  h.pendingFunny.shift()!([{ answerText: "old run" }]); await h.settle();
  assert.equal(h.view().funnyAnswers.length, 0);
  h.unmount();
  const counts = { ...h.counts };
  h.pendingFunny.shift()!([{ answerText: "unmounted" }]);
  await Promise.resolve(); await Promise.resolve();
  assert.deepEqual(h.counts, counts);
  assert.equal(h.timers.size, 0);
});

test("B10a: repeated mount/unmount clears all polling timers and aborts the snapshot context", async () => {
  for (let i = 0; i < 5; i++) {
    const h = harness(); await h.settle(); await h.advance(1_500);
    h.unmount(); assert.equal(h.timers.size, 0);
    assert.ok(h.signals.every(signal => signal.aborted));
  }
});

test("B10a: unmount before pending snapshot/progress resolves prevents late writes and rescheduling", async () => {
  const h = harness();
  const view = h.view();
  h.unmount();
  await h.settle();
  assert.equal(h.view(), view);
  assert.equal(view.antwortStatus.antwortenEingegangen, 0);
  assert.equal(h.timers.size, 0);
  assert.ok(h.signals.every(signal => signal.aborted));
});
