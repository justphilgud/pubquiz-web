import assert from "node:assert/strict";
import test from "node:test";
import { confirmImport, previewImport } from "@/app/fragen/import/excel/importService";
import type { ImportTarget } from "@/app/fragen/import/excel/format";
import { writeWorkbook } from "@/app/fragen/import/excel/writeWorkbook";
import { loadQuestionForEditor } from "@/app/fragen/editor/questionEditorData";
import { evaluateBaseAnswer } from "@/app/quiz/evaluation/evaluateBaseAnswer";
import { resolveQuizAnswerInteraction } from "@/app/quiz/answerInteraction";
import { pairColumns } from "@/app/fragen/editor/templates/pairsTemplate";
import { fixtureSecret, fixtureWorkbook, openExcelFixture, seriesTarget, testDatabase } from "./excelImportFixture";

test("PostgreSQL import: preview, active categories, authorization, full rollback, concurrent retries and 100 pair questions", {
  skip: !testDatabase, timeout: 120_000,
}, async () => {
  const { db, sql, close } = await openExcelFixture();
  const global = { scope: "GLOBAL", eventSeriesIds: [] } as const;
  try {
    const example = writeWorkbook(true);
    const preview = (file: Buffer, actorId = 1, target: ImportTarget = seriesTarget) => previewImport(db, actorId, target, file, fixtureSecret);
    const confirm = (file: Buffer, token: string, actorId = 1, target: ImportTarget = seriesTarget) => confirmImport(db, actorId, target, file, token, fixtureSecret);
    const before = await db.fragen.create({ data: { frage: "Vorhandene Frage bleibt unverändert" } });
    const invalidCategory = fixtureWorkbook({
      Fragen: [["O", "Offen", "Kategorie", "", "Archivkategorie\nUnbekannt"]],
      Antworten: [["O", "Antwort"]],
    });
    const rejected = await preview(invalidCategory);
    assert.equal(rejected.errors.length, 2);
    assert.ok(rejected.errors.every(error => error.row === 2 && error.field === "Kategorien"));
    assert.equal(await db.fragenkategorie.count(), 3);
    for (const ids of [[20], [30], [10, 20]]) {
      assert.equal((await preview(example, 1, { ...seriesTarget, eventSeriesIds: ids })).token, undefined);
    }
    const globalTarget = { ...global, eventSeriesIds: [] };
    assert.equal((await preview(example, 1, globalTarget)).token, undefined);
    assert.ok((await preview(example, 3, globalTarget)).token);
    assert.equal((await preview(example, 3)).token, undefined);

    const examplePlan = await preview(example);
    assert.ok(examplePlan.token, JSON.stringify(examplePlan.errors));
    assert.equal(examplePlan.questions.length, 6);
    assert.equal(await db.fragen.count(), 1);
    assert.equal(await db.excel_question_import_receipts.count(), 0);
    assert.equal((await confirm(example, examplePlan.token, 2)).ok, false);

    await sql.query("DELETE FROM pubquiz.benutzer_reihenrollen WHERE benutzer_id=1 AND eventreihe_id=10");
    assert.equal((await confirm(example, examplePlan.token)).ok, false);
    await sql.query("INSERT INTO pubquiz.benutzer_reihenrollen(benutzer_id,eventreihe_id,rolle) VALUES (1,10,'EDITOR')");

    await sql.query(`CREATE FUNCTION pubquiz.excel_import_test_fault() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.antwort = 'Eisen' THEN RAISE EXCEPTION 'forced fixture error'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER excel_import_test_fault BEFORE INSERT ON pubquiz.antworten
      FOR EACH ROW EXECUTE FUNCTION pubquiz.excel_import_test_fault()`);
    const rolledBack = await confirm(example, examplePlan.token);
    assert.equal(rolledBack.ok, false);
    assert.equal(!rolledBack.ok && rolledBack.errors[0].row, 3);
    assert.equal(await db.fragen.count(), 1);
    assert.equal(await db.antworten.count(), 0);
    assert.equal(await db.fragen_eventreihen.count(), 0);
    assert.equal(await db.excel_question_import_receipts.count(), 0);
    await sql.query("DROP TRIGGER excel_import_test_fault ON pubquiz.antworten");

    const otherPlan = await preview(example);
    assert.ok(otherPlan.token);
    const [first, second, third] = await Promise.all([
      confirm(example, examplePlan.token), confirm(example, examplePlan.token), confirm(example, otherPlan.token),
    ]);
    assert.ok(first.ok, JSON.stringify(first));
    assert.deepEqual(second, first);
    assert.deepEqual(third, first);
    assert.deepEqual(await confirm(example, examplePlan.token), first);
    assert.equal(await db.fragen.count(), 7);
    assert.equal(await db.excel_question_import_receipts.count(), 1);
    assert.deepEqual(await db.fragen.findUnique({ where: { fragen_id: before.fragen_id } }), before);
    assert.equal((await preview(example)).token, undefined);
    assert.equal((await preview(example, 2)).token, undefined);
    assert.ok((await preview(example, 2, globalTarget)).token, "another target may use the same content");

    const [open, , closed, , , pair] = await Promise.all(first.questions.map(question => loadQuestionForEditor(question.id, db)));
    assert.ok(open && closed && pair);
    assert.deepEqual(open.draft.answers.map(answer => [answer.text, answer.isCorrect]), [
      ["Mount Everest", true], ["Everest", true], ["Sagarmatha", true],
    ]);
    assert.equal(closed.draft.answers.filter(answer => answer.isCorrect).length, 1);
    assert.ok([open, closed, pair].every(record => record.access.reviewStatus === "DRAFT" && !record.access.isApproved));
    assert.equal(await db.antworten.count({ where: { fragen_id: first.questions[5].id } }), 0);
    const pairs = pair.draft.templateConfig.templateData;
    assert.ok(pairs?.kind === "PAIRS");
    assert.deepEqual(pairs.pairs.map(({ left, right }) => [left, right]), [
      ["Länge", "Meter"], ["Masse", "Kilogramm"], ["Zeit", "Sekunde"], ["Stoffmenge", "Mol"],
    ]);
    const interaction = resolveQuizAnswerInteraction({
      templateId: "paare_bilden", originalAnswerMode: "UNCLASSIFIED", effectiveAnswerMode: "UNCLASSIFIED",
      answerOptions: [], answerFields: [], templateData: pairs,
    });
    assert.deepEqual(interaction, { type: "MATCHING", ...pairColumns(pairs) });
    const answerText = JSON.stringify([
      [pairs.pairs[0].leftId, pairs.pairs[0].rightId], [pairs.pairs[1].leftId, pairs.pairs[1].rightId],
      [pairs.pairs[2].leftId, pairs.pairs[3].rightId],
    ]);
    const score = evaluateBaseAnswer({ templateId: "paare_bilden", effectiveAnswerMode: "UNCLASSIFIED",
      answerOptions: [], selectedAnswerIds: [], answerText, structuredFields: [], structuredAnswers: new Map(),
      orderingItems: [], pairs,
    });
    assert.equal(score.basePoints.toString(), "0.5");
    assert.equal(score.maxPoints.toString(), "1");

    const bulkQuestions = Array.from({ length: 100 }, (_, i) => [
      `P-${i}`, "Paare bilden", `Fixture-Zuordnung ${i}`, "", " alltagsphysik ", "", "", "", "2028-01-02", "",
    ]);
    const bulk = fixtureWorkbook({
      Fragen: bulkQuestions,
      Paare: bulkQuestions.flatMap(([key], index) => Array.from({ length: 2 + index % 9 }, (_, i) => [key, `L ${i}`, `R ${i}`])),
    });
    const bulkPlan = await preview(bulk);
    assert.ok(bulkPlan.token);
    assert.equal(bulkPlan.questions.length, 100);
    assert.deepEqual(bulkPlan.questions[0].resolvedCategories, ["Alltagsphysik"]);
    await sql.query("UPDATE pubquiz.fragenkategorie SET status='ARCHIVED' WHERE fragenkategorie_id=10");
    assert.equal((await confirm(bulk, bulkPlan.token)).ok, false);
    await sql.query("UPDATE pubquiz.fragenkategorie SET status='ACTIVE' WHERE fragenkategorie_id=10");
    const bulkResult = await confirm(bulk, bulkPlan.token);
    assert.ok(bulkResult.ok, JSON.stringify(bulkResult));
    assert.equal(bulkResult.questions.length, 100);
    assert.equal(await db.fragen.count(), 107);
    assert.equal(await db.fragen_kategorien.count(), 100);
    assert.equal(await db.medien.count(), 0);
    const stored = await loadQuestionForEditor(bulkResult.questions[8].id, db);
    assert.equal(stored?.draft.validUntil, "2028-01-01");
    const config = stored?.draft.templateConfig.templateData;
    assert.equal(config?.kind === "PAIRS" && config.pairs.length, 10);
    assert.deepEqual(await confirm(bulk, bulkPlan.token), bulkResult);
    assert.equal((await preview(bulk)).token, undefined);
  } finally {
    await close();
  }
});
