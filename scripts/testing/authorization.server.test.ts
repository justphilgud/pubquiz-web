import assert from "node:assert/strict";
import test, { before } from "node:test";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { relative } from "node:path";
import { runInNewContext } from "node:vm";
import { build } from "esbuild";
import { DEFAULT_PIXEL_TEMPLATE_CONFIG } from "@/app/fragen/editor/pixelTemplateConfig";
import type { SaveQuestionPayload } from "@/app/fragen/editor/types";

// Execute the real exported Actions/route and real auth/scope guards. Only the
// authentication provider, persistence and framework side effects are adapters.
let bundled: Awaited<ReturnType<typeof build>>;
before(async () => {
  bundled = await build({
  stdin: { contents: `
    export * as questions from './app/fragen/actions';
    export * as editor from './app/fragen/editor/actions';
    export * as duplicates from './app/fragen/editor/duplicateActions';
    export * as management from './app/fragen/editor/managementActions';
    export * as quizzes from './app/quiz/actions';
    export * as live from './app/api/quiz/live-snapshot/route';
    export * as seriesAccess from './app/eventreihen/eventSeriesAccess.server';
  `, resolveDir: process.cwd(), sourcefile: "authorization-test-entry.ts" },
  define: { "import.meta.url": JSON.stringify(import.meta.url) },
  bundle: true, write: false, platform: "node", format: "cjs", packages: "external",
  plugins: [{ name: "test-adapters", setup(builder) {
    const baseline = process.env.AUTHORIZATION_TEST_BASELINE;
    if (baseline) {
      if (!/^[a-f0-9]{40}$/.test(baseline)) throw new Error("Expected an exact baseline commit");
      builder.onLoad({ filter: /app[/\\](fragen[/\\](actions|editor[/\\](actions|duplicateActions|questionScopePolicy))|quiz[/\\]actions|story-elemente[/\\]storyElementPolicy)\.ts$/ }, args => ({
        contents: execFileSync("git", ["show", `${baseline}:${relative(process.cwd(), args.path).replaceAll("\\", "/")}`], { encoding: "utf8" }), loader: "ts",
      }));
    }
    builder.onResolve({ filter: /^(server-only|@\/auth|@\/app\/lib\/prisma|next\/cache|next\/navigation)$/ }, args => ({ path: args.path, namespace: "test-adapter" }));
    builder.onLoad({ filter: /.*/, namespace: "test-adapter" }, args => ({ contents:
      args.path === "@/auth" ? "export const auth = async () => globalThis.fixture.session;" :
      args.path === "@/app/lib/prisma" ? "export const prisma = globalThis.fixture.db;" :
      args.path === "next/navigation" ? 'export function redirect(path) { throw new Error("REDIRECT:" + path); }' :
      args.path === "next/cache" ? "export function revalidatePath() {}" : "",
    }));
  } }],
  });
});

type Row = Record<string, unknown>;
type Where = Record<string, unknown>;
function matches(row: Row, where: Where = {}): boolean {
  return Object.entries(where).every(([key, value]) => {
    if (value === undefined) return true;
    if (key === "AND") return (Array.isArray(value) ? value : [value]).every(item => matches(row, item));
    if (key === "OR") return (value as Where[]).some(item => matches(row, item));
    if (key === "NOT") return !matches(row, value as Where);
    const actual = row[key];
    if (value && typeof value === "object" && !(value instanceof Date)) {
      const condition = value as Where;
      if ("in" in condition) return (condition.in as unknown[]).includes(actual);
      if ("notIn" in condition) return !(condition.notIn as unknown[]).includes(actual);
      if ("not" in condition) return actual !== condition.not;
      if ("some" in condition) return (actual as Row[]).some(item => matches(item, condition.some as Where));
      if ("none" in condition) return !(actual as Row[]).some(item => matches(item, condition.none as Where));
      if ("contains" in condition) return String(actual).toLowerCase().includes(String(condition.contains).toLowerCase());
      return actual !== null && actual !== undefined && matches(actual as Row, condition);
    }
    return actual === value;
  });
}

function question(id: number, scope: "GLOBAL" | "EVENT_SERIES", series: number[], creator = 4, status = "DRAFT") {
  return {
    fragen_id: id, frage: `Isolierte Berechtigungsfrage ${id}`, quelle: null, schwierigkeitslevel: null,
    geltungsbereich: scope, created_by_user_id: creator, review_status: status,
    freigegeben: status === "APPROVED", ist_archiviert: false, archivierungsgrund: null,
    created_at: new Date("2026-10-01"), updated_at: new Date("2026-10-01"), erstellungsdatum: new Date("2026-10-01"),
    gueltig_bis: null, pruefen_ab: null, aktualitaet_geprueft_am: null,
    source_vorlage_id: null, template_config_json: null, vorlage: null,
    fragen_kategorien: [], medien: [], antworten: [], antwortfelder: [],
    story_element_verknuepfungen: [], generator_laefe: [],
    eventreihen: series.map(id => ({ eventreihe_id: id, eventreihe: { name: `Reihe ${id}` } })),
    quiz_fragen: [] as Row[], _count: { story_element_verknuepfungen: 0 },
  };
}

function fixture(userId = 3, options: { disabled?: boolean; eventType?: string; management?: number[] } = {}) {
  const assignments = [
    { benutzer_id: 1, rolle: "ADMIN", scope_typ: "GLOBAL", eventreihe_id: null },
    { benutzer_id: 2, rolle: "EDITOR", scope_typ: "GLOBAL", eventreihe_id: null },
    { benutzer_id: 3, rolle: "EVENT_MANAGER", scope_typ: "EVENT_SERIES", eventreihe_id: 10 },
    { benutzer_id: 4, rolle: "EDITOR", scope_typ: "EVENT_SERIES", eventreihe_id: 10 },
  ];
  const questions = [question(101, "EVENT_SERIES", [10]), question(102, "EVENT_SERIES", [20]),
    question(103, "GLOBAL", [], 2), question(104, "GLOBAL", [], 2, "APPROVED"),
    question(105, "EVENT_SERIES", [10, 20]), question(106, "EVENT_SERIES", [10])];
  questions[5].ist_archiviert = true;
  const quiz = { quiz_id: 11, eventreihe_id: 10, ist_archiviert: false,
    presentation_template_id: null, answer_form_template_id: null, aufloesungsstrategie: "AFTER_EACH_QUESTION" };
  const usages = [10, 20].map(id => ({ quiz_id: id, quiz: { quiz_id: id, eventreihe_id: id, titel: `Quiz ${id}`, quiz_datum: new Date("2026-10-01"), ist_archiviert: false } }));
  questions[3].quiz_fragen = usages;
  let active = true;
  let writes = 0;
  let snapshots = 0;
  const calls: string[] = [];
  let placementScopes: Row[] = [];
  let assignedQuestions = [questions[0]];
  const db = {
    users: { findUnique: async () => ({ is_active: active, must_change_password: false }) },
    benutzer_rollenzuweisungen: { findMany: async ({ where }: { where: Row }) => active ? assignments.filter(row => row.benutzer_id === where.benutzer_id) : [] },
    benutzer_eventartrollen: { findMany: async ({ where }: { where: Row }) => active ? assignments.filter(row => row.benutzer_id === where.benutzer_id && row.scope_typ === "EVENT_SERIES").map(row => ({
      ...row, eventart: options.eventType ?? "QUIZ", eventreihe: { eventarten: [{ eventart: options.eventType ?? "QUIZ", ist_freigeschaltet: !options.disabled }] },
    })) : [] },
    eventreihe_verwaltung: { findMany: async () => active ? (options.management ?? []).map(eventreihe_id => ({ eventreihe_id })) : [] },
    eventreihen: {
      count: async ({ where }: { where: { eventreihe_id: { in: number[] } } }) => where.eventreihe_id.in.filter(id => [10, 20].includes(id)).length,
      findUnique: async ({ where }: { where: Row }) => ({ eventreihe_id: where.eventreihe_id, ist_archiviert: false }),
      findFirst: async ({ where }: { where: Row }) => ({ eventreihe_id: where.eventreihe_id, ist_archiviert: false }),
    },
    fragen: {
      findUnique: async ({ where, include }: { where: Row; include?: { quiz_fragen?: { where?: Where } } }) => {
        const row = questions.find(row => row.fragen_id === where.fragen_id);
        return row ? { ...row, quiz_fragen: row.quiz_fragen.filter(usage => matches(usage, include?.quiz_fragen?.where)) } : null;
      },
      findMany: async ({ where, include, take }: { where: Where; include?: { quiz_fragen?: { where?: Where } }; take?: number }) => {
        calls.push("fragen.findMany");
        return questions.filter(row => matches(row, where)).slice(0, take).map(row => ({ ...row,
          quiz_fragen: row.quiz_fragen.filter(usage => matches(usage, include?.quiz_fragen?.where)),
        }));
      },
      count: async ({ where }: { where: Where }) => questions.filter(row => matches(row, where)).length,
      update: async ({ where, data }: { where: Row; data: Row }) => { writes++; const row = questions.find(row => row.fragen_id === where.fragen_id)!; Object.assign(row, data); return row; },
    },
    fragen_kategorien: { deleteMany: async () => { writes++; } },
    medien: { deleteMany: async () => { writes++; } },
    antworten: { deleteMany: async () => { writes++; } },
    quiz: { findUnique: async ({ where }: { where: Row }) => where.quiz_id === 12 ? { ...quiz, quiz_id: 12, eventreihe_id: 20 } : quiz, update: async ({ data }: { data: Row }) => { writes++; Object.assign(quiz, data); return quiz; } },
    quiz_fragen: { findMany: async () => assignedQuestions.map(fragen => ({ fragen, verknuepfte_story_elemente_uebernehmen: true })) },
    quiz_ablauf_elemente: { findMany: async () => placementScopes },
    presentation_templates: { findMany: async () => [] },
    quiz_interaction_runs: { findFirst: async () => { snapshots++; return null; } },
    quiz_block_freigaben: { findFirst: async () => null, findMany: async () => [] },
    quiz_team_sessions: { count: async () => 0, findMany: async () => [] },
    quiz_praesentation_status: {
      findUnique: async () => null,
      findUniqueOrThrow: async () => ({ quiz_started_at: null, quiz_stopped_at: null }),
      upsert: async () => ({ quiz_started_at: null, quiz_stopped_at: null }),
    },
    $queryRaw: async () => [],
    $transaction: async <T>(operation: (tx: unknown) => Promise<T>) => operation(db),
  };
  const state = { session: { user: { id: String(userId) } } as { user: { id: string } } | null, db };
  const exports: { seriesAccess: typeof import("@/app/eventreihen/eventSeriesAccess.server"); questions: typeof import("@/app/fragen/actions"); editor: typeof import("@/app/fragen/editor/actions"); duplicates: typeof import("@/app/fragen/editor/duplicateActions"); management: typeof import("@/app/fragen/editor/managementActions"); quizzes: typeof import("@/app/quiz/actions"); live: typeof import("@/app/api/quiz/live-snapshot/route") } = {} as never;
  const runtimeModule = { exports };
  runInNewContext(bundled.outputFiles![0].text, { exports, module: runtimeModule,
    require: createRequire(import.meta.url), fixture: state, console, process, Buffer, URL, Request, Response,
    Date, setTimeout, clearTimeout, performance, TextEncoder, TextDecoder, structuredClone,
  }, { filename: "authorization-actions.cjs" });
  return { ...runtimeModule.exports, rows: questions, assignments, quiz, calls,
    deactivate: () => { active = false; }, revoke: () => { assignments.splice(0); },
    grantTarget: () => { assignments.push({ benutzer_id: userId, rolle: "EVENT_MANAGER", scope_typ: "EVENT_SERIES", eventreihe_id: 20 }); },
    setQuestions: (ids: number[]) => { assignedQuestions = questions.filter(row => ids.includes(row.fragen_id)); },
    setPlacements: (rows: Row[]) => { placementScopes = rows; },
    writes: () => writes, snapshots: () => snapshots,
  };
}

const searchInput = { suchtext: "", kategorieId: null, sourceState: null, mediaState: null, answerMode: null, statuses: [], templateIds: [] };
const updateInput = (id: number) => ({ fragenId: id, frage: "Geprüfte Änderung", quelle: null, schwierigkeitslevel: null, kategorieIds: [], neueKategorien: [], medienZurFrage: [], antworten: [] });
const saveInput = (id: number, scope: "GLOBAL" | "EVENT_SERIES", eventSeriesIds: number[]): SaveQuestionPayload => ({
  questionId: id, intent: "APPROVE", scope, eventSeriesIds, questionText: "Berechtigungstest",
  questionMedia: [], answers: [], categoryIds: [], sourceOrRemark: "", moderationNotes: "", categoryRequest: "",
  validUntil: null, templateId: null, sourceTemplateId: null, templateConfig: DEFAULT_PIXEL_TEMPLATE_CONFIG,
});

for (const id of [102, 103, 104, 105, 106]) {
  test(`saveQuestion rejects taking over protected question ${id} through an authorized destination`, async () => {
    const f = fixture();
    const result = await f.editor.saveQuestion(saveInput(id, "EVENT_SERIES", [10]));
    assert.equal(result.success, false);
    assert.equal(!result.success && result.errorCode, "PERMISSION_DENIED");
    assert.equal(f.writes(), 0);
  });
}
for (const user of [1, 2, 3, 4]) {
  test(`real legacy read/write Actions enforce question scope for role fixture ${user}`, async () => {
    const f = fixture(user);
    if (user === 1) {
      assert.ok(await f.questions.getFrageForEdit(102));
      assert.ok(await f.questions.updateFrage(updateInput(102)));
    } else {
      await assert.rejects(f.questions.getFrageDetails(102), /Zugriff/);
      await assert.rejects(f.questions.getFrageForEdit(102), /Zugriff/);
      await assert.rejects(f.questions.updateFrage(updateInput(102)), /Zugriff/);
      assert.equal(f.writes(), 0);
    }
    assert.ok(await f.questions.getFrageDetails(104));
  });
}
test("scoped editor can update own draft; global editor can update own global draft; global original stays protected", async () => {
  for (const [user, id] of [[4, 101], [2, 103]]) {
    const f = fixture(user); assert.ok(await f.questions.updateFrage(updateInput(id))); assert.ok(f.writes() > 0);
  }
  const f = fixture(3); await assert.rejects(f.questions.updateFrage(updateInput(104)), /Zugriff/); assert.equal(f.writes(), 0);
});
test("search returns permitted quiz usages only, including counts and archive capability", async () => {
  const f = fixture(); const result = await f.questions.searchFragen(searchInput);
  const global = result.results.find(row => row.fragen_id === 104)!;
  assert.equal(global.quiz_anzahl, 1); assert.equal(global.quizze[0].quiz_id, 10);
  assert.equal(global.can_archive, false);
  assert.equal(result.results.some(row => row.fragen_id === 102 || row.fragen_id === 103), false);
  assert.equal(result.results.find(row => row.fragen_id === 101)?.can_archive, true);
});
test("details also filter foreign quiz metadata", async () => {
  const f = fixture(); const result = await f.questions.getFrageDetails(104);
  assert.equal(result?.quiz.length, 1);
  assert.equal(result?.quiz[0].quiz_id, 10);
});
for (const user of [2, 3, 4]) {
  test(`revocation with an existing session removes own private search/similarity/read access (${user})`, async () => {
    const f = fixture(user); f.revoke();
    await assert.rejects(f.questions.searchFragen(searchInput), /REDIRECT/);
    await assert.rejects(f.duplicates.findSimilarQuestions({ questionText: "Isolierte Berechtigungsfrage 101", templateId: null, templateConfig: DEFAULT_PIXEL_TEMPLATE_CONFIG, answers: [] }), /REDIRECT/);
    await assert.rejects(f.questions.getFrageForEdit(101), /Zugriff/);
    assert.equal(f.writes(), 0);
  });
}
test("similarity respects revoked source series even when another editorial assignment remains", async () => {
  const f = fixture(4); f.revoke(); f.grantTarget();
  const result = await f.duplicates.findSimilarQuestions({ questionText: "Isolierte Berechtigungsfrage 101", templateId: null, templateConfig: DEFAULT_PIXEL_TEMPLATE_CONFIG, answers: [] });
  assert.equal(result.some(row => row.questionId === 101 || row.questionId === 106), false);
  assert.ok(result.every(row => row.questionId === 102 || row.questionId === 105));
});
for (const user of [1, 2, 3, 4]) {
  test(`deactivated account with retained session cannot read/write through Actions (${user})`, async () => {
    const f = fixture(user); f.deactivate();
    await assert.rejects(f.questions.getFrageDetails(104), /REDIRECT/);
    await assert.rejects(f.questions.updateFrage(updateInput(101)), /REDIRECT/);
    await assert.rejects(f.editor.saveQuestion(saveInput(101, "EVENT_SERIES", [10])), /REDIRECT/);
    assert.equal(f.writes(), 0);
  });
}
const quizInput = { quizId: 11, eventSeriesId: 20, titel: "Isolierter Wechsel", quizDatum: "2026-10-25", bemerkung: "" };
test("updateQuiz rejects a foreign target before writes", async () => {
  const f = fixture(); await assert.rejects(f.quizzes.updateQuiz(quizInput), /Zugriff/); assert.equal(f.writes(), 0);
});
test("updateQuiz keeps incompatible question and quiz unchanged", async () => {
  const f = fixture(); f.grantTarget(); const result = await f.quizzes.updateQuiz(quizInput);
  assert.equal(result.success, false); assert.match(result.message, /Frage/); assert.equal(f.writes(), 0); assert.equal(f.quiz.eventreihe_id, 10);
});
for (const kind of ["story", "poll", "linked-story"]) {
  test(`updateQuiz rejects incompatible ${kind} without changing contents`, async () => {
    const f = fixture(); f.grantTarget(); f.setQuestions([104]);
    const content = { geltungsbereich: "EVENT_SERIES", eventreihe_id: 10, quiz_id: null };
    if (kind === "linked-story") f.rows[3].story_element_verknuepfungen = [{ story_element: content }] as never;
    else f.setPlacements([{ story_element_revision: kind === "story" ? { story_element: content } : null, live_poll_revision: kind === "poll" ? { live_poll: content } : null }]);
    const result = await f.quizzes.updateQuiz(quizInput); assert.equal(result.success, false); assert.match(result.message, /Story-Element/); assert.equal(f.writes(), 0);
  });
}
test("updateQuiz allows globals, matching and quiz-local content without new grants", async () => {
  const f = fixture(); f.grantTarget(); f.setQuestions([104, 105]);
  f.setPlacements([{ story_element_revision: { story_element: { geltungsbereich: "QUIZ", eventreihe_id: null, quiz_id: 11 } }, live_poll_revision: null }]);
  assert.equal((await f.quizzes.updateQuiz(quizInput)).success, true); assert.equal(f.quiz.eventreihe_id, 20); assert.equal(f.writes(), 1);
});
for (const user of [2, 4]) {
  test(`live route rejects role ${user} without querying the live state`, async () => {
    const f = fixture(user); await assert.rejects(f.live.POST(new Request("http://localhost/api/quiz/live-snapshot", { method: "POST", body: JSON.stringify({ quizId: 11 }) })), /Zugriff/);
    assert.equal(f.snapshots(), 0);
  });
}
test("manager cannot query another series through the live route", async () => {
  const f = fixture();
  await assert.rejects(f.live.POST(new Request("http://localhost/api/quiz/live-snapshot", {
    method: "POST", body: JSON.stringify({ quizId: 12 }),
  })), /Zugriff/);
  assert.equal(f.snapshots(), 0);
});
for (const user of [2, 3, 4]) {
  test(`global question cloning remains forbidden for non-admin role ${user}`, async () => {
    const f = fixture(user);
    const result = await f.management.cloneQuestion(104);
    assert.equal(result.ok, false);
    assert.equal(!result.ok && result.code, "PERMISSION_DENIED");
    assert.equal(f.writes(), 0);
  });
}
test("live route rechecks account state and current assignments", async () => {
  for (const mutate of ["deactivate", "revoke"] as const) {
    const f = fixture(); f[mutate]();
    await assert.rejects(f.live.POST(new Request("http://localhost/api/quiz/live-snapshot", { method: "POST", body: JSON.stringify({ quizId: 11 }) })));
    assert.equal(f.snapshots(), 0);
  }
});

for (const user of [1, 3]) {
  test(`live route preserves authorized moderation for role ${user}`, async () => {
    const f = fixture(user);
    const response = await f.live.POST(new Request("http://localhost/api/quiz/live-snapshot", {
      method: "POST", body: JSON.stringify({ quizId: 11, includeLiveModeration: true }),
    }));
    assert.equal(response.status, 200);
    assert.ok(f.snapshots() > 0);
  });
}

for (const options of [{ disabled: true }, { eventType: "BINGO" }, { eventType: "POWERPOINT_KARAOKE" }]) {
  test(`real Quiz Actions/API deny incompatible product rights ${JSON.stringify(options)}`, async () => {
    const f = fixture(3, options);
    await assert.rejects(f.questions.getFrageDetails(101));
    await assert.rejects(f.questions.getFrageDetails(104));
    await assert.rejects(f.live.POST(new Request("http://localhost/api/quiz/live-snapshot", { method: "POST", body: JSON.stringify({ quizId: 11 }) })));
    assert.equal(f.writes(), 0); assert.equal(f.snapshots(), 0);
  });
}
test("shared branding permission grants no Quiz object or live access", async () => {
  const f = fixture(3, { eventType: "BINGO", management: [10] });
  assert.ok(await f.seriesAccess.requireEventSeriesEditor(10));
  await assert.rejects(f.seriesAccess.requireEventSeriesAccess(10, "CONTROL_LIVE"));
  await assert.rejects(f.questions.getFrageDetails(101));
});
test("Quiz manager without shared management cannot edit shared branding", async () => {
  const f = fixture(3);
  await assert.rejects(f.seriesAccess.requireEventSeriesEditor(10));
  assert.ok(await f.seriesAccess.requireEventSeriesAccess(10, "CONTROL_LIVE"));
});
test("global Quiz editor remains global when a series product is disabled", async () => {
  const f = fixture(2, { disabled: true });
  assert.ok(await f.questions.getFrageForEdit(103));
  await assert.rejects(f.questions.getFrageForEdit(101));
});
