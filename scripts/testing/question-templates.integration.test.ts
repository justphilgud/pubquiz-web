import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { PrismaPg } from "@prisma/adapter-pg";
import { build } from "esbuild";
import { Client } from "pg";
import { Prisma, PrismaClient } from "@/app/generated/prisma/client";
import { DEFAULT_PIXEL_TEMPLATE_CONFIG } from "@/app/fragen/editor/pixelTemplateConfig";
import { defaultFacts, factsAnswers } from "@/app/fragen/editor/templates/factsTemplate";
import { pairColumns, type PairsData } from "@/app/fragen/editor/templates/pairsTemplate";
import type { QuestionMediaDraft, SaveQuestionPayload } from "@/app/fragen/editor/types";
import type { AuthorizationActor } from "@/app/roles/roleAssignmentPolicy";

const databaseUrl = process.env.QUESTION_TEMPLATE_TEST_DATABASE_URL;
const imagePath = "dev/question-media/facts_person_solution_image/image/portrait.png";
const imageUrl = `https://test.public.blob.vercel-storage.com/${imagePath}`;

test("real save action creates independent pixel drafts atomically and saves editable pairs", {
  skip: !databaseUrl, timeout: 60_000,
}, async () => {
  const url = new URL(databaseUrl!);
  assert.ok(["127.0.0.1", "localhost"].includes(url.hostname), "Use a local PostgreSQL fixture");
  const name = `question_templates_${process.pid}_${Date.now()}`;
  const control = new Client({ connectionString: url.toString() });
  await control.connect();
  await control.query(`CREATE DATABASE ${name}`);
  url.pathname = `/${name}`;
  const db = new Client({ connectionString: url.toString() });
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString() }) });
  try {
    await db.connect();
    const schema = execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "diff",
      "--from-empty", "--to-schema", "prisma/schema.prisma", "--script"], {
      encoding: "utf8", env: { ...process.env, DATABASE_URL: url.toString() }, maxBuffer: 10_000_000,
    });
    await db.query(schema.slice(schema.indexOf("-- CreateSchema")));
    const migration = readFileSync("prisma/migrations/20261110120000_add_person_and_pairs_question_templates/migration.sql", "utf8");
    await db.query(migration);
    await db.query(migration);
    await db.query(`
      INSERT INTO pubquiz.frage_vorlagen(code, name, slide_typ) VALUES ('pixelbild','Pixelbild','pixel');
      INSERT INTO pubquiz.antworttyp(antworttyp) VALUES ('Standard');
      INSERT INTO pubquiz.medientyp(medientyp) VALUES ('Bild');
      INSERT INTO pubquiz.eventreihen(eventreihe_id, name, slug) VALUES (10, 'Fixture A', 'fixture-a'), (20, 'Fixture B', 'fixture-b');
      INSERT INTO pubquiz.eventarten(kennung,name) VALUES ('QUIZ','Quiz');
      INSERT INTO pubquiz.eventreihe_eventarten(eventreihe_id,eventart,ist_freigeschaltet) VALUES (10,'QUIZ',true), (20,'QUIZ',true);
      INSERT INTO pubquiz.fragenkategorie(fragenkategorie_id,kategorie) VALUES (10,'Fixture');
    `);

    const mocks: Record<string, string> = {
      "server-only": "",
      "next/cache": "export const revalidatePath = () => {};",
      "@/app/lib/permissions": "export const requireQuestionEditor = () => ({user:{id:'1'}}); export const requireSession = requireQuestionEditor;",
      "@/app/generated/prisma/client": "export const Prisma = globalThis.prismaValue;",
      "@/app/services/questionService": "export const getCurrentUserId = (session) => Number(session.user.id);",
      "@/app/lib/prisma": "export const prisma = globalThis.fixture;",
      "@/app/roles/roleAssignments.server": "export const getActorForSession = () => globalThis.actor();",
      "./mediaUploadEnvironment": `export const getMediaVerificationServerConfig = () => ({environmentPrefix:"dev", blobAuthentication:{}}); export const buildMediaUploadPathname = () => ""; export const logMediaUploadFailure = () => {};`,
      "@vercel/blob": `export const head = () => ({url:${JSON.stringify(imageUrl)},pathname:${JSON.stringify(imagePath)},size:300,contentType:"image/png"}); export const copy = () => {throw Error("Unexpected copy")}; export const del = copy; export const put = copy;`,
      "./generators/service": "export const runQuestionGenerator = (id) => globalThis.generate(id);",
    };
    const bundle = await build({
      stdin: {
        contents: `export { saveQuestion } from "./app/fragen/editor/actions";
          export { cloneQuestion } from "./app/fragen/editor/managementActions";
          export { addQuestionToQuiz } from "./app/services/quizService";
          export { saveTeamAnswerDraft, submitTeamAnswer } from "./app/quiz/interaction/interaction.server";`,
        resolveDir: process.cwd(),
      },
      bundle: true, platform: "node", format: "cjs",
      write: false, packages: "external", plugins: [{ name: "fixture-boundaries", setup(api) {
        api.onResolve({ filter: /./ }, ({ path }) => Object.hasOwn(mocks, path) ? { path, namespace: "fixture" } : undefined);
        api.onLoad({ filter: /.*/, namespace: "fixture" }, ({ path }) => ({ contents: mocks[path] }));
      } }],
    });
    let actor: AuthorizationActor = { userId: 1, assignments: [{ role: "EDITOR", scopeType: "EVENT_SERIES", eventSeriesId: 10 }] };
    const runtime = { exports: {} };
    runInNewContext(bundle.outputFiles[0].text, {
      module: runtime, exports: runtime.exports, require: createRequire(import.meta.url),
      fixture: prisma, prismaValue: Prisma, actor: () => actor, console, process, Buffer, URL, setTimeout, clearTimeout,
      generate: async (id: number) => {
        assert.ok(await prisma.fragen.findUnique({ where: { fragen_id: id } }), "generator sees committed child");
        return { ok: true };
      },
    });
    const { saveQuestion, cloneQuestion, addQuestionToQuiz, saveTeamAnswerDraft, submitTeamAnswer } = runtime.exports as
      typeof import("@/app/fragen/editor/actions") &
      typeof import("@/app/fragen/editor/managementActions") &
      typeof import("@/app/services/quizService") &
      typeof import("@/app/quiz/interaction/interaction.server");
    const facts = {
      ...defaultFacts("TEXT"), solution: "Wilhelm Tell", acceptedVariants: ["Tell"],
      facts: [{ id: "a", text: "Apfel" }, { id: "b", text: "Armbrust" }],
    };
    const portrait: QuestionMediaDraft = {
      slotKey: "facts_person_solution_image", mediaType: "IMAGE", operation: "NEW",
      existingMediaId: null, existingMediaCount: 0, url: imageUrl,
    };
    const payload = (text: string, withImage: boolean, createPixelQuestion: boolean): SaveQuestionPayload => ({
      creationRequestId: crypto.randomUUID(), intent: "DRAFT", scope: "EVENT_SERIES", eventSeriesIds: [10],
      questionText: text, questionMedia: withImage ? [portrait] : [],
      answers: factsAnswers(facts, []).map(({ id, ...answer }) => ({ ...answer, clientId: id })),
      categoryIds: [10], sourceOrRemark: "", moderationNotes: "", categoryRequest: "", validUntil: null,
      templateId: "fakten_person", sourceTemplateId: null,
      templateConfig: { ...DEFAULT_PIXEL_TEMPLATE_CONFIG, templateData: { ...facts, createPixelQuestion } },
    });
    const save = async (value: SaveQuestionPayload) => {
      const result = await saveQuestion(value);
      assert.ok(result.success, JSON.stringify(result));
      return result;
    };

    await save(payload("Wer wird gesucht?", false, false));
    assert.equal(await prisma.fragen.count(), 1);
    await save(payload("Welcher Name passt?", true, false));
    assert.equal(await prisma.fragen.count(), 2);
    const missing = await saveQuestion(payload("Kein Bild", false, true));
    assert.ok(!missing.success && missing.validationTarget === "questionMedia", JSON.stringify(missing));
    assert.equal(await prisma.fragen.count(), 2, "missing image rolls back parent too");

    const withPixel = payload("Gesuchte Person", true, true);
    const [first, retry] = await Promise.all([save(withPixel), save(withPixel)]);
    assert.equal(first.questionId, retry.questionId);
    assert.equal(await prisma.fragen.count(), 4);
    const relation = await prisma.fragen_relationen.findFirstOrThrow({ where: { quell_fragen_id: first.questionId } });
    const child = await prisma.fragen.findUniqueOrThrow({
      where: { fragen_id: relation.ziel_fragen_id },
      include: { vorlage: true, medien: true, antwortfelder: { include: { loesungen: true } }, eventreihen: true, fragen_kategorien: true },
    });
    assert.equal(child.vorlage?.code, "pixelbild");
    assert.doesNotMatch(child.frage, /Tell/);
    assert.equal(child.created_by_user_id, 1);
    assert.equal(child.geltungsbereich, "EVENT_SERIES");
    assert.equal(child.eventreihen[0].eventreihe_id, 10);
    assert.equal(child.fragen_kategorien[0].fragenkategorie_id, 10);
    assert.equal(child.medien[0].datei, imageUrl);
    assert.equal(child.medien[0].slot_key, "pixel_original_image");
    assert.deepEqual(child.antwortfelder[0].loesungen.map(({ loesung_text }) => loesung_text).sort(), ["Tell", "Wilhelm Tell"]);
    assert.deepEqual(child.template_config_json, DEFAULT_PIXEL_TEMPLATE_CONFIG);
    assert.equal((await saveQuestion({ ...withPixel, eventSeriesIds: [20] })).success, false);

    const edit = {
      ...withPixel, questionId: first.questionId, questionMedia: first.questionMedia,
      answers: withPixel.answers.map((answer) => ({
        ...answer, answerId: first.answers.find((saved) => saved.clientId === answer.clientId)?.answerId,
      })),
    };
    await save(edit);
    const removed = await saveQuestion({
      ...edit, questionMedia: edit.questionMedia.map((medium) => ({ ...medium, operation: "REMOVE" })),
    });
    assert.ok(!removed.success && removed.validationTarget === "questionMedia", JSON.stringify(removed));
    assert.equal(await prisma.fragen.count(), 4);
    assert.equal(await prisma.medien.count({ where: { fragen_id: first.questionId } }), 1, "failed update rolls back removal");

    actor = { userId: 1, assignments: [{ role: "ADMIN", scopeType: "GLOBAL", eventSeriesId: null }] };
    const pairs: PairsData = { kind: "PAIRS", pairs: Array.from({ length: 7 }, (_, index) => ({
      leftId: crypto.randomUUID(), rightId: crypto.randomUUID(), left: `L ${index}`, right: `R ${index}`,
    })) };
    const pairPayload: SaveQuestionPayload = {
      ...payload("Welche Begriffe gehören zusammen?", false, false), intent: "APPROVE",
      templateId: "paare_bilden", answers: [], templateConfig: { ...DEFAULT_PIXEL_TEMPLATE_CONFIG, templateData: pairs },
    };
    const paired = await save(pairPayload);
    const reversed = { ...pairs, pairs: [...pairs.pairs].reverse() };
    await save({ ...pairPayload, questionId: paired.questionId, templateConfig: { ...pairPayload.templateConfig, templateData: reversed } });
    const stored = await prisma.fragen.findUniqueOrThrow({ where: { fragen_id: paired.questionId } });
    const storedConfig = stored.template_config_json as unknown as SaveQuestionPayload["templateConfig"];
    assert.deepEqual(storedConfig.templateData, reversed);
    assert.deepEqual(pairColumns(reversed), pairColumns(pairs));
    const personClone = await cloneQuestion(first.questionId);
    assert.ok(personClone.ok);
    const clonedPerson = await prisma.fragen.findUniqueOrThrow({ where: { fragen_id: personClone.questionId } });
    const cloneConfig = clonedPerson.template_config_json as unknown as SaveQuestionPayload["templateConfig"];
    assert.ok(!Object.hasOwn(cloneConfig, "factsPersonCreationRequestId"));
    assert.equal(cloneConfig.templateData?.kind === "FACTS" && cloneConfig.templateData.createPixelQuestion, false);
    assert.equal(await prisma.fragen_relationen.count({ where: { quell_fragen_id: personClone.questionId } }), 0);
    const pairClone = await cloneQuestion(paired.questionId);
    assert.ok(pairClone.ok);
    const clonedPairs = await prisma.fragen.findUniqueOrThrow({ where: { fragen_id: pairClone.questionId } });
    assert.deepEqual(clonedPairs.template_config_json, stored.template_config_json);

    const seriesQuiz = await prisma.quiz.create({ data: { eventreihe_id: 10 } });
    const otherQuiz = await prisma.quiz.create({ data: { eventreihe_id: 20 } });
    const session = { user: { id: "1", role: "ADMIN" }, expires: "" };
    const block = await prisma.quiz_abschnitte.create({ data: {
      quiz_id: seriesQuiz.quiz_id, titel: "Fixture block", sortierung: 1, abschnitt_typ: "FRAGEN",
    } });
    const assignment = await addQuestionToQuiz({
      quiz_id: seriesQuiz.quiz_id, fragen_id: paired.questionId, quiz_abschnitt_id: block.quiz_abschnitt_id,
    }, session);
    assert.equal(assignment.punkte_basis.toString(), "1.75");
    await assert.rejects(addQuestionToQuiz({ quiz_id: otherQuiz.quiz_id, fragen_id: paired.questionId }, session), /Eventreihe/);
    const team = await prisma.teams.create({ data: { teamname: "Fixture Team", teamname_normalisiert: "fixture team" } });
    const participant = await prisma.quiz_team_sessions.create({ data: {
      quiz_id: seriesQuiz.quiz_id, team_id: team.team_id, teamname: team.teamname,
    } });
    const openedAt = new Date();
    await prisma.quiz_block_freigaben.create({ data: {
      quiz_id: seriesQuiz.quiz_id, quiz_abschnitt_id: block.quiz_abschnitt_id,
      ist_freigegeben: true, freigegeben_ab: openedAt, aktuelle_quiz_fragen_id: assignment.quiz_fragen_id,
    } });
    const run = await prisma.quiz_interaction_runs.create({ data: {
      quiz_id: seriesQuiz.quiz_id, quiz_fragen_id: assignment.quiz_fragen_id,
      interaction_type: "MATCHING", state: "OPEN", is_current: true, opened_at: openedAt,
      config_snapshot: { interaction: { type: "MATCHING", ...pairColumns(pairs) } },
    } });
    const answerText = JSON.stringify(pairs.pairs.slice(0, 3).map(({ leftId, rightId }) => [leftId, rightId]));
    const participantInput = {
      quizId: seriesQuiz.quiz_id, quizFragenId: assignment.quiz_fragen_id,
      interactionRunId: run.interaction_run_id, quizTeamSessionId: participant.quiz_team_session_id,
    };
    const draftInput = {
      ...participantInput, quizAbschnittId: block.quiz_abschnitt_id,
      expectedDraftRevision: 0, draft: { answerText, selectedAnswerIds: [], structuredAnswers: [] },
    };
    assert.equal((await saveTeamAnswerDraft(draftInput)).success, true);
    assert.equal((await submitTeamAnswer(participantInput)).success, true);
    const evaluated = await prisma.team_antworten.findFirstOrThrow({
      where: { quiz_fragen_id: assignment.quiz_fragen_id, quiz_team_session_id: participant.quiz_team_session_id },
    });
    assert.equal(evaluated.antwort_text, answerText);
    assert.equal(evaluated.auto_basis_punkte?.toString(), "0.75");
    assert.equal(evaluated.bewertungsstatus, "PARTIAL");
    await prisma.quiz_interaction_runs.update({ where: { interaction_run_id: run.interaction_run_id }, data: { state: "CLOSED" } });
    assert.equal((await saveTeamAnswerDraft({ ...draftInput, expectedDraftRevision: evaluated.draft_revision })).success, false);
    assert.equal((await submitTeamAnswer(participantInput)).success, false);
  } finally {
    await prisma.$disconnect();
    await db.end();
    await control.query(`DROP DATABASE ${name} WITH (FORCE)`);
    await control.end();
  }
});
