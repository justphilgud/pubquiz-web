import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { buildPresentationQualityFixture } from "./presentationQualityFixtures";
import { buildPraesentationSlides, getPresentationSlideKey } from "@/app/quiz/[quizId]/praesentation/buildPraesentationSlides";
import { parsePresentationSlideKey, resolvePresentationAudienceState, resolvePresentationLiveState } from "./presentationLiveState";
import { selectQuizAnswerAssignments } from "@/app/quiz/quizAnswerLiveState";
import { assertLifecycleRevision } from "@/app/quiz/quizLifecycle";
import { parseQuizBlockPreviewSectionId } from "@/app/quiz/quizBlockLiveState";
import { presentationCountdownDeadline } from "@/app/quiz/blockCountdown";

function fixture() {
  const result = buildPresentationQualityFixture("sponsor-open", "EDITORIAL").quiz;
  result.sponsorMomentsEnabled = true;
  return result;
}

test("sponsor deck derives one explicit noninteractive position from the same question metadata", () => {
  const quiz = fixture();
  const deck = buildPraesentationSlides(quiz);
  const index = deck.findIndex(s => s.typ === "frage");
  const sponsor = deck[index - 1];
  assert.equal(sponsor.typ, "ablauf");
  if (sponsor.typ !== "ablauf") throw Error("Expected sponsor");
  assert.equal(sponsor.presentationRole?.kind, "SPONSOR");
  assert.equal(sponsor.element.config.imageUrl, quiz.fragen[0].templateConfig?.sponsor?.logo);
  assert.equal(sponsor.element.questionAssignmentId, null);
  assert.deepEqual(parsePresentationSlideKey(getPresentationSlideKey(sponsor)), { kind: "NON_QUESTION", slideType: "SPONSOR", statusText: "Nächste Frage gleich …" });
  assert.deepEqual(buildPraesentationSlides(structuredClone(quiz)).map(getPresentationSlideKey), deck.map(getPresentationSlideKey));
  const changed = structuredClone(quiz);
  changed.fragen[0].templateConfig!.sponsor!.logo = "/branding/other.png";
  const swapped = buildPraesentationSlides(changed)[index - 1];
  assert.equal(swapped.typ === "ablauf" && swapped.element.config.imageUrl, "/branding/other.png");
  delete changed.fragen[0].templateConfig!.sponsor;
  assert.equal(buildPraesentationSlides(changed).length, deck.length - 1);
  quiz.sponsorMomentsEnabled = false;
  assert.deepEqual(buildPraesentationSlides(quiz).map(getPresentationSlideKey), buildPraesentationSlides(changed).map(getPresentationSlideKey));
});

// Execute the actual server action, with fail-closed DB/service spies. Unlike a
// source-text assertion this catches any newly introduced mutation on this path.
function navigationHarness(previousKey: string, previousIndex: number, expired = false) {
  const quiz = fixture();
  const writes: Record<string, unknown>[] = [];
  const syncCalls: string[] = [];
  const deadline = new Date(Date.now() + (expired ? -60_000 : 60_000));
  const closedBlocks: number[] = [];
  let blockClosed = false;
  let state: Record<string, unknown> = { slide_key: previousKey, slide_index: previousIndex, lifecycle_revision: 1, countdown_status: "running", countdown_started_at: new Date(deadline.getTime() - 60_000), countdown_dauer_sekunden: 60, quiz_started_at: new Date(500), quiz_stopped_at: null };
  const tx = new Proxy({ quiz_praesentation_status: {
    findUnique: async () => state,
    findUniqueOrThrow: async () => state,
    update: async ({ data }: { data: Record<string, unknown> }) => { writes.push(data); state = { ...state, ...data }; return state; },
    upsert: async ({ update }: { update: Record<string, unknown> }) => { writes.push(update); state = { ...state, ...update }; return state; },
  }, quiz_block_freigaben: {
    findMany: async ({ where }: { where: { answer_deadline_at: { lte: Date } } }) => !blockClosed && deadline <= where.answer_deadline_at.lte
      ? [{ quiz_abschnitt_id: 1, quiz_block_freigabe_id: 1, answer_deadline_at: deadline }] : [],
    update: async () => { blockClosed = true; },
  } }, { get(target, property) { if (!(property in target)) throw Error(`Unexpected database access: ${String(property)}`); return Reflect.get(target, property); } });
  const interactionSource = ts.createSourceFile("interaction.server.ts", readFileSync("app/quiz/interaction/interaction.server.ts", "utf8"), ts.ScriptTarget.Latest, true);
  const windowSource = interactionSource.statements.filter(node => ts.isFunctionDeclaration(node) && ["expireQuizBlockDeadlines", "requireQuizAnswerWindow"].includes(node.name?.text ?? "")).map(node => node.getText(interactionSource)).join("\n");
  const windowExports: Record<string, unknown> = {};
  runInNewContext(ts.transpileModule(windowSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports: windowExports, Date, presentationCountdownDeadline,
    requireQuizRunning: async () => state,
    closeBlockInteractions: async (_: unknown, _quiz: number, block: number) => { closedBlocks.push(block); },
  });
  const dependencies: Record<string, unknown> = {
    "@/app/lib/prisma": { prisma: { $transaction: (work: (db: unknown) => unknown) => work(tx) } },
    "../../actions": { getQuizPraesentation: async () => quiz },
    "./buildPraesentationSlides": { buildPraesentationSlides, getPresentationSlideKey },
    "../../quizAccess.server": { requireQuizLiveController: async () => {}, requireQuizQuestion: async () => ({ quiz_abschnitt_id: null }) },
    "../../quizLifecycle": { assertLifecycleRevision },
    "../../quizLifecycle.server": { requireQuizNotStopped: async () => state },
    "@/app/rendering/presentation/presentationLiveState": { parsePresentationSlideKey },
    "@/app/quiz/quizBlockLiveState": { parseQuizBlockPreviewSectionId },
    "@/app/quiz/interaction/interaction.server": { ...windowExports, syncInteractionForPresentation: async (_: unknown, input: { slideKey: string }) => { syncCalls.push(input.slideKey); } },
    "@/app/lib/prismaQueryDiagnostics.server": { logLivePerformance: () => {}, withPrismaQueryDiagnostics: async (work: () => unknown) => ({ result: await work(), diagnostics: null }) },
  };
  const exports: Record<string, (...args: unknown[]) => Promise<unknown>> = {};
  const source = readFileSync("app/quiz/[quizId]/praesentation/statusActions.ts", "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  runInNewContext(code, { exports, require: (name: string) => dependencies[name] ?? {}, performance, Date });
  return { quiz, writes, syncCalls, closedBlocks, deadline, state: () => state, navigate: exports.setPraesentationSlideIndex };
}

for (const before of ["question:9:question", "question:9:solution", "flow:pause:BREAK", "flow:countdown:COUNTDOWN", "pixel-explanation:9"]) {
  test(`entering sponsor from ${before} only writes presentation position (including backward/reconnect)`, async () => {
    for (const previousIndex of [0, 999]) {
      const h = navigationHarness(before, previousIndex);
      const slides = buildPraesentationSlides(h.quiz);
      const index = slides.findIndex(s => s.typ === "ablauf" && s.presentationRole?.kind === "SPONSOR");
      const key = getPresentationSlideKey(slides[index]);
      const beforeState = { ...h.state() };
      await h.navigate(h.quiz.quiz_id, index, key, 1);
      assert.deepEqual(Object.keys(h.writes[0]).sort(), ["slide_index", "slide_key", "slide_started_at"]);
      assert.equal(h.syncCalls.length, 0);
      assert.equal(h.state().countdown_started_at, beforeState.countdown_started_at);
      assert.equal(h.state().countdown_status, "running");
      await h.navigate(h.quiz.quiz_id, index, key, 1);
      assert.equal(h.writes.length, 1);
      const live = resolvePresentationLiveState(h.state() as Parameters<typeof resolvePresentationLiveState>[0]);
      const audience = resolvePresentationAudienceState(live, []);
      assert.equal(audience.kind, "NON_QUESTION");
      assert.deepEqual(selectQuizAnswerAssignments(audience, h.quiz.fragen, h.quiz.fragen.map(q => q.quiz_fragen_id)), []);
    }
  });
}

test("sponsor to question invokes the existing question sync once; duplicate navigation does not reopen", async () => {
  const quiz = fixture();
  const deck = buildPraesentationSlides(quiz);
  const index = deck.findIndex(s => s.typ === "frage");
  const h = navigationHarness(getPresentationSlideKey(deck[index - 1]), index - 1);
  const key = getPresentationSlideKey(deck[index]);
  await h.navigate(quiz.quiz_id, index, key, 1);
  await h.navigate(quiz.quiz_id, index, key, 1);
  assert.deepEqual(h.syncCalls, [key]);
  assert.equal(h.writes.length, 1);
});

test("forged sponsor keys cannot bypass server deck validation", async () => {
  const h = navigationHarness("question:9:question", 0);
  await assert.rejects(h.navigate(h.quiz.quiz_id, 0, "sponsor:999999", 1), /Präsentationsposition/);
  assert.equal(h.writes.length, 0);
});

test("sponsor navigation preserves mandatory expiry of an already elapsed block deadline", async () => {
  const h = navigationHarness("flow:countdown:COUNTDOWN", 0, true);
  const deck = buildPraesentationSlides(h.quiz);
  const index = deck.findIndex(s => s.typ === "ablauf" && s.presentationRole?.kind === "SPONSOR");
  const key = getPresentationSlideKey(deck[index]);
  await h.navigate(h.quiz.quiz_id, index, key, 1);
  assert.deepEqual(h.closedBlocks, [1]);
  assert.equal(h.state().countdown_status, "finished");
  assert.equal((h.state().countdown_ended_at as Date).getTime(), h.deadline.getTime());
  assert.equal(h.syncCalls.length, 0);
  await h.navigate(h.quiz.quiz_id, index, key, 1);
  assert.deepEqual(h.closedBlocks, [1]);
});
