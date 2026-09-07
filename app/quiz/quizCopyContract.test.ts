import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

test("copyQuiz preserves content references and order, remaps assignments, and never accesses runtime tables", async () => {
  const original = {
    quiz_id: 30, eventreihe_id: 2, eventreihe: { ist_archiviert: false },
    aufloesungsstrategie: "END_OF_BLOCK", intro_regeln: ["Regel A", "Regel B"],
    team_anzahl: 5, teilnehmer_anzahl: 10, ist_archiviert: true,
    quiz_abschnitte: [1, 2].map(id => ({ quiz_abschnitt_id: id, titel: `Block ${id}`, sortierung: id, abschnitt_typ: "QUESTIONS", aufloesungsstrategie: "END_OF_BLOCK" })),
    quiz_fragen: [1, 2].map(id => ({ quiz_fragen_id: id + 10, fragen_id: id + 100, quiz_abschnitt_id: id, sortierung: id, punkte_modus: "STANDARD", praesentationslayout: "AUTO", antwort_reihenfolge: [3, 1, 2], freie_antwort_erlaubt: true, ergebnisdarstellung: "DEFAULT", verknuepfte_story_elemente_uebernehmen: false })),
    quiz_ablauf_elemente: [
      { typ: "RULES", quiz_abschnitt_id: null, quiz_fragen_id: null, story_bezugs_quiz_fragen_id: null, anker_schluessel: "QUIZ", sortierung: 1, konfiguration: { rules: ["Regel A"] } },
      { typ: "QUESTION", quiz_abschnitt_id: 1, quiz_fragen_id: 11, story_bezugs_quiz_fragen_id: null, anker_schluessel: "1", sortierung: 2 },
      { typ: "STORY", quiz_abschnitt_id: 2, quiz_fragen_id: null, story_bezugs_quiz_fragen_id: 12, anker_schluessel: "2", story_element_revision_id: 7, sortierung: 3 },
    ],
  };
  const before = structuredClone(original);
  type Row = Record<string, unknown>;
  const writes: Record<string, Row[]> = { quiz: [], blocks: [], questions: [], flows: [], updates: [] };
  const tx = {
    quiz: { create: async ({ data }: { data: Row }) => { writes.quiz.push(data); return { quiz_id: 31 }; } },
    quiz_abschnitte: { create: async ({ data }: { data: Row }) => { writes.blocks.push(data); return { quiz_abschnitt_id: writes.blocks.length + 20 }; } },
    quiz_fragen: { update: async (value: Row) => { writes.updates.push(value); } },
    quiz_ablauf_elemente: { createMany: async ({ data }: { data: Row[] }) => { writes.flows.push(...data); } },
  };
  const strictTx = new Proxy(tx, { get(target, key) { assert.ok(key in target, `Unexpected table: ${String(key)}`); return Reflect.get(target, key); } });
  const value = { title: "Eigene Kopie", dateValue: new Date("2026-09-08"), time: "20:00", venueName: "Test", mapUrl: null, internalNote: "Testnotiz", presentationTemplateId: "standard" };
  const exports: { copyQuiz?: (data: unknown) => Promise<{ success: boolean; quizId: number }> } = {};
  const source = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");
  const start = source.indexOf("export async function copyQuiz(");
  const body = source.slice(start, source.indexOf("export async function ", start + 1));
  runInNewContext(ts.transpileModule(body, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports,
    requireQuizAdmin: async (id: number) => { assert.equal(id, 30); return { session: "authorized" }; },
    prisma: { quiz: { findUnique: async () => original }, $transaction: async (callback: (transaction: typeof tx) => unknown) => callback(strictTx) },
    getPresentationTemplateValidationOptions: async () => ({}), buildQuizCopyMasterData: () => ({}), validateQuizMasterData: () => ({ ok: true, value }),
    addQuestionToQuiz: async (data: Row, session: string, transaction: unknown) => { assert.equal(session, "authorized"); assert.equal(transaction, strictTx); writes.questions.push(data); return { quiz_fragen_id: writes.questions.length + 40 }; },
    revalidatePath: (path: string) => assert.equal(path, "/quiz"),
  });
  assert.equal((await exports.copyQuiz!({ quizId: 30, neuerTitel: value.title, quizDatum: "2026-09-08" })).quizId, 31);
  assert.deepEqual(original, before);
  assert.equal(writes.quiz.length, 1);
  assert.equal(writes.quiz[0].team_anzahl, 0); assert.equal(writes.quiz[0].teilnehmer_anzahl, 0);
  assert.equal(writes.quiz[0].ist_archiviert, false); assert.equal(writes.quiz[0].oeffentliche_url, null);
  assert.equal(writes.quiz[0].titel, value.title); assert.equal(writes.quiz[0].quiz_datum, value.dateValue);
  assert.deepEqual(writes.quiz[0].intro_regeln, before.intro_regeln);
  assert.deepEqual(writes.blocks.map(row => row.titel), ["Block 1", "Block 2"]);
  assert.deepEqual(writes.questions.map(row => row.fragen_id), [101, 102]);
  assert.deepEqual(writes.questions.map(row => row.quiz_abschnitt_id), [21, 22]);
  assert.deepEqual(writes.questions.map(row => row.antwort_reihenfolge), [[3, 1, 2], [3, 1, 2]]);
  assert.equal(writes.flows[1].quiz_fragen_id, 41);
  assert.equal(writes.flows[2].story_bezugs_quiz_fragen_id, 42);
  assert.equal(writes.flows[2].story_element_revision_id, 7);
  assert.equal(writes.flows[2].anker_schluessel, "22");
  assert.ok(Object.values(writes).flat().filter(row => "quiz_id" in row).every(row => row.quiz_id === 31));
});
