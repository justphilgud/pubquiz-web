import assert from "node:assert/strict";
import test from "node:test";
import * as XLSX from "xlsx";
import { headers, parseTarget, type Sheet } from "./format";
import { parseImport, contentFingerprint } from "./parseImport";
import { signPlan, verifyPlan } from "./importPlan";
import { writeWorkbook } from "./writeWorkbook";

function workbook(sheets: Partial<Record<Sheet, unknown[][]>>) {
  const book = XLSX.utils.book_new();
  for (const name of Object.keys(headers) as Sheet[]) {
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([[...headers[name]], ...(sheets[name] ?? [])]), name);
  }
  return XLSX.write(book, { type: "buffer", bookSST: true, compression: true });
}

test("downloaded template and example contain four sheets and two working examples per type", () => {
  const blank = writeWorkbook(false);
  assert.deepEqual(XLSX.read(blank).SheetNames, ["Fragen", "Antworten", "Paare", "Anleitung"]);
  assert.equal(parseImport(blank).errors[0].field, "Fragetext");
  const example = parseImport(writeWorkbook(true));
  assert.deepEqual(example.errors, []);
  assert.deepEqual(example.questions.map(question => question.type), ["Offen", "Offen", "Geschlossen", "Geschlossen", "Paare bilden", "Paare bilden"]);
  assert.deepEqual(example.questions.filter(question => question.type === "Geschlossen").map(question => question.answers.filter(answer => answer.correct).length), [1, 1]);
  assert.deepEqual(example.questions.filter(question => question.type === "Paare bilden").map(question => question.pairs.length), [2, 4]);
});

test("preserves original sparse rows, meaningful numbers and line breaks, and rejects formulas and Excel serials", () => {
  const parsed = parseImport(workbook({
    Fragen: [["O-01", "Offen", "  Grüße\r\nWelt  ", "", "", "", "", "", 46830], [], ["O-02", "Offen", "Test"]],
    Antworten: [["o-01", "007", "", "Zeile 1\r\nZeile 2"], [], ["O-02", { t: "n", f: "1+1", v: 2 }], ["O-01", "= 42"]],
  }));
  assert.deepEqual(parsed.questions.map(question => question.row), [2, 4]);
  assert.equal(parsed.questions[0].text, "Grüße\nWelt");
  assert.deepEqual(parsed.questions[0].answers.map(answer => [answer.text, answer.info]), [["007", "Zeile 1\nZeile 2"], ["= 42", ""]]);
  assert.ok(parsed.errors.some(issue => issue.sheet === "Fragen" && issue.row === 2 && issue.field === "Veraltet ab"));
  assert.ok(parsed.errors.some(issue => issue.sheet === "Antworten" && issue.row === 4 && issue.field === "Antworttext" && issue.message.includes("Formeln")));
});

test("rejects invalid sheet columns, question keys, references, lengths, dates and answer mode", () => {
  const book = XLSX.read(workbook({}));
  book.Sheets.Fragen.K1 = { t: "s", v: "Medien" };
  book.Sheets.Fragen["!ref"] = "A1:K1";
  assert.ok(parseImport(XLSX.write(book, { type: "buffer" })).errors.some(issue => issue.field === "Medien"));
  const { errors } = parseImport(workbook({
    Fragen: [
      ["G1", "Geschlossen", "x".repeat(301), "Mehrfachauswahl", "", "", "", "", "2027-02-29", "2027-02-28"],
      ["g1", "Offen", "Doppelt"],
      ["P1", "Paare bilden", "Zuordnen"],
    ],
    Antworten: [["G1", "A", "Ja"], ["G1", "B", "Ja"], ["P1", "Falsch zugeordnet"], ["FEHLT", "Wert"]],
    Paare: [["P1", "A", ""], ["P1", "Ａ", "X"], ["G1", "Y", "Z"]],
  }));
  for (const [sheet, row, field] of [
    ["Fragen", 2, "Fragetext"], ["Fragen", 2, "Auswahlmodus"], ["Fragen", 2, "Veraltet ab"], ["Fragen", 2, "Prüfen ab"],
    ["Fragen", 3, "Fragekürzel"], ["Antworten", 3, "Richtig"], ["Antworten", 4, "Fragekürzel"], ["Antworten", 5, "Fragekürzel"],
    ["Paare", 2, "Rechts"], ["Paare", 3, "Links"], ["Paare", 4, "Fragekürzel"],
  ]) assert.ok(errors.some(issue => issue.sheet === sheet && issue.row === row && issue.field === field), JSON.stringify([sheet, row, field]));
});

test("keeps complete pairs associated and handles 100 pair questions with 2 to 10 pairs", () => {
  const entries = Array.from({ length: 100 }, (_, index) => [`P-${index}`, "Paare bilden", `Zuordnung ${index}`]);
  const pairs = entries.flatMap(([key], index) => Array.from({ length: 2 + index % 9 }, (_, pair) => [key, `Links ${pair}`, `Rechts ${pair}`]));
  const parsed = parseImport(workbook({ Fragen: entries, Paare: pairs }));
  assert.deepEqual(parsed.errors, []);
  assert.equal(parsed.questions.length, 100);
  assert.equal(parsed.questions[8].pairs.length, 10);
  const first = parsed.questions[0];
  assert.equal(contentFingerprint(first), contentFingerprint({ ...first, pairs: [...first.pairs].reverse() }));
  assert.notEqual(contentFingerprint(first), contentFingerprint({ ...first, pairs: first.pairs.map((pair, index) => ({
    ...pair, right: first.pairs[1 - index].right,
  })) }));
  for (const count of [1, 11]) {
    const bad = parseImport(workbook({ Fragen: [entries[0]], Paare: Array.from({ length: count }, (_, index) => [entries[0][0], `L${index}`, `R${index}`]) }));
    assert.ok(bad.errors.some(issue => issue.message.includes("2 bis 10")));
  }
});

test("validates target and binds confirmation to actor and plan integrity", () => {
  assert.deepEqual(parseTarget("20,10"), { scope: "EVENT_SERIES", eventSeriesIds: [10, 20] });
  for (const invalid of ["", "0", "1,1", "1, 2", "2147483648", "01"]) assert.equal(parseTarget(invalid), null);
  const token = signPlan(42, "a".repeat(64), "fixture-secret");
  assert.equal(verifyPlan(token, 42, "fixture-secret")?.digest, "a".repeat(64));
  assert.equal(verifyPlan(token, 43, "fixture-secret"), null);
  assert.equal(verifyPlan(token, 42, "different-secret"), null);
  assert.throws(() => parseImport(Buffer.from("not xlsx")));
});
